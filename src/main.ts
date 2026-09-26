import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { renderForWechat, RenderResult } from "./render";
import { migrateSettings, StylePreset, WechatAccount, WechatSettings, WechatSettingTab } from "./settings";
import { TuneModal } from "./tune";
import { WechatClient, WechatApiError, DraftArticle } from "./wechat/api";
import { ImageResolver, LoadedImage } from "./wechat/images";
import { VIEW_TYPE_WECHAT_PREVIEW, WechatPreviewView } from "./workbench";
import { AccountManagerModal, IpWhitelistModal } from "./accounts";
import { CoverOverride, MetaModal, PublishOverride, ResolvedCover } from "./meta";
import { renderMermaidSvg, svgToPng } from "./rasterize";
import { MP_HOME } from "./links";

interface PluginData {
  settings: WechatSettings;
  /** 图片上传缓存：同一张图不重复上传（按账号 AppID 区分） */
  imageCache: Record<string, string>;
  /** `账号ID|笔记路径` → 草稿 media_id，用于“更新同一篇草稿” */
  drafts: Record<string, string>;
}

export interface ArticleMeta {
  title: string;
  author: string;
  digest: string;
  /** frontmatter 里的 cover */
  cover: string;
  sourceUrl: string;
}

type RenderMode = "preview" | "upload" | "inline";

export type StepId = "render" | "images" | "cover" | "draft" | "copy";
export type StepState = "wait" | "run" | "done" | "error";

/** 发布进度的展示方：预览面板里是步骤列表，命令行触发时是 Notice */
export interface ReporterAction {
  label: string;
  cta?: boolean;
  onClick: () => void;
}

export interface Reporter {
  start(steps: { id: StepId; label: string }[]): void;
  update(id: StepId, state: StepState, detail?: string): void;
  /** actions：完成后给出的下一步按钮（如“去公众号发表”） */
  finish(ok: boolean, message: string, actions?: ReporterAction[]): void;
}

class NoticeReporter implements Reporter {
  private notice = new Notice("", 0);
  private labels = new Map<StepId, string>();
  start(steps: { id: StepId; label: string }[]) {
    steps.forEach((s) => this.labels.set(s.id, s.label));
  }
  update(id: StepId, state: StepState, detail?: string) {
    if (state === "run") this.notice.setMessage(`${this.labels.get(id)}${detail ? `：${detail}` : "…"}`);
  }
  finish(ok: boolean, message: string) {
    this.notice.setMessage(message);
    setTimeout(() => this.notice.hide(), ok ? 6000 : 15000);
  }
}


export default class WechatPublisherPlugin extends Plugin {
  settings!: WechatSettings;
  private data_!: PluginData;
  private busy = false;
  /** 笔记路径 → 本次发布资料覆盖（仅内存） */
  private overrides = new Map<string, PublishOverride>();

