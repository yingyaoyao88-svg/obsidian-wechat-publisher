/**
 * 主题 = 「CSS 选择器 → 内联样式」的映射。
 *
 * 公众号编辑器会删除 <style>、class、id，只保留元素上的 style 属性，
 * 所以主题不能写成样式表，只能在渲染时逐个元素“烫”到 style 上。
 * 选择器只在渲染过程中使用（此时 class 还在），最终输出前 class 会被全部删除。
 */

export interface ThemeOptions {
  /** 主题色，如 #1e80ff */
  color: string;
  /** 正文字号 px */
  fontSize: number;
}

export interface Theme {
  id: string;
  name: string;
  styles: Record<string, string>;
}

export type CodeThemeId = "one-dark" | "github";

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
  };
}

function headingSizes(fs: number) {
  return { h1: fs + 9, h2: fs + 5, h3: fs + 3, h4: fs + 1 };
}

export function buildTheme(id: string, o: ThemeOptions): Theme {
  const s = headingSizes(o.fontSize);
  const b = base(o);
  switch (id) {
    case "orange":
      return {
        id,
        name: "暖橙",
        styles: {
          ...b,
          h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;text-align:center;color:#3f3f3f;`,
          "h1 > span.wx-h": `border-bottom:3px solid ${o.color};padding:0 4px 6px;`,
          h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;text-align:center;`,
          "h2 > span.wx-h": `display:inline-block;background:${o.color};color:#fff;padding:4px 14px;border-radius:16px;`,
          h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};`,
          "h3 > span.wx-h": `border-left:4px solid ${o.color};padding-left:8px;`,
          "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#3f3f3f;`,
          blockquote: `margin:1.2em 0;padding:12px 16px;background:#fff9f5;border-left:4px solid ${o.color};border-radius:4px;color:#666;`,
          "blockquote p": `margin:0.4em 0;color:#666;`,
        },
      };
    case "ink":
      return {
        id,
        name: "墨黑",
        styles: {
          ...b,
          root: b.root.replace("color:#3f3f3f", "color:#222"),
          strong: `font-weight:bold;color:#000;`,
          h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#000;`,
          h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#000;border-bottom:1px solid #000;padding-bottom:6px;`,
          h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#000;`,
          "h3 > span.wx-h": `border-bottom:2px solid ${o.color};padding-bottom:2px;`,
          "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#222;`,
          blockquote: `margin:1.2em 0;padding:4px 16px;border-left:3px solid #000;color:#555;`,
          "blockquote p": `margin:0.4em 0;color:#555;`,
        },
      };
    case "default":
    default:
      return {
        id: "default",
        name: "简约",
        styles: {
          ...b,
          h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#222;text-align:center;`,
          h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#222;`,
          "h2 > span.wx-h": `display:inline-block;border-bottom:2px solid ${o.color};padding-bottom:4px;`,
          h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#222;`,
          "h3 > span.wx-h": `border-left:4px solid ${o.color};padding-left:8px;`,
          "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#222;`,
          blockquote: `margin:1.2em 0;padding:10px 16px;background:#f7f7f7;border-left:4px solid #d0d0d0;color:#666;border-radius:2px;`,
          "blockquote p": `margin:0.4em 0;color:#666;`,
        },
      };
  }
}

export const THEMES: { id: string; name: string }[] = [
  { id: "default", name: "简约" },
  { id: "orange", name: "暖橙" },
  { id: "ink", name: "墨黑" },
];

export const CODE_THEMES: Record<CodeThemeId, CodeTheme> = {
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
