import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { renderForWechat, RenderResult } from "./render";
import { DEFAULT_SETTINGS, WechatSettings, WechatSettingTab } from "./settings";
import { WechatClient, WechatApiError, DraftArticle } from "./wechat/api";
import { ImageResolver } from "./wechat/images";
import { VIEW_TYPE_WECHAT_PREVIEW, WechatPreviewView } from "./preview";

interface PluginData {
  settings: WechatSettings;
  /** 图片上传缓存：同一张图不重复上传 */
  imageCache: Record<string, string>;
  /** 笔记路径 → 草稿 media_id，用于“更新同一篇草稿” */
  drafts: Record<string, string>;
}

export interface ArticleMeta {
  title: string;
  author: string;
  digest: string;
  cover: string;
  sourceUrl: string;
}

type RenderMode = "preview" | "upload" | "inline";

const MP_HOME = "https://mp.weixin.qq.com/";

export default class WechatPublisherPlugin extends Plugin {
  settings!: WechatSettings;
  private data_!: PluginData;
  private client!: WechatClient;
  private busy = false;

  async onload() {
    const saved = ((await this.loadData()) ?? {}) as Partial<PluginData>;
    this.data_ = {
      settings: Object.assign({}, DEFAULT_SETTINGS, saved.settings),
      imageCache: saved.imageCache ?? {},
      drafts: saved.drafts ?? {},
    };
    this.settings = this.data_.settings;
    this.client = new WechatClient(this.settings.appId, this.settings.appSecret);

    this.registerView(VIEW_TYPE_WECHAT_PREVIEW, (leaf) => new WechatPreviewView(leaf, this));
    this.addRibbonIcon("send", "公众号预览 / 发布", () => this.openPreview());

    this.addCommand({ id: "open-preview", name: "打开公众号预览", callback: () => this.openPreview() });
    this.addCommand({
      id: "publish-draft",
      name: "推送当前笔记到公众号草稿箱",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.publishDraft(f)),
    });
    this.addCommand({
      id: "copy-html",
      name: "复制公众号格式（到编辑器粘贴）",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.copyToClipboard(f)),
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((i) => i.setTitle("推送到公众号草稿箱").setIcon("send").onClick(() => this.publishDraft(file)));
      }),
    );

    this.addSettingTab(new WechatSettingTab(this.app, this));
  }

  async saveSettings() {
    this.client = new WechatClient(this.settings.appId, this.settings.appSecret);
    await this.saveData(this.data_);
  }

  private withActiveFile(checking: boolean, fn: (f: TFile) => void): boolean {
    const file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") return false;
    if (!checking) fn(file);
    return true;
  }

  async openPreview() {
    const file = this.app.workspace.getActiveFile();
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_WECHAT_PREVIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE_WECHAT_PREVIEW, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    if (file && leaf.view instanceof WechatPreviewView) leaf.view.setFile(file);
  }

  refreshPreviews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_WECHAT_PREVIEW).forEach((l) => {
      if (l.view instanceof WechatPreviewView) l.view.update();
    });
  }

  // ------------------------------------------------------------ 渲染

  private resolverFor(file: TFile): ImageResolver {
    const cache = {
      get: (k: string) => this.data_.imageCache[k],
      set: async (k: string, v: string) => {
        this.data_.imageCache[k] = v;
        await this.saveData(this.data_);
      },
    };
    return new ImageResolver(this.app, file.path, this.client, cache, this.settings.appId);
  }

  readMeta(file: TFile): ArticleMeta {
    const fm = (this.app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    const str = (...keys: string[]) => {
      for (const k of keys) {
        const v = fm[k];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
      }
      return "";
    };
    return {
      title: str("title", "标题") || file.basename,
      author: str("author", "作者") || this.settings.defaultAuthor,
      digest: str("digest", "summary", "description", "摘要"),
      // 支持 cover: "[[a.png]]" / "![[a.png]]" / a.png / https://...
      cover: str("cover", "banner", "封面").replace(/^!?\[\[([^|\]]+)(\|[^\]]*)?\]\]$/, "$1"),
      sourceUrl: str("source_url", "original_url", "原文链接"),
    };
  }

  /**
   * mode:
   *   preview —— 图片用本地资源地址（不联网）
   *   upload  —— 图片上传到微信图床（推送草稿、或已配置 API 时的复制）
   *   inline  —— 图片内嵌 base64（未配置 API 时的复制兜底）
   */
  async renderFile(
    file: TFile,
    mode: RenderMode,
    onImage?: (done: number) => void,
  ): Promise<{ result: RenderResult; meta: ArticleMeta; resolver: ImageResolver }> {
    const source = await this.app.vault.cachedRead(file);
    const resolver = this.resolverFor(file);
    let done = 0;
    const resolveImage = async (src: string) => {
      const url =
        mode === "preview"
          ? resolver.previewUrl(src)
          : mode === "upload"
            ? await resolver.uploadForContent(src)
            : await resolver.toDataUri(src);
      onImage?.(++done);
      return url;
    };
    const s = this.settings;
    const result = await renderForWechat(source, {
      themeId: s.themeId,
      themeColor: s.themeColor,
      fontSize: s.fontSize,
      codeTheme: s.codeTheme,
      macCodeBlock: s.macCodeBlock,
      linkToFootnote: s.linkToFootnote,
      imageCaption: s.imageCaption,
      resolveImage,
    });
    return { result, meta: this.readMeta(file), resolver };
  }

  // ------------------------------------------------------------ 动作

  async testConnection() {
    try {
      await this.client.getToken(true);
      new Notice("✅ 连接成功，AppID / AppSecret / IP 白名单均正常");
    } catch (e) {
      new Notice(`❌ ${(e as Error).message}`, 15000);
    }
  }

  private async guard(label: string, fn: (notice: Notice) => Promise<void>) {
    if (this.busy) {
      new Notice("上一个任务还在进行中…");
      return;
    }
    this.busy = true;
    const notice = new Notice(`${label}…`, 0);
    try {
      await fn(notice);
    } catch (e) {
      console.error("[wechat-publisher]", e);
      notice.hide();
      new Notice(`❌ ${label}失败：${(e as Error).message}`, 20000);
      return;
    } finally {
      this.busy = false;
    }
    setTimeout(() => notice.hide(), 6000);
  }

  async publishDraft(file: TFile) {
    await this.guard("推送到公众号草稿箱", async (notice) => {
      if (!this.client.configured) throw new Error("请先在插件设置中填写 AppID 和 AppSecret");

      const { result, meta, resolver } = await this.renderFile(file, "upload", (n) =>
        notice.setMessage(`正在上传正文图片 ${n}…`),
      );
      if (result.warnings.length) throw new Error(result.warnings.join("\n"));

      notice.setMessage("正在上传封面…");
      const coverSrc = meta.cover || result.images[0] || this.settings.defaultCover;
      if (!coverSrc) {
        throw new Error("公众号草稿必须有封面：请在 frontmatter 写 cover: 图片路径，或在正文放一张图，或在设置里指定默认封面");
      }
      const thumbId = await resolver.uploadCover(coverSrc);

      const article: DraftArticle = {
        title: meta.title.slice(0, 64),
        author: meta.author.slice(0, 16) || undefined,
        digest: meta.digest.slice(0, 120) || undefined,
        content: result.html,
        content_source_url: meta.sourceUrl || undefined,
        thumb_media_id: thumbId,
        need_open_comment: this.settings.openComment ? 1 : 0,
        only_fans_can_comment: 0,
      };

      notice.setMessage("正在写入草稿箱…");
      const existing = this.settings.updateExistingDraft ? this.data_.drafts[file.path] : undefined;
      let updated = false;
      if (existing) {
        try {
          await this.client.updateDraft(existing, article);
          updated = true;
        } catch (e) {
          // 草稿已在后台被删除/发表 → 新建
          if (!(e instanceof WechatApiError)) throw e;
        }
      }
      if (!updated) {
        this.data_.drafts[file.path] = await this.client.addDraft(article);
        await this.saveData(this.data_);
      }

      notice.setMessage(`✅ 已${updated ? "更新" : "新建"}草稿「${article.title}」，请到公众号后台「内容与互动 → 草稿箱」查看`);
      if (this.settings.openBrowserAfterPublish) window.open(MP_HOME);
    });
  }

  async copyToClipboard(file: TFile) {
    await this.guard("复制公众号格式", async (notice) => {
      const mode: RenderMode = this.client.configured ? "upload" : "inline";
      const { result } = await this.renderFile(file, mode, (n) => notice.setMessage(`正在处理图片 ${n}…`));
      const html = result.html;
      const plain = new DOMParser().parseFromString(html, "text/html").body.innerText;
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      const tip =
        mode === "inline" && result.images.length
          ? "（未配置公众号 API，图片以内嵌方式复制，个别图片可能需要在编辑器里重新上传）"
          : "";
      notice.setMessage(`✅ 已复制，打开公众号编辑器直接粘贴即可${tip}`);
      if (result.warnings.length) new Notice(result.warnings.join("\n"), 15000);
      if (this.settings.openBrowserAfterPublish) window.open(MP_HOME);
    });
  }
}
