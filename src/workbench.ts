import { debounce, ItemView, MarkdownView, Menu, Notice, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type WechatPublisherPlugin from "./main";
import type { Reporter, StepId, StepState } from "./main";
import { HELP_URL, MP_HOME } from "./links";
import { PROFILES, resolveProfile, THEMES } from "./render";
import type { LayoutId, RenderResult } from "./render";
import { VaultImageSuggest } from "./meta";
import { loadBrowserFile } from "./wechat/images";

export const VIEW_TYPE_WECHAT_PREVIEW = "wechat-mp-publisher-preview";

/**
 * 预览工作台：一个干净的页面，所见即所发。
 *
 *   [图标]                      [推送到草稿箱]  ⚙  ●      ← ● 绿色 = 可以发布；琥珀色 = 有待处理的问题
 *   📄 正在预览 · 文章.md · 约 3,982 字
 *   ┌──────────────────────────────┐
 *   │  封面（2.35:1，点击/拖入图片更换） │
 *   │  文章标题（大号粗体）             │
 *   │  正文（与推送内容是同一份 HTML）   │
 *   └──────────────────────────────┘
 *
 * 其余功能（排版样式、复制排版、标题/作者/摘要、账号、滚动同步、帮助）都收在 ⚙ 菜单里。
 */
export class WechatPreviewView extends ItemView {
  private file: TFile | null = null;
  private renderSeq = 0;

  private topEl!: HTMLElement;
  private subEl!: HTMLElement;
  private formatPanel: HTMLElement | null = null;
  private progressEl!: HTMLElement;
  private phoneEl!: HTMLElement;
  private coverEl!: HTMLElement;
  private shadow!: ShadowRoot;
  private dotEl!: HTMLElement;
  private issues: string[] = [];

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

    this.topEl = root.createDiv({ cls: "wxp-topbar" });
    this.buildTopbar();
    this.subEl = root.createDiv({ cls: "wxp-subline" });
    this.progressEl = root.createDiv({ cls: "wxp-progress" });
    this.phoneEl = root.createDiv({ cls: "wxp-phone" });
    const card = this.phoneEl.createDiv({ cls: "wxp-card" });
    this.coverEl = card.createDiv({ cls: "wxp-cover" });
    const stage = card.createDiv({ cls: "wxp-stage" });
    this.shadow = stage.attachShadow({ mode: "open" });

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
      if (this.formatPanel && !this.formatPanel.contains(e.target as Node)) this.closeFormatPanel();
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

  // ------------------------------------------------------------ 顶栏

  private buildTopbar() {
    const bar = this.topEl;
    bar.empty();
    const logo = bar.createDiv({ cls: "wxp-logo", attr: { "aria-label": "WeChat MP Publisher" } });
    setIcon(logo, "feather");

    const publish = bar.createEl("button", { cls: "wxp-publish" });
    setIcon(publish.createSpan({ cls: "wxp-publish-icon" }), "send");
    publish.createSpan({ text: "推送到草稿箱" });
    publish.onclick = () => this.publish();

    const gear = bar.createEl("button", { cls: "wxp-icon-btn", attr: { "aria-label": "更多" } });
    setIcon(gear, "settings");
    gear.onclick = (e) => this.openMenu(e);

    this.dotEl = bar.createDiv({ cls: "wxp-dot-status" });
    this.dotEl.onclick = (e) => this.openStatus(e);
  }

  private publish() {
    if (!this.file) return;
    const acc = this.plugin.activeAccount;
    if (!acc || !acc.appId || !acc.appSecret) {
      new Notice("先添加公众号账号（AppID / AppSecret），之后就能一键推送");
      this.plugin.openAccountManager(() => this.update());
      return;
    }
    this.plugin.publishDraft(this.file, this.reporter());
  }

  private openMenu(e: MouseEvent) {
    e.stopPropagation();
    const s = this.plugin.settings;
    const menu = new Menu();
    menu.addItem((i) => i.setTitle("排版样式…").setIcon("palette").onClick(() => this.openFormatPanel()));
    menu.addItem((i) =>
      i
        .setTitle("复制排版（手动粘贴到公众号）")
        .setIcon("copy")
        .onClick(() => this.file && this.plugin.copyToClipboard(this.file, this.reporter())),
    );
    menu.addItem((i) =>
      i.setTitle("标题 / 作者 / 摘要…").setIcon("file-pen").onClick(() => this.file && this.plugin.openMetaEditor(this.file)),
    );
    menu.addSeparator();
    const acc = this.plugin.activeAccount;
    this.plugin.settings.accounts.forEach((a) =>
      menu.addItem((i) =>
        i
          .setTitle(`发布到：${a.name}`)
          .setChecked(a.id === acc?.id)
          .onClick(() => this.plugin.setActiveAccount(a.id)),
      ),
    );
    menu.addItem((i) =>
      i
        .setTitle(s.accounts.length ? "管理账号…" : "添加公众号账号…")
        .setIcon("user-cog")
        .onClick(() => this.plugin.openAccountManager(() => this.update())),
    );
    menu.addSeparator();
    menu.addItem((i) => i.setTitle("刷新预览").setIcon("refresh-cw").onClick(() => this.update()));
    menu.addItem((i) =>
      i
        .setTitle("滚动同步")
        .setIcon("arrow-up-down")
        .setChecked(s.scrollSync)
        .onClick(async () => {
          s.scrollSync = !s.scrollSync;
          await this.plugin.saveSettings();
          this.attachScrollSync();
        }),
    );
    menu.addItem((i) => i.setTitle("打开公众号后台").setIcon("external-link").onClick(() => window.open(MP_HOME)));
    menu.addItem((i) => i.setTitle("插件设置").setIcon("settings").onClick(() => this.openSettings()));
    menu.addItem((i) => i.setTitle("使用帮助").setIcon("help-circle").onClick(() => window.open(HELP_URL)));
    menu.showAtMouseEvent(e);
  }

  /** 状态点：就绪 / 待处理的问题一目了然，点开看详情 */
  private openStatus(e: MouseEvent) {
    const acc = this.plugin.activeAccount;
    const menu = new Menu();
    if (!this.issues.length) {
      menu.addItem((i) => i.setTitle(`✅ 已就绪，将推送到「${acc?.name}」`).setDisabled(true));
    } else {
      this.issues.forEach((t) => menu.addItem((i) => i.setTitle(`⚠️ ${t}`).setDisabled(true)));
    }
    if (!acc) menu.addItem((i) => i.setTitle("添加公众号账号…").onClick(() => this.plugin.openAccountManager(() => this.update())));
    menu.showAtMouseEvent(e);
  }

  private openSettings() {
    const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
    setting.open();
    setting.openTabById(this.plugin.manifest.id);
  }

  // ------------------------------------------------------------ 封面

  private renderCover(cover: { label: string; previewUrl: string | null }) {
    const el = this.coverEl;
    el.empty();
    el.toggleClass("is-empty", !cover.previewUrl);
    const file = this.file;
    if (!file) return;

    const pickFromComputer = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (f) await this.setCoverFromFile(file, f);
      };
      input.click();
    };
    const pickFromVault = () =>
      new VaultImageSuggest(this.app, (f) => this.plugin.setCoverOverride(file, { kind: "vault", path: f.path })).open();

    if (cover.previewUrl) {
      el.createEl("img", { attr: { src: cover.previewUrl, alt: "封面" } });
      el.createDiv({ cls: "wxp-cover-tag", text: `封面 · ${cover.label}` });
      const change = el.createEl("button", { cls: "wxp-cover-change" });
      setIcon(change.createSpan(), "image-plus");
      change.createSpan({ text: "更换封面" });
      change.onclick = (e) => {
        e.stopPropagation();
        const menu = new Menu();
        menu.addItem((i) => i.setTitle("从电脑选择…").setIcon("upload").onClick(pickFromComputer));
        menu.addItem((i) => i.setTitle("从库中选择…").setIcon("image").onClick(pickFromVault));
        if (this.plugin.activeAccount?.defaultCover) {
          menu.addItem((i) =>
            i.setTitle("用账号默认封面").setIcon("user").onClick(() => this.plugin.setCoverOverride(file, { kind: "account" })),
          );
        }
        if (this.plugin.getOverride(file).cover) {
          menu.addItem((i) =>
            i.setTitle("恢复自动（正文首图）").setIcon("rotate-ccw").onClick(() => this.plugin.setCoverOverride(file, undefined)),
          );
        }
        menu.showAtMouseEvent(e);
      };
    } else {
      const box = el.createDiv({ cls: "wxp-cover-empty" });
      const up = box.createEl("button", { cls: "wxp-cover-upload" });
      setIcon(up.createSpan(), "image-plus");
      up.createSpan({ text: "上传封面" });
      up.onclick = pickFromComputer;
      const alt = box.createEl("a", { cls: "wxp-cover-alt", text: "或从库中选择" });
      alt.onclick = pickFromVault;
      box.createDiv({ cls: "wxp-cover-hint", text: "也可以把图片拖到这里 · 建议 900×383" });
    }

    // 拖入图片直接设为封面
    el.ondragover = (e) => {
      e.preventDefault();
      el.addClass("is-drag");
    };
    el.ondragleave = () => el.removeClass("is-drag");
    el.ondrop = async (e) => {
      e.preventDefault();
      el.removeClass("is-drag");
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith("image/")) await this.setCoverFromFile(file, f);
    };
  }

  private async setCoverFromFile(file: TFile, f: File) {
    this.plugin.setCoverOverride(file, { kind: "file", image: await loadBrowserFile(f), previewUrl: URL.createObjectURL(f) });
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
    this.subEl.insertAdjacentElement("afterend", panel);
    panel.style.top = `${this.subEl.offsetTop + this.subEl.offsetHeight + 4}px`;
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
      panel.createDiv({ cls: "wxp-section-title", text: "主题" });
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
      this.subEl.setText("打开一篇笔记即可预览");
      this.coverEl.empty();
      this.shadow.innerHTML = "";
      this.setStatus(["没有打开的笔记"]);
      return;
    }
    const file = this.file;
    let result: RenderResult, meta;
    try {
      ({ result, meta } = await this.plugin.renderFile(file, "preview"));
    } catch (e) {
      this.subEl.setText(`预览失败：${(e as Error).message}`);
      return;
    }
    const words = await this.plugin.wordCount(file);
    if (seq !== this.renderSeq) return; // 已有更新的渲染

    // 副标题：正在预览哪篇、多少字；有需要注意的问题时附一句
    this.subEl.empty();
    setIcon(this.subEl.createSpan({ cls: "wxp-sub-icon" }), "file-text");
    this.subEl.createSpan({ text: `正在预览 · ${file.name} · 约 ${words.toLocaleString()} 字` });

    this.renderCover(this.plugin.resolveCover(file, result.images));

    const phoneScroll = this.phoneEl.scrollTop;
    const font = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
    this.shadow.innerHTML =
      `<style>:host{all:initial;display:block}img{max-width:100%}</style>` +
      `<div style="padding:22px 20px 40px;">` +
      `<h1 style="font-size:26px;line-height:1.35;margin:0 0 10px;font-weight:800;color:#111;letter-spacing:0.01em;font-family:${font};">${escapeHtml(meta.title)}</h1>` +
      (meta.author ? `<div style="font-size:14px;color:#8a8a8a;margin-bottom:20px;font-family:${font};">${escapeHtml(meta.author)}</div>` : `<div style="height:12px"></div>`) +
      `<div id="wxp-article">${result.html}</div>` +
      `</div>`;
    this.phoneEl.scrollTop = phoneScroll;

    // 发布前检查 + 超长提示 + 渲染警告，汇总到状态点
    const publishHtml = result.html.replace(/src="[^"]*"/g, `src="${"x".repeat(100)}"`);
    const issues = this.plugin.preflight(file, result);
    if (publishHtml.length >= 20000) issues.push(`正文约 ${publishHtml.length} 字符，超过公众号 2 万字符上限，推送可能失败`);
    issues.push(...result.warnings);
    this.setStatus(issues);
    if (issues.length) {
      const warn = this.subEl.createSpan({ cls: "wxp-sub-warn", text: ` · ${issues.length} 项需要处理` });
      warn.onclick = (e) => this.openStatus(e);
    }
    this.attachScrollSync();
  }

  private setStatus(issues: string[]) {
    this.issues = issues;
    const acc = this.plugin.activeAccount;
    const ready = !issues.length && !!acc;
    this.dotEl.className = `wxp-dot-status ${ready ? "is-ready" : acc ? "is-warn" : "is-off"}`;
    this.dotEl.setAttribute("aria-label", ready ? `已就绪 · 推送到「${acc?.name}」` : issues.join("\n"));
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
