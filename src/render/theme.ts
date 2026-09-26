/**
 * 主题注册表：17 款调色板主题（配色）× 排版模板（版式），生成样式表后按 CSS 层叠规则内联。
 *
 * 公众号编辑器会删除 <style>、class、id，只保留元素上的 style 属性，
 * 所以最终所有样式都会“烫”到每个元素的 style 上，class 在输出前全部删除。
 */
import { CaptionMode, CodeThemeId, LayoutId, resolveProfile, StyleProfile, Tune } from "./profiles";
import { PALETTE_THEMES } from "./palette-themes";
import { buildPaletteCss, resolvePalette } from "./palette-css";

export type { CodeThemeId, LayoutId } from "./profiles";

export type ThemeGroup = "经典";

export interface Theme {
  id: string;
  name: string;
  /** 完整样式表（作用于 .wxp-root），按特异度/!important 层叠后内联 */
  css: string;
  /** 正文颜色（公式图片需要显式颜色） */
  textColor: string;
  /** 正文字号 px（公式按它缩放） */
  fontSize: number;
  code: CodeTheme;
  showMacCodeHeader: boolean;
  captionMode: CaptionMode;
}

export interface CodeTheme {
  background: string;
  color: string;
  headerBackground: string;
  palette: Record<string, string>;
}

export const MONO = "Menlo,Monaco,Consolas,'Courier New',monospace";

export const CODE_THEMES: Record<CodeThemeId, CodeTheme> = {
  // 配色取自 RanceLee233/wechat-publisher 的 GitHub Dark 高亮（MIT）
  "github-dark": {
    background: "#0d1117",
    color: "#e6edf3",
    headerBackground: "rgba(255,255,255,0.06)",
    palette: {
      comment: "#8b949e", quote: "#8b949e",
      variable: "#ff7b72", "template-variable": "#ff7b72", tag: "#ff7b72", name: "#ff7b72",
      "selector-id": "#ff7b72", "selector-class": "#ff7b72", regexp: "#ff7b72", deletion: "#ff7b72",
      number: "#79c0ff", "built_in": "#79c0ff", literal: "#79c0ff", type: "#79c0ff", params: "#79c0ff",
      meta: "#79c0ff", link: "#79c0ff", attribute: "#d2a8ff", attr: "#79c0ff",
      string: "#a5d6ff", symbol: "#a5d6ff", bullet: "#a5d6ff", addition: "#a5d6ff",
      title: "#d2a8ff", "title.function": "#d2a8ff", "title.class": "#d2a8ff", section: "#d2a8ff",
      keyword: "#ff7b72", "selector-tag": "#ff7b72", property: "#79c0ff", operator: "#ff7b72",
      "variable.language": "#79c0ff", subst: "#e6edf3",
    },
  },
  "one-dark": {
    background: "#282c34",
    color: "#abb2bf",
    headerBackground: "#21252b",
    palette: {
      keyword: "#c678dd", "built_in": "#e6c07b", type: "#e6c07b", literal: "#56b6c2",
      number: "#d19a66", string: "#98c379", regexp: "#98c379", comment: "#7f848e", quote: "#7f848e",
      title: "#61afef", "title.function": "#61afef", "title.class": "#e6c07b", params: "#abb2bf",
      attr: "#d19a66", attribute: "#98c379", variable: "#e06c75", "variable.language": "#e5c07b",
      "template-variable": "#e06c75", meta: "#61afef", "meta keyword": "#c678dd", tag: "#e06c75",
      name: "#e06c75", "selector-tag": "#e06c75", "selector-class": "#d19a66", "selector-id": "#61afef",
      symbol: "#56b6c2", bullet: "#61afef", link: "#61afef", addition: "#98c379", deletion: "#e06c75",
      section: "#e06c75", property: "#e06c75", operator: "#56b6c2", subst: "#e06c75",
    },
  },
  github: {
    background: "#f6f8fa",
    color: "#24292e",
    headerBackground: "#eef0f3",
    palette: {
      keyword: "#d73a49", "built_in": "#e36209", type: "#d73a49", literal: "#005cc5",
      number: "#005cc5", string: "#032f62", regexp: "#032f62", comment: "#6a737d", quote: "#22863a",
      title: "#6f42c1", "title.function": "#6f42c1", "title.class": "#6f42c1", params: "#24292e",
      attr: "#005cc5", attribute: "#005cc5", variable: "#e36209", "variable.language": "#d73a49",
      "template-variable": "#e36209", meta: "#005cc5", tag: "#22863a", name: "#22863a",
      "selector-tag": "#22863a", "selector-class": "#6f42c1", "selector-id": "#005cc5", symbol: "#e36209",
      bullet: "#735c0f", link: "#032f62", addition: "#22863a", deletion: "#b31d28", section: "#005cc5",
      property: "#005cc5", operator: "#d73a49", subst: "#24292e",
    },
  },
};


