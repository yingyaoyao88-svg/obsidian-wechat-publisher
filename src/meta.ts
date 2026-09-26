import { App, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { LoadedImage, loadBrowserFile } from "./wechat/images";

/**
 * 本次发布的资料覆盖：只保存在内存里，不回写笔记。
 * 适合“公众号标题想和笔记标题不一样”“这次临时换张封面”之类的场景。
 */
export type CoverOverride =
  | { kind: "vault"; path: string }
  | { kind: "file"; image: LoadedImage; previewUrl: string }
  | { kind: "account" };

export interface PublishOverride {
  title?: string;
  author?: string;
  digest?: string;
  cover?: CoverOverride;
}

export type CoverSourceLabel = "手动选择" | "笔记属性" | "账号默认" | "正文首图" | "未设置";

export interface ResolvedCover {
  source: string | LoadedImage | null;
  label: CoverSourceLabel;
  previewUrl: string | null;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;

export class VaultImageSuggest extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onPick: (f: TFile) => void) {
    super(app);
    this.setPlaceholder("搜索库中的图片作为封面…");
  }
  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((f) => IMAGE_EXT.test(f.name));
  }
  getItemText(f: TFile): string {
    return f.path;
  }
  onChooseItem(f: TFile): void {
    this.onPick(f);
  }
}

export interface MetaDefaults {
  title: string;
  author: string;
  digest: string;
  cover: ResolvedCover;
  /** 不含手动覆盖时的封面（“恢复自动”后会是什么） */
  autoCover: ResolvedCover;
  accountCover: ResolvedCover | null;
}

export class MetaModal extends Modal {
  private draft: PublishOverride;

  constructor(
    app: App,
    private current: PublishOverride,
    private defaults: MetaDefaults,
    private resolvePreview: (c: CoverOverride) => string | null,
    private onSave: (o: PublishOverride) => void,
  ) {
    super(app);
    this.draft = { ...current };
  }

  onOpen() {
    this.modalEl.addClass("wxp-meta-modal");
    this.titleEl.setText("本次发布资料");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    el.createEl("p", {
      cls: "setting-item-description",
      text: "这里的修改只用于本次发布，不会写回笔记。留空则使用笔记属性或账号默认值。",
    });

    const field = (name: string, key: "title" | "author" | "digest", placeholder: string, limit: number, multiline = false) => {
      const s = new Setting(el).setName(name).setDesc(`最多 ${limit} 字`);
      const onInput = (v: string) => {
        this.draft[key] = v.trim() ? v : undefined;
      };
      if (multiline) {
        s.addTextArea((t) => {
          t.setPlaceholder(placeholder).setValue(this.draft[key] ?? "").onChange(onInput);
          t.inputEl.maxLength = limit;
          t.inputEl.rows = 3;
        });
      } else {
        s.addText((t) => {
          t.setPlaceholder(placeholder).setValue(this.draft[key] ?? "").onChange(onInput);
          t.inputEl.maxLength = limit;
        });
      }
    };
    field("标题", "title", this.defaults.title, 64);
    field("作者", "author", this.defaults.author || "（未设置）", 16);
    field("摘要", "digest", this.defaults.digest || "不填则公众号自动截取正文前 54 字", 120, true);

    // 封面
    const cover = this.currentCover();
    const box = el.createDiv({ cls: "wxp-cover-edit" });
    const thumb = box.createDiv({ cls: "wxp-cover-thumb is-large" });
    if (cover.previewUrl) thumb.createEl("img", { attr: { src: cover.previewUrl } });
    else thumb.createSpan({ text: "无封面" });
    const side = box.createDiv({ cls: "wxp-cover-side" });
    side.createDiv({ cls: "wxp-cover-label", text: `封面：${cover.label}` });
    side.createDiv({
      cls: "setting-item-description",
      text: "优先级：手动选择 > 笔记 cover 属性 > 账号默认封面 > 正文第一张图。建议 900×383（2.35:1），JPG/PNG。",
    });
    const btns = side.createDiv({ cls: "wxp-btn-row" });
    btns.createEl("button", { text: "从库中选择" }).onclick = () =>
      new VaultImageSuggest(this.app, (f) => {
        this.draft.cover = { kind: "vault", path: f.path };
        this.render();
      }).open();
    btns.createEl("button", { text: "从电脑选择" }).onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return;
        this.draft.cover = { kind: "file", image: await loadBrowserFile(f), previewUrl: URL.createObjectURL(f) };
        this.render();
      };
      input.click();
    };
    if (this.defaults.accountCover) {
      btns.createEl("button", { text: "用账号默认封面" }).onclick = () => {
        this.draft.cover = { kind: "account" };
        this.render();
      };
    }
    if (this.draft.cover) {
      btns.createEl("button", { text: "恢复自动" }).onclick = () => {
        this.draft.cover = undefined;
        this.render();
      };
    }

    const footer = el.createDiv({ cls: "wxp-modal-footer" });
    footer.createEl("button", { text: "清除本次修改" }).onclick = () => {
      this.onSave({});
      this.close();
    };
    footer.createEl("button", { text: "保存", cls: "mod-cta wxp-push-right" }).onclick = () => {
      this.onSave(this.draft);
      this.close();
    };
  }

  private currentCover(): ResolvedCover {
    const c = this.draft.cover;
    if (!c) return this.defaults.autoCover;
    if (c.kind === "account" && this.defaults.accountCover) return this.defaults.accountCover;
    return { source: null, label: "手动选择", previewUrl: this.resolvePreview(c) };
  }
}
