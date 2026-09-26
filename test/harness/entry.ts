// 界面截图调试：npm run harness 后用浏览器打开 test/harness/index.html#<场景>
// 场景：workbench | nocover | issues | format | progress | success | accounts | ip | meta | hidden | math | tune | <主题ID>（如 #paper-orange）
import "./mock-obsidian";
import { renderForWechat } from "../../src/render";
import { WechatPreviewView } from "../../src/workbench";
import { AccountManagerModal, IpWhitelistModal } from "../../src/accounts";
import { MetaModal } from "../../src/meta";
import { TuneModal } from "../../src/tune";
import { THEMES } from "../../src/render";
import { DEFAULT_SETTINGS, newAccount } from "../../src/settings";
import { renderMermaidSvg, svgToPng } from "../../src/rasterize";
import { TFile } from "./mock-obsidian";
import md from "../sample.md";

const img = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="383"><defs><linearGradient id="g"><stop offset="0" stop-color="#8ec5fc"/><stop offset="1" stop-color="#e0c3fc"/></linearGradient></defs><rect width="900" height="383" fill="url(#g)"/></svg>');
const scene = location.hash.slice(1) || "workbench";
const app: any = { workspace: { on: () => ({}), getActiveFile: () => file, getLeavesOfType: () => [] }, vault: { on: () => ({}) }, metadataCache: { on: () => ({}), getFileCache: () => ({}) } };
(window as any).__app = app;
const file = new TFile();
const main = newAccount({ name: "主号", appId: "wx0123456789abcdef", appSecret: "x".repeat(32), author: "张三" });
const themeScene = THEMES.find((t) => t.id === scene);
const settings = {
  ...DEFAULT_SETTINGS,
  accounts: [main, newAccount({ name: "备用号" })],
  activeAccountId: main.id,
  themeId: themeScene?.id ?? "classic",
  themeColor: themeScene?.defaultColor ?? "#0F4C81",
  presets: [
    { id: "p1", name: "技术长文", themeId: "techno", themeColor: "#3A5A7A", layout: "balanced", tune: {} },
    { id: "p2", name: "周报", themeId: "classic", themeColor: "#0F4C81", layout: "compact", tune: {} },
  ],
} as any;
let view: WechatPreviewView;
const plugin: any = {
  settings, manifest: { id: "wechat-mp-publisher" },
  get activeAccount() { return settings.accounts[0]; },
  saveSettings: async () => {}, refreshPreviews: () => view.update(), setActiveAccount: async () => {},
  renderFile: async () => ({
    result: await renderForWechat(md, { themeId: settings.themeId, themeColor: settings.themeColor, layout: settings.layout, tune: settings.tune, linkToFootnote: true, resolveImage: async (s: string) => (s.startsWith("data:image/png") ? s : img), rasterize: svgToPng, renderMermaid: renderMermaidSvg }),
    meta: { title: "用 Obsidian 写公众号：从排版到一键发布", author: "张三", digest: "", cover: "", sourceUrl: "" },
  }),
  resolveCover: () => (scene === "nocover" ? { source: null, label: "未设置", previewUrl: null } : { source: img, label: "正文首图", previewUrl: img }),
  getOverride: () => ({}), setCoverOverride: () => {}, wordCount: async () => 3982,
  openMetaEditor: () => {}, openAccountManager: () => {}, testConnection: async () => {}, openTuneModal: () => {}, applyPreset: async () => {},
  preflight: () => (scene === "nocover" ? ["没有封面：点上方稿件资料选择，或在正文放一张图"] : scene === "issues" ? ["标题 70 字，超过 64 字会被截断"] : []),
  publishDraft: async (_f: any, r: any) => {
    r.start([{ id: "render", label: "排版" }, { id: "images", label: "上传正文图片" }, { id: "cover", label: "封面" }, { id: "draft", label: "写入草稿箱" }]);
    r.update("render", "done"); r.update("images", "done", "5 张"); r.update("cover", "done", "正文首图 · 复用历史封面"); r.update("draft", "run");
  },
};

(async () => {
  const host = document.getElementById("host")!;
  view = new WechatPreviewView({} as any, plugin);
  host.appendChild((view as any).contentEl);
  if (scene === "hidden") settings.toolbarHidden = true;
  await view.onOpen();
  if (scene === "format") (view as any).openFormatPanel();
  if (scene === "progress") plugin.publishDraft(file, (view as any).reporter());
  if (scene === "success") {
    const r = (view as any).reporter();
    await plugin.publishDraft(file, r);
    r.update("draft", "done", "已新建草稿");
    r.finish(true, "✅ 「用 Obsidian 写公众号」已放入草稿箱，图片和封面都已就绪。\n下一步：公众号后台 →「内容与互动 → 草稿箱」→ 找到这篇 →「发表」。", [{ label: "去公众号发表", cta: true, onClick: () => {} }]);
  }
  if (scene === "tune") new TuneModal(app, plugin).open();
  if (scene === "accounts") new AccountManagerModal(app, plugin).open();
  if (scene === "ip") new IpWhitelistModal(app, "39.148.225.201", main, () => {}).open();
  if (scene === "meta")
    new MetaModal(app, {}, { title: "用 Obsidian 写公众号", author: "张三", digest: "", cover: { source: img, label: "正文首图", previewUrl: img }, autoCover: { source: img, label: "正文首图", previewUrl: img }, accountCover: null }, () => img, () => {}).open();
  if (scene === "math") { const ph = (view as any).phoneEl; setTimeout(() => (ph.scrollTop = ph.scrollHeight), 50); }
  document.body.dataset.ready = "1";
})();