// ---------------------------------------------------------------- 注册表

export const THEMES: {
  id: string;
  name: string;
  defaultColor: string;
  group: ThemeGroup;
  desc?: string;
  /** 主题卡片上的色块：主色 / 浅主色 / 页面底色 */
  swatch?: [string, string, string];
}[] = [
  ...PALETTE_THEMES.map((t) => ({
    id: t.id,
    name: t.name,
    defaultColor: t.palette.primary,
    group: "经典" as ThemeGroup,
    desc: t.description,
    swatch: [t.palette.primary, t.palette.primarySoft, t.palette.background] as [string, string, string],
  })),
];

/** 已移除的旧主题（0.2.x 的经典主题、0.2–0.4 的网页风格主题）映射到风格最接近的调色板主题；未列出的回到经典蓝 */
const LEGACY_THEME_IDS: Record<string, string> = {
  default: "classic",
  orange: "sunrise",
  ink: "graphite",
  tech: "techno",
  purple: "electric-violet",
  rose: "maple",
  magazine: "newspaper",
  paper: "paper-orange",
  geek: "neon-terminal",
  notion: "minimal",
  medium: "editorial",
  github: "graphite",
  apple: "classic",
  sspai: "editorial",
  brutal: "acid-print",
  xhs: "sunrise",
  kinfolk: "warm",
  cyber: "neon-terminal",
  material: "electric-violet",
};

export function normalizeThemeId(id: string): string {
  if (THEMES.some((t) => t.id === id)) return id;
  return LEGACY_THEME_IDS[id] ?? "classic";
}

export function themeDefaultColor(id: string): string {
  return THEMES.find((t) => t.id === normalizeThemeId(id))?.defaultColor ?? "#0F4C81";
}

export interface ThemeRequest {
  themeId: string;
  /** 主题色；与主题默认色相同时视为未自定义 */
  themeColor?: string;
  layout?: LayoutId;
  tune?: Tune;
}

function isDark(color: string): boolean {
  const m = color.match(/^#([0-9a-f]{6})$/i);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 128;
}

export function resolveTheme(req: ThemeRequest): Theme {
  const id = normalizeThemeId(req.themeId);
  const tune = req.tune ?? {};
  const palette = PALETTE_THEMES.find((t) => t.id === id) ?? PALETTE_THEMES[0];
  const custom = req.themeColor && req.themeColor.toLowerCase() !== palette.palette.primary.toLowerCase();
  const profile: StyleProfile = resolveProfile(req.layout, {
    ...tune,
    customPrimaryColor: tune.customPrimaryColor || (custom ? req.themeColor : undefined),
  });
  const colors = resolvePalette(palette, profile);
  const codeId = profile.codeTheme;
  // 深色代码配色用主题自带的代码底色；浅色配色（GitHub）配浅底，避免深底浅字色看不清
  const code: CodeTheme = isDark(CODE_THEMES[codeId].background)
    ? { ...CODE_THEMES[codeId], background: colors.codeBackground, color: colors.codeText, headerBackground: "rgba(255,255,255,0.06)" }
    : CODE_THEMES[codeId];
  return {
    id: palette.id,
    name: palette.name,
    css: buildPaletteCss(palette, profile),
    textColor: colors.text,
    fontSize: profile.fontSize,
    code,
    showMacCodeHeader: profile.showMacCodeHeader,
    captionMode: profile.figureCaptionMode,
  };
}
