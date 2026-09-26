import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

/**
 * LaTeX → 独立 SVG 字符串。
 *
 * 公众号不支持 MathJax 脚本，也不能上传 SVG，所以公式要先变成 SVG，再由插件层栅格化成 PNG 上传。
 * 这里用 mathjax-full 自带的轻量 DOM（liteAdaptor），不依赖浏览器，Node 测试里也能跑。
 * fontCache: "none" 让每个 SVG 自带字形路径，不引用页面上的全局 <defs>，单独拿出来也能显示。
 */

type MathDoc = ReturnType<typeof mathjax.document>;
let adaptor: ReturnType<typeof liteAdaptor> | null = null;
let doc: MathDoc | null = null;

function ensure(): { adaptor: ReturnType<typeof liteAdaptor>; doc: MathDoc } {
  if (!adaptor || !doc) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    doc = mathjax.document("", {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: "none" }),
    });
  }
  return { adaptor, doc };
}

export interface MathSvg {
  svg: string;
  /** 宽高与基线偏移，单位 ex（MathJax 约定 1ex ≈ 0.5em） */
  widthEx: number;
  heightEx: number;
  verticalAlignEx: number;
}

export function texToSvg(tex: string, display: boolean, color = "#333333"): MathSvg {
  const { adaptor, doc } = ensure();
  const node = doc.convert(tex, { display });
  const svgNode = adaptor.firstChild(node) as Parameters<typeof adaptor.outerHTML>[0];
  let svg = adaptor.outerHTML(svgNode);
  const num = (re: RegExp) => parseFloat(svg.match(re)?.[1] ?? "0");
  const widthEx = num(/width="([\d.]+)ex"/);
  const heightEx = num(/height="([\d.]+)ex"/);
  const verticalAlignEx = num(/vertical-align:\s*(-?[\d.]+)ex/);
  if (/data-mjx-error|merror/.test(svg)) throw new Error(`公式语法错误：${tex}`);
  // 独立 SVG 需要显式颜色（currentColor 在 <img> 里没有继承对象）
  svg = svg.replace(/currentColor/g, color);
  return { svg, widthEx, heightEx, verticalAlignEx };
}
