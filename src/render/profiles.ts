/**
 * 排版模板（style profile）：决定字号、行距、段距、对齐、缩进，以及各级标题、引用块、代码块、图注的“款式”。
 *
 * 模板与调色板主题正交：任意主题 × 任意模板都成立。
 * 四个内置模板的参数移植自 RanceLee233/wechat-publisher（MIT，Copyright (c) 2026 RanceLee），
 * 许可声明见 palette-themes.ts。
 *
 * 「高级微调」就是在所选模板之上覆盖任意字段（Tune），「我的方案」是保存下来的 主题 + 模板 + 微调 组合。
 */

export type LayoutId = "balanced" | "compact" | "relaxed" | "column";
export type FontPreset = "theme-default" | "sans" | "serif" | "mono" | "rounded";
export type H1Style = "underline" | "solid" | "outline";
export type H2Style = "solid" | "plain" | "capsule";
export type H3Style = "bar" | "plain" | "capsule";
export type H4Style = "accent" | "plain" | "eyebrow";
export type QuoteStyle = "card-soft" | "card-rounded" | "card-square" | "bar-rounded" | "bar-square";
export type CodeThemeId = "github-dark" | "github" | "one-dark";
export type CaptionMode = "none" | "alt-only" | "alt-first" | "title-first";

export interface StyleProfile {
  fontPreset: FontPreset;
  /** px */
  fontSize: number;
  lineHeight: number;
  letterSpacing: string;
  paragraphMargin: string;
  headingTopMargin: string;
  headingBottomMargin: string;
  blockquotePadding: string;
  textAlign: "left" | "justify";
  paragraphIndent: boolean;
  /** 正文左右留白 */
  contentSideIndent: string;
  imageBorderRadius: string;
  h1Style: H1Style;
  h2Style: H2Style;
  h3Style: H3Style;
  h4Style: H4Style;
  calloutStyleMode: QuoteStyle;
  codeTheme: CodeThemeId;
  showMacCodeHeader: boolean;
  figureCaptionMode: CaptionMode;
  /** 覆盖主题主色（空 = 用主题自带） */
  customPrimaryColor?: string;
  /** 覆盖页面底色（空 = 用主题自带） */
  customPageBackgroundColor?: string;
}

export type Tune = Partial<StyleProfile>;

const base: Omit<StyleProfile, "fontSize" | "lineHeight" | "letterSpacing" | "paragraphMargin"> = {
  fontPreset: "sans",
  headingTopMargin: "2.2em",
  headingBottomMargin: "1em",
  blockquotePadding: "1em 1.1em",
  textAlign: "left",
  paragraphIndent: false,
  contentSideIndent: "0px",
  imageBorderRadius: "8px",
  h1Style: "underline",
  h2Style: "solid",
  h3Style: "bar",
  h4Style: "accent",
  calloutStyleMode: "card-soft",
  codeTheme: "github-dark",
  showMacCodeHeader: true,
  figureCaptionMode: "none",
};

export const PROFILES: { id: LayoutId; name: string; desc: string; profile: StyleProfile }[] = [
  {
    id: "balanced",
    name: "均衡",
    desc: "默认的公众号阅读节奏，适合大多数文章",
    profile: { ...base, fontSize: 16, lineHeight: 1.8, letterSpacing: "0.02em", paragraphMargin: "1.2em 8px" },
  },
  {
    id: "compact",
    name: "紧凑",
    desc: "更省篇幅，适合资讯、清单和短内容",
    profile: {
      ...base,
      fontSize: 15,
      lineHeight: 1.65,
      letterSpacing: "0.015em",
      paragraphMargin: "0.9em 8px",
      headingTopMargin: "1.7em",
      headingBottomMargin: "0.75em",
      blockquotePadding: "0.85em 1em",
      imageBorderRadius: "6px",
      h2Style: "plain",
      h3Style: "plain",
      h4Style: "plain",
      calloutStyleMode: "bar-square",
      codeTheme: "github",
      showMacCodeHeader: false,
      figureCaptionMode: "alt-only",
    },
  },
  {
    id: "relaxed",
    name: "舒展",
    desc: "留白更多，适合长文和叙事内容",
    profile: {
      ...base,
      fontPreset: "rounded",
      fontSize: 17,
      lineHeight: 1.95,
      letterSpacing: "0.025em",
      paragraphMargin: "1.45em 8px",
      headingTopMargin: "2.6em",
      headingBottomMargin: "1.15em",
      blockquotePadding: "1.15em 1.2em",
      textAlign: "justify",
      paragraphIndent: true,
      imageBorderRadius: "10px",
      h3Style: "capsule",
      h4Style: "eyebrow",
      calloutStyleMode: "card-rounded",
      figureCaptionMode: "title-first",
    },
  },
  {
    id: "column",
    name: "专栏",
    desc: "更像专栏排版，适合观点和品牌内容",
    profile: {
      ...base,
      fontPreset: "serif",
      fontSize: 17,
      lineHeight: 1.88,
      letterSpacing: "0.025em",
      paragraphMargin: "1.3em 8px",
      headingTopMargin: "2.4em",
      blockquotePadding: "1em 1.15em",
      textAlign: "justify",
      paragraphIndent: true,
      imageBorderRadius: "4px",
      h1Style: "solid",
      h2Style: "plain",
      h3Style: "plain",
      h4Style: "eyebrow",
      calloutStyleMode: "bar-rounded",
      figureCaptionMode: "title-first",
    },
  },
];

export const FONT_PRESET_STACKS: Record<FontPreset, string> = {
  "theme-default": "",
  sans: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Helvetica Neue', Arial, sans-serif",
  serif: "'Georgia', 'Songti SC', 'Noto Serif SC', serif",
  mono: "'SFMono-Regular', 'JetBrains Mono', 'Fira Code', 'Microsoft YaHei Mono', monospace",
  rounded: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
};

export function resolveProfile(layout: LayoutId | undefined, tune: Tune = {}): StyleProfile {
  const p = (PROFILES.find((x) => x.id === layout) ?? PROFILES[0]).profile;
  const clean = Object.fromEntries(Object.entries(tune).filter(([, v]) => v !== undefined && v !== "")) as Tune;
  return { ...p, ...clean };
}

/** 高级微调里可选的值与中文名 */
export const TUNE_OPTIONS = {
  fontPreset: { "theme-default": "跟随主题", sans: "无衬线", serif: "衬线", rounded: "圆体", mono: "等宽" },
  textAlign: { left: "左对齐", justify: "两端对齐" },
  h1Style: { underline: "下划线", solid: "色块", outline: "描边胶囊" },
  h2Style: { solid: "居中色块", plain: "左竖线", capsule: "胶囊" },
  h3Style: { bar: "左竖线", plain: "主色文字", capsule: "浅色胶囊" },
  h4Style: { accent: "浅色标签", plain: "主色文字", eyebrow: "眉题下划线" },
  calloutStyleMode: {
    "card-soft": "柔和卡片",
    "card-rounded": "圆角卡片 + 竖线",
    "card-square": "方角卡片 + 竖线",
    "bar-rounded": "仅竖线（圆角）",
    "bar-square": "仅竖线（方角）",
  },
  codeTheme: { "github-dark": "GitHub 深色", github: "GitHub 浅色", "one-dark": "One Dark" },
  figureCaptionMode: { none: "不显示", "alt-only": "图片描述", "alt-first": "描述优先", "title-first": "标题优先" },
  contentSideIndent: { "0px": "无", "8px": "小", "16px": "中", "24px": "大" },
} as const;
