import { requestUrl } from "obsidian";

/**
 * 微信公众号服务端 API 的最小封装。
 *
 * 用到的接口：
 *   POST /cgi-bin/stable_token           获取 access_token（稳定版，不会让其它地方的 token 失效）
 *   POST /cgi-bin/media/uploadimg        上传「正文图片」→ 返回 mmbiz.qpic.cn 地址（jpg/png，≤1MB，不占素材库）
 *   POST /cgi-bin/material/add_material  上传「永久图片素材」→ 返回 media_id + url（封面必须用它；也用来传 GIF）
 *   POST /cgi-bin/draft/add              新建草稿
 *   POST /cgi-bin/draft/update           更新已有草稿
 *
 * 所有请求都走 Obsidian 的 requestUrl：它由 Electron 主进程发出，不受浏览器 CORS 限制。
 */

const BASE = "https://api.weixin.qq.com/cgi-bin";

export interface DraftArticle {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  content_source_url?: string;
  thumb_media_id: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
}

export class WechatApiError extends Error {
  constructor(public errcode: number, public errmsg: string, public api: string) {
    super(explain(errcode, errmsg, api));
  }
}

function explain(code: number, msg: string, api: string): string {
  const hint: Record<number, string> = {
    40164: "当前电脑的公网 IP 不在白名单中。请到「公众号后台 → 设置与开发 → 开发接口管理 → 基本配置 → IP 白名单」添加错误信息里的 IP。",
    40125: "AppSecret 不正确，请到公众号后台重新获取并填入插件设置。",
    40013: "AppID 不正确。",
    41004: "未填写 AppSecret。",
    48001: "该公众号没有此接口的权限（请在公众号后台「接口权限」中确认草稿箱/素材管理权限）。",
    45009: "今日接口调用次数已达上限。",
    40007: "media_id 无效（草稿可能已被删除）。",
    45166: "正文内容不合法（可能包含公众号不支持的标签或外链）。",
    45002: "正文太长（需少于 2 万字符、小于 1MB）。",
    40005: "图片格式不受支持。",
    40009: "图片太大。",
    53404: "账号已被限制带货能力/或内容违规，请到后台查看。",
  };
  return `[${api}] 错误 ${code}：${hint[code] ?? ""} 原始信息：${msg}`;
}

interface MultipartFile {
  field: string;
  filename: string;
  mime: string;
  data: ArrayBuffer;
}

/** 手动拼 multipart/form-data 请求体（requestUrl 不支持 FormData） */
function buildMultipart(file: MultipartFile): { body: ArrayBuffer; contentType: string } {
  const boundary = "----ObsidianWechat" + Math.random().toString(16).slice(2);
  // 文件名只保留 ASCII，中文/空格文件名在 multipart 头里容易被微信接口判为非法
  const ext = (file.filename.match(/\.(\w+)$/)?.[1] ?? "jpg").toLowerCase();
  const safeName = (file.filename.replace(/\.\w+$/, "").replace(/[^\w-]/g, "") || `img${Date.now()}`) + "." + ext;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.field}"; filename="${safeName}"\r\n` +
      `Content-Type: ${file.mime}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + file.data.byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(file.data), head.length);
  body.set(tail, head.length + file.data.byteLength);
  return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

export class WechatClient {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private appId: string, private appSecret: string) {}

  get configured(): boolean {
    return !!(this.appId && this.appSecret);
  }

  async getToken(force = false): Promise<string> {
    if (!this.configured) throw new Error("请先在插件设置里填写公众号 AppID 和 AppSecret。");
    if (!force && this.token && Date.now() < this.token.expiresAt) return this.token.value;
    const res = await requestUrl({
      url: `${BASE}/stable_token`,
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: this.appId,
        secret: this.appSecret,
        force_refresh: force,
      }),
      throw: false,
    });
    const json = res.json;
    if (!json?.access_token) throw new WechatApiError(json?.errcode ?? res.status, json?.errmsg ?? res.text, "获取 access_token");
    this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 300) * 1000 };
    return this.token.value;
  }

  /** 统一处理 token 过期重试和 errcode 判断 */
  private async call<T>(api: string, send: (token: string) => Promise<{ json: any; status: number; text: string }>): Promise<T> {
    let res = await send(await this.getToken());
    if (res.json?.errcode === 40001 || res.json?.errcode === 42001) {
      res = await send(await this.getToken(true));
    }
    const json = res.json;
    if (!json || (json.errcode && json.errcode !== 0)) {
      throw new WechatApiError(json?.errcode ?? res.status, json?.errmsg ?? res.text, api);
    }
    return json as T;
  }

  private postJson<T>(api: string, path: string, payload: unknown): Promise<T> {
    return this.call<T>(api, (token) =>
      requestUrl({
        url: `${BASE}${path}?access_token=${token}`,
        method: "POST",
        contentType: "application/json",
        // 微信要求中文原样传输；JSON.stringify 不会转义非 ASCII，正好满足
        body: JSON.stringify(payload),
        throw: false,
      }),
    );
  }

  private postFile<T>(api: string, path: string, file: MultipartFile): Promise<T> {
    const { body, contentType } = buildMultipart(file);
    return this.call<T>(api, (token) =>
      requestUrl({
        url: `${BASE}${path}${path.includes("?") ? "&" : "?"}access_token=${token}`,
        method: "POST",
        contentType,
        body,
        throw: false,
      }),
    );
  }

  /** 正文图片：返回可直接用于 <img src> 的 URL */
  async uploadContentImage(data: ArrayBuffer, filename: string, mime: string): Promise<string> {
    const r = await this.postFile<{ url: string }>("上传正文图片", "/media/uploadimg", { field: "media", filename, mime, data });
    return r.url;
  }

  /** 永久图片素材：返回 media_id（封面用）和 url */
  async addImageMaterial(data: ArrayBuffer, filename: string, mime: string): Promise<{ media_id: string; url: string }> {
    return this.postFile("上传图片素材", "/material/add_material?type=image", { field: "media", filename, mime, data });
  }

  async addDraft(article: DraftArticle): Promise<string> {
    const r = await this.postJson<{ media_id: string }>("新建草稿", "/draft/add", { articles: [article] });
    return r.media_id;
  }

  async updateDraft(mediaId: string, article: DraftArticle): Promise<void> {
    await this.postJson("更新草稿", "/draft/update", { media_id: mediaId, index: 0, articles: article });
  }
}
