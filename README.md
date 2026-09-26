# WeChat Publisher — Obsidian 一键发布公众号

在 Obsidian 里写好文章（配图、代码块、封面），点一下：

1. 右侧弹出**公众号样式预览**（和最终在公众号里看到的效果是同一份 HTML）；
2. 点「**推送到草稿箱**」：自动上传所有图片和封面到微信，生成草稿，并打开公众号后台；
3. 或点「**复制**」：把带样式的正文复制到剪贴板，去公众号编辑器里 `Ctrl/Cmd+V`。

## 安装

> 仅支持**电脑版** Obsidian（Windows / macOS / Linux），版本 ≥ 1.4。手机版不可用。

### 方式一：下载安装包（推荐，不需要装任何开发工具）

1. 打开本仓库右侧的 **Releases**，下载最新版本里的 `wechat-publisher-x.y.z.zip`。
2. 找到你的库（vault）所在文件夹，进入其中的 `.obsidian/plugins/` 目录；没有 `plugins` 文件夹就新建一个。
   - `.obsidian` 是隐藏文件夹。最简单的找法：Obsidian → 设置 → **第三方插件** → 「已安装插件」右边的 📁 **文件夹图标**，会直接打开 `plugins` 目录。
   - 或手动显示隐藏文件：macOS 在访达里按 `Cmd + Shift + .`；Windows 在资源管理器「查看 → 显示 → 隐藏的项目」。
3. 把 zip 解压到这里，得到的目录结构应该是：
   ```
   <你的库>/.obsidian/plugins/wechat-publisher/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```
   ⚠️ 文件夹名必须是 `wechat-publisher`，三个文件要直接在它下面，不能再多套一层文件夹。
4. 回到 Obsidian → 设置 → **第三方插件**：
   - 如果显示「安全模式 / 受限模式」，先点**关闭**（开启第三方插件）；
   - 点「已安装插件」右边的 🔄 **刷新**，列表里出现 **WeChat Publisher**，打开右侧开关。
5. 左侧功能区出现一个 ✈️ 纸飞机图标，就表示安装成功。

### 方式二：用 BRAT 插件安装（以后可自动更新）

1. 在 Obsidian 社区插件市场搜索安装 **BRAT**（Obsidian42 - BRAT）并启用；
2. 命令面板（`Ctrl/Cmd + P`）运行 **BRAT: Add a beta plugin for testing**；
3. 填入仓库地址 `https://github.com/yingyaoyao88-svg/obsidian-wechat-publisher`，确认；
4. 到「第三方插件」里启用 WeChat Publisher。

> 如果仓库是私有的，需要先在 BRAT 设置里填一个有该仓库读取权限的 GitHub Token。

### 方式三：从源码构建（开发者）

需要 Node.js 22+：

```bash
git clone https://github.com/yingyaoyao88-svg/obsidian-wechat-publisher.git
cd obsidian-wechat-publisher
npm install
npm run build        # 生成 main.js
```

然后把 `main.js`、`manifest.json`、`styles.css` 复制到 `<你的库>/.obsidian/plugins/wechat-publisher/`，按方式一第 4 步启用。

### 更新插件

- 方式一：下载新版 zip，覆盖 `wechat-publisher` 文件夹里的三个文件（`data.json` 是你的设置，**不要删**），然后在「第三方插件」里把开关关掉再打开。
- 方式二：BRAT 会自动检查更新，也可以运行命令 **BRAT: Check for updates to all beta plugins**。

## 使用说明

### 第一次使用：配置公众号接口

> 只用「复制」功能可以跳过这一步；要「一键推送到草稿箱」必须配置。

