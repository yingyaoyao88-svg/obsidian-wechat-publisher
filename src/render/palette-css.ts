/**
 * 调色板主题 × 排版模板 → 作用于 .wxp-root 的样式表（随后由 inline-css.ts 内联）。
 *
 * 版式规则移植自 RanceLee233/wechat-publisher 的 render-core（MIT，Copyright (c) 2026 RanceLee，
 * 许可声明见 palette-themes.ts），并按本插件的 DOM 结构调整了选择器：
 *   .wxp-highlight → mark，.wxp-footnote-ref → sup.wx-fn-ref，figcaption → .wx-caption，
 *   .wxp-code-block → section.wx-codeblock，行内 code → code.wx-inline，Obsidian callout → section.wx-callout。
 * calc() 在生成时直接算好，避免依赖公众号对 calc 的支持。
 */
import type { Palette, PaletteTheme } from "./palette-themes";
import { FONT_PRESET_STACKS, StyleProfile } from "./profiles";

/** "2.2em" + 0.5 → "2.7em"（模板里的标题间距都是 em） */
function em(value: string, delta: number): string {
  const m = value.match(/^(-?[\d.]+)em$/);
  return m ? `${+(parseFloat(m[1]) + delta).toFixed(3)}em` : value;
}

export function resolvePalette(theme: PaletteTheme, p: StyleProfile): Palette {
  return {
    ...theme.palette,
    primary: p.customPrimaryColor || theme.palette.primary,
    background: p.customPageBackgroundColor || theme.palette.background,
  };
}

export function paletteFont(theme: PaletteTheme, p: StyleProfile): string {
  return p.fontPreset && p.fontPreset !== "theme-default" ? FONT_PRESET_STACKS[p.fontPreset] : theme.fontFamily;
}

