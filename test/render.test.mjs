import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { renderForWechat } from "./.build/render.mjs";

const md = readFileSync(new URL("./sample.md", import.meta.url), "utf8");
const res = await renderForWechat(md, {
  themeId: "default", themeColor: "#1e80ff", fontSize: 15, codeTheme: "one-dark",
  macCodeBlock: true, linkToFootnote: true, imageCaption: true,
  resolveImage: async (src) => `https://mmbiz.qpic.cn/fake/${encodeURIComponent(src)}`,
  parseHTML: (h) => new JSDOM(h).window.document,
});
writeFileSync(new URL("./.build/out.html", import.meta.url), `<meta charset=utf-8><div style="max-width:420px;margin:auto">${res.html}</div>`);

const h = res.html;
assert.deepEqual(res.images, ["pic one.png", "assets/a.jpg"]);
assert.ok(!/class=|<style/.test(h), "不应残留 class / <style>");
assert.ok(!h.includes("测试文章"), "frontmatter 应被去掉");
assert.ok(!h.includes("隐藏注释"), "%% 注释应被去掉");
assert.ok(h.includes("别名") && !h.includes("[[另一篇"), "双链转文本");
assert.ok(h.includes("[[x]] ==y=="), "行内代码内不转换");
assert.ok(h.includes("<mark"), "高亮");
assert.ok(h.includes("https://mmbiz.qpic.cn/fake/pic%20one.png") && h.includes("width:300px"), "图片替换+宽度");
assert.ok(h.includes("图注文字"), "图注");
assert.ok(h.includes("[1] 外链: https://example.com"), "外链转脚注");
assert.ok(/<br>/.test(h) && h.includes("<br>&nbsp;&nbsp;&nbsp;&nbsp;<span"), "代码空白处理");
assert.ok(h.includes("color:#c678dd"), "代码高亮内联颜色");
assert.ok(h.includes("💡 小提示"), "callout");
assert.ok(!h.includes("[[不应处理]]"), "callout 内双链也会转文本");
assert.ok(h.includes("☐") && h.includes("☑"), "任务列表");
assert.ok(res.warnings.length === 0, res.warnings.join());
console.log("render ok, html length =", h.length);

