import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";
import { preprocessObsidian } from "./preprocess";
import { LayoutId, MONO, resolveTheme, Theme, ThemeDecor } from "./theme";
import type { Tune } from "./profiles";
import { texToSvg } from "./math";
import { inlineCss } from "./inline-css";

export { THEMES, CODE_THEMES, normalizeThemeId, themeDefaultColor } from "./theme";
export { PROFILES, TUNE_OPTIONS, resolveProfile } from "./profiles";
export type { LayoutId, Tune, StyleProfile } from "./profiles";
export { stripFrontmatter } from "./preprocess";

export interface RenderOptions {
  themeId: string;
  /** 主题色；与主题默认色相同时视为未自定义 */
  themeColor?: string;
  /** 排版模板：均衡 / 紧凑 / 舒展 / 专栏 */
  layout?: LayoutId;
  /** 高级微调：覆盖排版模板里的任意字段（字号、标题款式、代码配色、图注…） */
  tune?: Tune;
  /** 外链转成文末脚注（未认证公众号正文里不能放外链） */
  linkToFootnote: boolean;
  /** 单个换行渲染为换行（与 Obsidian 默认一致；开启“严格换行”时传 false） */
  breaks?: boolean;
  /**
   * 把 Markdown 里写的图片地址（相对路径 / 双链文件名 / http 链接）换成最终地址：
   * 预览时是 Obsidian 本地资源地址，发布时是上传到微信后的 mmbiz.qpic.cn 地址。
   */
  resolveImage: (src: string) => Promise<string>;
  /**
   * 把 SVG（公式、Mermaid 图）变成 <img> 可用的地址。
   * 插件里用 canvas 栅格化成 PNG（公众号不收 SVG）；缺省时直接用 SVG data URI（仅用于测试/预览）。
   */
  rasterize?: (svg: string, kind: "math" | "diagram") => Promise<string>;
  /** Mermaid 源码 → SVG。缺省时 Mermaid 按普通代码块显示 */
  renderMermaid?: (code: string) => Promise<string>;
  /** 默认用全局 DOMParser；在 Node 测试里注入 jsdom */
  parseHTML?: (html: string) => Document;
}

export interface RenderResult {
  html: string;
  /** Markdown 中出现的原始图片地址（去重，按出现顺序） */
  images: string[];
  warnings: string[];
}

const CALLOUT_LABELS: Record<string, string> = {
  abstract: "摘要", summary: "摘要", attention: "注意", bug: "问题", caution: "提醒", check: "检查", danger: "警告",
  error: "错误", example: "示例", fail: "失败", failure: "失败", faq: "问答", help: "帮助", hint: "提示",
  important: "重点", info: "说明", note: "笔记", question: "问题", quote: "引用", cite: "引用", success: "完成",
  done: "完成", tip: "技巧", todo: "待办", warning: "警示", missing: "缺失",
};

const CALLOUT_COLORS: Record<string, [string, string]> = {
  note: ["#448aff", "ℹ️"], info: ["#448aff", "ℹ️"], abstract: ["#00b0ff", "📋"], summary: ["#00b0ff", "📋"],
  tip: ["#00bfa5", "💡"], hint: ["#00bfa5", "💡"], important: ["#00bfa5", "🔥"], success: ["#00c853", "✅"],
  check: ["#00c853", "✅"], done: ["#00c853", "✅"], question: ["#64dd17", "❓"], help: ["#64dd17", "❓"],
  faq: ["#64dd17", "❓"], warning: ["#ff9100", "⚠️"], caution: ["#ff9100", "⚠️"], attention: ["#ff9100", "⚠️"],
  failure: ["#ff5252", "❌"], fail: ["#ff5252", "❌"], missing: ["#ff5252", "❌"], danger: ["#ff1744", "⛔"],
  error: ["#ff1744", "⛔"], bug: ["#f50057", "🐞"], example: ["#7c4dff", "📝"], quote: ["#9e9e9e", "💬"],
  cite: ["#9e9e9e", "💬"], todo: ["#448aff", "☑️"],
};

