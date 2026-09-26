# WeChat Publisher — Obsidian 一键发布公众号

在 Obsidian 里写好文章（配图、代码块、封面），点一下：

1. 右侧弹出**公众号样式预览**（和最终在公众号里看到的效果是同一份 HTML）；
2. 点「**推送到草稿箱**」：自动上传所有图片和封面到微信，生成草稿，并打开公众号后台；
3. 或点「**复制**」：把带样式的正文复制到剪贴板，去公众号编辑器里 `Ctrl/Cmd+V`。

## 安装

```bash
npm install
npm run build        # 生成 main.js
```

把 `main.js`、`manifest.json`、`styles.css` 复制到
`<你的库>/.obsidian/plugins/wechat-publisher/`，在 Obsidian「第三方插件」里启用。

## 配置公众号接口（推送草稿箱需要）

1. 公众号后台 → 设置与开发 → 开发接口管理 → 基本配置，拿到 **AppID**、**AppSecret**；
2. 同一页面把**本机公网 IP** 加到 **IP 白名单**（不知道 IP 就先点插件设置里的「测试」，报错信息里会写出来）；
3. 填到插件设置里，点「测试」看到 ✅ 即可。

> AppSecret 明文保存在 `.obsidian/plugins/wechat-publisher/data.json`，不要把它同步到公开仓库。
> 接口权限以公众号后台「接口权限」页为准；没有草稿箱权限的账号可以用「复制」模式。

## 文章元数据（frontmatter，均可选）

```yaml
---
title: 文章标题            # 默认用文件名
author: 作者名             # 默认用设置里的默认作者
digest: 摘要，≤120 字      # 不填则公众号自动截取正文
cover: "[[封面.png]]"      # 不填则用正文第一张图，再没有就用设置里的默认封面
source_url: https://...   # 「阅读原文」链接
---
```

## 支持的写法

