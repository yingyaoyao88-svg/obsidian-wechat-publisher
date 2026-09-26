import { App, Modal, Notice, Setting } from "obsidian";
import type WechatPublisherPlugin from "./main";
import { newAccount, WechatAccount } from "./settings";
import { probeIp } from "./wechat/api";
import { parseAccountText } from "./wechat/parse";
export { parseAccountText };
import { DEV_CONSOLE_URL } from "./links";


async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  new Notice(`已复制：${text}`);
}

/** 渲染“IP 白名单辅助”一行：检测 → 显示 IP → 复制 / 打开平台 */
export function renderIpHelper(container: HTMLElement, getAccount: () => WechatAccount | undefined, initialIp?: string) {
  const box = container.createDiv({ cls: "wxp-ip-helper" });
  const row = box.createDiv({ cls: "wxp-ip-row" });
  const ipEl = row.createSpan({ cls: "wxp-ip", text: initialIp ?? "未检测" });
  const status = box.createDiv({ cls: "wxp-ip-status setting-item-description" });
  const copyBtn = row.createEl("button", { text: "复制" });
  copyBtn.disabled = !initialIp;
  copyBtn.onclick = () => copy(ipEl.getText());
  const detect = row.createEl("button", { text: "检测出口 IP" });
  const open = row.createEl("button", { text: "打开微信开发者平台" });
  open.onclick = () => window.open(DEV_CONSOLE_URL);

  if (initialIp) status.setText("微信实际看到的出口 IP，复制后加入「API IP 白名单」，多个 IP 每行一个。");

  detect.onclick = async () => {
    detect.disabled = true;
    detect.setText("检测中…");
    const acc = getAccount();
    const r = await probeIp(acc?.appId ?? "", acc?.appSecret ?? "");
    detect.disabled = false;
    detect.setText("重新检测");
    if (r.ip) {
      ipEl.setText(r.ip);
      copyBtn.disabled = false;
    }
    status.removeClass("mod-warning", "mod-success");
    if (r.whitelisted === true) {
      status.setText(`✅ 已在白名单，可以正常推送${r.ip ? `（当前公网 IP ${r.ip}）` : ""}`);
      status.addClass("mod-success");
    } else if (r.whitelisted === false) {
      status.setText("⚠️ 不在白名单：复制上面的 IP，到微信开发者平台「基础信息 → API IP 白名单」添加，几分钟后生效。");
      status.addClass("mod-warning");
    } else if (r.error) {
      status.setText(`❌ ${r.error}`);
      status.addClass("mod-warning");
    } else {
      status.setText("这是查询到的公网 IP。填写 AppID/AppSecret 后再检测，可得到微信实际看到的 IP（开了代理时两者可能不同）。");
    }
  };
  return box;
}

export class AccountManagerModal extends Modal {
  private currentId: string;

  constructor(app: App, private plugin: WechatPublisherPlugin, private onClose_?: () => void) {
    super(app);
    this.currentId = plugin.settings.activeAccountId || plugin.settings.accounts[0]?.id || "";
  }

  onOpen() {
    this.modalEl.addClass("wxp-account-modal");
    this.titleEl.setText("公众号账号");
    this.render();
  }

  onClose() {
    this.contentEl.empty();
    this.onClose_?.();
    this.plugin.refreshPreviews();
  }

  private get accounts() {
    return this.plugin.settings.accounts;
  }

  private async save() {
    await this.plugin.saveSettings();
  }