function createMarkdown(breaks: boolean): InstanceType<typeof MarkdownIt> {
  const md: InstanceType<typeof MarkdownIt> = new MarkdownIt({
    html: true,
    linkify: true,
    breaks,
    typographer: false,
    highlight(code: string, lang: string): string {
      const language = (lang || "").trim().split(/\s+/)[0].toLowerCase();
      if (language === "mermaid") {
        return `<pre class="wx-mermaid" data-code="${encodeURIComponent(code)}"></pre>`;
      }
      let body: string;
      if (language && hljs.getLanguage(language)) {
        body = hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } else {
        body = md.utils.escapeHtml(code);
      }
      return `<pre class="wx-pre"><code class="wx-code" data-lang="${md.utils.escapeHtml(language)}">${body}</code></pre>`;
    },
  });
  return md;
}

const markdowns = { soft: createMarkdown(true), strict: createMarkdown(false) };

// ---------------------------------------------------------------- 代码块

function hljsColor(el: Element, palette: Record<string, string>): string | undefined {
  const scopes = Array.from(el.classList)
    .map((c) => c.replace(/^hljs-/, "").replace(/_+$/, ""))
    .filter(Boolean);
  if (!scopes.length) return undefined;
  const joined = scopes.join(".");
  return palette[joined] ?? palette[scopes[0]] ?? undefined;
}

/**
 * 公众号编辑器会把连续空格折叠、把 \n 当普通空白处理，
 * 所以代码块里：空格 → &nbsp;，Tab → 4 个 &nbsp;，换行 → <br>，
 * 再配合 white-space:nowrap + overflow-x:auto 实现横向滚动而不是自动折行。
 */
function normalizeCodeWhitespace(code: Element, doc: Document) {
  const walker = doc.createTreeWalker(code, 4 /* NodeFilter.SHOW_TEXT */);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  texts.forEach((t) => {
    const value = (t.nodeValue ?? "").replace(/\t/g, "    ").replace(/ /g, " ");
    if (!value.includes("\n")) {
      t.nodeValue = value;
      return;
    }
    const frag = doc.createDocumentFragment();
    value.split("\n").forEach((part, i) => {
      if (i > 0) frag.appendChild(doc.createElement("br"));
      if (part) frag.appendChild(doc.createTextNode(part));
    });
    t.parentNode!.replaceChild(frag, t);
  });
  // 去掉末尾多余的 <br>
  let last = code.lastChild;
  while (last && last.nodeName === "BR") {
    code.removeChild(last);
    last = code.lastChild;
  }
}

