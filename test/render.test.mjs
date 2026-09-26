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
