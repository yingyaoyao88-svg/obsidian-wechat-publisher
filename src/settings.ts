import { App, PluginSettingTab, Setting } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { normalizeThemeId, PROFILES, THEMES, themeDefaultColor } from "./render";
import type { LayoutId, Tune } from "./render";

export interface WechatAccount {
  id: string;
  /** 自定义名称，如“主号”“备用号” */
  name: string;
  appId: string;
  appSecret: string;
  /** 该账号的默认作者 */
  author: string;
  /** 该账号的默认封面（库内图片路径） */
  defaultCover: string;
}

/** 「我的方案」：保存下来的 主题 + 主题色 + 排版模板 + 高级微调 */
export interface StylePreset {
  id: string;
  name: string;
  themeId: string;
  themeColor: string;
  layout: LayoutId;
  tune: Tune;
}

export interface WechatSettings {
  accounts: WechatAccount[];
  activeAccountId: string;
  themeId: string;
  themeColor: string;
  /** 排版模板（均衡 / 紧凑 / 舒展 / 专栏） */
  layout: LayoutId;
  /** 高级微调：覆盖排版模板里的字段 */
  tune: Tune;
  presets: StylePreset[];
  linkToFootnote: boolean;
  openComment: boolean;
  updateExistingDraft: boolean;
  openBrowserAfterPublish: boolean;
  /** 编辑器滚动时预览跟随 */
  scrollSync: boolean;
  /** 预览面板隐藏工具栏（沉浸预览） */
  toolbarHidden: boolean;
}

export const DEFAULT_SETTINGS: WechatSettings = {
  accounts: [],
  activeAccountId: "",
  themeId: "classic",
  themeColor: "#0F4C81",
  layout: "balanced",
  tune: {},
  presets: [],
  linkToFootnote: true,
  openComment: true,
  updateExistingDraft: true,
  openBrowserAfterPublish: true,
  scrollSync: false,
  toolbarHidden: false,
};

export function newAccount(partial: Partial<WechatAccount> = {}): WechatAccount {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "公众号",
    appId: "",
    appSecret: "",
    author: "",
    defaultCover: "",
    ...partial,
  };
}

/** 兼容 0.1.x 的单账号设置（appId/appSecret/defaultAuthor/defaultCover 在顶层） */
export function migrateSettings(raw: Record<string, unknown> | undefined): WechatSettings {
  const s = Object.assign({}, DEFAULT_SETTINGS, raw ?? {}) as WechatSettings & Record<string, unknown>;
  if (!Array.isArray(s.accounts)) s.accounts = [];
  if (!s.accounts.length && typeof s.appId === "string" && s.appId) {
    s.accounts.push(
      newAccount({
        name: "默认账号",
        appId: s.appId as string,
        appSecret: (s.appSecret as string) ?? "",
        author: (s.defaultAuthor as string) ?? "",
        defaultCover: (s.defaultCover as string) ?? "",
      }),
    );
  }
  for (const k of ["appId", "appSecret", "defaultAuthor", "defaultCover"]) delete s[k];

  // 0.2.x → 0.3：旧“经典”主题换成调色板主题；字号/代码配色/圆点/图注并入高级微调（只保留改过默认值的）
  const oldId = s.themeId;
  s.themeId = normalizeThemeId(s.themeId);
  if (oldId !== s.themeId) s.themeColor = themeDefaultColor(s.themeId);
  if (!s.tune || typeof s.tune !== "object") s.tune = {};
  if (!Array.isArray(s.presets)) s.presets = [];
  if (typeof s.fontSize === "number" && s.fontSize !== 15 && s.tune.fontSize === undefined) s.tune.fontSize = s.fontSize;
  if (s.codeTheme === "github" && s.tune.codeTheme === undefined) s.tune.codeTheme = "github";
  if (s.macCodeBlock === false && s.tune.showMacCodeHeader === undefined) s.tune.showMacCodeHeader = false;
  if (s.imageCaption === false && s.tune.figureCaptionMode === undefined) s.tune.figureCaptionMode = "none";
  for (const k of ["fontSize", "codeTheme", "macCodeBlock", "imageCaption"]) delete s[k];
  if (!s.accounts.some((a) => a.id === s.activeAccountId)) s.activeAccountId = s.accounts[0]?.id ?? "";
  return s;
}

