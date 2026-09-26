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
  build(o: ThemeOptions, s: Sizes, b: Record<string, string>): Record<string, string>;
}

const SERIF = "'Songti SC','STSong','Noto Serif SC','Source Han Serif SC',Georgia,serif";

const DEFS: ThemeDef[] = [
  {
    id: "default",
    name: "简约",
    defaultColor: "#1e80ff",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#222;text-align:center;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#222;`,
      "h2 > span.wx-h": `display:inline-block;border-bottom:2px solid ${o.color};padding-bottom:4px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#222;`,
      "h3 > span.wx-h": `border-left:4px solid ${o.color};padding-left:8px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#222;`,
      blockquote: `margin:1.2em 0;padding:10px 16px;background:#f7f7f7;border-left:4px solid #d0d0d0;color:#666;border-radius:2px;`,
      "blockquote p": `margin:0.4em 0;color:#666;`,
    }),
  },
  {
    id: "orange",
    name: "暖橙",
    defaultColor: "#ff7e33",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;text-align:center;color:#3f3f3f;`,
      "h1 > span.wx-h": `border-bottom:3px solid ${o.color};padding:0 4px 6px;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;text-align:center;`,
      "h2 > span.wx-h": `display:inline-block;background:${o.color};color:#fff;padding:4px 14px;border-radius:16px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};`,
      "h3 > span.wx-h": `border-left:4px solid ${o.color};padding-left:8px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#3f3f3f;`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:#fff9f5;border-left:4px solid ${o.color};border-radius:4px;color:#666;`,
      "blockquote p": `margin:0.4em 0;color:#666;`,
    }),
  },
  {
    id: "ink",
    name: "墨黑",
    defaultColor: "#333333",
    build: (o, s, b) => ({
      root: b.root.replace("color:#3f3f3f", "color:#222"),
      strong: `font-weight:bold;color:#000;`,
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#000;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#000;border-bottom:1px solid #000;padding-bottom:6px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#000;`,
      "h3 > span.wx-h": `border-bottom:2px solid ${o.color};padding-bottom:2px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#222;`,
      blockquote: `margin:1.2em 0;padding:4px 16px;border-left:3px solid #000;color:#555;`,
      "blockquote p": `margin:0.4em 0;color:#555;`,
    }),
  },
  {
    id: "mint",
    name: "薄荷绿",
    defaultColor: "#16a085",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:${o.color};text-align:center;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#2c3e50;background:${o.color}14;border-left:5px solid ${o.color};padding:8px 12px;border-radius:0 6px 6px 0;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};`,
      "h3 > span.wx-h": `border-bottom:2px dotted ${o.color};padding-bottom:2px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#2c3e50;`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:${o.color}0f;border:1px solid ${o.color}40;border-radius:8px;color:#4a5b5a;`,
      "blockquote p": `margin:0.4em 0;color:#4a5b5a;`,
      hr: `border:none;border-top:2px dashed ${o.color}66;margin:2em 0;height:0;`,
    }),
  },
  {
    id: "tech",
    name: "科技蓝",
    defaultColor: "#0066ff",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#fff;text-align:center;background:linear-gradient(135deg, ${o.color}, #00c6ff);padding:14px 10px;border-radius:8px;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;`,
      "h2 > span.wx-h": `display:inline-block;color:#fff;background:linear-gradient(90deg, ${o.color}, #00c6ff);padding:5px 16px 5px 12px;border-radius:0 20px 20px 0;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};border-bottom:1px dashed ${o.color}80;padding-bottom:6px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:${o.color};`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:#f0f6ff;border-left:4px solid ${o.color};color:#4a5568;border-radius:0 6px 6px 0;`,
      "blockquote p": `margin:0.4em 0;color:#4a5568;`,
      "code.wx-inline": `font-family:${MONO};font-size:90%;color:${o.color};background:${o.color}14;padding:2px 5px;border-radius:4px;margin:0 2px;word-break:break-all;`,
    }),
  },
  {
    id: "purple",
    name: "优雅紫",
    defaultColor: "#8e44ad",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:${o.color};text-align:center;letter-spacing:0.1em;`,
      h2: `margin:2.2em 0 1.2em;font-size:${s.h2}px;font-weight:bold;text-align:center;color:${o.color};`,
      "h2 > span.wx-h": `display:inline-block;border-top:1px solid ${o.color};border-bottom:1px solid ${o.color};padding:6px 18px;letter-spacing:0.12em;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#333;`,
      "h3 > span.wx-h": `background:linear-gradient(transparent 65%, ${o.color}33 65%);padding:0 2px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:${o.color};`,
      strong: `font-weight:bold;color:${o.color};background:${o.color}12;padding:0 2px;border-radius:2px;`,
      blockquote: `margin:1.4em 0;padding:14px 18px;background:#faf7fc;border-left:3px solid ${o.color};color:#666;font-style:italic;`,
      "blockquote p": `margin:0.4em 0;color:#666;`,
    }),
  },
  {
    id: "rose",
    name: "樱花粉",
    defaultColor: "#e8638c",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:${o.color};text-align:center;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;text-align:center;`,
      "h2 > span.wx-h": `display:inline-block;color:${o.color};background:${o.color}1a;border:1px solid ${o.color}55;padding:5px 18px;border-radius:20px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};`,
      "h3 > span.wx-h": `border-left:4px solid ${o.color};border-radius:2px;padding-left:8px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#555;`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:#fff5f8;border:1px dashed ${o.color}99;border-radius:10px;color:#7a5a64;`,
      "blockquote p": `margin:0.4em 0;color:#7a5a64;`,
      hr: `border:none;border-top:1px dashed ${o.color}99;margin:2em 0;height:0;`,
    }),
  },
  {
    id: "magazine",
    name: "杂志",
    defaultColor: "#c0392b",
    build: (o, s, b) => ({
      root: b.root.replace(/font-family:[^;]+;/, `font-family:${SERIF};`) + "text-align:justify;",
      p: `margin:1.3em 0;font-size:${o.fontSize}px;line-height:1.9;color:#2b2b2b;`,
      strong: `font-weight:bold;color:#1a1a1a;`,
      h1: `margin:1.4em 0 1.2em;font-size:${s.h1 + 3}px;font-weight:bold;color:#111;text-align:center;letter-spacing:0.15em;`,
      h2: `margin:2.4em 0 1.2em;font-size:${s.h2}px;font-weight:bold;color:#111;text-align:center;border-top:3px double #111;border-bottom:1px solid #111;padding:8px 0;letter-spacing:0.1em;`,
      h3: `margin:1.8em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};letter-spacing:0.05em;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#333;`,
      blockquote: `margin:1.6em 0;padding:14px 10px;border-top:1px solid #ccc;border-bottom:1px solid #ccc;color:#555;text-align:center;font-style:italic;`,
      "blockquote p": `margin:0.4em 0;color:#555;font-size:${o.fontSize + 1}px;`,
      "figcaption, .wx-caption": `display:block;text-align:center;color:#888;font-size:${o.fontSize - 3}px;margin-top:6px;line-height:1.5;font-style:italic;`,
    }),
  },
  {
    id: "paper",
    name: "手账",
    defaultColor: "#d35400",
    build: (o, s, b) => ({
      root: b.root + "background:#fdf8ee;padding:16px 14px;border-radius:6px;",
      p: `margin:1.2em 0;font-size:${o.fontSize}px;line-height:1.8;color:#4a3f35;`,
      strong: `font-weight:bold;color:${o.color};`,
      h1: `margin:1.2em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#4a3f35;text-align:center;`,
      "h1 > span.wx-h": `border-bottom:2px dashed ${o.color};padding-bottom:4px;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;color:#4a3f35;`,
      "h2 > span.wx-h": `display:inline-block;background:#f7e3c3;border-radius:4px;padding:4px 12px;border-bottom:3px solid ${o.color};`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:${o.color};`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#4a3f35;`,
      blockquote: `margin:1.2em 0;padding:12px 16px;background:#fffdf7;border:1px dashed #c9b28f;border-radius:8px;color:#6b5d4f;`,
      "blockquote p": `margin:0.4em 0;color:#6b5d4f;`,
      th: `border:1px solid #e0d2b8;padding:6px 10px;background:#f7ecd8;font-weight:bold;text-align:left;`,
      td: `border:1px solid #e0d2b8;padding:6px 10px;`,
      hr: `border:none;border-top:2px dotted #c9b28f;margin:2em 0;height:0;`,
    }),
  },
  {
    id: "minimal",
    name: "极简",
    defaultColor: "#555555",
    build: (o, s) => ({
      p: `margin:1.4em 0;font-size:${o.fontSize}px;line-height:2;color:#444;`,
      strong: `font-weight:bold;color:#111;`,
      a: `color:#111;text-decoration:none;border-bottom:1px solid #999;`,
      h1: `margin:1.6em 0 1.2em;font-size:${s.h1}px;font-weight:600;color:#111;`,
      h2: `margin:2.4em 0 1em;font-size:${s.h2}px;font-weight:600;color:#111;`,
      h3: `margin:2em 0 0.8em;font-size:${s.h3}px;font-weight:600;color:#333;`,
      "h4, h5, h6": `margin:1.6em 0 0.6em;font-size:${s.h4}px;font-weight:600;color:#555;`,
      blockquote: `margin:1.4em 0;padding:0 0 0 16px;border-left:2px solid #ddd;color:#777;`,
      "blockquote p": `margin:0.4em 0;color:#777;`,
      "sup.wx-fn-ref": `color:${o.color};font-size:75%;line-height:0;vertical-align:super;margin-left:1px;`,
    }),
  },
  {
    id: "geek",
    name: "极客",
    defaultColor: "#00b894",
    build: (o, s) => ({
      h1: `margin:1.4em 0 1em;font-size:${s.h1}px;font-weight:bold;color:#2d3436;font-family:${MONO};`,
      "h1 > span.wx-h": `border-bottom:3px solid ${o.color};padding-bottom:4px;`,
      h2: `margin:2em 0 1em;font-size:${s.h2}px;font-weight:bold;font-family:${MONO};`,
      "h2 > span.wx-h": `display:inline-block;background:#2d3436;color:${o.color};padding:4px 12px;border-radius:4px;`,
      h3: `margin:1.6em 0 0.8em;font-size:${s.h3}px;font-weight:bold;color:#2d3436;font-family:${MONO};`,
      "h3 > span.wx-h": `border-left:6px solid ${o.color};padding-left:8px;`,
      "h4, h5, h6": `margin:1.4em 0 0.6em;font-size:${s.h4}px;font-weight:bold;color:#2d3436;font-family:${MONO};`,
      strong: `font-weight:bold;color:#2d3436;border-bottom:2px solid ${o.color};`,
      blockquote: `margin:1.2em 0;padding:10px 16px;background:#f5f6fa;border-left:4px solid #2d3436;color:#555;font-family:${MONO};font-size:${o.fontSize - 1}px;`,
      "blockquote p": `margin:0.4em 0;color:#555;font-size:${o.fontSize - 1}px;`,
      "code.wx-inline": `font-family:${MONO};font-size:90%;color:${o.color};background:#2d3436;padding:2px 5px;border-radius:3px;margin:0 2px;word-break:break-all;`,
    }),
  },
];

export function buildTheme(id: string, o: ThemeOptions): Theme {
  const def = DEFS.find((d) => d.id === id) ?? DEFS[0];
  const b = base(o);
  return { id: def.id, name: def.name, styles: { ...b, ...def.build(o, headingSizes(o.fontSize), b) } };
}

export const THEMES: { id: string; name: string; defaultColor: string }[] = DEFS.map(({ id, name, defaultColor }) => ({
  id,
  name,
  defaultColor,
}));

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
