/**
 * 调色板主题数据（17 款）。
 *
 * 移植自 RanceLee233/wechat-publisher（theme-pack），MIT License：
 *
 *   Copyright (c) 2026 RanceLee
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 *
 * 每款主题只描述「调色板 + 圆角 + 标题字重」（以及少量 cssOverrides），
 * 具体版式由排版模板（style profile）决定，见 profiles.ts / palette-css.ts。
 */

export interface Palette {
  primary: string;
  primarySoft: string;
  secondary: string;
  text: string;
  background: string;
  surface: string;
  border: string;
  link: string;
  codeBackground: string;
  codeText: string;
  quoteBackground: string;
}

export interface PaletteTheme {
  id: string;
  name: string;
  description: string;
  radius: string;
  headingWeight: number;
  fontFamily: string;
  palette: Palette;
  /** 以 .wxp-root 为作用域的补充 CSS，支持 !important */
  cssOverrides?: string;
}

export const PALETTE_THEMES: PaletteTheme[] = [
  {
    "id": "classic",
    "name": "经典蓝",
    "description": "经典蓝白，接近公众号常见教程排版。",
    "radius": "8px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#0F4C81",
      "primarySoft": "#EAF2FA",
      "secondary": "#576B95",
      "text": "#2F3440",
      "background": "#FFFFFF",
      "surface": "#F6F8FB",
      "border": "#D9E2EC",
      "link": "#576B95",
      "codeBackground": "#0D1117",
      "codeText": "#E6EDF3",
      "quoteBackground": "#F7F7F7"
    }
  },
  {
    "id": "graphite",
    "name": "石墨灰",
    "description": "冷静的深灰金属风，适合产品说明。",
    "radius": "10px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Avenir Next', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#2F3A4A",
      "primarySoft": "#EEF2F7",
      "secondary": "#5D7285",
      "text": "#25303B",
      "background": "#FFFFFF",
      "surface": "#F3F5F7",
      "border": "#CED6DE",
      "link": "#415B76",
      "codeBackground": "#161B22",
      "codeText": "#E6EDF3",
      "quoteBackground": "#F5F7FA"
    }
  },
  {
    "id": "maple",
    "name": "枫糖棕",
    "description": "暖色杂志感，适合故事和观点文。",
    "radius": "10px",
    "headingWeight": 700,
    "fontFamily": "'Georgia', 'PingFang SC', 'Hiragino Sans GB', serif",
    "palette": {
      "primary": "#9E4B32",
      "primarySoft": "#FBEEE8",
      "secondary": "#7C6857",
      "text": "#473B35",
      "background": "#FFFDF9",
      "surface": "#FBF5EE",
      "border": "#E9D6C7",
      "link": "#8A4A35",
      "codeBackground": "#2B211D",
      "codeText": "#F6E9E2",
      "quoteBackground": "#F9F0E8"
    }
  },
  {
    "id": "mint",
    "name": "薄荷绿",
    "description": "清爽的薄荷绿，适合轻教程和知识卡片。",
    "radius": "12px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Trebuchet MS', Arial, sans-serif",
    "palette": {
      "primary": "#1F8A70",
      "primarySoft": "#E8F7F3",
      "secondary": "#3C7D73",
      "text": "#26433C",
      "background": "#FFFFFF",
      "surface": "#F3FBF8",
      "border": "#CCE8E0",
      "link": "#1E7F68",
      "codeBackground": "#0F2420",
      "codeText": "#D9F4EC",
      "quoteBackground": "#EEF8F4"
    }
  },
  {
    "id": "sunrise",
    "name": "朝阳橙",
    "description": "高对比橙黄，适合运营和增长内容。",
    "radius": "12px",
    "headingWeight": 800,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#C96A1B",
      "primarySoft": "#FFF3E6",
      "secondary": "#A55D24",
      "text": "#4B3B2B",
      "background": "#FFFDF8",
      "surface": "#FFF7EE",
      "border": "#F0D7BB",
      "link": "#B85F18",
      "codeBackground": "#2A1D11",
      "codeText": "#FFEBD7",
      "quoteBackground": "#FFF3E4"
    }
  },
  {
    "id": "lake",
    "name": "湖水青",
    "description": "偏青色的内容页，适合专业讲解。",
    "radius": "10px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#15616D",
      "primarySoft": "#E7F4F6",
      "secondary": "#3C7680",
      "text": "#244047",
      "background": "#FFFFFF",
      "surface": "#F2FAFB",
      "border": "#C9E0E4",
      "link": "#165C68",
      "codeBackground": "#102125",
      "codeText": "#D7EEF2",
      "quoteBackground": "#EEF7F8"
    }
  },
  {
    "id": "newspaper",
    "name": "报刊风",
    "description": "更像专栏文章的报刊风。",
    "radius": "4px",
    "headingWeight": 700,
    "fontFamily": "'Georgia', 'Songti SC', 'PingFang SC', serif",
    "palette": {
      "primary": "#111111",
      "primarySoft": "#F3F0E7",
      "secondary": "#555555",
      "text": "#222222",
      "background": "#FFFDF7",
      "surface": "#FAF6EC",
      "border": "#DDD3BD",
      "link": "#3E5C76",
      "codeBackground": "#1C1C1C",
      "codeText": "#F5F5F5",
      "quoteBackground": "#F3EEE1"
    },
    "cssOverrides": "h1,h2{text-transform:none;} blockquote{font-style:italic;} table{background:#fff;}"
  },
  {
    "id": "forest",
    "name": "森林绿",
    "description": "深绿系，适合方法论和长期主义主题。",
    "radius": "12px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#365B43",
      "primarySoft": "#EEF5F0",
      "secondary": "#56745B",
      "text": "#25352B",
      "background": "#FCFEFC",
      "surface": "#F4F8F4",
      "border": "#D5E2D6",
      "link": "#41684E",
      "codeBackground": "#172019",
      "codeText": "#D8E8DA",
      "quoteBackground": "#EFF5EF"
    }
  },
  {
    "id": "minimal",
    "name": "极简白",
    "description": "黑白灰 · 大留白，适合观点长文和深度阅读。",
    "radius": "4px",
    "headingWeight": 700,
    "fontFamily": "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#222222",
      "primarySoft": "#F5F5F5",
      "secondary": "#666666",
      "text": "#222222",
      "background": "#FFFFFF",
      "surface": "#FAFAFA",
      "border": "#E5E5E5",
      "link": "#222222",
      "codeBackground": "#1A1A1A",
      "codeText": "#F0F0F0",
      "quoteBackground": "#FFFFFF"
    },
    "cssOverrides": ".wxp-root blockquote{border-left-width:2px!important;background:transparent!important;padding-left:18px!important;color:#333!important;font-style:normal!important;}.wxp-root h1,.wxp-root h2,.wxp-root h3,.wxp-root h4{letter-spacing:-0.2px;}"
  },
  {
    "id": "editorial",
    "name": "编辑部",
    "description": "厚横线 + 高对比，像专栏杂志的版式。",
    "radius": "2px",
    "headingWeight": 800,
    "fontFamily": "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#1A1A1A",
      "primarySoft": "#F4F2ED",
      "secondary": "#555555",
      "text": "#1A1A1A",
      "background": "#FFFFFF",
      "surface": "#FAFAFA",
      "border": "#E3E0D7",
      "link": "#1A1A1A",
      "codeBackground": "#0F0F0F",
      "codeText": "#F5F5F5",
      "quoteBackground": "#F4F2ED"
    },
    "cssOverrides": ".wxp-root h1{letter-spacing:-0.5px;border-bottom:4px solid #1A1A1A;padding-bottom:6px;}.wxp-root hr{border:none;border-top:4px solid #1A1A1A;}.wxp-root blockquote{border-left:none!important;border-radius:2px!important;padding:18px 22px!important;font-weight:500!important;color:#2a2a2a!important;background:#F4F2ED!important;}"
  },
  {
    "id": "ink",
    "name": "墨卡",
    "description": "米色卡片 · 温润克制，像一页淡雅的韩系博客。",
    "radius": "8px",
    "headingWeight": 600,
    "fontFamily": "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#5A5145",
      "primarySoft": "#F7F6F3",
      "secondary": "#9A8F82",
      "text": "#3A3A3A",
      "background": "#FFFFFF",
      "surface": "#F7F6F3",
      "border": "#D9CFBF",
      "link": "#5A5145",
      "codeBackground": "#2B221B",
      "codeText": "#F0E8DC",
      "quoteBackground": "#F7F6F3"
    },
    "cssOverrides": ".wxp-root blockquote{border-left:none!important;color:#5A5145!important;}.wxp-root h2{border-bottom:2px solid #D9CFBF;padding-bottom:3px;display:inline-block;}"
  },
  {
    "id": "warm",
    "name": "暖栗色",
    "description": "米黄底 + 栗色主色 + 圆角，手感柔和。",
    "radius": "10px",
    "headingWeight": 700,
    "fontFamily": "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#8A4B28",
      "primarySoft": "#F4E8D4",
      "secondary": "#A48060",
      "text": "#3A2A1A",
      "background": "#FDF8EF",
      "surface": "#F4E8D4",
      "border": "#E6D3B3",
      "link": "#6A3820",
      "codeBackground": "#2B1F14",
      "codeText": "#F6E9D8",
      "quoteBackground": "#F4E8D4"
    },
    "cssOverrides": ".wxp-root h2{color:#6A3820!important;}.wxp-root blockquote{border:1px solid #E6D3B3!important;color:#6A4020!important;}"
  },
  {
    "id": "techno",
    "name": "技术流",
    "description": "深蓝标题 + 薄荷引用 + 代码块友好，适合技术/工具文。",
    "radius": "4px",
    "headingWeight": 700,
    "fontFamily": "'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    "palette": {
      "primary": "#3A5A7A",
      "primarySoft": "#E6F3F0",
      "secondary": "#6A7A8A",
      "text": "#2A2A2A",
      "background": "#FFFFFF",
      "surface": "#F6F8FA",
      "border": "#D8DDE4",
      "link": "#3A5A7A",
      "codeBackground": "#0D1117",
      "codeText": "#E6EDF3",
      "quoteBackground": "#E6F3F0"
    },
    "cssOverrides": ".wxp-root h2{font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif;color:#3A5A7A!important;}.wxp-root blockquote{color:#2A5A52!important;border-radius:0 4px 4px 0!important;}"
  },
  {
    "id": "paper-orange",
    "name": "纸上烧橙",
    "description": "奶油纸色与烧橙，延续博客的温暖编辑风。",
    "radius": "6px",
    "headingWeight": 700,
    "fontFamily": "'Noto Serif SC', 'Songti SC', 'STSong', Georgia, serif",
    "palette": {
      "primary": "#B63C0C",
      "primarySoft": "#F5E4D6",
      "secondary": "#675748",
      "text": "#241B15",
      "background": "#F5F1EA",
      "surface": "#FAF6EF",
      "border": "#D9CBBB",
      "link": "#A9360B",
      "codeBackground": "#241B15",
      "codeText": "#F5EBDD",
      "quoteBackground": "#EFE5D8"
    },
    "cssOverrides": ".wxp-root blockquote{background:#EFE5D8;}"
  },
  {
    "id": "electric-violet",
    "name": "电光紫",
    "description": "浅冷底、电紫标题与青色细节，适合 AI 与新工具。",
    "radius": "6px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    "palette": {
      "primary": "#6530CE",
      "primarySoft": "#EDE5FF",
      "secondary": "#4D6372",
      "text": "#242038",
      "background": "#FAF9FF",
      "surface": "#F1EDFA",
      "border": "#D9CEEB",
      "link": "#6530CE",
      "codeBackground": "#19152D",
      "codeText": "#F0EBFF",
      "quoteBackground": "#EEE9FA"
    },
    "cssOverrides": ".wxp-root blockquote{background:#EEE9FA;}.wxp-root hr{border-top-color:#087E8B;}"
  },
  {
    "id": "neon-terminal",
    "name": "霓虹终端",
    "description": "深蓝黑底、电青标题与玫红点缀，适合技术专题。",
    "radius": "4px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    "palette": {
      "primary": "#61E8ED",
      "primarySoft": "#17343F",
      "secondary": "#ACBED1",
      "text": "#E5EDF6",
      "background": "#101722",
      "surface": "#182332",
      "border": "#355064",
      "link": "#61E8ED",
      "codeBackground": "#0B111B",
      "codeText": "#E5EDF6",
      "quoteBackground": "#1A293A"
    },
    "cssOverrides": ".wxp-root blockquote{background:#1A293A;}.wxp-root li{color:#E5EDF6;}.wxp-root hr{border-top-color:#F58AC8;}.wxp-root h3{border-bottom:1px solid #F58AC8;padding-bottom:0.35em;}"
  },
  {
    "id": "acid-print",
    "name": "酸性印刷",
    "description": "黑白正文、荧光黄绿标记，像醒目的独立刊物。",
    "radius": "2px",
    "headingWeight": 700,
    "fontFamily": "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', Arial, sans-serif",
    "palette": {
      "primary": "#364807",
      "primarySoft": "#E5FF62",
      "secondary": "#566044",
      "text": "#20241B",
      "background": "#FFFFFF",
      "surface": "#F5F8EB",
      "border": "#CFD8B7",
      "link": "#405C0B",
      "codeBackground": "#20241B",
      "codeText": "#F0F5E4",
      "quoteBackground": "#F1F7D9"
    },
    "cssOverrides": ".wxp-root blockquote{background:#F1F7D9;}.wxp-root strong{background:#E5FF62;color:#20241B;}.wxp-root hr{border-top:4px solid #20241B;}"
  }
];
