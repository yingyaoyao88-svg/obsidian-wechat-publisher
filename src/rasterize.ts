import { loadMermaid } from "obsidian";

/**
 * SVG → PNG data URI。
 *
 * 公众号正文图片只接受 jpg/png，所以公式和 Mermaid 图都要栅格化。
 * 按 3 倍分辨率绘制，保证在手机高清屏上不糊；结果按内容缓存，预览时反复渲染也不卡。
 */

const cache = new Map<string, Promise<string>>();

function svgSize(svg: string): { w: number; h: number } {
  const vb = svg.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  const num = (attr: string) => {
    const m = svg.match(new RegExp(`<svg[^>]*\\s${attr}="([\\d.]+)(px)?"`));
    return m ? parseFloat(m[1]) : NaN;
  };
  let w = num("width");
  let h = num("height");
  // MathJax 用 ex 作单位：1ex ≈ 8px（16px 字号下）
  const ex = (attr: string) => {
    const m = svg.match(new RegExp(`<svg[^>]*\\s${attr}="([\\d.]+)ex"`));
    return m ? parseFloat(m[1]) * 8 : NaN;
  };
  if (isNaN(w)) w = ex("width");
  if (isNaN(h)) h = ex("height");
  if ((isNaN(w) || isNaN(h)) && vb) {
    const vw = parseFloat(vb[1]);
    const vh = parseFloat(vb[2]);
    if (isNaN(w) && isNaN(h)) {
      w = Math.min(vw, 1200);
      h = (w * vh) / vw;
    } else if (isNaN(w)) w = (h * vw) / vh;
    else h = (w * vh) / vw;
  }
  return { w: w || 600, h: h || 400 };
}

export function svgToPng(svg: string, kind: "math" | "diagram"): Promise<string> {
  const key = kind + svg;
  let p = cache.get(key);
  if (!p) {
    p = draw(svg, kind);
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  return p;
}

async function draw(svg: string, kind: "math" | "diagram"): Promise<string> {
  const { w, h } = svgSize(svg);
  // 固定像素尺寸，避免 width="100%" 之类在 <img> 里算成 0
  const sized = svg.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, "").replace(/max-width:[^;"]*;?/g, "");
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext("2d")!;
  if (kind === "diagram") {
    // 图表加白底：公众号深色模式下透明底会看不清
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

let mermaidSeq = 0;
const mermaidCache = new Map<string, Promise<string>>();

/**
 * 用 Obsidian 自带的 Mermaid 渲染；强制 htmlLabels:false，避免 foreignObject 导致 canvas 无法导出。
 * Mermaid 每次渲染都会生成新的元素 ID，所以按源码缓存，否则预览每次刷新都要重画所有图。
 */
export function renderMermaidSvg(code: string): Promise<string> {
  let p = mermaidCache.get(code);
  if (!p) {
    p = renderMermaidUncached(code);
    mermaidCache.set(code, p);
    p.catch(() => mermaidCache.delete(code));
    if (mermaidCache.size > 50) mermaidCache.delete(mermaidCache.keys().next().value as string);
  }
  return p;
}

async function renderMermaidUncached(code: string): Promise<string> {
  const mermaid = await loadMermaid();
  const directive = `%%{init: {"htmlLabels": false, "flowchart": {"htmlLabels": false}, "theme": "default"}}%%\n`;
  const id = `wx-mermaid-${Date.now()}-${mermaidSeq++}`;
  const result = await mermaid.render(id, directive + code);
  const svg: string = typeof result === "string" ? result : result.svg;
  document.getElementById(id)?.remove();
  document.getElementById("d" + id)?.remove();
  return svg;
}