1. 登录 [公众号后台](https://mp.weixin.qq.com/) → 左侧 **设置与开发 → 开发接口管理 → 基本配置**；
2. 复制 **AppID**；**AppSecret** 点「重置/启用」后复制（只显示一次，请妥善保存）；
3. Obsidian → 设置 → 左下方 **WeChat Publisher**，填入 AppID、AppSecret；
4. 点「**测试连接**」右边的「测试」：
   - 看到 ✅ **连接成功**，配置完成；
   - 看到错误 **40164 / invalid ip**：错误信息里会写出你当前的公网 IP（形如 `invalid ip 1.2.3.4`），回到公众号后台同一页面，把这个 IP 加进 **IP 白名单**，几分钟后再测一次。
5. 顺手在设置里填上**默认作者**，选一个喜欢的**主题**。

> 家庭宽带的公网 IP 可能会变。哪天推送突然报 40164，把新 IP 再加进白名单即可。
> AppSecret 明文保存在 `.obsidian/plugins/wechat-publisher/data.json`，不要把它同步到公开仓库。
> 接口权限以公众号后台「接口权限」页为准；没有草稿箱权限的账号可以用「复制」模式。

### 日常发文流程

**① 写文章**

像平时一样在 Obsidian 里写。图片直接拖进笔记即可（`![[图片.png]]` 或 `![](路径)` 都行），代码用 ```` ``` ```` 代码块。
在笔记开头加上属性（都可选，见下方「文章元数据」）：

```yaml
---
title: 我的第一篇文章
author: 张三
cover: "[[封面.png]]"
digest: 这是一段文章摘要
---
```

**② 打开预览**

点左侧 ✈️ 图标（或命令面板运行「**打开公众号预览**」），右侧会出现手机样式的预览：

- 你在左边改文字，预览会自动刷新；
- 顶部下拉框切换**主题**，旁边的色块改**主题色**；
- 工具栏下方的状态行显示图片数量和正文大小，超出公众号限制会提示。

**③ 发布（两种方式任选）**

| 方式 | 操作 | 适合 |
|---|---|---|
| **推送到草稿箱**（推荐） | 预览面板点「推送到草稿箱」；或命令面板运行「推送当前笔记到公众号草稿箱」；或在文件列表里右键笔记 →「推送到公众号草稿箱」 | 已配置接口。图片、封面全部自动上传 |
| **复制** | 预览面板点「复制」，然后在公众号编辑器正文里 `Ctrl/Cmd + V` | 没配置接口，或想在编辑器里继续手动调整 |

推送成功后，插件会打开公众号后台。到 **内容与互动 → 草稿箱** 找到这篇文章，检查无误后点「发表」。

> 同一篇笔记改完再推送，默认**更新原来那篇草稿**，不会重复新建（可在设置里关闭）。
> 已上传过的图片会记住，不会重复上传。

**④ 设置快捷键（可选）**

设置 → **快捷键**，搜索「WeChat」，给「推送当前笔记到公众号草稿箱」或「复制公众号格式」绑定一个快捷键，以后一键发布。

### 常见问题

| 现象 | 原因与解决 |
|---|---|
| 左侧没有 ✈️ 图标 / 插件列表里找不到 | 检查文件夹名是否为 `wechat-publisher`、三个文件是否直接在其中；在「第三方插件」点刷新 |
| 报错 40164 invalid ip | 本机公网 IP 不在白名单，按「第一次使用」第 4 步添加 |
| 报错 40125 / 40013 | AppSecret / AppID 填错，注意不要多复制空格 |
| 报错 48001 | 该公众号没有草稿箱接口权限，改用「复制」 |
| 提示「必须有封面」 | 在 frontmatter 写 `cover:`，或正文放一张图，或在设置里指定默认封面 |
| 提示找不到图片 | 图片不在库里，或路径写错；在 Obsidian 里能正常显示的图片都能找到 |
| 复制粘贴后部分图片不显示 | 未配置接口时图片以内嵌方式复制，个别图片需在编辑器里重新上传；配置接口后复制会先上传到微信，就不会有这个问题 |
| 报错 45002 / 正文太长 | 公众号要求正文少于 2 万字符，内联样式也算在内；把长文拆成两篇，或换一个装饰较少的主题（如「极简」「Notion 风」） |

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

发布新版本：同步修改 `manifest.json`、`package.json` 的 `version` 并在 `versions.json` 加一行，提交到 `main` 后，到仓库的 **Actions → Release → Run workflow** 手动运行（或推送同名标签 `git tag 0.2.0 && git push origin 0.2.0`），会自动测试、构建、打标签并创建 Release。

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