  async onload() {
    const saved = ((await this.loadData()) ?? {}) as Partial<PluginData> & Record<string, unknown>;
    // 0.1.x 的 data.json 里设置在 settings 下，且为单账号结构
    this.data_ = {
      settings: migrateSettings(saved.settings as unknown as Record<string, unknown>),
      imageCache: saved.imageCache ?? {},
      drafts: saved.drafts ?? {},
    };
    this.settings = this.data_.settings;

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
    this.addCommand({
      id: "edit-meta",
      name: "编辑本次发布资料（标题/作者/封面）",
      checkCallback: (checking) => this.withActiveFile(checking, (f) => this.openMetaEditor(f)),
    });
    this.addCommand({ id: "manage-accounts", name: "管理公众号账号", callback: () => this.openAccountManager() });
    this.addCommand({ id: "open-mp", name: "打开公众号后台", callback: () => window.open(MP_HOME) });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((i) => i.setTitle("推送到公众号草稿箱").setIcon("send").onClick(() => this.publishDraft(file)));
      }),
    );

    this.addSettingTab(new WechatSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.data_);
  }

  // ------------------------------------------------------------ 账号

  get activeAccount(): WechatAccount | undefined {
    return this.settings.accounts.find((a) => a.id === this.settings.activeAccountId) ?? this.settings.accounts[0];
  }

  async setActiveAccount(id: string) {
    this.settings.activeAccountId = id;
    await this.saveSettings();
    this.refreshPreviews();
  }

  private clientFor(acc: WechatAccount | undefined): WechatClient {
    return new WechatClient(acc?.appId ?? "", acc?.appSecret ?? "");
  }

  openTuneModal() {
    new TuneModal(this.app, this).open();
  }

  async applyPreset(p: StylePreset) {
    this.settings.themeId = p.themeId;
    this.settings.themeColor = p.themeColor;
    this.settings.layout = p.layout;
    this.settings.tune = { ...p.tune };
    await this.saveSettings();
    this.refreshPreviews();
    new Notice(`已套用方案「${p.name}」`);
  }

  openAccountManager(onClose?: () => void) {
    new AccountManagerModal(this.app, this, onClose).open();
  }

  async testConnection(acc: WechatAccount) {
    try {
      await this.clientFor(acc).getToken(true);
      new Notice(`✅ 「${acc.name}」连接成功，AppID / AppSecret / IP 白名单均正常`);
    } catch (e) {
      if (e instanceof WechatApiError && e.blockedIp) {
        new IpWhitelistModal(this.app, e.blockedIp, acc, () => this.testConnection(acc)).open();
      } else {
        new Notice(`❌ ${(e as Error).message}`, 15000);
      }
    }
  }

  // ------------------------------------------------------------ 视图

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
    if (file && file.extension === "md" && leaf.view instanceof WechatPreviewView) leaf.view.setFile(file);
  }

  refreshPreviews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_WECHAT_PREVIEW).forEach((l) => {
      if (l.view instanceof WechatPreviewView) l.view.update();
    });
  }

  // ------------------------------------------------------------ 文章资料 & 封面

  private resolverFor(file: TFile, acc: WechatAccount | undefined): ImageResolver {
    const cache = {
      get: (k: string) => this.data_.imageCache[k],
      set: async (k: string, v: string) => {
        this.data_.imageCache[k] = v;
        await this.saveData(this.data_);
      },
    };
    return new ImageResolver(this.app, file.path, this.clientFor(acc), cache, acc?.appId ?? "");
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
      title: str("title", "标题") || this.leadingH1(file)?.text || file.basename,
      author: str("author", "作者") || this.activeAccount?.author || "",
      digest: str("digest", "summary", "description", "摘要"),
      // 支持 cover: "[[a.png]]" / "![[a.png]]" / a.png / https://...
      cover: str("cover", "banner", "封面").replace(/^!?\[\[([^|\]]+)(\|[^\]]*)?\]\]$/, "$1"),
      sourceUrl: str("source_url", "original_url", "原文链接"),
    };
  }

  /**
   * 笔记开头的一级标题（frontmatter 之后的第一个块）。公众号的文章标题是单独显示的，
   * 所以这行会作为标题使用，并从正文里去掉，避免标题出现两次。
   */
  leadingH1(file: TFile): { text: string; line: number } | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const first = cache?.sections?.find((sec) => sec.type !== "yaml");
    const h = cache?.headings?.[0];
    if (first?.type === "heading" && h && h.level === 1 && h.position.start.line === first.position.start.line) {
      return { text: h.heading.trim(), line: h.position.start.line };
    }
    return null;
  }

  getOverride(file: TFile): PublishOverride {
    return this.overrides.get(file.path) ?? {};
  }

  /** 叠加“本次发布资料”后的最终标题/作者/摘要 */
  effectiveMeta(file: TFile): ArticleMeta {
    const meta = this.readMeta(file);
    const o = this.getOverride(file);
    return {
      ...meta,
      title: o.title?.trim() || meta.title,
      author: o.author?.trim() || meta.author,
      digest: o.digest?.trim() || meta.digest,
    };
  }

  coverPreview(file: TFile, c: CoverOverride): string | null {
    if (c.kind === "file") return c.previewUrl;
    const path = c.kind === "vault" ? c.path : this.activeAccount?.defaultCover;
    return path ? this.resolverFor(file, this.activeAccount).previewUrl(path) : null;
  }

  /** 封面优先级：手动选择 > 笔记 cover 属性 > 账号默认封面 > 正文第一张图 */
  resolveCover(file: TFile, images: string[], withOverride = true): ResolvedCover {
    const resolver = this.resolverFor(file, this.activeAccount);
    const preview = (src: string) => resolver.previewUrl(src);
    const o = withOverride ? this.getOverride(file).cover : undefined;
    const accCover = this.activeAccount?.defaultCover;
    if (o?.kind === "file") return { source: o.image, label: "手动选择", previewUrl: o.previewUrl };
    if (o?.kind === "vault") return { source: o.path, label: "手动选择", previewUrl: preview(o.path) };
    if (o?.kind === "account" && accCover) return { source: accCover, label: "账号默认", previewUrl: preview(accCover) };
    const fmCover = this.readMeta(file).cover;
    if (fmCover) return { source: fmCover, label: "笔记属性", previewUrl: preview(fmCover) };
    if (accCover) return { source: accCover, label: "账号默认", previewUrl: preview(accCover) };
    if (images[0]) return { source: images[0], label: "正文首图", previewUrl: preview(images[0]) };
    return { source: null, label: "未设置", previewUrl: null };
  }

  /** 直接在预览卡片上设置/清除本次发布的封面（不写回笔记） */
  setCoverOverride(file: TFile, cover: CoverOverride | undefined) {
    const o = { ...this.getOverride(file), cover };
    if (!o.title && !o.author && !o.digest && !o.cover) this.overrides.delete(file.path);
    else this.overrides.set(file.path, o);
    this.refreshPreviews();
  }

  /** 正文字数（去掉 Markdown 标记、代码块与 frontmatter，中英文都按字计） */
  async wordCount(file: TFile): Promise<number> {
    const text = (await this.app.vault.cachedRead(file))
      .replace(/^---[\s\S]*?\n---/, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/!?\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/[#>*_`~=\-|[\]()!]/g, "");
    const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
    const words = (text.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
    return cjk + words;
  }

  /** 发布前检查：在点击发布之前就把会失败的问题摆出来 */
  preflight(file: TFile, result: RenderResult): string[] {
    const issues: string[] = [];
    const acc = this.activeAccount;
    if (!acc || !acc.appId || !acc.appSecret) issues.push("未配置公众号账号（发布草稿需要，复制排版不需要）");
    const meta = this.effectiveMeta(file);
    if (meta.title.length > 64) issues.push(`标题 ${meta.title.length} 字，超过 64 字会被截断`);
    if (meta.digest.length > 120) issues.push(`摘要 ${meta.digest.length} 字，超过 120 字会被截断`);
    if (!this.resolveCover(file, result.images).source) issues.push("没有封面：点上方稿件资料选择，或在正文放一张图");
    return issues;
  }

  async openMetaEditor(file: TFile) {
    const { result } = await this.renderFile(file, "preview");
    const meta = this.readMeta(file);
    const accCover = this.activeAccount?.defaultCover;
    new MetaModal(
      this.app,
      this.getOverride(file),
      {
        title: meta.title,
        author: meta.author,
        digest: meta.digest,
        cover: this.resolveCover(file, result.images),
        autoCover: this.resolveCover(file, result.images, false),
        accountCover: accCover
          ? { source: accCover, label: "账号默认", previewUrl: this.coverPreview(file, { kind: "account" }) }
          : null,
      },
      (c) => this.coverPreview(file, c),
      (o) => {
        const empty = !o.title && !o.author && !o.digest && !o.cover;
        if (empty) this.overrides.delete(file.path);
        else this.overrides.set(file.path, o);
        this.refreshPreviews();
      },
    ).open();
  }

  // ------------------------------------------------------------ 渲染

  /**
   * mode:
   *   preview —— 图片用本地资源地址（不联网）
   *   upload  —— 图片上传到微信图床（推送草稿、或已配置账号时的复制）
   *   inline  —— 图片内嵌 base64（未配置账号时的复制兜底）
   */
  async renderFile(
    file: TFile,
    mode: RenderMode,
    onImage?: (done: number) => void,
  ): Promise<{ result: RenderResult; meta: ArticleMeta; resolver: ImageResolver }> {
    let source = await this.app.vault.cachedRead(file);
    const h1 = this.leadingH1(file);
    const fmTitle = this.readMeta(file).title;
    if (h1 && fmTitle === h1.text) {
      const lines = source.split("\n");
      lines.splice(h1.line, 1);
      source = lines.join("\n");
    }
    const resolver = this.resolverFor(file, this.activeAccount);
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
    // 与 Obsidian 的「严格换行」设置保持一致：默认单个换行就是换行
    const strict = (this.app.vault as unknown as { getConfig?(k: string): unknown }).getConfig?.("strictLineBreaks") === true;
    const result = await renderForWechat(source, {
      themeId: s.themeId,
      themeColor: s.themeColor,
      layout: s.layout,
      tune: s.tune,
      breaks: !strict,
      linkToFootnote: s.linkToFootnote,
      resolveImage,
      rasterize: svgToPng,
      renderMermaid: renderMermaidSvg,
    });
    return { result, meta: this.effectiveMeta(file), resolver };
  }

  // ------------------------------------------------------------ 动作

  private async run(
    reporter: Reporter,
    fn: () => Promise<string | { message: string; actions: ReporterAction[] }>,
    onError?: (e: unknown) => boolean,
  ) {
    if (this.busy) {
      new Notice("上一个任务还在进行中…");
      return;
    }
    this.busy = true;
    try {
      const r = await fn();
      if (typeof r === "string") reporter.finish(true, r);
      else reporter.finish(true, r.message, r.actions);
    } catch (e) {
      console.error("[wechat-mp-publisher]", e);
      const handled = onError?.(e) ?? false;
      reporter.finish(false, handled ? "已暂停：请按弹窗提示处理后重试" : `❌ ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  async publishDraft(file: TFile, reporter: Reporter = new NoticeReporter()) {
    const acc = this.activeAccount;
    reporter.start([
      { id: "render", label: "排版" },
      { id: "images", label: "上传正文图片" },
      { id: "cover", label: "封面" },
      { id: "draft", label: "写入草稿箱" },
    ]);
    let current: StepId = "render";
    const step = (id: StepId, detail?: string) => {
      if (current !== id) reporter.update(current, "done");
      current = id;
      reporter.update(id, "run", detail);
    };

    await this.run(
      reporter,
      async () => {
        if (!acc || !acc.appId || !acc.appSecret) {
          throw new Error("还没有配置公众号账号：点击顶部「发布到」或设置里的「管理账号」添加 AppID 和 AppSecret");
        }
        step("render");
        let total = 0;
        const { result, meta, resolver } = await this.renderFile(file, "upload", (n) => {
          if (n === 1) step("images");
          total = n;
          reporter.update("images", "run", `${n} 张`);
        });
        if (result.warnings.length) throw new Error(result.warnings.join("\n"));
        if (current === "render") reporter.update("images", "done", "无图片");
        else reporter.update("images", "done", `${total} 张`);

        step("cover");
        const cover = this.resolveCover(file, result.images);
        if (!cover.source) {
          throw new Error("公众号草稿必须有封面：点顶部的稿件资料选择封面，或在笔记写 cover 属性，或给账号设置默认封面");
        }
        const { mediaId, reused } = await resolver.uploadCover(cover.source as string | LoadedImage);
        reporter.update("cover", "done", `${cover.label} · ${reused ? "复用历史封面" : "已上传新封面"}`);

        step("draft");
        const article: DraftArticle = {
          title: meta.title.slice(0, 64),
          author: meta.author.slice(0, 16) || undefined,
          digest: meta.digest.slice(0, 120) || undefined,
          content: result.html,
          content_source_url: meta.sourceUrl || undefined,
          thumb_media_id: mediaId,
          need_open_comment: this.settings.openComment ? 1 : 0,
          only_fans_can_comment: 0,
        };
        const client = this.clientFor(acc);
        const key = `${acc.id}|${file.path}`;
        const existing = this.settings.updateExistingDraft ? this.data_.drafts[key] : undefined;
        let updated = false;
        if (existing) {
          try {
            await client.updateDraft(existing, article);
            updated = true;
          } catch (e) {
            // 草稿已在后台被删除/发表 → 新建；其它错误照常抛出
            if (!(e instanceof WechatApiError) || e.blockedIp) throw e;
          }
        }
        if (!updated) {
          this.data_.drafts[key] = await client.addDraft(article);
          await this.saveData(this.data_);
        }
        reporter.update("draft", "done", updated ? "已更新原草稿" : "已新建草稿");
        if (this.settings.openBrowserAfterPublish) window.open(MP_HOME);
        return {
          message:
            `✅ 「${article.title}」已${updated ? "更新到" : "放入"}草稿箱，图片和封面都已就绪。\n` +
            `下一步：公众号后台 →「内容与互动 → 草稿箱」→ 找到这篇 →「发表」。`,
          actions: [{ label: "去公众号发表", cta: true, onClick: () => window.open(MP_HOME) }],
        };
      },
      (e) => {
        reporter.update(current, "error");
        if (e instanceof WechatApiError && e.blockedIp) {
          new IpWhitelistModal(this.app, e.blockedIp, acc, () => this.publishDraft(file, reporter)).open();
          return true;
        }
        return false;
      },
    );
  }

  async copyToClipboard(file: TFile, reporter: Reporter = new NoticeReporter()) {
    const acc = this.activeAccount;
    const configured = !!(acc?.appId && acc?.appSecret);
    reporter.start([
      { id: "render", label: configured ? "排版并上传图片" : "排版" },
      { id: "copy", label: "复制到剪贴板" },
    ]);
    await this.run(
      reporter,
      async () => {
        reporter.update("render", "run");
        const mode: RenderMode = configured ? "upload" : "inline";
        const { result } = await this.renderFile(file, mode, (n) => reporter.update("render", "run", `图片 ${n}`));
        reporter.update("render", "done");
        reporter.update("copy", "run");
        const html = result.html;
        const plain = new DOMParser().parseFromString(html, "text/html").body.innerText;
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        reporter.update("copy", "done");
        if (result.warnings.length) new Notice(result.warnings.join("\n"), 15000);
        const tip =
          mode === "inline" && result.images.length
            ? "（未配置账号：图片为内嵌方式，个别图片可能需要在编辑器里重新上传）"
            : "";
        return {
          message: `✅ 已复制，到公众号编辑器正文里粘贴即可${tip}`,
          actions: [{ label: "打开公众号后台", onClick: () => window.open(MP_HOME) }],
        };
      },
      (e) => {
        reporter.update("render", "error");
        if (e instanceof WechatApiError && e.blockedIp) {
          new IpWhitelistModal(this.app, e.blockedIp, acc, () => this.copyToClipboard(file, reporter)).open();
          return true;
        }
        return false;
      },
    );
  }
}
