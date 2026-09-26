import { App, PluginSettingTab, Setting } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { THEMES } from "./render";
import type { CodeThemeId } from "./render/theme";

export interface WechatSettings {
  appId: string;
  appSecret: string;
  defaultAuthor: string;
  /** frontmatter 和正文里都没有图片时使用的默认封面（库内路径） */
  defaultCover: string;
  themeId: string;
  themeColor: string;
  fontSize: number;
  codeTheme: CodeThemeId;
  macCodeBlock: boolean;
  linkToFootnote: boolean;
  imageCaption: boolean;
  openComment: boolean;
  updateExistingDraft: boolean;
  openBrowserAfterPublish: boolean;
}

export const DEFAULT_SETTINGS: WechatSettings = {
  appId: "",
  appSecret: "",
  defaultAuthor: "",
  defaultCover: "",
  themeId: "default",
  themeColor: "#1e80ff",
  fontSize: 15,
  codeTheme: "one-dark",
  macCodeBlock: true,
  linkToFootnote: true,
  imageCaption: true,
  openComment: true,
  updateExistingDraft: true,
  openBrowserAfterPublish: true,
};

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

    containerEl.createEl("h3", { text: "公众号接口" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text:
        "在「公众号后台 → 设置与开发 → 开发接口管理 → 基本配置」获取 AppID / AppSecret，并把本机公网 IP 加入 IP 白名单。" +
        "注意：AppSecret 以明文保存在库的 .obsidian/plugins/wechat-publisher/data.json 中，请勿把该文件同步到公开仓库。",
    });
    new Setting(containerEl).setName("AppID").addText((t) =>
      t.setValue(s.appId).onChange(async (v) => {
        s.appId = v.trim();
        await save();
      }),
    );
    new Setting(containerEl).setName("AppSecret").addText((t) => {
      t.inputEl.type = "password";
      t.setValue(s.appSecret).onChange(async (v) => {
        s.appSecret = v.trim();
        await save();
      });
    });
    new Setting(containerEl)
      .setName("测试连接")
      .setDesc("获取一次 access_token，检查 AppID/AppSecret/IP 白名单是否正确。")
      .addButton((b) => b.setButtonText("测试").onClick(() => this.plugin.testConnection()));

    containerEl.createEl("h3", { text: "文章默认值" });
    new Setting(containerEl).setName("默认作者").addText((t) =>
      t.setValue(s.defaultAuthor).onChange(async (v) => {
        s.defaultAuthor = v;
        await save();
      }),
    );
    new Setting(containerEl)
      .setName("默认封面")
      .setDesc("库内图片路径。优先级：frontmatter 的 cover → 正文第一张图 → 此处。")
      .addText((t) =>
        t.setPlaceholder("assets/cover.png").setValue(s.defaultCover).onChange(async (v) => {
          s.defaultCover = v.trim();
          await save();
        }),
      );
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
    new Setting(containerEl).setName("主题").addDropdown((d) => {
      THEMES.forEach((t) => d.addOption(t.id, `${t.group} · ${t.name}`));
      d.setValue(s.themeId).onChange(async (v) => {
        s.themeId = v;
        s.themeColor = THEMES.find((t) => t.id === v)?.defaultColor ?? s.themeColor;
        await save();
        this.display(); // 刷新主题色选择器
      });
    });
    new Setting(containerEl).setName("主题色").setDesc("切换主题时会自动换成该主题的推荐色，之后可以再改。").addColorPicker((c) =>
      c.setValue(s.themeColor).onChange(async (v) => {
        s.themeColor = v;
        await save();
      }),
    );
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
