import { App, PluginSettingTab, Setting } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { LAYOUTS, THEMES } from "./render";
import type { CodeThemeId, LayoutId } from "./render/theme";

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

export interface WechatSettings {
  accounts: WechatAccount[];
  activeAccountId: string;
  themeId: string;
  themeColor: string;
  fontSize: number;
  layout: LayoutId;
  codeTheme: CodeThemeId;
  macCodeBlock: boolean;
  linkToFootnote: boolean;
  imageCaption: boolean;
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
  themeId: "default",
  themeColor: "#1e80ff",
  fontSize: 15,
  layout: "balanced",
  codeTheme: "one-dark",
  macCodeBlock: true,
  linkToFootnote: true,
  imageCaption: true,
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
      text: "主题、主题色、排版模板和字号也可以在预览面板的「格式」里一键切换。",
    });
    new Setting(containerEl).setName("主题").addDropdown((d) => {
      THEMES.forEach((t) => d.addOption(t.id, `${t.group} · ${t.name}`));
      d.setValue(s.themeId).onChange(async (v) => {
        s.themeId = v;
        s.themeColor = THEMES.find((t) => t.id === v)?.defaultColor ?? s.themeColor;
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
      LAYOUTS.forEach((l) => d.addOption(l.id, `${l.name} — ${l.desc}`));
      d.setValue(s.layout).onChange(async (v) => {
        s.layout = v as LayoutId;
        await save();
      });
    });
    new Setting(containerEl).setName("正文字号").addSlider((sl) =>
      sl
        .setLimits(13, 18, 1)
        .setValue(s.fontSize)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.fontSize = v;
          await save();
        }),
    );
    new Setting(containerEl).setName("代码主题").addDropdown((d) =>
      d
        .addOption("one-dark", "One Dark（深色）")
        .addOption("github", "GitHub（浅色）")
        .setValue(s.codeTheme)
        .onChange(async (v) => {
          s.codeTheme = v as CodeThemeId;
          await save();
        }),
    );
    new Setting(containerEl).setName("代码块 Mac 风格圆点").addToggle((t) =>
      t.setValue(s.macCodeBlock).onChange(async (v) => {
        s.macCodeBlock = v;
        await save();
      }),
    );
    new Setting(containerEl)
      .setName("外链转为文末脚注")
      .setDesc("非认证公众号正文不能放外部链接，开启后链接会变成「文字[1]」并在文末列出网址。")
      .addToggle((t) =>
        t.setValue(s.linkToFootnote).onChange(async (v) => {
          s.linkToFootnote = v;
          await save();
        }),
      );
    new Setting(containerEl).setName("显示图注（图片 alt 文字）").addToggle((t) =>
      t.setValue(s.imageCaption).onChange(async (v) => {
        s.imageCaption = v;
        await save();
      }),
    );
  }
}