// ---- 所有主题都能渲染、互不相同、且不残留 class
import { THEMES } from "./.build/render.mjs";
const seen = new Set();
let gallery = "";
for (const t of THEMES) {
  assert.match(t.defaultColor, /^#[0-9a-f]{6}$/i, `${t.id} 推荐色需为 6 位十六进制（样式里会拼接透明度）`);
  const r = await renderForWechat(md, {
    themeId: t.id, themeColor: t.defaultColor, fontSize: 15, codeTheme: "one-dark",
    macCodeBlock: true, linkToFootnote: true, imageCaption: true,
    resolveImage: async (src) => src,
    parseHTML: (h) => new JSDOM(h).window.document,
  });
  assert.ok(!/class=|<style/.test(r.html), `${t.id} 残留 class`);
  assert.ok(!r.html.includes("undefined"), `${t.id} 样式里出现 undefined`);
  assert.ok(!seen.has(r.html), `${t.id} 与其它主题输出完全相同`);
  seen.add(r.html);
  gallery += `<div style="width:400px;flex:none;border:1px solid #ddd;padding:8px"><div style="font:bold 14px sans-serif;margin-bottom:6px">${t.name}（${t.id}）</div>${r.html}</div>`;
}
writeFileSync(new URL("./.build/gallery.html", import.meta.url), `<meta charset=utf-8><body style="display:flex;flex-wrap:wrap;gap:12px;width:1700px">${gallery}</body>`);
// 结构装饰确实插入了
const renderWith = (id) => renderForWechat(md, {
  themeId: id, themeColor: THEMES.find((t) => t.id === id).defaultColor, fontSize: 15, codeTheme: "one-dark",
  macCodeBlock: true, linkToFootnote: true, imageCaption: true, resolveImage: async (s) => s,
  parseHTML: (h) => new JSDOM(h).window.document,
});
const xhs = (await renderWith("xhs")).html;
assert.ok(xhs.includes("📌 ") && xhs.includes("✨ ") && xhs.includes("✿") && xhs.includes("— 完 —"), "小红书风装饰");
assert.ok(xhs.indexOf("— 完 —") < xhs.indexOf("参考链接"), "结束标记应在参考链接之前");
const kin = (await renderWith("kinfolk")).html;
assert.ok(kin.includes(">01<") && kin.includes(">02<") && kin.includes("“") && kin.includes("FIN."), "日系杂志编号/引号/结尾");
assert.ok(!kin.includes("<hr"), "hr 已替换成文字分隔");
const brutal = (await renderWith("brutal")).html;
assert.ok(brutal.includes("box-shadow:5px 5px 0 #000"), "新野兽派代码框硬投影");
console.log(`themes ok: ${THEMES.length} 个主题`);

// ---- 公式 / Mermaid / 排版模板 / 后台链接
const base = {
  themeId: "default", themeColor: "#1e80ff", fontSize: 15, codeTheme: "one-dark",
  macCodeBlock: true, linkToFootnote: true, imageCaption: true,
  resolveImage: async (s) => s, parseHTML: (h) => new JSDOM(h).window.document,
};
{
  const r = await renderForWechat(md, base);
  const imgs = r.html.match(/<img[^>]+data:image\/svg\+xml[^>]*>/g) ?? [];
  assert.equal(imgs.length, 2, "一个行内公式 + 一个块公式应渲染为 SVG 图片");
  assert.ok(/vertical-align:-?[\d.]+px/.test(imgs.join("")), "行内公式有基线对齐");
  assert.ok(r.html.includes("价格 $5 和 $10 不是公式"), "美元金额不被当成公式");
  assert.ok(r.html.includes("转义 $x$ 也不是"), "转义的 $ 保留为普通文字");
  assert.ok(r.html.includes("graph&nbsp;TD"), "无 Mermaid 渲染器时退化为代码块");
  assert.ok(r.html.includes("素材库") && !r.html.includes("cgi-bin"), "公众号后台链接只保留文字");
  assert.ok(!r.images.some((s) => s.startsWith("data:")), "公式不计入正文图片（不会被当成封面）");
  assert.deepEqual(r.warnings, []);
}
{
  let asked = "";
  const r = await renderForWechat(md, {
    ...base,
    renderMermaid: async (code) => { asked = code; return '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'; },
    rasterize: async (svg, kind) => `https://example.test/${kind}.png`,
  });
  assert.ok(asked.includes("A[开始] --> B[结束]"), "Mermaid 源码原样交给渲染器");
  assert.ok(r.html.includes("https://example.test/diagram.png") && r.html.includes("https://example.test/math.png"), "栅格化结果被使用");
}
{
  const bad = await renderForWechat("$$\\frac{1}{$$", base);
  assert.equal(bad.warnings.length, 1, "公式语法错误给出警告");
  assert.ok(bad.html.includes("<code"), "错误公式退化为代码显示");
}
for (const layout of ["compact", "relaxed", "column"]) {
  const r = await renderForWechat(md, { ...base, layout });
  const bal = await renderForWechat(md, base);
  assert.notEqual(r.html, bal.html, `${layout} 排版模板生效`);
}
const col = (await renderForWechat(md, { ...base, layout: "column" })).html;
assert.ok(col.includes("text-indent:2em"), "专栏版首行缩进");
console.log("math/mermaid/layout ok");

// ---- 账号粘贴识别 / 40164 IP 解析
import { parseAccountText, parseBlockedIp } from "./.build/parse.mjs";
assert.equal(
  parseBlockedIp("invalid ip 39.148.225.201 ipv6 ::ffff:39.148.225.201, not in whitelist rid: 6ab77960-701459bd-1a85764f"),
  "39.148.225.201",
);
assert.equal(parseBlockedIp("invalid appsecret"), null);
const pasted = parseAccountText(`基础信息
公众号
我的技术小站
AppID
wx0123456789abcdef
开发密钥
AppSecret
0123456789abcdef0123456789abcdef
API IP 白名单`);
assert.deepEqual(pasted, { appId: "wx0123456789abcdef", appSecret: "0123456789abcdef0123456789abcdef", name: "我的技术小站" });
assert.equal(parseAccountText("随便一段文字"), null);
console.log("parse ok");