| Obsidian 写法 | 公众号里的效果 |
|---|---|
| `![[图.png]]`、`![[图.png\|300]]`、`![说明](a.png)` | 上传到微信图床，居中，可指定宽度，alt 作为图注 |
| ```` ```ts ```` 代码块 | 语法高亮（One Dark / GitHub），Mac 三色圆点，横向滚动不折行 |
| `[文字](https://...)` | 文字 + 上标 `[1]`，文末「参考链接」列出网址（公众号文章链接保持可点） |
| `> [!tip] 标题` callout | 彩色提示框 |
| `==高亮==`、`- [ ]` 任务、表格、嵌套列表、引用 | 对应样式 |
| `[[双链\|别名]]`、`%%注释%%`、frontmatter | 转为纯文本 / 删除 |

## 主题

在预览面板顶部或设置里切换（按「经典 / 网页风格」分组）。切换主题时会自动换成该主题的推荐色，之后可以用取色器再改。

**网页风格**：参考流行网站/设计潮流的版式语言，不只是换颜色。

| 主题 | 参考 | 版式特点 |
|---|---|---|
| Notion 风 | Notion 文档 | 暖灰文字、紧凑段距、红色行内代码、浅灰表头，几乎无装饰 |
| Medium 风 | Medium 博客 | 衬线大字号正文、`· · ·` 分隔、只留一根黑线的引用 |
| GitHub 风 | GitHub README | 标题下细灰线、灰色引用竖线、灰底行内代码 |
| Apple 风 | Apple 产品页 | 超大居中标题、章节编号 01/02、大圆角图片、居中金句式引用 |
| 少数派风 | 少数派 | 红色竖条标题、红色分隔点、文末 END |
| 新野兽派 | Neo-Brutalism（Gumroad 等） | 粗黑描边、硬投影、高饱和黄/粉色块 |
| 小红书风 | 小红书笔记 | 📌/✨ 标题、胶囊色块、大圆角卡片、✿ 分隔 |
| 日系杂志 | Kinfolk 一类生活方式杂志 | 衬线、斜体大编号、居中引号、◇ 分隔、FIN. 结尾 |
| 赛博朋克 | 霓虹/赛博风网页 | 深紫底卡片、霓虹发光标题、`//` `>` 标题前缀 |
| Material 卡片 | Material Design 3 | 色块标题卡、带阴影卡片、16px 圆角 |

**经典**：简约、暖橙、墨黑、薄荷绿、科技蓝、优雅紫、樱花粉、杂志、手账、极简、极客。

### 自定义主题

在 `src/render/theme.ts` 的 `DEFS` 里加一项：`build` 只写与基础样式不同的选择器；`decor` 声明需要真实插入的装饰：

| decor 字段 | 作用 | 对应可设置样式的选择器 |
|---|---|---|
| `headingPrefix` / `headingSuffix` | 标题前后加文字（emoji、`# ` 等） | `span.wx-h-pre` / `span.wx-h-suf` |
| `h2Number` | 二级标题自动编号 01、02… | `span.wx-h-num` |
| `quoteMark` | 引用块开头的大引号 | `section.wx-quote-mark` |
| `hr` | 用文字替代分隔线 | `section.wx-hr` |
| `ending` | 文末结束标记 | `section.wx-ending` |

公众号不支持 `::before/::after` 伪元素，所以这些装饰由渲染器插入真实元素。代码块外框（`section.wx-codeblock`）、图片、表格等也都可以按主题覆盖。

## 核心原理（为什么能“排版完全一致”）

**1. 公众号编辑器只保留内联样式。** 它会删掉 `<style>`、`class`、`id`，所以不能靠样式表。
插件用 markdown-it 把 Markdown 转成 HTML 后，把主题里每条「选择器 → 样式」逐个写进元素的 `style` 属性，
最后删除所有 class。代码高亮同理：highlight.js 生成的 `hljs-keyword` 等 class 被换成 `style="color:…"`。

**2. 代码块的空白必须显式化。** 公众号会折叠连续空格、忽略 `\n`，所以缩进空格 → `&nbsp;`，Tab → 4 个 `&nbsp;`，
换行 → `<br>`，再配合 `white-space:nowrap; overflow-x:auto` 让长行横向滚动。

**3. 图片必须在微信图床上。** 正文图片调用 `media/uploadimg`（仅 jpg/png、≤1MB）换成 `mmbiz.qpic.cn` 地址；
超限或 webp/bmp/svg 等格式先用 canvas 重新编码压缩；GIF 走 `material/add_material` 保留动图；
封面必须是永久素材的 `media_id`。已上传的图片按「路径+修改时间+大小」缓存，重复推送不会重复上传。

**4. 预览 = 发布。** 预览面板和发布调用同一个 `renderForWechat()`，只是图片地址不同（本地资源 vs 微信图床），
并且渲染在 Shadow DOM 里，隔离 Obsidian 自己的 CSS。

**5. 跨域。** 微信接口不允许浏览器跨域调用，插件使用 Obsidian 的 `requestUrl`（由 Electron 主进程发出）绕开 CORS。

## 开发

```bash
npm run dev    # 监听构建
npm test       # 渲染层单元测试（Node + jsdom，不依赖 Obsidian）
```

```
src/
  main.ts            插件入口：命令、功能区按钮、推送草稿 / 复制流程
  preview.ts         右侧预览面板（Shadow DOM）
  settings.ts        设置页
  render/
    preprocess.ts    Obsidian 方言 → 标准 Markdown
    theme.ts         主题（选择器 → 内联样式）与代码配色
    index.ts         渲染管线：markdown-it → DOM 变换 → 样式内联
  wechat/
    api.ts           access_token、图片上传、草稿新建/更新
    images.ts        图片定位、压缩、上传缓存
```

## 已知限制

- 数学公式（LaTeX）、Mermaid 图暂不支持（可先导出为图片）。
- 接口文档要求正文少于 2 万字符、小于 1MB；内联样式会占用字符数，超长文章建议拆分（预览面板会提示）。
- 仅桌面端可用（依赖剪贴板写入和 Electron 网络请求）。
