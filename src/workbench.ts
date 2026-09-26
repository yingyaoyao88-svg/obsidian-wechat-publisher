import { debounce, ItemView, MarkdownView, Menu, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type WechatPublisherPlugin from "./main";
import type { Reporter, StepId, StepState } from "./main";
import { HELP_URL, MP_HOME } from "./links";
import { PROFILES, resolveProfile, THEMES } from "./render";
import type { LayoutId } from "./render";

export const VIEW_TYPE_WECHAT_PREVIEW = "wechat-mp-publisher-preview";


/**
 * 预览工作台。
 *
 *   ┌ 上层 ─────────────────────────────────────┐
 *   │ [封面] 标题 / 作者 / 封面来源      发布到：主号 ▾ │  ← 点击编辑本次发布资料
 *   ├ 下层 ─────────────────────────────────────┤
 *   │ [格式 ▾] [复制排版] [发布草稿]            [⋯] │
 *   └──────────────────────────────────────────┘
 *     发布进度（步骤列表）/ 状态行
 *     手机宽度的文章预览（Shadow DOM，与发布内容是同一份 HTML）
 *
 * “所见即所发”：预览和发布调用同一个渲染函数，只是图片地址不同（本地资源 vs 微信图床）。
 */
export class WechatPreviewView extends ItemView {
  private file: TFile | null = null;
  private renderSeq = 0;

  private headerEl!: HTMLElement;
  private toolbarEl!: HTMLElement;
  private showBarEl!: HTMLElement;
  private formatPanel: HTMLElement | null = null;
  private progressEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private phoneEl!: HTMLElement;
  private shadow!: ShadowRoot;

  private syncCleanup: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: WechatPublisherPlugin) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_WECHAT_PREVIEW;
  }
  getDisplayText() {
    return "公众号预览";
  }
  getIcon() {
    return "send";
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("wxp-view");

    this.showBarEl = root.createDiv({ cls: "wxp-showbar", text: "⌄ 显示工具栏" });
    this.showBarEl.onclick = () => this.setToolbarHidden(false);

    this.headerEl = root.createDiv({ cls: "wxp-header" });
    this.toolbarEl = root.createDiv({ cls: "wxp-toolbar" });
    this.buildToolbar();
    this.progressEl = root.createDiv({ cls: "wxp-progress" });
    this.statusEl = root.createDiv({ cls: "wxp-status" });
    this.phoneEl = root.createDiv({ cls: "wxp-phone" });
    const stage = this.phoneEl.createDiv({ cls: "wxp-stage" });
    this.shadow = stage.attachShadow({ mode: "open" });
    this.applyToolbarHidden();

    this.registerEvent(
      this.app.workspace.on("file-open", (f) => {
        if (f && f.extension === "md" && f !== this.file) {
          this.file = f;
          this.update();
        }
      }),
    );
    // 切换编辑器面板时重新挂载滚动同步
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.attachScrollSync()));
    const onModify = debounce((f: TFile) => f === this.file && this.update(), 600, true);
    this.registerEvent(this.app.vault.on("modify", (f) => f instanceof TFile && onModify(f)));
    this.registerEvent(this.app.metadataCache.on("changed", (f) => f === this.file && onModify(f)));
    this.registerDomEvent(document, "click", (e) => {
      if (this.formatPanel && !this.formatPanel.contains(e.target as Node) && !(e.target as HTMLElement).closest(".wxp-format-btn")) {
        this.closeFormatPanel();
      }
    });
    this.registerDomEvent(document, "keydown", (e) => {
      if (e.key === "Escape") this.closeFormatPanel();
    });

    const active = this.app.workspace.getActiveFile();
    this.file = active && active.extension === "md" ? active : null;
    await this.update();
  }

  async onClose() {
    this.syncCleanup?.();
  }

  setFile(file: TFile) {
    this.file = file;
    this.update();
  }

  // ------------------------------------------------------------ 工具栏

  private buildToolbar() {
    const bar = this.toolbarEl;
    bar.empty();
    const btn = (text: string, icon: string, cls = "") => {
      const b = bar.createEl("button", { cls: `wxp-btn ${cls}` });
      setIcon(b.createSpan({ cls: "wxp-btn-icon" }), icon);
      b.createSpan({ text });
      return b;
    };
    const fmt = btn("格式", "palette", "wxp-format-btn");
    fmt.onclick = () => (this.formatPanel ? this.closeFormatPanel() : this.openFormatPanel());

    const copy = btn("复制排版", "copy");
    copy.title = "复制微信兼容的正文，到公众号编辑器里粘贴";
    copy.onclick = () => this.file && this.plugin.copyToClipboard(this.file, this.reporter());

    const pub = btn("发布草稿", "send", "mod-cta");
    pub.title = "上传图片与封面，写入公众号草稿箱（不会群发）";
    pub.onclick = () => this.file && this.plugin.publishDraft(this.file, this.reporter());

    const more = bar.createEl("button", { cls: "wxp-btn wxp-more clickable-icon", attr: { "aria-label": "更多" } });
    setIcon(more, "more-horizontal");
    more.onclick = (e) => this.openMoreMenu(e);
  }

  private openMoreMenu(e: MouseEvent) {
    const s = this.plugin.settings;
    const menu = new Menu();
    menu.addItem((i) => i.setTitle("刷新预览").setIcon("refresh-cw").onClick(() => this.update()));
    menu.addItem((i) =>
      i
        .setTitle(`滚动同步${s.scrollSync ? "（已开启）" : ""}`)
        .setIcon("arrow-up-down")
        .setChecked(s.scrollSync)
        .onClick(async () => {
          s.scrollSync = !s.scrollSync;
          await this.plugin.saveSettings();
          this.attachScrollSync();
        }),
    );
    menu.addItem((i) => i.setTitle("隐藏工具栏").setIcon("panel-top-close").onClick(() => this.setToolbarHidden(true)));
    menu.addSeparator();
    menu.addItem((i) =>
      i.setTitle("编辑本次发布资料").setIcon("file-pen").onClick(() => this.file && this.plugin.openMetaEditor(this.file)),
    );
    menu.addItem((i) => i.setTitle("打开公众号后台").setIcon("external-link").onClick(() => window.open(MP_HOME)));
    menu.addItem((i) => i.setTitle("账号配置").setIcon("user-cog").onClick(() => this.plugin.openAccountManager()));
    menu.addItem((i) => i.setTitle("插件设置").setIcon("settings").onClick(() => this.openSettings()));
    menu.addItem((i) => i.setTitle("使用帮助").setIcon("help-circle").onClick(() => window.open(HELP_URL)));
    menu.showAtMouseEvent(e);
  }

  private openSettings() {
    const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
    setting.open();
    setting.openTabById(this.plugin.manifest.id);
  }

  private async setToolbarHidden(hidden: boolean) {
    this.plugin.settings.toolbarHidden = hidden;
    await this.plugin.saveSettings();
    this.applyToolbarHidden();
  }

  private applyToolbarHidden() {
    const hidden = this.plugin.settings.toolbarHidden;
    this.contentEl.toggleClass("is-toolbar-hidden", hidden);
    if (hidden) this.closeFormatPanel();
  }

  // ------------------------------------------------------------ 上层：稿件资料 + 账号

  private renderHeader(title: string, author: string, cover: { label: string; previewUrl: string | null }) {
    const h = this.headerEl;
    h.empty();
    const card = h.createDiv({ cls: "wxp-article", attr: { "aria-label": "编辑本次发布资料" } });
    const thumb = card.createDiv({ cls: "wxp-cover-thumb" });
    if (cover.previewUrl) thumb.createEl("img", { attr: { src: cover.previewUrl } });
    else setIcon(thumb, "image-off");
    const info = card.createDiv({ cls: "wxp-article-info" });
    info.createDiv({ cls: "wxp-article-title", text: title });
    const sub = info.createDiv({ cls: "wxp-article-sub" });
    sub.createSpan({ text: author || "未设置作者" });
    sub.createSpan({ cls: "wxp-dot", text: "·" });
    sub.createSpan({ cls: cover.previewUrl ? "" : "wxp-warn", text: `封面：${cover.label}` });
    const edit = card.createDiv({ cls: "wxp-edit-hint" });
    setIcon(edit, "pencil");
    card.onclick = () => this.file && this.plugin.openMetaEditor(this.file);

    const accBox = h.createDiv({ cls: "wxp-account" });
    accBox.createDiv({ cls: "wxp-account-label", text: "发布到" });
    const acc = this.plugin.activeAccount;
    const chip = accBox.createDiv({ cls: "wxp-account-chip" + (acc ? "" : " is-empty") });
    chip.createSpan({ text: acc ? acc.name : "添加账号" });
    setIcon(chip.createSpan({ cls: "wxp-chevron" }), "chevron-down");
    chip.onclick = (e) => {
      if (!this.plugin.settings.accounts.length) {
        this.plugin.openAccountManager();
        return;
      }
      const menu = new Menu();
      this.plugin.settings.accounts.forEach((a) =>
        menu.addItem((i) =>
          i
            .setTitle(a.name)
            .setChecked(a.id === acc?.id)
            .onClick(() => this.plugin.setActiveAccount(a.id)),
        ),
      );
      menu.addSeparator();
      menu.addItem((i) => i.setTitle("管理账号…").setIcon("user-cog").onClick(() => this.plugin.openAccountManager()));
      menu.showAtMouseEvent(e);
    };
  }

  // ------------------------------------------------------------ 格式面板

  private closeFormatPanel() {
    this.formatPanel?.remove();
    this.formatPanel = null;
  }

  private openFormatPanel() {
    this.closeFormatPanel();
    const s = this.plugin.settings;
    const panel = createDiv({ cls: "wxp-format-panel" });
    this.toolbarEl.insertAdjacentElement("afterend", panel);
    panel.style.top = `${this.toolbarEl.offsetTop + this.toolbarEl.offsetHeight + 4}px`;
    this.formatPanel = panel;

    const apply = async (fn: () => void) => {
      fn();
      await this.plugin.saveSettings();
      this.plugin.refreshPreviews();
      const keep = panel.scrollTop;
      this.openFormatPanel(); // 重新绘制选中态
      if (this.formatPanel) this.formatPanel.scrollTop = keep;
    };

    // 我的方案（有才显示）
    if (s.presets.length) {
      panel.createDiv({ cls: "wxp-section-title", text: "我的方案" });
      const chips = panel.createDiv({ cls: "wxp-chips" });
      s.presets.forEach((p) => {
        const active = p.themeId === s.themeId && p.layout === s.layout && JSON.stringify(p.tune) === JSON.stringify(s.tune);
        const chip = chips.createEl("button", { text: p.name, cls: active ? "is-active" : "" });
        chip.onclick = async () => {
          await this.plugin.applyPreset(p);
          this.openFormatPanel();
        };
      });
    }

    // 主题网格
    for (const group of [...new Set(THEMES.map((t) => t.group))]) {
      panel.createDiv({ cls: "wxp-section-title", text: `主题 · ${group}` });
      const grid = panel.createDiv({ cls: "wxp-theme-grid" });
      THEMES.filter((t) => t.group === group).forEach((t) => {
        const card = grid.createDiv({ cls: "wxp-theme-card" + (t.id === s.themeId ? " is-active" : "") });
        if (t.desc) card.title = t.desc;
        const sw = card.createDiv({ cls: "wxp-swatch" });
        const [main, soft, bg] = t.swatch ?? [t.defaultColor, `color-mix(in srgb, ${t.defaultColor} 18%, #fff)`, "#fff"];
        sw.style.setProperty("--wxp-swatch", main);
        sw.style.setProperty("--wxp-swatch-soft", soft);
        sw.style.setProperty("--wxp-swatch-bg", bg);
        card.createDiv({ cls: "wxp-theme-name", text: t.name });
        card.onclick = () =>
          apply(() => {
            s.themeId = t.id;
            s.themeColor = t.defaultColor;
          });
      });
    }

    // 排版模板
    panel.createDiv({ cls: "wxp-section-title", text: "排版模板" });
    const seg = panel.createDiv({ cls: "wxp-segment" });
    PROFILES.forEach((l) => {
      const b = seg.createEl("button", { text: l.name, cls: l.id === s.layout ? "is-active" : "" });
      b.title = l.desc;
      b.onclick = () => apply(() => (s.layout = l.id as LayoutId));
    });

    // 微调
    panel.createDiv({ cls: "wxp-section-title", text: "微调" });
    const row = panel.createDiv({ cls: "wxp-tune-row" });
    const colorWrap = row.createDiv({ cls: "wxp-tune" });
    colorWrap.createSpan({ text: "主题色" });
    const color = colorWrap.createEl("input", { type: "color" });
    color.value = s.themeColor;
    color.onchange = () => apply(() => (s.themeColor = color.value));

    const fontSize = resolveProfile(s.layout, s.tune).fontSize;
    const fsWrap = row.createDiv({ cls: "wxp-tune" });
    fsWrap.createSpan({ text: "字号" });
    const minus = fsWrap.createEl("button", { text: "−" });
    fsWrap.createSpan({ cls: "wxp-fs", text: `${fontSize}` });
    const plus = fsWrap.createEl("button", { text: "+" });
    minus.onclick = () => fontSize > 13 && apply(() => (s.tune = { ...s.tune, fontSize: fontSize - 0.5 }));
    plus.onclick = () => fontSize < 20 && apply(() => (s.tune = { ...s.tune, fontSize: fontSize + 0.5 }));

    const tuneBtn = row.createEl("button", { text: "高级微调 / 我的方案…", cls: "wxp-tune-open" });
    tuneBtn.onclick = () => {
      this.closeFormatPanel();
      this.plugin.openTuneModal();
    };
  }

  // ------------------------------------------------------------ 发布进度

  private reporter(): Reporter {
    const el = this.progressEl;
    const rows = new Map<StepId, HTMLElement>();
    const icons: Record<StepState, string> = { wait: "circle", run: "loader", done: "check-circle-2", error: "x-circle" };
    let hideTimer: number | undefined;
    return {
      start: (steps) => {
        window.clearTimeout(hideTimer);
        el.empty();
        el.addClass("is-visible");
        el.removeClass("is-error", "is-done");
        el.querySelector(".wxp-progress-actions")?.remove();
        const list = el.createDiv({ cls: "wxp-steps-list" });
        steps.forEach((s) => {
          const r = list.createDiv({ cls: "wxp-step is-wait" });
          setIcon(r.createSpan({ cls: "wxp-step-icon" }), icons.wait);
          r.createSpan({ cls: "wxp-step-label", text: s.label });
          r.createSpan({ cls: "wxp-step-detail" });
          rows.set(s.id, r);
        });
        el.createDiv({ cls: "wxp-progress-msg" });
      },
      update: (id, state, detail) => {
        const r = rows.get(id);
        if (!r) return;
        r.className = `wxp-step is-${state}`;
        const icon = r.querySelector(".wxp-step-icon") as HTMLElement;
        icon.empty();
        setIcon(icon, icons[state]);
        if (detail !== undefined) (r.querySelector(".wxp-step-detail") as HTMLElement).setText(detail);
      },
      finish: (ok, message, actions) => {
        el.addClass(ok ? "is-done" : "is-error");
        const msg = el.querySelector(".wxp-progress-msg") as HTMLElement;
        msg.empty();
        msg.createSpan({ text: message });
        const close = msg.createEl("button", { cls: "clickable-icon wxp-progress-close", attr: { "aria-label": "关闭" } });
        setIcon(close, "x");
        close.onclick = () => el.removeClass("is-visible");
        if (actions?.length) {
          const row = el.createDiv({ cls: "wxp-progress-actions" });
          actions.forEach((a) => {
            const b = row.createEl("button", { text: a.label, cls: a.cta ? "mod-cta" : "" });
            b.onclick = a.onClick;
          });
        } else if (ok) {
          hideTimer = window.setTimeout(() => el.removeClass("is-visible"), 8000);
        }
      },
    };
  }

  // ------------------------------------------------------------ 渲染预览

  async update() {
    const seq = ++this.renderSeq;
    if (!this.file) {
      this.headerEl.empty();
      this.shadow.innerHTML = `<p style="color:#999;text-align:center;padding:40px 0;font-family:sans-serif">打开一篇笔记即可预览</p>`;
      this.statusEl.setText("");
      return;
    }
    const file = this.file;
    let result, meta;
    try {
      ({ result, meta } = await this.plugin.renderFile(file, "preview"));
    } catch (e) {
      this.statusEl.setText(`预览失败：${(e as Error).message}`);
      return;
    }
    if (seq !== this.renderSeq) return; // 已有更新的渲染

    this.renderHeader(meta.title, meta.author, this.plugin.resolveCover(file, result.images));

    const phoneScroll = this.phoneEl.scrollTop;
    const font = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    this.shadow.innerHTML =
      `<style>:host{all:initial;display:block}img{max-width:100%}</style>` +
      `<div style="background:#fff;padding:20px 16px 40px;">` +
      `<h1 style="font-size:22px;line-height:1.4;margin:0 0 14px;font-weight:bold;color:#1a1a1a;font-family:${font};">${escapeHtml(meta.title)}</h1>` +
      `<div style="font-size:15px;color:#576b95;margin-bottom:22px;font-family:${font};">${escapeHtml(meta.author || "")}</div>` +
      `<div id="wxp-article">${result.html}</div>` +
      `</div>`;
    this.phoneEl.scrollTop = phoneScroll;

    // 预览里的图片是本地地址/内嵌 base64，发布时会换成约 100 字符的微信图床地址，按发布后的长度估算
    const publishHtml = result.html.replace(/src="[^"]*"/g, `src="${"x".repeat(100)}"`);
    const size = new TextEncoder().encode(publishHtml).length;
    const warn = publishHtml.length >= 20000 ? " · ⚠️ 超过接口文档的 2 万字符上限，推送可能失败" : "";
    this.statusEl.setText(
      `${result.images.length} 张图 · 约 ${publishHtml.length} 字符 · ${(size / 1024).toFixed(0)} KB${warn}` +
        (result.warnings.length ? ` · ${result.warnings.join("；")}` : ""),
    );
    const issues = this.plugin.preflight(file, result);
    if (issues.length) {
      const list = this.statusEl.createDiv({ cls: "wxp-preflight" });
      issues.forEach((i) => list.createDiv({ text: `⚠️ ${i}` }));
    }
    this.statusEl.toggleClass("is-warning", !!warn || result.warnings.length > 0);
    this.attachScrollSync();
  }

  // ------------------------------------------------------------ 滚动同步（编辑器 → 预览）

  /**
   * 按标题对齐：编辑器顶部所在的行落在第 i 个和第 i+1 个标题之间的某个比例处，
   * 预览就滚到第 i 个和第 i+1 个标题元素之间的同一比例处。没有标题时退化为按全文比例。
   */
  private attachScrollSync() {
    this.syncCleanup?.();
    this.syncCleanup = null;
    if (!this.plugin.settings.scrollSync || !this.file) return;
    const mv = this.app.workspace
      .getLeavesOfType("markdown")
      .map((l) => l.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.file === this.file);
    if (!mv) return;
    const cm = (mv.editor as unknown as { cm?: EditorView }).cm;
    const scroller: HTMLElement | null =
      mv.getMode() === "source" ? cm?.scrollDOM ?? null : mv.contentEl.querySelector(".markdown-preview-view");
    if (!scroller) return;

    let frame = 0;
    const handler = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.syncFrom(scroller, mv.getMode() === "source" ? cm : undefined));
    };
    scroller.addEventListener("scroll", handler, { passive: true });
    this.syncCleanup = () => {
      scroller.removeEventListener("scroll", handler);
      cancelAnimationFrame(frame);
    };
  }

  private syncFrom(scroller: HTMLElement, cm: EditorView | undefined) {
    const phone = this.phoneEl;
    const maxY = phone.scrollHeight - phone.clientHeight;
    if (!cm || !this.file) {
      const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      phone.scrollTop = ratio * maxY;
      return;
    }
    const docTop = scroller.getBoundingClientRect().top - cm.documentTop;
    const topLine = cm.state.doc.lineAt(cm.lineBlockAtHeight(Math.max(0, docTop)).from).number - 1;
    const totalLines = cm.state.doc.lines;

    const mdHeads = (this.app.metadataCache.getFileCache(this.file)?.headings ?? []).map((h) => h.position.start.line);
    const article = this.shadow.getElementById("wxp-article");
    const htmlHeads = article ? Array.from(article.querySelectorAll("h1,h2,h3,h4,h5,h6")) : [];
    const n = Math.min(mdHeads.length, htmlHeads.length);
    const base = phone.getBoundingClientRect().top - phone.scrollTop;
    const anchors: { line: number; y: number }[] = [{ line: 0, y: 0 }];
    for (let i = 0; i < n; i++) {
      anchors.push({ line: mdHeads[i], y: htmlHeads[i].getBoundingClientRect().top - base - 12 });
    }
    anchors.push({ line: totalLines, y: maxY });

    let i = 0;
    while (i < anchors.length - 2 && topLine >= anchors[i + 1].line) i++;
    const a = anchors[i];
    const b = anchors[i + 1];
    const t = b.line > a.line ? Math.min(1, Math.max(0, (topLine - a.line) / (b.line - a.line))) : 0;
    phone.scrollTop = Math.min(maxY, Math.max(0, a.y + (b.y - a.y) * t));
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