export class WechatSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: WechatPublisherPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const save = async () => {
      await this.plugin.saveSettings();
      this.plugin.refreshPreviews();
    };
    containerEl.empty();

    containerEl.createEl("h3", { text: "公众号账号" });
    const accounts = s.accounts.length
      ? s.accounts.map((a) => `${a.name}${a.id === s.activeAccountId ? "（默认）" : ""}`).join("、")
      : "还没有添加账号";
    new Setting(containerEl)
      .setName("账号管理")
      .setDesc(`${accounts}。在这里添加 AppID/AppSecret、检测并复制 IP 白名单、设置默认作者和封面。`)
      .addButton((b) =>
        b
          .setButtonText(s.accounts.length ? "管理账号" : "添加账号")
          .setCta()
          .onClick(() => this.plugin.openAccountManager(() => this.display())),
      );

    containerEl.createEl("h3", { text: "发布" });
    new Setting(containerEl).setName("开启留言").addToggle((t) =>
      t.setValue(s.openComment).onChange(async (v) => {
        s.openComment = v;
        await save();
      }),
    );
    new Setting(containerEl)
      .setName("重复推送时更新同一篇草稿")
      .setDesc("关闭后每次推送都会新建一篇草稿。")
      .addToggle((t) =>
        t.setValue(s.updateExistingDraft).onChange(async (v) => {
          s.updateExistingDraft = v;
          await save();
        }),
      );
    new Setting(containerEl).setName("完成后打开公众号后台").addToggle((t) =>
      t.setValue(s.openBrowserAfterPublish).onChange(async (v) => {
        s.openBrowserAfterPublish = v;
        await save();
      }),
    );

    containerEl.createEl("h3", { text: "排版" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "主题、排版模板、主题色、字号也可以在预览面板的「格式」里一键切换，效果实时可见。",
    });
    new Setting(containerEl).setName("主题").addDropdown((d) => {
      THEMES.forEach((t) => d.addOption(t.id, t.name));
      d.setValue(s.themeId).onChange(async (v) => {
        s.themeId = v;
        s.themeColor = themeDefaultColor(v);
        await save();
        this.display(); // 刷新主题色选择器
      });
    });
    new Setting(containerEl)
      .setName("主题色")
      .setDesc("切换主题时会自动换成该主题的推荐色，之后可以再改。")
      .addColorPicker((c) =>
        c.setValue(s.themeColor).onChange(async (v) => {
          s.themeColor = v;
          await save();
        }),
      );
    new Setting(containerEl).setName("排版模板").addDropdown((d) => {
      PROFILES.forEach((l) => d.addOption(l.id, `${l.name} — ${l.desc}`));
      d.setValue(s.layout).onChange(async (v) => {
        s.layout = v as LayoutId;
        await save();
      });
    });
    new Setting(containerEl)
      .setName("高级微调 / 我的方案")
      .setDesc("字号、行距、对齐、缩进、各级标题款式、引用块、代码配色、图注……在模板基础上逐项调整，并可保存为方案。")
      .addButton((b) => b.setButtonText("打开").onClick(() => this.plugin.openTuneModal()));
    new Setting(containerEl)
      .setName("外链转为文末脚注")
      .setDesc("非认证公众号正文不能放外部链接，开启后链接会变成「文字[1]」并在文末列出网址。")
      .addToggle((t) =>
        t.setValue(s.linkToFootnote).onChange(async (v) => {
          s.linkToFootnote = v;
          await save();
        }),
      );
  }
}