  private render() {
    const el = this.contentEl;
    el.empty();

    // 顶部标签页
    const tabs = el.createDiv({ cls: "wxp-tabs" });
    this.accounts.forEach((a) => {
      const t = tabs.createEl("button", {
        cls: "wxp-tab" + (a.id === this.currentId ? " is-active" : ""),
        text: a.name + (a.id === this.plugin.settings.activeAccountId ? " ★" : ""),
      });
      t.onclick = () => {
        this.currentId = a.id;
        this.render();
      };
    });

    const acc = this.accounts.find((a) => a.id === this.currentId);
    if (!acc) {
      el.createEl("p", {
        cls: "wxp-empty",
        text: "还没有公众号账号。推荐用「快速粘贴新建」：在微信开发者平台的「基础信息」页全选复制，粘贴进来即可自动识别。",
      });
    } else {
      this.renderForm(el, acc);
    }

    const footer = el.createDiv({ cls: "wxp-modal-footer" });
    const quick = footer.createEl("button", { text: "快速粘贴新建", cls: this.accounts.length ? "" : "mod-cta" });
    quick.onclick = () =>
      new QuickPasteModal(this.app, async (parsed) => {
        const a = newAccount({ ...parsed, name: parsed.name ?? `公众号 ${this.accounts.length + 1}` });
        this.accounts.push(a);
        if (!this.plugin.settings.activeAccountId) this.plugin.settings.activeAccountId = a.id;
        this.currentId = a.id;
        await this.save();
        this.render();
      }).open();
    const manual = footer.createEl("button", { text: "手动新增" });
    manual.onclick = async () => {
      const a = newAccount({ name: `公众号 ${this.accounts.length + 1}` });
      this.accounts.push(a);
      if (!this.plugin.settings.activeAccountId) this.plugin.settings.activeAccountId = a.id;
      this.currentId = a.id;
      await this.save();
      this.render();
    };
    footer.createEl("button", { text: "完成", cls: "mod-cta wxp-push-right" }).onclick = () => this.close();
  }

  private renderForm(el: HTMLElement, acc: WechatAccount) {
    const form = el.createDiv({ cls: "wxp-form" });
    const text = (name: string, key: keyof WechatAccount, opts: { desc?: string; password?: boolean; placeholder?: string } = {}) =>
      new Setting(form)
        .setName(name)
        .setDesc(opts.desc ?? "")
        .addText((t) => {
          if (opts.password) t.inputEl.type = "password";
          t.setPlaceholder(opts.placeholder ?? "")
            .setValue(acc[key])
            .onChange(async (v) => {
              acc[key] = v.trim();
              await this.save();
              if (key === "name") this.refreshTabs();
            });
        });

    text("账号名称", "name", { desc: "自定义，用来区分多个公众号", placeholder: "主号" });
    text("AppID", "appId", { placeholder: "wx…" });
    text("AppSecret", "appSecret", { password: true, desc: "在微信开发者平台「基础信息 → 开发密钥」启用后获取，只显示一次" });

    new Setting(form)
      .setName("IP 白名单")
      .setDesc("微信只接受白名单内 IP 的请求。检测后复制，粘贴到开发者平台「API IP 白名单」。");
    renderIpHelper(form, () => acc);

    text("默认作者", "author", { desc: "笔记里没写 author 时使用" });
    text("默认封面", "defaultCover", { desc: "库内图片路径；笔记没指定封面时优先使用它", placeholder: "assets/cover.png" });

    new Setting(form)
      .setName("设为默认账号")
      .setDesc("打开插件时自动选中；也可以在预览面板顶部随时切换")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.activeAccountId === acc.id).onChange(async (v) => {
          if (v) this.plugin.settings.activeAccountId = acc.id;
          await this.save();
          this.render();
        }),
      );

    new Setting(form)
      .addButton((b) =>
        b.setButtonText("测试连接").onClick(async () => {
          b.setDisabled(true);
          await this.plugin.testConnection(acc);
          b.setDisabled(false);
        }),
      )
      .addButton((b) =>
        b
          .setButtonText("删除此账号")
          .setWarning()
          .onClick(async () => {
            if (!confirm(`确定删除账号「${acc.name}」？`)) return;
            const i = this.accounts.indexOf(acc);
            this.accounts.splice(i, 1);
            if (this.plugin.settings.activeAccountId === acc.id) {
              this.plugin.settings.activeAccountId = this.accounts[0]?.id ?? "";
            }
            this.currentId = this.accounts[0]?.id ?? "";
            await this.save();
            this.render();
          }),
      );
  }

  private refreshTabs() {
    const tabs = this.contentEl.querySelectorAll<HTMLButtonElement>(".wxp-tab");
    this.accounts.forEach((a, i) => {
      if (tabs[i]) tabs[i].setText(a.name + (a.id === this.plugin.settings.activeAccountId ? " ★" : ""));
    });
  }
}

