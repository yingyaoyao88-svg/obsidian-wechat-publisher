/**
 * 主题注册表。两类主题：
 *
 *   经典（调色板主题，17 款）：调色板 + 圆角，版式由排版模板决定，生成样式表后按 CSS 层叠规则内联。
 *   网页风格（装饰主题，10 款）：直接写「选择器 → 内联样式」，并可声明结构装饰（标题前缀、编号、分隔符…）。
 *
 * 公众号编辑器会删除 <style>、class、id，只保留元素上的 style 属性，
 * 所以无论哪类主题，最终都会“烫”到每个元素的 style 上，class 在输出前全部删除。
 */
import { CaptionMode, CodeThemeId, LayoutId, resolveProfile, StyleProfile, Tune } from "./profiles";
import { PALETTE_THEMES } from "./palette-themes";
import { buildPaletteCss, resolvePalette } from "./palette-css";

export type { CodeThemeId, LayoutId } from "./profiles";

export interface ThemeOptions {
  /** 主题色，如 #1e80ff */
  color: string;
  /** 正文字号 px */
  fontSize: number;
}

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

/**
 * 主题的“结构装饰”：公众号没有 ::before/::after，所以需要真实插入的元素/文字，
 * 由渲染器按这里的声明插入，再由主题样式（wx-h-pre / wx-h-num / wx-hr …）上色。
 */
export interface ThemeDecor {
  /** 标题前缀文字，如 { h2: "📌 " } → <span class="wx-h-pre"> */
  headingPrefix?: Partial<Record<HeadingLevel, string>>;
  /** 标题后缀文字 → <span class="wx-h-suf"> */
  headingSuffix?: Partial<Record<HeadingLevel, string>>;
  /** 二级标题自动编号 01、02… → <span class="wx-h-num"> */
  h2Number?: boolean;
  /** 引用块开头的大引号 → <section class="wx-quote-mark"> */
  quoteMark?: string;
  /** 用文字替代分隔线，如 "· · ·" → <section class="wx-hr"> */
  hr?: string;
  /** 文末结束标记，如 "— END —" → <section class="wx-ending"> */
  ending?: string;
}

export type ThemeGroup = "经典" | "网页风格";

interface ResolvedBase {
  id: string;
  name: string;
  decor: ThemeDecor;
  /** 正文颜色（公式图片需要显式颜色） */
  textColor: string;
  /** 正文字号 px（公式按它缩放） */
  fontSize: number;
  code: CodeTheme;
  showMacCodeHeader: boolean;
  captionMode: CaptionMode;
  /** typed = 按 callout 类型着色并带图标；quote = 与引用块同款 */
  callout: "typed" | "quote";
}

/** 装饰主题：选择器 → 样式，按声明顺序叠加 */
export interface DecorTheme extends ResolvedBase {
  kind: "decor";
  styles: Record<string, string>;
}

/** 调色板主题：完整样式表，按特异度/!important 层叠后内联 */
export interface PaletteThemeResolved extends ResolvedBase {
  kind: "palette";
  css: string;
}

export type Theme = DecorTheme | PaletteThemeResolved;