function macDots(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="13" viewBox="0 0 450 130" style="display:block;">` +
    `<ellipse cx="50" cy="65" rx="50" ry="52" fill="#ff5f56"/>` +
    `<ellipse cx="225" cy="65" rx="50" ry="52" fill="#ffbd2e"/>` +
    `<ellipse cx="400" cy="65" rx="50" ry="52" fill="#27c93f"/></svg>`
  );
}

function transformCodeBlocks(root: Element, doc: Document, theme: Theme) {
  const ct = theme.code;
  root.querySelectorAll("pre.wx-pre").forEach((pre) => {
    const code = pre.querySelector("code")!;
    code.querySelectorAll("span").forEach((span) => {
      const color = hljsColor(span, ct.palette);
      const italic = span.classList.contains("hljs-comment") || span.classList.contains("hljs-quote");
      const style = `${color ? `color:${color};` : ""}${italic ? "font-style:italic;" : ""}`;
      if (style) span.setAttribute("style", style);
      span.removeAttribute("class");
    });
    normalizeCodeWhitespace(code, doc);

    const wrapper = doc.createElement("section");
    wrapper.className = "wx-codeblock"; // 外框圆角/阴影/边框由主题决定
    wrapper.setAttribute("style", `background:${ct.background};`);
    if (theme.showMacCodeHeader) {
      const header = doc.createElement("section");
      header.setAttribute("style", `padding:8px 12px;background:${ct.headerBackground};line-height:1;`);
      header.innerHTML = macDots();
      wrapper.appendChild(header);
    }
    pre.setAttribute(
      "style",
      `margin:0;padding:12px 16px 14px;background:${ct.background};overflow-x:auto;border-radius:0;text-indent:0;`,
    );
    code.setAttribute(
      "style",
      `display:block;white-space:nowrap;font-family:${MONO};font-size:${theme.kind === "palette" ? 14 : 13}px;line-height:1.65;text-indent:0;` +
        `color:${ct.color};background:transparent;letter-spacing:0;padding:0;margin:0;word-break:normal;`,
    );
    pre.parentNode!.replaceChild(wrapper, pre);
    wrapper.appendChild(pre);
  });
}

// ---------------------------------------------------------------- 公式 / Mermaid

function svgDataUri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

async function transformMath(root: Element, doc: Document, opts: RenderOptions, theme: Theme, warnings: string[]) {
  const rasterize = opts.rasterize ?? (async (svg: string) => svgDataUri(svg));
  const color = theme.textColor;
  const exPx = theme.fontSize / 2; // MathJax 约定 1ex ≈ 0.5em
  const nodes = Array.from(root.querySelectorAll("span.wx-math, section.wx-math-block"));
  for (const node of nodes) {
    const display = node.tagName === "SECTION";
    const tex = decodeURIComponent(node.getAttribute("data-tex") ?? "");
    try {
      const m = texToSvg(tex, display, color);
      const img = doc.createElement("img");
      img.className = "wx-math-img";
      img.setAttribute("src", await rasterize(m.svg, "math"));
      img.setAttribute("alt", "");
      const w = (m.widthEx * exPx).toFixed(1);
      const h = (m.heightEx * exPx).toFixed(1);
      // 显式重置：主题里给普通图片加的边框/阴影/圆角不应作用在公式上
      const reset = "border:none;box-shadow:none;border-radius:0;padding:0;background:transparent;";
      if (display) {
        img.setAttribute("style", `${reset}display:block;margin:0 auto;width:${w}px;max-width:100%;height:auto;`);
        const wrap = doc.createElement("section");
        wrap.className = "wx-math-display";
        wrap.setAttribute("style", "margin:1em 0;text-align:center;overflow-x:auto;");
        wrap.appendChild(img);
        node.parentNode!.replaceChild(wrap, node);
      } else {
        const va = (m.verticalAlignEx * exPx).toFixed(1);
        img.setAttribute(
          "style",
          `${reset}display:inline-block;margin:0 1px;width:${w}px;height:${h}px;max-width:none;vertical-align:${va}px;`,
        );
        node.parentNode!.replaceChild(img, node);
      }
    } catch (e) {
      warnings.push((e as Error).message);
      const code = doc.createElement("code");
      code.textContent = display ? `$$${tex}$$` : `$${tex}$`;
      node.parentNode!.replaceChild(code, node);
    }
  }
}

/** Mermaid SVG 的逻辑宽度：优先 style 里的 max-width，其次 viewBox */
function diagramWidth(svg: string): number | null {
  const head = svg.match(/<svg[^>]*>/)?.[0] ?? "";
  const mw = head.match(/max-width:\s*([\d.]+)px/);
  if (mw) return parseFloat(mw[1]);
  const w = head.match(/\swidth="([\d.]+)(px)?"/);
  if (w) return parseFloat(w[1]);
  const vb = head.match(/viewBox="[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)/);
  return vb ? parseFloat(vb[1]) : null;
}

async function transformMermaid(root: Element, doc: Document, opts: RenderOptions, warnings: string[]) {
  const blocks = Array.from(root.querySelectorAll("pre.wx-mermaid"));
  for (const pre of blocks) {
    const code = decodeURIComponent(pre.getAttribute("data-code") ?? "");
    let replacement: Element | null = null;
    if (opts.renderMermaid) {
      try {
        const svg = await opts.renderMermaid(code);
        const src = await (opts.rasterize ?? (async (s: string) => svgDataUri(s)))(svg, "diagram");
        replacement = doc.createElement("section");
        replacement.className = "wx-img";
        const img = doc.createElement("img");
        img.className = "wx-diagram";
        img.setAttribute("src", src);
        img.setAttribute("alt", "");
        // PNG 按 3 倍分辨率栅格化，显示宽度要用图表本身的逻辑宽度，否则小图会被放大到整屏宽
        const w = diagramWidth(svg);
        if (w) img.setAttribute("style", `width:${Math.round(w)}px;max-width:100%;`);
        replacement.appendChild(img);
      } catch (e) {
        warnings.push(`Mermaid 渲染失败：${(e as Error).message}`);
      }
    }
    if (!replacement) {
      // 退化为普通代码块，交给后面的代码块处理
      replacement = doc.createElement("pre");
      replacement.className = "wx-pre";
      const c = doc.createElement("code");
      c.className = "wx-code";
      c.textContent = code.replace(/\n$/, "");
      replacement.appendChild(c);
    }
    pre.parentNode!.replaceChild(replacement, pre);
  }
}

// ---------------------------------------------------------------- 图片

async function transformImages(root: Element, doc: Document, opts: RenderOptions, theme: Theme, warnings: string[]) {
  const imgs = Array.from(root.querySelectorAll("img"));
  const resolved = new Map<string, string>();
  for (const img of imgs) {
    const raw = img.getAttribute("src") ?? "";
    if (!raw || resolved.has(raw)) continue;
    try {
      resolved.set(raw, await opts.resolveImage(raw));
    } catch (e) {
      warnings.push(`图片处理失败：${raw}（${(e as Error).message}）`);
      resolved.set(raw, raw);
    }
  }

  for (const img of imgs) {
    const raw = img.getAttribute("src") ?? "";
    img.setAttribute("src", resolved.get(raw) ?? raw);
    if (img.classList.contains("wx-math-img") || img.classList.contains("wx-diagram")) continue;

    // Obsidian 标准语法 ![描述|300](a.png) 的宽度写在 alt 里
    let alt = img.getAttribute("alt") ?? "";
    let width = img.getAttribute("data-width") ?? "";
    const m = alt.match(/^(.*?)\|?(\d+)(?:x\d+)?$/);
    if (!width && m && (alt.includes("|") || /^\d+$/.test(alt))) {
      alt = m[1];
      width = m[2];
    }
    img.setAttribute("alt", alt);
    img.removeAttribute("data-width");
    if (width) img.setAttribute("style", `width:${width}px;`);
  }

  // 只含图片的段落 → 居中的图片块（附图注）
  root.querySelectorAll("p").forEach((p) => {
    const meaningful = Array.from(p.childNodes).filter(
      (n) => !(n.nodeType === 3 && !(n.nodeValue ?? "").trim()) && n.nodeName !== "BR",
    );
    const isPicture = (n: ChildNode) => n.nodeName === "IMG" && !(n as Element).classList.contains("wx-math-img");
    if (!meaningful.length || !meaningful.every(isPicture)) return;
    const frag = doc.createDocumentFragment();
    meaningful.forEach((img) => {
      const block = doc.createElement("section");
      block.className = "wx-img";
      block.appendChild(img);
      const caption = pickCaption(img as Element, theme.captionMode);
      if (caption) {
        const cap = doc.createElement("section");
        cap.className = "wx-caption";
        cap.textContent = caption;
        block.appendChild(cap);
      }
      frag.appendChild(block);
    });
    p.parentNode!.replaceChild(frag, p);
  });
  root.querySelectorAll("img").forEach((img) => {
    if (img.classList.contains("wx-math-img")) return;
    if (!img.parentElement?.classList.contains("wx-img")) img.classList.add("wx-inline-img");
  });
}

/** 图注来源：none / 仅 alt / alt 优先 / title 优先（![alt](a.png "title")）；文件名式的 alt 不算图注 */
function pickCaption(img: Element, mode: Theme["captionMode"]): string {
  let alt = (img.getAttribute("alt") ?? "").trim();
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(alt)) alt = "";
  const title = (img.getAttribute("title") ?? "").trim();
  switch (mode) {
    case "none":
      return "";
    case "alt-only":
      return alt;
    case "title-first":
      return title || alt;
    default:
      return alt || title;
  }
}

// ---------------------------------------------------------------- 链接 → 脚注

function transformLinks(root: Element, doc: Document, opts: RenderOptions) {
  const notes: { text: string; href: string }[] = [];
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const text = a.textContent ?? "";
    // 公众号后台链接（cgi-bin）会让草稿接口判定 invalid content：只保留文字
    if (/^https?:\/\/mp\.weixin\.qq\.com\/cgi-bin\//.test(href)) {
      const span = doc.createElement("span");
      while (a.firstChild) span.appendChild(a.firstChild);
      a.parentNode!.replaceChild(span, a);
      return;
    }
    if (/^https?:\/\/mp\.weixin\.qq\.com\//.test(href)) {
      a.classList.add("wx-inner-link"); // 公众号文章链接可以直接点
      return;
    }
    if (!opts.linkToFootnote && /^https?:/.test(href)) return;

    const frag = doc.createDocumentFragment();
    const span = doc.createElement("span");
    while (a.firstChild) span.appendChild(a.firstChild);
    frag.appendChild(span);
    if (/^https?:/.test(href) && text.trim() !== href.trim()) {
      let idx = notes.findIndex((n) => n.href === href);
      if (idx === -1) {
        notes.push({ text, href });
        idx = notes.length - 1;
      }
      const sup = doc.createElement("sup");
      sup.className = "wx-fn-ref";
      sup.textContent = `[${idx + 1}]`;
      frag.appendChild(sup);
    }
    a.parentNode!.replaceChild(frag, a);
  });

  if (!notes.length) return;
  const box = doc.createElement("section");
  box.className = "wx-footnotes";
  const title = doc.createElement("section");
  title.className = "wx-footnotes-title";
  title.textContent = "参考链接";
  box.appendChild(title);
  notes.forEach((n, i) => {
    const p = doc.createElement("p");
    p.textContent = `[${i + 1}] ${n.text}: ${n.href}`;
    box.appendChild(p);
  });
  root.appendChild(box);
}

// ---------------------------------------------------------------- Callout

function transformCallouts(root: Element, doc: Document, mode: Theme["callout"]) {
  root.querySelectorAll("blockquote").forEach((bq) => {
    const first = bq.firstElementChild;
    if (!first || first.tagName !== "P") return;
    const m = first.innerHTML.match(/^\[!(\w+)\][+-]?[ \t]*([^\n]*)(\n|$)/);
    if (!m) return;
    const type = m[1].toLowerCase();
    const [color, icon] = CALLOUT_COLORS[type] ?? CALLOUT_COLORS.note;
    const label = m[2].trim() || CALLOUT_LABELS[type] || type.toUpperCase();
    // 调色板主题：callout 就是一个引用块（所有引用规则、主题覆盖都作用于它）；装饰主题：独立的彩色提示框
    const section = doc.createElement(mode === "quote" ? "blockquote" : "section");
    section.className = "wx-callout";
    const title = doc.createElement("section");
    title.className = "wx-callout-title";
    if (mode === "typed") {
      // 装饰主题：按类型着色 + 图标
      section.setAttribute("style", `border-left-color:${color};background:${color}14;`);
      title.setAttribute("style", `color:${color};`);
      title.innerHTML = `${icon} ${label}`;
    } else {
      // 调色板主题：与引用块同款，标题用主色
      title.innerHTML = label;
    }
    section.appendChild(title);

    first.innerHTML = first.innerHTML.slice(m[0].length);
    if (!first.innerHTML.trim()) first.remove();
    while (bq.firstChild) section.appendChild(bq.firstChild);
    bq.parentNode!.replaceChild(section, bq);
  });
}

// ---------------------------------------------------------------- 其它结构

function transformMisc(root: Element, doc: Document) {
  // 标题内容包一层 span，方便主题做“只给文字加下划线/底色”的装饰
  root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const span = doc.createElement("span");
    span.className = "wx-h";
    while (h.firstChild) span.appendChild(h.firstChild);
    h.appendChild(span);
  });
  // 行内代码
  root.querySelectorAll("code").forEach((c) => {
    if (!c.classList.contains("wx-code")) c.classList.add("wx-inline");
  });
  // 段落内的软换行：后续每一行变成块级 span，这样首行缩进（text-indent 会继承）对每一行都生效
  root.querySelectorAll("p").forEach((p) => {
    if (!p.querySelector(":scope > br")) return;
    const lines: ChildNode[][] = [[]];
    Array.from(p.childNodes).forEach((n) => {
      if (n.nodeName === "BR") lines.push([]);
      else lines[lines.length - 1].push(n);
    });
    if (lines.length < 2) return;
    p.innerHTML = "";
    lines.forEach((nodes, i) => {
      // 去掉 markdown-it 在 <br> 后留下的换行符
      if (nodes[0]?.nodeType === 3) nodes[0].nodeValue = (nodes[0].nodeValue ?? "").replace(/^\n/, "");
      if (i === 0) nodes.forEach((n) => p.appendChild(n));
      else {
        const line = doc.createElement("span");
        line.className = "wx-br-line";
        nodes.forEach((n) => line.appendChild(n));
        p.appendChild(line);
      }
    });
  });
  // 表格外包一层可横向滚动的容器
  root.querySelectorAll("table").forEach((t) => {
    const wrap = doc.createElement("section");
    wrap.className = "wx-table";
    t.parentNode!.replaceChild(wrap, t);
    wrap.appendChild(t);
  });
  // 列表项里的纯文本包进 section，避免公众号编辑器插入空行/丢样式
  root.querySelectorAll("li").forEach((li) => {
    if (li.firstElementChild && li.firstElementChild.tagName === "P") return;
    const sec = doc.createElement("section");
    const moved: ChildNode[] = [];
    for (const n of Array.from(li.childNodes)) {
      if (n.nodeName === "UL" || n.nodeName === "OL") break;
      moved.push(n);
    }
    if (!moved.length) return;
    li.insertBefore(sec, moved[0]);
    moved.forEach((n) => sec.appendChild(n));
  });
}

// ---------------------------------------------------------------- 主题装饰

function applyDecor(root: Element, doc: Document, decor: ThemeDecor) {
  const span = (cls: string, text: string) => {
    const el = doc.createElement("span");
    el.className = cls;
    el.textContent = text;
    return el;
  };
  const section = (cls: string, text: string) => {
    const el = doc.createElement("section");
    el.className = cls;
    el.textContent = text;
    return el;
  };

  (["h1", "h2", "h3", "h4"] as const).forEach((level) => {
    const pre = decor.headingPrefix?.[level];
    const suf = decor.headingSuffix?.[level];
    root.querySelectorAll(level).forEach((h) => {
      const content = h.querySelector("span.wx-h");
      if (!content) return;
      if (pre) h.insertBefore(span("wx-h-pre", pre), content);
      if (suf) h.appendChild(span("wx-h-suf", suf));
    });
  });

  if (decor.h2Number) {
    root.querySelectorAll("h2").forEach((h, i) => {
      h.insertBefore(span("wx-h-num", String(i + 1).padStart(2, "0")), h.firstChild);
    });
  }

  if (decor.quoteMark) {
    root.querySelectorAll("blockquote").forEach((bq) => {
      bq.insertBefore(section("wx-quote-mark", decor.quoteMark!), bq.firstChild);
    });
  }

  if (decor.hr) {
    root.querySelectorAll("hr").forEach((hr) => hr.parentNode!.replaceChild(section("wx-hr", decor.hr!), hr));
  }

  if (decor.ending) {
    // 放在“参考链接”之前
    const notes = Array.from(root.children).find((c) => c.classList.contains("wx-footnotes"));
    root.insertBefore(section("wx-ending", decor.ending), notes ?? null);
  }
}

// ---------------------------------------------------------------- 样式内联

function applyTheme(root: Element, styles: Record<string, string>) {
  const acc = new Map<Element, string>();
  const add = (el: Element, s: string) => acc.set(el, (acc.get(el) ?? "") + s);
  for (const [selector, style] of Object.entries(styles)) {
    if (selector === "root") {
      add(root, style);
      continue;
    }
    root.querySelectorAll(selector).forEach((el) => add(el, style));
  }
  // 主题样式在前，元素自身（代码块、图片宽度、callout 颜色等）样式在后，后者优先
  acc.forEach((themeStyle, el) => {
    el.setAttribute("style", themeStyle + (el.getAttribute("style") ?? ""));
  });
}

function cleanAttributes(root: Element) {
  const all = [root, ...Array.from(root.querySelectorAll("*"))];
  all.forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "class" || attr.name === "id" || attr.name.startsWith("data-")) {
        el.removeAttribute(attr.name);
      }
    }
  });
}

// ---------------------------------------------------------------- 入口

export async function renderForWechat(source: string, opts: RenderOptions): Promise<RenderResult> {
  const warnings: string[] = [];
  const md = opts.breaks === false ? markdowns.strict : markdowns.soft;
  const bodyHtml = md.render(preprocessObsidian(source));

  const parse = opts.parseHTML ?? ((h: string) => new DOMParser().parseFromString(h, "text/html"));
  const doc = parse(`<!DOCTYPE html><html><body><section id="wx-root">${bodyHtml}</section></body></html>`);
  const root = doc.getElementById("wx-root")!;

  const images: string[] = [];
  root.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src && !images.includes(src)) images.push(src);
  });

  const theme = resolveTheme({ themeId: opts.themeId, themeColor: opts.themeColor, layout: opts.layout, tune: opts.tune });

  transformCallouts(root, doc, theme.callout);
  await transformMath(root, doc, opts, theme, warnings);
  await transformMermaid(root, doc, opts, warnings);
  transformCodeBlocks(root, doc, theme);
  await transformImages(root, doc, opts, theme, warnings);
  transformLinks(root, doc, opts);
  transformMisc(root, doc);

  applyDecor(root, doc, theme.decor);
  if (theme.kind === "palette") {
    root.classList.add("wxp-root");
    inlineCss(root, theme.css);
  } else {
    applyTheme(root, theme.styles);
  }
  cleanAttributes(root);

  return { html: root.outerHTML, images, warnings };
}