export class QuickPasteModal extends Modal {
  constructor(app: App, private onParsed: (a: Partial<WechatAccount>) => void) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("快速粘贴新建账号");
    const el = this.contentEl;
    el.createEl("p", {
      cls: "setting-item-description",
      text: "打开微信开发者平台 → 我的业务 → 公众号 →「基础信息」页，Ctrl/Cmd+A 全选、复制，粘贴到下面。插件会自动识别账号名称、AppID 和 AppSecret（启用 AppSecret 后它只显示一次，请在那时复制）。",
    });
    const ta = el.createEl("textarea", { cls: "wxp-paste" });
    ta.placeholder = "公众号\n你的公众号名称\nAppID\nwx0123456789abcdef\nAppSecret\n0123456789abcdef0123456789abcdef";
    const result = el.createDiv({ cls: "setting-item-description" });
    const footer = el.createDiv({ cls: "wxp-modal-footer" });
    footer.createEl("button", { text: "打开微信开发者平台" }).onclick = () => window.open(DEV_CONSOLE_URL);
    const ok = footer.createEl("button", { text: "识别并添加", cls: "mod-cta wxp-push-right" });
    ta.oninput = () => {
      const p = parseAccountText(ta.value);
      result.setText(
        p ? `识别到：${p.name ?? "（未识别名称）"} · AppID ${p.appId ?? "未识别"} · AppSecret ${p.appSecret ? "已识别" : "未识别"}` : "",
      );
    };
    ok.onclick = () => {
      const p = parseAccountText(ta.value);
      if (!p) {
        new Notice("没有识别到 AppID 或 AppSecret，请检查粘贴的内容");
        return;
      }
      this.onParsed(p);
      this.close();
    };
    setTimeout(() => ta.focus(), 0);
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** 推送时遇到 40164：直接给出 IP、复制按钮、平台入口和重试 */
export class IpWhitelistModal extends Modal {
  constructor(
    app: App,
    private ip: string,
    private account: WechatAccount | undefined,
    private onRetry: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("需要把本机 IP 加入白名单");
    const el = this.contentEl;
    el.createEl("p", {
      text: "微信拒绝了这次请求：当前电脑的出口 IP 不在公众号的 API IP 白名单里。这是首次使用公众号接口的必要设置，按下面三步即可：",
    });
    const ol = el.createEl("ol", { cls: "wxp-steps" });
    ol.createEl("li", { text: "点「复制」复制下面的 IP" });
    ol.createEl("li", { text: "点「打开微信开发者平台」→ 我的业务 → 公众号 → 基础信息 →「API IP 白名单」→ 设置名单，粘贴并确认（多个 IP 每行一个）" });
    ol.createEl("li", { text: "等 1～5 分钟生效，回来点「重试」" });
    renderIpHelper(el, () => this.account, this.ip);
    el.createEl("p", {
      cls: "setting-item-description",
      text: "家庭宽带的 IP 可能会变；开着代理/VPN 时微信看到的是代理的 IP。以后再遇到此提示，重复上面步骤即可，旧 IP 不用删。",
    });
    const footer = el.createDiv({ cls: "wxp-modal-footer" });
    footer.createEl("button", { text: "关闭" }).onclick = () => this.close();
    footer.createEl("button", { text: "重试", cls: "mod-cta wxp-push-right" }).onclick = () => {
      this.close();
      this.onRetry();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