export interface CodeTheme {
  background: string;
  color: string;
  headerBackground: string;
  palette: Record<string, string>;
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei',Arial,sans-serif";
export const MONO = "Menlo,Monaco,Consolas,'Courier New',monospace";

function base(o: ThemeOptions): Record<string, string> {
  const fs = o.fontSize;
  return {
    root: `font-family:${FONT};font-size:${fs}px;color:#3f3f3f;line-height:1.75;letter-spacing:0.05em;word-break:break-word;text-align:left;padding:0 4px;`,
    p: `margin:1.2em 0;font-size:${fs}px;line-height:1.75;color:#3f3f3f;`,
    "strong": `font-weight:bold;color:${o.color};`,
    em: `font-style:italic;`,
    del: `text-decoration:line-through;`,
    mark: `background:linear-gradient(transparent 60%, ${o.color}33 60%);color:inherit;padding:0 2px;`,
    a: `color:${o.color};text-decoration:none;border-bottom:1px solid ${o.color};`,
    "a.wx-inner-link": `color:${o.color};text-decoration:none;`,
    ul: `margin:1em 0;padding-left:1.6em;list-style-type:disc;color:#3f3f3f;`,
    ol: `margin:1em 0;padding-left:1.6em;list-style-type:decimal;color:#3f3f3f;`,
    "ul ul": `list-style-type:circle;margin:0.2em 0;`,
    "ol ol, ul ol, ol ul": `margin:0.2em 0;`,
    li: `margin:0.3em 0;font-size:${fs}px;line-height:1.75;`,
    "li > section": `margin:0;`,
    hr: `border:none;border-top:1px solid #e5e5e5;margin:2em 0;height:0;`,
    "code.wx-inline": `font-family:${MONO};font-size:90%;color:#d14;background:rgba(27,31,35,0.05);padding:2px 4px;border-radius:4px;margin:0 2px;word-break:break-all;`,
    "section.wx-img": `margin:1.2em 0;text-align:center;`,
    img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;`,
    "img.wx-inline-img": `display:inline-block;vertical-align:middle;margin:0 2px;`,
    "figcaption, .wx-caption": `display:block;text-align:center;color:#999;font-size:${fs - 3}px;margin-top:6px;line-height:1.5;`,
    "section.wx-table": `margin:1.2em 0;overflow-x:auto;`,
    table: `border-collapse:collapse;width:100%;font-size:${fs - 2}px;`,
    th: `border:1px solid #dfdfdf;padding:6px 10px;background:#f6f8fa;font-weight:bold;text-align:left;`,
    td: `border:1px solid #dfdfdf;padding:6px 10px;`,
    "section.wx-footnotes": `margin-top:2.5em;font-size:${fs - 3}px;color:#888;`,
    "section.wx-footnotes p": `margin:0.3em 0;font-size:${fs - 3}px;color:#888;line-height:1.6;word-break:break-all;`,
    "section.wx-footnotes-title": `font-weight:bold;color:#555;margin-bottom:0.6em;font-size:${fs - 1}px;`,
    "sup.wx-fn-ref": `color:${o.color};font-size:75%;line-height:0;vertical-align:super;margin-left:1px;`,
    "section.wx-callout": `margin:1.2em 0;padding:10px 14px;border-radius:6px;border-left:4px solid ${o.color};background:${o.color}14;`,
    "section.wx-callout-title": `font-weight:bold;margin-bottom:4px;color:${o.color};font-size:${fs}px;`,
    "section.wx-callout p": `margin:0.4em 0;`,
    "p span.wx-br-line": `display:block;`,
    // 代码块外框（背景色由代码配色决定，写在元素自身上）
    "section.wx-codeblock": `margin:1.2em 0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12);text-align:left;`,
    // 结构装饰的默认样式
    "span.wx-h-num": `display:block;font-size:0.8em;color:${o.color};margin-bottom:4px;`,
    "section.wx-quote-mark": `font-family:Georgia,serif;font-size:40px;line-height:1;height:26px;color:${o.color};opacity:0.5;`,
    "section.wx-hr": `text-align:center;color:#bbb;letter-spacing:0.6em;margin:2em 0;font-size:14px;line-height:1;`,
    "section.wx-ending": `text-align:center;color:#999;font-size:13px;letter-spacing:0.3em;margin:3em 0 1em;`,
  };
}

function headingSizes(fs: number) {
  return { h1: fs + 9, h2: fs + 5, h3: fs + 3, h4: fs + 1 };
}

type Sizes = ReturnType<typeof headingSizes>;

/**
 * 一个主题只需声明与基础样式（base）不同的部分。
 * 注意公众号不支持 ::before/::after 伪元素，装饰只能靠元素本身的边框/背景，
 * 以及渲染器给标题内容包的那层 <span class="wx-h">。
 */
interface ThemeDef {
  id: string;
  name: string;
  /** 切换到该主题时使用的推荐主题色（之后仍可自行修改） */
  defaultColor: string;
  group?: ThemeGroup;
  decor?: ThemeDecor;
  build(o: ThemeOptions, s: Sizes, b: Record<string, string>): Record<string, string>;
}

const SERIF = "'Songti SC','STSong','Noto Serif SC','Source Han Serif SC',Georgia,serif";

const DEFS: ThemeDef[] = [
  // ================================================================ 网页风格
  {
    // Notion：暖灰文字、几乎无装饰、红色行内代码、浅灰表头
    id: "notion",
    name: "Notion 风",
    defaultColor: "#2383e2",
    group: "网页风格",
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:ui-sans-serif,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',Helvetica,sans-serif;`).replace("color:#3f3f3f", "color:#37352f").replace("letter-spacing:0.05em", "letter-spacing:0"),
      p: `margin:0.6em 0;font-size:${o.fontSize + 1}px;line-height:1.7;color:#37352f;`,
      strong: `font-weight:600;color:#37352f;`,
      a: `color:#37352f;text-decoration:underline;border-bottom:none;`,
      mark: `background:#fbf3db;color:inherit;padding:0 2px;`,
      h1: `margin:1.6em 0 0.4em;font-size:${s.h1 + 6}px;font-weight:700;color:#37352f;line-height:1.3;`,
      h2: `margin:1.6em 0 0.4em;font-size:${s.h2 + 3}px;font-weight:600;color:#37352f;line-height:1.3;`,
      h3: `margin:1.2em 0 0.3em;font-size:${s.h3 + 1}px;font-weight:600;color:#37352f;`,
      "h4, h5, h6": `margin:1em 0 0.3em;font-size:${s.h4}px;font-weight:600;color:#37352f;`,
      blockquote: `margin:0.8em 0;padding:0 0 0 14px;border-left:3px solid #37352f;color:#37352f;`,
      "blockquote p": `margin:0.3em 0;color:#37352f;font-size:${o.fontSize + 1}px;`,
      "code.wx-inline": `font-family:${MONO};font-size:85%;color:#eb5757;background:rgba(135,131,120,0.15);padding:2px 4px;border-radius:4px;margin:0 1px;word-break:break-all;`,
      "section.wx-codeblock": `margin:0.8em 0;border-radius:4px;overflow:hidden;text-align:left;`,
      hr: `border:none;border-top:1px solid rgba(55,53,47,0.16);margin:1.6em 0;height:0;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:3px;`,
      th: `border:1px solid rgba(55,53,47,0.09);padding:7px 9px;background:#f7f6f3;color:rgba(55,53,47,0.65);font-weight:500;text-align:left;`,
      td: `border:1px solid rgba(55,53,47,0.09);padding:7px 9px;color:#37352f;`,
      "section.wx-callout": `margin:0.8em 0;padding:14px 16px;border-radius:4px;background:#f1f1ef;`,
    }),
  },
  {
    // Medium：衬线正文、大字号大行距、“· · ·”分隔、引用只留一根黑线
    id: "medium",
    name: "Medium 风",
    defaultColor: "#1a8917",
    group: "网页风格",
    decor: { hr: "· · ·" },
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:Charter,Georgia,${SERIF};`).replace("color:#3f3f3f", "color:#242424").replace("letter-spacing:0.05em", "letter-spacing:0.01em"),
      p: `margin:1.5em 0 0;font-size:${o.fontSize + 3}px;line-height:1.85;color:#242424;`,
      strong: `font-weight:bold;color:#242424;`,
      a: `color:#242424;text-decoration:underline;border-bottom:none;`,
      h1: `margin:1.4em 0 0.6em;font-size:${s.h1 + 8}px;font-weight:bold;color:#242424;line-height:1.25;font-family:${FONT};letter-spacing:-0.01em;`,
      h2: `margin:2em 0 0.4em;font-size:${s.h2 + 4}px;font-weight:bold;color:#242424;line-height:1.3;font-family:${FONT};`,
      h3: `margin:1.6em 0 0.3em;font-size:${s.h3 + 2}px;font-weight:bold;color:#242424;font-family:${FONT};`,
      "h4, h5, h6": `margin:1.4em 0 0.3em;font-size:${s.h4 + 1}px;font-weight:bold;color:#242424;font-family:${FONT};`,
      blockquote: `margin:1.6em 0;padding:0 0 0 20px;border-left:3px solid #242424;color:#242424;font-style:italic;`,
      "blockquote p": `margin:0.5em 0;color:#242424;font-size:${o.fontSize + 3}px;`,
      li: `margin:0.6em 0;font-size:${o.fontSize + 3}px;line-height:1.8;`,
      "code.wx-inline": `font-family:${MONO};font-size:80%;color:#242424;background:#f2f2f2;padding:3px 4px;border-radius:3px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.6em 0;border-radius:4px;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:0;`,
      "section.wx-img": `margin:2em 0;text-align:center;`,
      "section.wx-hr": `text-align:center;color:#242424;letter-spacing:1em;margin:2.4em 0;font-size:24px;line-height:1;`,
    }),
  },
  {
    // GitHub README：标题下细灰线、灰色引用竖线、85% 行内代码
    id: "github",
    name: "GitHub 风",
    defaultColor: "#0969da",
    group: "网页风格",
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans','PingFang SC','Microsoft YaHei',Helvetica,Arial,sans-serif;`).replace("color:#3f3f3f", "color:#1f2328").replace("letter-spacing:0.05em", "letter-spacing:0").replace("line-height:1.75", "line-height:1.6"),
      p: `margin:0 0 16px;font-size:${o.fontSize}px;line-height:1.6;color:#1f2328;`,
      strong: `font-weight:600;color:#1f2328;`,
      a: `color:${o.color};text-decoration:none;border-bottom:none;`,
      mark: `background:#fff8c5;color:inherit;padding:0 2px;`,
      h1: `margin:24px 0 16px;font-size:${s.h1 + 6}px;font-weight:600;color:#1f2328;padding-bottom:0.3em;border-bottom:1px solid #d1d9e0;line-height:1.25;`,
      h2: `margin:24px 0 16px;font-size:${s.h2 + 2}px;font-weight:600;color:#1f2328;padding-bottom:0.3em;border-bottom:1px solid #d1d9e0;line-height:1.25;`,
      h3: `margin:24px 0 16px;font-size:${s.h3}px;font-weight:600;color:#1f2328;line-height:1.25;`,
      "h4, h5, h6": `margin:24px 0 16px;font-size:${s.h4}px;font-weight:600;color:#1f2328;`,
      blockquote: `margin:0 0 16px;padding:0 1em;border-left:0.25em solid #d1d9e0;color:#59636e;`,
      "blockquote p": `margin:0.4em 0;color:#59636e;`,
      ul: `margin:0 0 16px;padding-left:2em;list-style-type:disc;color:#1f2328;`,
      ol: `margin:0 0 16px;padding-left:2em;list-style-type:decimal;color:#1f2328;`,
      li: `margin:0.25em 0;font-size:${o.fontSize}px;line-height:1.6;`,
      "code.wx-inline": `font-family:${MONO};font-size:85%;color:#1f2328;background:rgba(129,139,152,0.12);padding:0.2em 0.4em;border-radius:6px;margin:0;word-break:break-all;`,
      "section.wx-codeblock": `margin:0 0 16px;border-radius:6px;overflow:hidden;text-align:left;`,
      hr: `border:none;border-top:4px solid #d1d9e0;margin:24px 0;height:0;`,
      th: `border:1px solid #d1d9e0;padding:6px 13px;background:#f6f8fa;font-weight:600;text-align:left;`,
      td: `border:1px solid #d1d9e0;padding:6px 13px;`,
      "section.wx-callout": `margin:0 0 16px;padding:8px 16px;border-radius:0;border-left:0.25em solid ${o.color};background:transparent;`,
    }),
  },
  {
    // Apple 产品页：大标题居中、章节编号、大留白、大圆角图片、居中的金句式引用
    id: "apple",
    name: "Apple 风",
    defaultColor: "#0071e3",
    group: "网页风格",
    decor: { h2Number: true },
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:'SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;`).replace("color:#3f3f3f", "color:#1d1d1f").replace("letter-spacing:0.05em", "letter-spacing:0.01em"),
      p: `margin:1.2em 0;font-size:${o.fontSize + 1}px;line-height:1.8;color:#1d1d1f;`,
      strong: `font-weight:600;color:#1d1d1f;`,
      a: `color:${o.color};text-decoration:none;border-bottom:none;`,
      h1: `margin:1.2em 0 0.8em;font-size:${s.h1 + 14}px;font-weight:700;color:#1d1d1f;text-align:center;line-height:1.15;letter-spacing:-0.01em;`,
      h2: `margin:3em 0 1em;font-size:${s.h2 + 9}px;font-weight:700;color:#1d1d1f;text-align:center;line-height:1.2;`,
      "span.wx-h-num": `display:block;font-size:13px;font-weight:600;color:#86868b;letter-spacing:0.2em;margin-bottom:10px;`,
      h3: `margin:2em 0 0.6em;font-size:${s.h3 + 3}px;font-weight:600;color:#1d1d1f;`,
      "h4, h5, h6": `margin:1.6em 0 0.4em;font-size:${s.h4}px;font-weight:600;color:#86868b;`,
      blockquote: `margin:2.4em 0;padding:0 8px;border:none;text-align:center;`,
      "blockquote p": `margin:0.4em 0;font-size:${o.fontSize + 6}px;line-height:1.5;font-weight:600;color:#1d1d1f;`,
      "code.wx-inline": `font-family:${MONO};font-size:88%;color:#1d1d1f;background:#f5f5f7;padding:2px 6px;border-radius:6px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.8em 0;border-radius:18px;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:18px;`,
      "section.wx-img": `margin:2.2em 0;text-align:center;`,
      "figcaption, .wx-caption": `display:block;text-align:center;color:#86868b;font-size:${o.fontSize - 2}px;margin-top:10px;`,
      hr: `border:none;border-top:1px solid #d2d2d7;margin:3em 0;height:0;`,
      th: `border:none;border-bottom:1px solid #d2d2d7;padding:10px;background:transparent;font-weight:600;text-align:left;`,
      td: `border:none;border-bottom:1px solid #e8e8ed;padding:10px;`,
      "section.wx-callout": `margin:1.6em 0;padding:18px 20px;border-radius:18px;border-left:none;background:#f5f5f7;`,
    }),
  },
  {
    // 少数派：红色竖条标题、“· · ·”分隔、文末 END
    id: "sspai",
    name: "少数派风",
    defaultColor: "#d71a1b",
    group: "网页风格",
    decor: { hr: "· · ·", ending: "— END —" },
    build: (o, s, b) => ({
      root: b.root.replace("color:#3f3f3f", "color:#292525"),
      p: `margin:1.3em 0;font-size:${o.fontSize + 1}px;line-height:1.85;color:#292525;`,
      strong: `font-weight:bold;color:#292525;border-bottom:2px solid ${o.color}99;`,
      h1: `margin:1.4em 0 1em;font-size:${s.h1 + 2}px;font-weight:bold;color:#292525;`,
      h2: `margin:2.2em 0 1em;font-size:${s.h2 + 1}px;font-weight:bold;color:#292525;border-left:4px solid ${o.color};padding-left:12px;line-height:1.4;`,
      h3: `margin:1.8em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#292525;`,
      "h3 > span.wx-h": `border-bottom:2px solid ${o.color};padding-bottom:2px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#292525;`,
      blockquote: `margin:1.4em 0;padding:12px 18px;background:#f7f7f7;border-left:3px solid #c4c4c4;color:#5d5d5d;`,
      "blockquote p": `margin:0.4em 0;color:#5d5d5d;`,
      "section.wx-hr": `text-align:center;color:${o.color};letter-spacing:0.8em;margin:2.2em 0;font-size:20px;line-height:1;`,
      "section.wx-ending": `text-align:center;color:#8e8787;font-size:13px;letter-spacing:0.3em;margin:3em 0 1em;`,
    }),
  },
  {
    // 新野兽派（Neo-Brutalism，Gumroad 一类）：粗黑描边、硬投影、高饱和黄/粉
    id: "brutal",
    name: "新野兽派",
    defaultColor: "#ffd23f",
    group: "网页风格",
    build: (o, s, b) => ({
      root: b.root.replace("color:#3f3f3f", "color:#111"),
      p: `margin:1.2em 0;font-size:${o.fontSize}px;line-height:1.8;color:#111;`,
      strong: `font-weight:900;color:#000;background:${o.color};padding:0 3px;`,
      a: `color:#000;text-decoration:none;border-bottom:2px solid #000;`,
      mark: `background:#ff90e8;color:#000;padding:0 3px;`,
      h1: `margin:1em 0 1.2em;font-size:${s.h1 + 2}px;font-weight:900;color:#000;text-align:center;background:${o.color};border:3px solid #000;box-shadow:6px 6px 0 #000;padding:14px 10px;`,
      h2: `margin:2.2em 0 1.2em;font-size:${s.h2}px;font-weight:900;color:#000;`,
      "h2 > span.wx-h": `display:inline-block;background:#ff90e8;border:2px solid #000;box-shadow:4px 4px 0 #000;padding:4px 14px;`,
      h3: `margin:1.8em 0 0.8em;font-size:${s.h3}px;font-weight:900;color:#000;`,
      "h3 > span.wx-h": `background:linear-gradient(transparent 55%, ${o.color} 55%);padding:0 2px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:900;color:#000;`,
      blockquote: `margin:1.6em 6px 1.6em 0;padding:12px 16px;background:#90e0ff;border:2px solid #000;box-shadow:5px 5px 0 #000;color:#000;`,
      "blockquote p": `margin:0.4em 0;color:#000;`,
      "code.wx-inline": `font-family:${MONO};font-size:88%;color:#000;background:#fff;border:1.5px solid #000;padding:1px 4px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.6em 6px 1.6em 0;border:2px solid #000;box-shadow:5px 5px 0 #000;border-radius:0;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border:2px solid #000;box-shadow:5px 5px 0 #000;border-radius:0;`,
      "section.wx-img": `margin:1.6em 6px 1.6em 0;text-align:center;`,
      hr: `border:none;border-top:3px solid #000;margin:2em 0;height:0;`,
      "section.wx-table": `margin:1.6em 6px 1.6em 0;overflow-x:auto;`,
      table: `border-collapse:collapse;width:100%;font-size:${o.fontSize - 2}px;border:2px solid #000;`,
      th: `border:2px solid #000;padding:8px 10px;background:${o.color};font-weight:900;text-align:left;color:#000;`,
      td: `border:2px solid #000;padding:8px 10px;color:#000;`,
      "section.wx-callout": `margin:1.6em 6px 1.6em 0;padding:12px 16px;border:2px solid #000;box-shadow:5px 5px 0 #000;border-radius:0;`,
    }),
  },
  {
    // 小红书：emoji 标题、胶囊色块、大圆角卡片
    id: "xhs",
    name: "小红书风",
    defaultColor: "#ff2442",
    group: "网页风格",
    decor: { headingPrefix: { h2: "📌 ", h3: "✨ " }, hr: "✿  ✿  ✿", ending: "— 完 —" },
    build: (o, s) => ({
      p: `margin:1.1em 0;font-size:${o.fontSize}px;line-height:1.9;color:#333;`,
      strong: `font-weight:bold;color:${o.color};`,
      mark: `background:${o.color}22;color:inherit;padding:0 3px;border-radius:3px;`,
      h1: `margin:1.2em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#333;text-align:center;`,
      "h1 > span.wx-h": `background:linear-gradient(transparent 60%, ${o.color}33 60%);padding:0 4px;`,
      h2: `display:table;margin:2em 0 1em;font-size:${s.h2 - 1}px;font-weight:bold;color:${o.color};background:${o.color}14;padding:6px 16px;border-radius:20px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3 - 1}px;font-weight:bold;color:#333;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#333;`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:#fff5f6;border:none;border-radius:14px;color:#666;`,
      "blockquote p": `margin:0.4em 0;color:#666;`,
      "code.wx-inline": `font-family:${MONO};font-size:90%;color:${o.color};background:${o.color}12;padding:2px 5px;border-radius:6px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.2em 0;border-radius:14px;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:14px;`,
      "section.wx-callout": `margin:1.2em 0;padding:12px 16px;border-radius:14px;border-left:none;`,
      "section.wx-hr": `text-align:center;color:${o.color}99;letter-spacing:0.3em;margin:2em 0;font-size:14px;line-height:1;`,
      "section.wx-ending": `text-align:center;color:${o.color};font-size:13px;letter-spacing:0.3em;margin:2.4em 0 1em;`,
    }),
  },
  {
    // 日系杂志（Kinfolk 一类）：衬线、细字号大编号、克制的大地色、居中引号
    id: "kinfolk",
    name: "日系杂志",
    defaultColor: "#a68a64",
    group: "网页风格",
    decor: { h2Number: true, headingPrefix: { h3: "— " }, quoteMark: "“", hr: "◇", ending: "FIN." },
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:${SERIF};`).replace("color:#3f3f3f", "color:#3a3a3a").replace("letter-spacing:0.05em", "letter-spacing:0.08em"),
      p: `margin:1.4em 0;font-size:${o.fontSize}px;line-height:2.1;color:#3a3a3a;text-align:justify;`,
      strong: `font-weight:600;color:#3a3a3a;`,
      a: `color:${o.color};text-decoration:none;border-bottom:1px solid ${o.color}88;`,
      h1: `margin:1.4em 0 1.4em;font-size:${s.h1}px;font-weight:500;color:#2a2a2a;text-align:center;letter-spacing:0.25em;`,
      h2: `margin:3em 0 1.4em;font-size:${s.h2 - 1}px;font-weight:500;color:#2a2a2a;text-align:center;letter-spacing:0.2em;`,
      "span.wx-h-num": `display:block;font-family:Georgia,'Times New Roman',serif;font-size:40px;font-weight:300;font-style:italic;color:${o.color};line-height:1.1;margin-bottom:10px;letter-spacing:0.05em;`,
      h3: `margin:2em 0 0.8em;font-size:${s.h3 - 1}px;font-weight:500;color:#555;letter-spacing:0.15em;`,
      "span.wx-h-pre": `color:${o.color};`,
      "h4, h5, h6": `margin:1.6em 0 0.6em;font-size:${s.h4 - 1}px;font-weight:500;color:#666;letter-spacing:0.1em;`,
      blockquote: `margin:2.4em 1em;padding:0;border:none;text-align:center;color:#777;`,
      "blockquote p": `margin:0.3em 0;color:#777;font-style:italic;text-align:center;`,
      "section.wx-quote-mark": `font-family:Georgia,serif;font-size:48px;line-height:1;height:30px;color:${o.color};`,
      "code.wx-inline": `font-family:${MONO};font-size:88%;color:#6b5a45;background:#f4efe8;padding:2px 5px;border-radius:2px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.8em 0;border-radius:2px;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:0;`,
      "section.wx-img": `margin:2.4em 0;text-align:center;`,
      "figcaption, .wx-caption": `display:block;text-align:center;color:#999;font-size:${o.fontSize - 3}px;margin-top:10px;font-style:italic;letter-spacing:0.1em;`,
      "section.wx-hr": `text-align:center;color:${o.color};margin:2.6em 0;font-size:14px;line-height:1;`,
      "section.wx-ending": `text-align:center;color:${o.color};font-family:Georgia,serif;font-style:italic;font-size:16px;letter-spacing:0.2em;margin:3em 0 1em;`,
      th: `border:none;border-bottom:1px solid #c9bda9;padding:8px 10px;background:transparent;font-weight:500;text-align:left;`,
      td: `border:none;border-bottom:1px solid #eee6da;padding:8px 10px;`,
    }),
  },
  {
    // 赛博朋克：深紫底卡片、霓虹粉/青发光标题、黄色重点
    id: "cyber",
    name: "赛博朋克",
    defaultColor: "#ff2bd6",
    group: "网页风格",
    decor: { headingPrefix: { h2: "// ", h3: "> " } },
    build: (o, s, b) => ({
      root: b.root.replace("color:#3f3f3f", "color:#d7d7f5") + "background:#140f2e;padding:22px 16px;border-radius:10px;",
      p: `margin:1.2em 0;font-size:${o.fontSize}px;line-height:1.8;color:#d7d7f5;`,
      strong: `font-weight:bold;color:#fcee0a;`,
      em: `font-style:italic;color:#c9c9ff;`,
      a: `color:#00f0ff;text-decoration:none;border-bottom:1px solid #00f0ff;`,
      mark: `background:${o.color}40;color:#fff;padding:0 2px;`,
      h1: `margin:0.6em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#00f0ff;text-align:center;letter-spacing:0.12em;text-shadow:0 0 8px rgba(0,240,255,0.8);`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:${o.color};border-bottom:1px solid ${o.color};padding-bottom:6px;text-shadow:0 0 6px ${o.color};font-family:${MONO};`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#00f0ff;font-family:${MONO};`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#c9c9ff;`,
      ul: `margin:1em 0;padding-left:1.6em;list-style-type:square;color:#d7d7f5;`,
      ol: `margin:1em 0;padding-left:1.6em;list-style-type:decimal;color:#d7d7f5;`,
      blockquote: `margin:1.2em 0;padding:10px 16px;border-left:3px solid #00f0ff;background:rgba(0,240,255,0.07);color:#b8b8e0;`,
      "blockquote p": `margin:0.4em 0;color:#b8b8e0;`,
      "code.wx-inline": `font-family:${MONO};font-size:90%;color:#fcee0a;background:rgba(252,238,10,0.1);padding:2px 5px;border-radius:3px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.4em 0;border:1px solid ${o.color};border-radius:6px;box-shadow:0 0 12px ${o.color}66;overflow:hidden;text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;border:1px solid #3b2e7a;`,
      hr: `border:none;border-top:1px solid #3b2e7a;margin:2em 0;height:0;`,
      th: `border:1px solid #3b2e7a;padding:6px 10px;background:#1c1446;color:#00f0ff;font-weight:bold;text-align:left;`,
      td: `border:1px solid #3b2e7a;padding:6px 10px;color:#d7d7f5;`,
      "figcaption, .wx-caption": `display:block;text-align:center;color:#8888b0;font-size:${o.fontSize - 3}px;margin-top:6px;`,
      "section.wx-footnotes": `margin-top:2.5em;font-size:${o.fontSize - 3}px;color:#8888b0;`,
      "section.wx-footnotes p": `margin:0.3em 0;font-size:${o.fontSize - 3}px;color:#8888b0;line-height:1.6;word-break:break-all;`,
      "section.wx-footnotes-title": `font-weight:bold;color:#c9c9ff;margin-bottom:0.6em;font-size:${o.fontSize - 1}px;`,
      "section.wx-callout p": `margin:0.4em 0;color:#d7d7f5;`,
    }),
  },
  {
    // Material Design 3：色块标题卡、带阴影的卡片、大圆角
    id: "material",
    name: "Material 卡片",
    defaultColor: "#6750a4",
    group: "网页风格",
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:Roboto,'Google Sans',-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;`).replace("color:#3f3f3f", "color:#1d1b20"),
      p: `margin:1.1em 0;font-size:${o.fontSize}px;line-height:1.75;color:#1d1b20;`,
      strong: `font-weight:bold;color:${o.color};`,
      h1: `margin:1em 0 1em;font-size:${s.h1 + 2}px;font-weight:500;color:#1d1b20;text-align:center;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:500;color:#fff;background:${o.color};border-radius:16px;padding:12px 18px;box-shadow:0 1px 3px rgba(0,0,0,0.3),0 4px 8px rgba(0,0,0,0.12);`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:500;color:${o.color};`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:500;color:#49454f;`,
      blockquote: `margin:1.4em 2px;padding:14px 18px;background:#fff;border:none;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.2),0 4px 10px rgba(0,0,0,0.08);color:#49454f;`,
      "blockquote p": `margin:0.4em 0;color:#49454f;`,
      "code.wx-inline": `font-family:${MONO};font-size:88%;color:${o.color};background:${o.color}14;padding:2px 6px;border-radius:8px;margin:0 2px;word-break:break-all;`,
      "section.wx-codeblock": `margin:1.4em 2px;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.3),0 4px 10px rgba(0,0,0,0.12);text-align:left;`,
      img: `max-width:100%;height:auto;display:block;margin:0 auto;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,0.2),0 4px 10px rgba(0,0,0,0.08);`,
      th: `border:none;border-bottom:1px solid #cac4d0;padding:10px;background:${o.color}14;font-weight:500;text-align:left;color:#1d1b20;`,
      td: `border:none;border-bottom:1px solid #e7e0ec;padding:10px;`,
      "section.wx-callout": `margin:1.4em 2px;padding:14px 18px;border-radius:16px;border-left:none;box-shadow:0 1px 3px rgba(0,0,0,0.15);`,
    }),
  },
];

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
  ...DEFS.map(({ id, name, defaultColor }) => ({ id, name, defaultColor, group: "网页风格" as ThemeGroup })),
];