export function buildPaletteCss(theme: PaletteTheme, p: StyleProfile): string {
  const c = resolvePalette(theme, p);
  const r = theme.radius;
  const top = p.headingTopMargin;
  const bottom = p.headingBottomMargin;

  const h1 =
    p.h1Style === "solid"
      ? `.wxp-root h1{display:block;margin:${top} 8px ${bottom};padding:0.45em 0.8em;border-radius:${r};background:${c.primary};color:${c.background};font-size:1.45em;text-align:center;}`
      : p.h1Style === "outline"
        ? `.wxp-root h1{display:table;margin:${top} auto ${bottom};padding:0.35em 1.05em;border:2px solid ${c.primary};border-radius:999px;color:${c.primary};font-size:1.45em;text-align:center;}`
        : `.wxp-root h1{display:table;margin:${top} auto ${bottom};padding:0 1.1em 0.35em;border-bottom:3px solid ${c.primary};font-size:1.45em;text-align:center;}`;

  const h2 =
    p.h2Style === "plain"
      ? `.wxp-root h2{display:block;margin:${em(top, 0.5)} 8px ${em(bottom, 0.2)};padding-left:10px;border-left:4px solid ${c.primary};color:${c.primary};font-size:1.2em;}`
      : p.h2Style === "capsule"
        ? `.wxp-root h2{display:table;margin:${em(top, 0.45)} 8px ${em(bottom, 0.2)};padding:0.18em 0.95em;border:1px solid ${c.primary};border-radius:999px;background:${c.primarySoft};color:${c.primary};font-size:1.16em;}`
        : `.wxp-root h2{display:table;margin:${em(top, 0.5)} auto ${em(bottom, 0.2)};padding:0.2em 0.95em;border-radius:${r};background:${c.primary};color:${c.background};font-size:1.25em;text-align:center;}`;

  const h3 =
    p.h3Style === "capsule"
      ? `.wxp-root h3{display:table;margin:${em(top, -0.2)} 8px ${bottom};padding:0.16em 0.8em;border-radius:999px;background:${c.primarySoft};color:${c.primary};font-size:1.08em;}`
      : p.h3Style === "plain"
        ? `.wxp-root h3{margin:${em(top, -0.2)} 8px ${bottom};color:${c.primary};font-size:1.08em;}`
        : `.wxp-root h3{margin:${em(top, -0.2)} 8px ${bottom};padding-left:10px;border-left:4px solid ${c.primary};font-size:1.12em;}`;

  const h4 =
    p.h4Style === "plain"
      ? `.wxp-root h4,.wxp-root h5,.wxp-root h6{margin:${em(top, -0.7)} 8px ${em(bottom, -0.2)};color:${c.primary};font-size:1em;}`
      : p.h4Style === "eyebrow"
        ? `.wxp-root h4,.wxp-root h5,.wxp-root h6{display:table;margin:${em(top, -0.7)} 8px ${em(bottom, -0.15)};padding-bottom:0.28em;border-bottom:2px solid ${c.primarySoft};color:${c.secondary};letter-spacing:0.08em;font-size:0.96em;}`
        : `.wxp-root h4,.wxp-root h5,.wxp-root h6{display:table;margin:${em(top, -0.7)} 8px ${em(bottom, -0.15)};padding:0.05em 0.65em;border-radius:999px;background:${c.primarySoft};color:${c.primary};font-size:0.96em;}`;

  const quoteSel = ".wxp-root blockquote";
  const quote = {
    "card-soft": `margin:${p.paragraphMargin};padding:${p.blockquotePadding};border-top:1px solid ${c.border};border-bottom:1px solid ${c.border};border-radius:10px;background:${c.primarySoft};`,
    "card-square": `margin:${p.paragraphMargin};padding:${p.blockquotePadding};border:1px solid ${c.border};border-left:4px solid ${c.primary};border-radius:0;background:${c.quoteBackground};`,
    "bar-rounded": `margin:${p.paragraphMargin};padding:${p.blockquotePadding};border-left:4px solid ${c.primary};border-radius:${r};background:transparent;`,
    "bar-square": `margin:${p.paragraphMargin};padding:${p.blockquotePadding};border-left:4px solid ${c.primary};border-radius:0;background:transparent;`,
    "card-rounded": `margin:${p.paragraphMargin};padding:${p.blockquotePadding};border:1px solid ${c.border};border-left:4px solid ${c.primary};border-radius:${r};background:${c.quoteBackground};`,
  }[p.calloutStyleMode];

  return `
.wxp-root{font-family:${paletteFont(theme, p)};font-size:${p.fontSize}px;line-height:${p.lineHeight};color:${c.text};letter-spacing:${p.letterSpacing};background:${c.background};word-break:break-word;text-align:${p.textAlign};padding:12px ${p.contentSideIndent} 16px;}
.wxp-root h1,.wxp-root h2,.wxp-root h3,.wxp-root h4,.wxp-root h5,.wxp-root h6{color:${c.text};font-weight:${theme.headingWeight};line-height:1.35;}
${h1}
${h2}
${h3}
${h4}
.wxp-root p,.wxp-root ul,.wxp-root ol,.wxp-root section.wx-table{margin:${p.paragraphMargin};}
.wxp-root p{color:${c.text};margin:${p.paragraphMargin};text-indent:${p.paragraphIndent ? "2em" : "0"};font-size:inherit;line-height:inherit;}
.wxp-root ul,.wxp-root ol{margin-left:0;padding-left:1.6em;list-style-position:outside;color:${c.text};}
.wxp-root ul{list-style-type:disc;}
.wxp-root ol{list-style-type:decimal;}
.wxp-root li{display:list-item;margin:0.35em 0;font-size:inherit;line-height:inherit;}
.wxp-root li > ul,.wxp-root li > ol{margin:0.45em 0 0.1em;}
.wxp-root ol ol{list-style-type:lower-alpha;}
.wxp-root ol ol ol{list-style-type:lower-roman;}
.wxp-root a{color:${c.link};text-decoration:none;border-bottom:none;}
.wxp-root mark{padding:0 0.3em;border-radius:0.35em;background:${c.primarySoft};color:${c.primary};}
.wxp-root sup.wx-fn-ref{margin:0 0.12em;color:${c.primary};font-size:0.78em;vertical-align:super;line-height:0;}
.wxp-root strong{color:${c.primary};font-weight:bold;}
${quoteSel}{${quote}}
${quoteSel}{font-size:${p.fontSize}px;line-height:${p.lineHeight};color:${c.text};}
.wxp-root blockquote p,.wxp-root blockquote strong,.wxp-root blockquote em,.wxp-root blockquote a{font-size:inherit;line-height:inherit;color:inherit;}
.wxp-root blockquote p{text-indent:0;margin:0.4em 0;}
.wxp-root blockquote > :first-child{margin-top:0;}
.wxp-root blockquote > :last-child{margin-bottom:0;}
.wxp-root .wx-callout-title{font-weight:bold;color:${c.primary};margin-bottom:0.3em;}
.wxp-root p .wx-br-line{display:block;}
.wxp-root img{display:block;max-width:100%;height:auto;margin:0.4em auto 0.8em;border-radius:${p.imageBorderRadius};}
.wxp-root img.wx-diagram{background:#ffffff;padding:0.4em;}
.wxp-root section.wx-img{margin:${p.paragraphMargin};text-align:center;}
.wxp-root .wx-caption{display:block;margin:-0.2em 8px 1em;color:${c.secondary};font-size:0.88em;text-align:center;text-indent:0;}
.wxp-root hr{margin:2em 0;border:0;border-top:2px solid ${c.border};height:0;}
.wxp-root table{width:100%;border-collapse:collapse;background:${c.background};font-size:0.94em;}
.wxp-root th,.wxp-root td{padding:0.55em 0.7em;border:1px solid ${c.border};text-align:left;color:${c.text};}
.wxp-root th{background:${c.primarySoft};font-weight:bold;}
.wxp-root section.wx-codeblock{margin:${p.paragraphMargin};overflow:hidden;border-radius:${r};text-align:left;text-indent:0;}
.wxp-root code.wx-inline{padding:3px 6px;border-radius:6px;background:${c.primarySoft};color:${c.primary};font-size:0.92em;font-family:Menlo,Monaco,Consolas,'Courier New',monospace;}
.wxp-root section.wx-footnotes{margin:2.5em 8px 0;font-size:0.82em;color:${c.secondary};}
.wxp-root section.wx-footnotes p{margin:0.3em 0;color:${c.secondary};text-indent:0;word-break:break-all;line-height:1.6;}
.wxp-root section.wx-footnotes-title{font-weight:bold;color:${c.text};margin-bottom:0.6em;}
.wxp-root section.wx-hr{text-align:center;color:${c.secondary};margin:2em 0;}
.wxp-root section.wx-ending{text-align:center;color:${c.secondary};margin:3em 0 1em;letter-spacing:0.3em;font-size:0.85em;}
${theme.cssOverrides ?? ""}
`;
}
