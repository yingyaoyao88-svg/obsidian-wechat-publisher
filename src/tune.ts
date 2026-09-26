import { App, debounce, Modal, Notice, Setting } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { PROFILES, resolveProfile, THEMES, TUNE_OPTIONS } from "./render";
import type { StyleProfile, Tune } from "./render";
import type { StylePreset } from "./settings";

type OptionKey = keyof typeof TUNE_OPTIONS;

/**
 * 高级微调 + 我的方案。
 *
 * 每一项都在当前排版模板的默认值之上覆盖；改动立即写入设置并刷新预览（预览面板就是效果）。
 * 「恢复模板默认」清空全部微调；「我的方案」保存 主题 + 主题色 + 模板 + 微调 的组合，一键套用。
 */
export class TuneModal extends Modal {
  private refresh = debounce(() => this.plugin.refreshPreviews(), 250, true);

  constructor(app: App, private plugin: WechatPublisherPlugin) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("wxp-tune-modal");
    this.titleEl.setText("高级微调");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
    this.plugin.refreshPreviews();
  }

  private get s() {
    return this.plugin.settings;
  }

  private async set<K extends keyof Tune>(key: K, value: Tune[K] | undefined) {
    const tune = { ...this.s.tune };
    if (value === undefined || value === "") delete tune[key];
    else tune[key] = value;
    this.s.tune = tune;
    await this.plugin.saveSettings();
    this.refresh();
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    const profile: StyleProfile = resolveProfile(this.s.layout, this.s.tune);
    const layoutName = PROFILES.find((p) => p.id === this.s.layout)?.name ?? "均衡";
    const themeName = THEMES.find((t) => t.id === this.s.themeId)?.name ?? "";
    el.createEl("p", {
      cls: "setting-item-description",
      text: `当前：${themeName} · ${layoutName}模板。以下各项在模板基础上覆盖，改动实时反映在预览面板里；带 • 的是已自定义的项。`,
    });

    const mark = (key: keyof Tune, name: string) => (this.s.tune[key] !== undefined ? `• ${name}` : name);

    const select = (key: OptionKey, name: string, desc = "") =>
      new Setting(el)
        .setName(mark(key, name))
        .setDesc(desc)
        .addDropdown((d) => {
          const opts = TUNE_OPTIONS[key] as Record<string, string>;
          Object.entries(opts).forEach(([v, label]) => d.addOption(v, label));
          d.setValue(String(profile[key as keyof StyleProfile] ?? Object.keys(opts)[0])).onChange(async (v) => {
            await this.set(key as keyof Tune, v as never);
            this.render();
          });
        });

    // —— 文字
    el.createEl("h4", { text: "文字" });
    select("fontPreset", "字体");
    new Setting(el).setName(mark("fontSize", "正文字号")).addSlider((sl) =>
      sl
        .setLimits(13, 20, 0.5)
        .setValue(profile.fontSize)
        .setDynamicTooltip()
        .onChange(async (v) => this.set("fontSize", v)),
    );
    new Setting(el).setName(mark("lineHeight", "行距")).addSlider((sl) =>
      sl
        .setLimits(1.4, 2.2, 0.05)
        .setValue(profile.lineHeight)
        .setDynamicTooltip()
        .onChange(async (v) => this.set("lineHeight", Math.round(v * 100) / 100)),
    );
    select("textAlign", "对齐");
    new Setting(el).setName(mark("paragraphIndent", "段首缩进两字")).addToggle((t) =>
      t.setValue(profile.paragraphIndent).onChange(async (v) => {
        await this.set("paragraphIndent", v);
        this.render();
      }),
    );
    select("contentSideIndent", "左右留白");

    // —— 标题与区块
    el.createEl("h4", { text: "标题与区块" });
    select("h1Style", "一级标题");
    select("h2Style", "二级标题");
    select("h3Style", "三级标题");
    select("h4Style", "四级标题");
    select("calloutStyleMode", "引用 / 提示块");
    select("figureCaptionMode", "图注", "图注取自 ![描述](图片 \"标题\")");

    // —— 代码
    el.createEl("h4", { text: "代码" });
    select("codeTheme", "代码配色");
    new Setting(el).setName(mark("showMacCodeHeader", "Mac 风格圆点")).addToggle((t) =>
      t.setValue(profile.showMacCodeHeader).onChange(async (v) => {
        await this.set("showMacCodeHeader", v);
        this.render();
      }),
    );

    // —— 颜色
    el.createEl("h4", { text: "颜色" });
    new Setting(el)
      .setName(mark("customPageBackgroundColor", "页面底色"))
      .setDesc("默认使用主题自带底色；深色底色请以微信实际预览为准")
      .addColorPicker((c) =>
        c.setValue(this.s.tune.customPageBackgroundColor ?? "#ffffff").onChange(async (v) => this.set("customPageBackgroundColor", v)),
      )
      .addExtraButton((b) =>
        b
          .setIcon("rotate-ccw")
          .setTooltip("用主题底色")
          .onClick(async () => {
            await this.set("customPageBackgroundColor", undefined);
            this.render();
          }),
      );

    new Setting(el).addButton((b) =>
      b.setButtonText("恢复模板默认").onClick(async () => {
        this.s.tune = {};
        await this.plugin.saveSettings();
        this.plugin.refreshPreviews();
        this.render();
      }),
    );

    this.renderPresets(el);
  }

  // ------------------------------------------------------------ 我的方案

  private renderPresets(el: HTMLElement) {
    el.createEl("h4", { text: "我的方案" });
    el.createEl("p", {
      cls: "setting-item-description",
      text: "把当前的主题、主题色、排版模板和微调保存为方案，以后一键套用。方案也会出现在「格式」面板里。",
    });
    let name = "";
    new Setting(el)
      .setName("保存当前为方案")
      .addText((t) => t.setPlaceholder("如：技术长文、周报").onChange((v) => (name = v.trim())))
      .addButton((b) =>
        b
          .setButtonText("保存")
          .setCta()
          .onClick(async () => {
            if (!name) {
              new Notice("先给方案起个名字");
              return;
            }
            const preset: StylePreset = {
              id: Math.random().toString(36).slice(2, 10),
              name,
              themeId: this.s.themeId,
              themeColor: this.s.themeColor,
              layout: this.s.layout,
              tune: { ...this.s.tune },
            };
            this.s.presets = [...this.s.presets.filter((p) => p.name !== name), preset];
            await this.plugin.saveSettings();
            new Notice(`已保存方案「${name}」`);
            this.render();
          }),
      );
    this.s.presets.forEach((p) => {
      const theme = THEMES.find((t) => t.id === p.themeId)?.name ?? p.themeId;
      const layout = PROFILES.find((l) => l.id === p.layout)?.name ?? p.layout;
      new Setting(el)
        .setName(p.name)
        .setDesc(`${theme} · ${layout}${Object.keys(p.tune).length ? ` · ${Object.keys(p.tune).length} 项微调` : ""}`)
        .addButton((b) =>
          b.setButtonText("套用").onClick(async () => {
            await this.plugin.applyPreset(p);
            this.render();
          }),
        )
        .addExtraButton((b) =>
          b
            .setIcon("trash")
            .setTooltip("删除")
            .onClick(async () => {
              this.s.presets = this.s.presets.filter((x) => x.id !== p.id);
              await this.plugin.saveSettings();
              this.render();
            }),
        );
    });
  }
}