/** 0.2.x 及更早的“经典”主题已被调色板主题取代，旧 ID 映射到风格最接近的新主题 */
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
  const palette = PALETTE_THEMES.find((t) => t.id === id);

  if (palette) {
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
      kind: "palette",
      id,
      name: palette.name,
      css: buildPaletteCss(palette, profile),
      decor: {},
      textColor: colors.text,
      fontSize: profile.fontSize,
      code,
      showMacCodeHeader: profile.showMacCodeHeader,
      captionMode: profile.figureCaptionMode,
      callout: "quote",
    };
  }

  const def = DEFS.find((d) => d.id === id) ?? DEFS[0];
  const fontSize = tune.fontSize ?? resolveProfile(req.layout).fontSize;
  const o: ThemeOptions = { color: req.themeColor || def.defaultColor, fontSize };
  const b = base(o);
  let styles = { ...b, ...def.build(o, headingSizes(fontSize), b) };
  styles = applyRhythm(styles, req.layout ?? "balanced", tune);
  return {
    kind: "decor",
    id: def.id,
    name: def.name,
    styles,
    decor: def.decor ?? {},
    textColor: styles.root.match(/(?:^|;)color:(#[0-9a-fA-F]{3,8})/)?.[1] ?? "#333333",
    fontSize,
    code: CODE_THEMES[tune.codeTheme ?? "one-dark"],
    showMacCodeHeader: tune.showMacCodeHeader ?? true,
    captionMode: tune.figureCaptionMode ?? "alt-first",
    callout: "typed",
  };
}

/**
 * 装饰主题有自己的字号与间距设计，排版模板只调“节奏”：
 * 行距、段距、对齐、首行缩进、左右留白；高级微调里显式设置的值再覆盖在上面。
 */
function applyRhythm(styles: Record<string, string>, layout: LayoutId, tune: Tune): Record<string, string> {
  const out = { ...styles };
  const append = (key: string, css: string) => (out[key] = (out[key] ?? "") + css);
  switch (layout) {
    case "compact":
      append("p", "line-height:1.6;margin-top:0.7em;margin-bottom:0.7em;");
      append("li", "line-height:1.6;margin:0.15em 0;");
      break;
    case "relaxed":
      append("p", "line-height:2.05;margin-top:1.6em;margin-bottom:1.6em;");
      append("li", "line-height:2;margin:0.5em 0;");
      break;
    case "column":
      append("root", "padding-left:12px;padding-right:12px;");
      append("p", "text-align:justify;text-indent:2em;line-height:1.9;");
      break;
  }
  if (tune.lineHeight) {
    append("p", `line-height:${tune.lineHeight};`);
    append("li", `line-height:${tune.lineHeight};`);
  }
  if (tune.textAlign) append("p", `text-align:${tune.textAlign};`);
  if (tune.paragraphIndent !== undefined) append("p", `text-indent:${tune.paragraphIndent ? "2em" : "0"};`);
  if (tune.contentSideIndent) append("root", `padding-left:${tune.contentSideIndent};padding-right:${tune.contentSideIndent};`);
  if (tune.customPageBackgroundColor) append("root", `background:${tune.customPageBackgroundColor};`);
  // 引用、图注、脚注里的段落不缩进
  append("blockquote p", "text-indent:0;");
  append("section.wx-callout p", "text-indent:0;");
  append("section.wx-footnotes p", "text-indent:0;");
  return out;
}
