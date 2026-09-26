import { debounce, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { THEMES } from "./render";

export const VIEW_TYPE_WECHAT_PREVIEW = "wechat-publisher-preview";

/**
 * 右侧预览面板。
 *
 * “所见即所得”的关键：预览里显示的 HTML 与推送/复制到公众号的 HTML 是同一个渲染函数、同一份内联样式，
 * 唯一区别是图片地址（预览用本地资源地址，发布时换成微信图床地址）。
 * 渲染结果放进 Shadow DOM，隔离 Obsidian 自身的 CSS，避免“预览好看、公众号走样”。
 */
export class WechatPreviewView extends ItemView {
  private file: TFile | null = null;
  private stage!: HTMLElement;
  private shadow!: ShadowRoot;
  private statusEl!: HTMLElement;
  private renderSeq = 0;

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
    root.addClass("wechat-publisher-view");

    const bar = root.createDiv({ cls: "wechat-publisher-toolbar" });
    const themeSel = bar.createEl("select", { cls: "dropdown" });
    THEMES.forEach((t) => themeSel.createEl("option", { value: t.id, text: t.name }));
    themeSel.value = this.plugin.settings.themeId;
    themeSel.onchange = async () => {
      this.plugin.settings.themeId = themeSel.value;
      await this.plugin.saveSettings();
      this.plugin.refreshPreviews();
    };
    const color = bar.createEl("input", { type: "color" });
    color.value = this.plugin.settings.themeColor;
    color.onchange = async () => {
      this.plugin.settings.themeColor = color.value;
      await this.plugin.saveSettings();
      this.plugin.refreshPreviews();
    };

    const copyBtn = bar.createEl("button", { text: "复制" });
    copyBtn.title = "复制带样式的正文，到公众号编辑器里粘贴";
    copyBtn.onclick = () => this.file && this.plugin.copyToClipboard(this.file);
    const pushBtn = bar.createEl("button", { text: "推送到草稿箱", cls: "mod-cta" });
    pushBtn.onclick = () => this.file && this.plugin.publishDraft(this.file);

    this.statusEl = root.createDiv({ cls: "wechat-publisher-status" });
    const phone = root.createDiv({ cls: "wechat-publisher-phone" });
    this.stage = phone.createDiv();
    this.shadow = this.stage.attachShadow({ mode: "open" });

    this.registerEvent(
      this.app.workspace.on("file-open", (f) => {
        if (f && f.extension === "md") {
          this.file = f;
          this.update();
        }
      }),
    );
    const onModify = debounce((f: TFile) => f === this.file && this.update(), 600, true);
    this.registerEvent(this.app.vault.on("modify", (f) => f instanceof TFile && onModify(f)));

    this.file = this.app.workspace.getActiveFile();
    await this.update();
  }

  setFile(file: TFile) {
    this.file = file;
    this.update();
  }

  async update() {
    const seq = ++this.renderSeq;
    if (!this.file) {
      this.shadow.innerHTML = `<p style="color:#999;text-align:center;padding:40px 0">打开一篇笔记即可预览</p>`;
      this.statusEl.setText("");
      return;
    }
    const { result, meta } = await this.plugin.renderFile(this.file, "preview");
    if (seq !== this.renderSeq) return; // 已有更新的渲染
    // 模拟公众号文章页：白底、标题、作者行
    this.shadow.innerHTML =
      `<style>:host{all:initial;display:block}img{max-width:100%}</style>` +
      `<div style="background:#fff;padding:20px 16px 40px;">` +
      `<h1 style="font-size:22px;line-height:1.4;margin:0 0 14px;font-weight:bold;color:#1a1a1a;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">${escapeHtml(meta.title)}</h1>` +
      `<div style="font-size:15px;color:#576b95;margin-bottom:22px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">${escapeHtml(meta.author || "")}</div>` +
      result.html +
      `</div>`;
    const size = new TextEncoder().encode(result.html).length;
    const warn = result.html.length >= 20000 ? " ⚠️ 接口文档要求正文少于 2 万字符，推送可能失败" : "";
    this.statusEl.setText(
      `${result.images.length} 张图 · ${result.html.length} 字符 · ${(size / 1024).toFixed(0)} KB${warn}` +
        (result.warnings.length ? ` · ${result.warnings.join("；")}` : ""),
    );
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
