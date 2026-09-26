import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { renderForWechat } from "./.build/render.mjs";

const md = readFileSync(new URL("./sample.md", import.meta.url), "utf8");
const res = await renderForWechat(md, {
  themeId: "classic", linkToFootnote: true,
  tune: { codeTheme: "one-dark", figureCaptionMode: "alt-first" },
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
assert.ok(h.includes(">小提示<") && !h.includes("[!tip]"), "callout（与引用同款、标题作为首行）");
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
    themeId: t.id, themeColor: t.defaultColor, linkToFootnote: true,
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
// 只保留 17 款调色板主题；已移除主题的旧 ID 自动映射
assert.equal(THEMES.length, 17, "主题数量");
assert.ok(THEMES.every((t) => t.group === "经典"), "只剩调色板主题");
const legacy = await renderForWechat(md, { themeId: "xhs", linkToFootnote: true, resolveImage: async (s) => s, parseHTML: (h) => new JSDOM(h).window.document });
const sunrise = await renderForWechat(md, { themeId: "sunrise", linkToFootnote: true, resolveImage: async (s) => s, parseHTML: (h) => new JSDOM(h).window.document });
assert.equal(legacy.html, sunrise.html, "旧 ID xhs → 朝阳橙");
console.log(`themes ok: ${THEMES.length} 个主题`);

// ---- 公式 / Mermaid / 排版模板 / 后台链接
const base = {
  themeId: "classic", linkToFootnote: true,
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

// ---- 调色板主题 × 排版模板 × 高级微调
{
  const r = (opts) => renderForWechat("## 标题\n\n> 引用\n\n正文第一行\n第二行", { ...base, ...opts }).then((x) => x.html);
  const solid = await r({ themeId: "classic" });
  assert.ok(/<h2 style="[^"]*display:table;[^"]*background:#0F4C81/.test(solid), "均衡版二级标题为主色色块");
  const capsule = await r({ themeId: "classic", tune: { h2Style: "capsule" } });
  assert.ok(/<h2 style="[^"]*border-radius:999px/.test(capsule), "高级微调可改标题款式");
  const custom = await r({ themeId: "classic", themeColor: "#ff0000" });
  assert.ok(custom.includes("background:#ff0000"), "自定义主题色覆盖调色板主色");
  assert.ok(/正文第一行<span style="[^"]*display:block[^"]*">第二行<\/span>/.test(solid), "单个换行渲染为换行（与 Obsidian 默认一致），续行为块级以继承首行缩进");
  assert.ok(!/<span style="[^"]*display:block[^"]*">第二行/.test(await r({ breaks: false })), "严格换行模式下不换行");
  const callout = await renderForWechat("> [!tip] 提示\n> 内容", { ...base, themeId: "neon-terminal" });
  assert.ok(/<blockquote style="[^"]*background:#1A293A/.test(callout.html), "调色板主题的 callout 就是引用块，吃到主题覆盖样式");
  // minimal 主题的 !important 覆盖：竖线变细、去掉底色
  const minimal = await r({ themeId: "minimal" });
  const bq = minimal.match(/<blockquote style="([^"]*)"/)[1];
  assert.ok(/border-left-width:2px/.test(bq) && /background:transparent/.test(bq), "cssOverrides 的 !important 生效：" + bq);
  assert.ok(bq.indexOf("border-left-width:2px") > bq.indexOf("border-left:4px"), "!important 的展开属性排在简写之后");
  // 旧主题 ID 自动映射
  assert.equal(await r({ themeId: "default" }), solid, "旧 ID default → classic");
  // 深色主题代码块配色来自调色板
  const neon = await renderForWechat("```js\nlet a = 1\n```", { ...base, themeId: "neon-terminal" });
  assert.ok(neon.html.includes("background:#0B111B"), "代码底色取主题 codeBackground");
  // 浅色代码配色不再配深色底
  const light = await renderForWechat("```js\nlet a = 1\n```", { ...base, tune: { codeTheme: "github" } });
  assert.ok(light.html.includes("background:#f6f8fa"), "GitHub 浅色代码配浅底");
}
console.log("palette themes ok");
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

// ---- 列表不能出现“空圆点”：公众号编辑器会把块级元素和标签间空白拆成空列表项
{
  const tight = "把你工作中经常遇到的英文词汇整理出来。来源可以是：\n\n- 你的英文邮件\n- 行业报告\n- 会议 PPT\n- 客户文档\n\n把这些文档丢给豆包工作";
  const loose = "来源可以是：\n\n- 你的英文邮件\n\n- 行业报告\n\n- 会议 PPT\n\n- 客户文档\n    - 嵌套一\n    - 嵌套二\n\n结尾";
  for (const [name, src] of [["紧凑列表", tight], ["松散列表", loose]]) {
    const html = (await renderForWechat(src, base)).html;
    const items = html.match(/<li[^>]*>[\s\S]*?(?=<li|<\/ul>|<\/ol>)/g) ?? [];
    assert.ok(items.length >= 4, `${name}：应有列表项`);
    items.forEach((li) => assert.ok(/[一-鿿A-Za-z]/.test(li.replace(/<[^>]+>/g, "")), `${name}：出现空列表项 ${li}`));
    assert.ok(!/<li[^>]*>\s*<(section|p)\b/.test(html), `${name}：列表项里不应有块级 section/p`);
    assert.ok(!/>\s+<(\/?)(li|ul|ol|p|section|blockquote|h[1-6]|table|tr|td|th)\b/.test(html), `${name}：块级标签之间不应有空白`);
  }
  // 行内元素之间的空格要保留
  const spaced = (await renderForWechat("hello **bold** *em* world", base)).html;
  assert.ok(/<\/strong> <em/.test(spaced), "行内元素之间的空格保留");
}
console.log("lists ok");
