import { App, normalizePath, requestUrl, TFile } from "obsidian";
import { WechatClient } from "./api";

/**
 * 图片处理：定位 → 读取 → 格式/体积规整 → 上传（带缓存）。
 *
 * 为什么不能直接把本地图片放进正文？
 *   公众号正文里的 <img> 只认微信自己的图床（mmbiz.qpic.cn），
 *   外部地址会被过滤或显示“此图片来自微信公众平台未经允许不可引用”。
 *   所以每张图都要先调用 uploadimg 换成微信地址，再替换进 HTML。
 *
 * 接口限制：
 *   - uploadimg（正文图）：仅 jpg/png，≤ 1MB
 *   - add_material（封面 / GIF）：≤ 10MB，支持 gif
 *   超限或格式不支持时，用 canvas 重新编码为 JPEG 并逐步降低质量/尺寸。
 */

export interface LoadedImage {
  data: ArrayBuffer;
  mime: string;
  filename: string;
  /** 缓存键：本地文件 = 路径+修改时间+大小；网络图片 = URL */
  cacheKey: string | null;
}

const MB = 1024 * 1024;

export interface ImageCacheStore {
  get(key: string): string | undefined;
  set(key: string, value: string): Promise<void>;
}

function sniffMime(data: ArrayBuffer, fallbackName: string): string {
  const b = new Uint8Array(data.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  if (/\.svg$/i.test(fallbackName)) return "image/svg+xml";
  return "application/octet-stream";
}

function extOf(mime: string): string {
  return { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" }[mime] ?? "jpg";
}

/** 用 canvas 重新编码成 JPEG，直到体积 ≤ maxBytes */
async function reencodeJpeg(data: ArrayBuffer, mime: string, maxBytes: number): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let w = img.naturalWidth || 1080;
    let h = img.naturalHeight || Math.round(w * 0.75);
    const maxSide = 2560;
    if (Math.max(w, h) > maxSide) {
      const r = maxSide / Math.max(w, h);
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff"; // PNG 透明底转 JPEG 时补白底
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const quality = Math.max(0.5, 0.92 - attempt * 0.08);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob) throw new Error("图片重新编码失败");
      if (blob.size <= maxBytes) return blob.arrayBuffer();
      if (quality <= 0.5) {
        w = Math.round(w * 0.8);
        h = Math.round(h * 0.8);
      }
    }
    throw new Error("图片压缩后仍然过大");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 内容哈希：公式图、电脑上选的封面等没有文件路径的图片，用它去重，避免重复上传 */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 从电脑选择的文件 → LoadedImage */
export async function loadBrowserFile(file: File): Promise<LoadedImage> {
  const data = await file.arrayBuffer();
  return { data, mime: sniffMime(data, file.name), filename: file.name, cacheKey: `sha:${await sha256Hex(data)}` };
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export class ImageResolver {
  constructor(
    private app: App,
    private notePath: string,
    private client: WechatClient,
    private cache: ImageCacheStore,
    private cacheScope: string,
  ) {}

  /** Markdown 里的地址 → vault 中的文件 */
  findLocal(src: string): TFile | null {
    let path = src;
    try {
      path = decodeURIComponent(src);
    } catch {
      /* 保持原样 */
    }
    path = path.replace(/^<|>$/g, "").split(/[?#]/)[0].replace(/^\.\//, "");
    const byLink = this.app.metadataCache.getFirstLinkpathDest(path, this.notePath);
    if (byLink) return byLink;
    // 相对当前笔记所在目录
    const dir = this.notePath.includes("/") ? this.notePath.slice(0, this.notePath.lastIndexOf("/")) : "";
    const parts = (dir ? dir.split("/") : []).concat(path.split("/"));
    const stack: string[] = [];
    parts.forEach((p) => (p === ".." ? stack.pop() : p && p !== "." && stack.push(p)));
    const f = this.app.vault.getAbstractFileByPath(normalizePath(stack.join("/")));
    return f instanceof TFile ? f : null;
  }

  /** 预览用：直接给 Obsidian 本地资源地址，不上传 */
  previewUrl(src: string): string {
    if (/^(https?:|data:|app:)/i.test(src)) return src;
    const f = this.findLocal(src);
    return f ? this.app.vault.getResourcePath(f) : src;
  }

  async load(src: string): Promise<LoadedImage> {
    if (/^data:/i.test(src)) {
      const m = src.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
      if (!m) throw new Error("无法解析 data URI");
      const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const mime = sniffMime(bytes.buffer, /svg/i.test(m[1] ?? "") ? "x.svg" : "");
      return { data: bytes.buffer, mime, filename: `image.${extOf(mime)}`, cacheKey: `sha:${await sha256Hex(bytes.buffer)}` };
    }
    if (/^https?:/i.test(src)) {
      const res = await requestUrl({ url: src, method: "GET", throw: false });
      if (res.status >= 400) throw new Error(`下载失败 HTTP ${res.status}`);
      const name = src.split(/[?#]/)[0].split("/").pop() || "image";
      return { data: res.arrayBuffer, mime: sniffMime(res.arrayBuffer, name), filename: name, cacheKey: src };
    }
    const file = this.findLocal(src);
    if (!file) throw new Error("在库中找不到该图片");
    const data = await this.app.vault.readBinary(file);
    return {
      data,
      mime: sniffMime(data, file.name),
      filename: file.name,
      cacheKey: `${file.path}|${file.stat.mtime}|${file.stat.size}`,
    };
  }

  /** 把图片规整到接口要求的格式与大小 */
  private async normalize(img: LoadedImage, allowGif: boolean, maxBytes: number): Promise<LoadedImage> {
    const ok = img.mime === "image/png" || img.mime === "image/jpeg" || (allowGif && img.mime === "image/gif");
    if (ok && img.data.byteLength <= maxBytes) return img;
    const data = await reencodeJpeg(img.data, img.mime, maxBytes);
    return { ...img, data, mime: "image/jpeg", filename: img.filename.replace(/\.\w+$/, "") + ".jpg" };
  }

  private cached(kind: string, img: LoadedImage): string | undefined {
    return img.cacheKey ? this.cache.get(`${this.cacheScope}|${kind}|${img.cacheKey}`) : undefined;
  }

  private async remember(kind: string, img: LoadedImage, value: string) {
    if (img.cacheKey) await this.cache.set(`${this.cacheScope}|${kind}|${img.cacheKey}`, value);
  }

  /** 正文图片 → 微信图床 URL */
  async uploadForContent(src: string): Promise<string> {
    if (/^https?:\/\/mmbiz\.q(pic|logo)\.cn\//i.test(src)) return src; // 已经是微信图床
    const img = await this.load(src);
    const hit = this.cached("content", img);
    if (hit) return hit;

    let url: string;
    if (img.mime === "image/gif" && img.data.byteLength <= 10 * MB) {
      // uploadimg 不收 GIF；用永久素材接口，保留动图
      url = (await this.client.addImageMaterial(img.data, img.filename, img.mime)).url;
    } else {
      const n = await this.normalize(img, false, MB - 16 * 1024);
      url = await this.client.uploadContentImage(n.data, `${n.filename.replace(/\.\w+$/, "")}.${extOf(n.mime)}`, n.mime);
    }
    await this.remember("content", img, url);
    return url;
  }

  /** 封面 → 永久素材 media_id（src 为地址，或已读入内存的图片，如“从电脑选择”） */
  async uploadCover(src: string | LoadedImage): Promise<{ mediaId: string; reused: boolean }> {
    const img = typeof src === "string" ? await this.load(src) : src;
    const hit = this.cached("cover", img);
    if (hit) return { mediaId: hit, reused: true };
    const n = await this.normalize(img, true, 10 * MB - 64 * 1024);
    const r = await this.client.addImageMaterial(n.data, `${n.filename.replace(/\.\w+$/, "")}.${extOf(n.mime)}`, n.mime);
    await this.remember("cover", img, r.media_id);
    return { mediaId: r.media_id, reused: false };
  }

  /** 未配置 API 时的复制模式：内嵌为 base64（公众号编辑器粘贴时会尝试自动转存） */
  async toDataUri(src: string): Promise<string> {
    if (/^https?:/i.test(src)) return src;
    const img = await this.normalize(await this.load(src), true, 2 * MB);
    return `data:${img.mime};base64,${arrayBufferToBase64(img.data)}`;
  }
}
