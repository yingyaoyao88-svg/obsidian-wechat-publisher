// 仅用于截图测试的 Obsidian API 替身：只实现本插件 UI 用到的部分
/* eslint-disable @typescript-eslint/no-explicit-any */
type Opts = { cls?: string; text?: string; attr?: Record<string, string>; type?: string; value?: string };
const P = HTMLElement.prototype as any;
P.createEl = function (tag: string, o: Opts = {}) {
  const el = document.createElement(tag) as any;
  if (o.cls) el.className = o.cls;
  if (o.text !== undefined) el.textContent = o.text;
  if (o.type) el.type = o.type;
  if (o.value !== undefined) el.value = o.value;
  for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, v);
  this.appendChild(el);
  return el;
};
P.createDiv = function (o: Opts | string = {}) { return this.createEl("div", typeof o === "string" ? { cls: o } : o); };
P.createSpan = function (o: Opts = {}) { return this.createEl("span", o); };
P.empty = function () { this.innerHTML = ""; };
P.setText = function (t: string) { this.textContent = t; };
P.getText = function () { return this.textContent; };
P.addClass = function (...c: string[]) { this.classList.add(...c); };
P.removeClass = function (...c: string[]) { this.classList.remove(...c); };
P.toggleClass = function (c: string, v: boolean) { this.classList.toggle(c, v); };
(window as any).createDiv = (o: Opts = {}) => { const d = document.createElement("div") as any; d.className = o.cls ?? ""; return d; };

export function setIcon(el: HTMLElement, name: string) {
  el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/></svg>`;
  el.setAttribute("data-icon", name);
}
export function debounce<T extends (...a: any[]) => any>(fn: T) { return fn; }
export class TFile { path = "文章.md"; basename = "文章"; extension = "md"; name = "文章.md"; stat = { mtime: 0, size: 0 }; }
export class MarkdownView {}
export class WorkspaceLeaf {}
export class Notice { constructor(public m: string) { console.log("Notice:", m); } setMessage(m: string) { this.m = m; } hide() {} }
export class Menu {
  items: any[] = [];
  addItem(cb: (i: any) => void) { const i: any = { setTitle: (t: string) => ((i.t = t), i), setIcon: () => i, setChecked: (c: boolean) => ((i.c = c), i), onClick: () => i }; cb(i); this.items.push(i); return this; }
  addSeparator() { return this; }
  showAtMouseEvent() {}
}
export class ItemView {
  contentEl: any; app: any;
  constructor(public leaf: any) { this.contentEl = document.createElement("div"); this.app = (window as any).__app; }
  registerEvent() {}
  registerDomEvent(el: any, ev: string, cb: any) { el.addEventListener(ev, cb); }
}
export class Modal {
  app: any; modalEl: any; titleEl: any; contentEl: any;
  constructor(app: any) {
    this.app = app;
    const bg = document.createElement("div"); bg.className = "modal-container";
    this.modalEl = (bg as any).createDiv({ cls: "modal" });
    this.titleEl = this.modalEl.createDiv({ cls: "modal-title" });
    this.contentEl = this.modalEl.createDiv({ cls: "modal-content" });
    (this as any)._bg = bg;
  }
  open() { document.body.appendChild((this as any)._bg); (this as any).onOpen?.(); }
  close() { (this as any)._bg.remove(); (this as any).onClose?.(); }
}
export class FuzzySuggestModal<T> extends Modal { setPlaceholder() {} }
function comp(input: HTMLElement) {
  const c: any = {
    inputEl: input,
    setValue: (v: any) => { (input as any).value = v; if (input.type === "checkbox") (input as any).checked = v; return c; },
    setPlaceholder: (p: string) => { (input as any).placeholder = p; return c; },
    onChange: () => c, setButtonText: (t: string) => { input.textContent = t; return c; },
    setCta: () => { input.classList.add("mod-cta"); return c; }, setWarning: () => { input.classList.add("mod-warning"); return c; },
    onClick: () => c, setDisabled: () => c, setLimits: () => c, setDynamicTooltip: () => c,
  };
  return c;
}
export class Setting {
  el: any; ctl: any;
  constructor(container: any) {
    this.el = container.createDiv({ cls: "setting-item" });
    const info = this.el.createDiv({ cls: "setting-item-info" });
    (this as any).name = info.createDiv({ cls: "setting-item-name" });
    (this as any).desc = info.createDiv({ cls: "setting-item-description" });
    this.ctl = this.el.createDiv({ cls: "setting-item-control" });
  }
  setName(n: string) { (this as any).name.textContent = n; return this; }
  setDesc(d: string) { (this as any).desc.textContent = d; return this; }
  addText(cb: any) { cb(comp(this.ctl.createEl("input", { type: "text" }))); return this; }
  addTextArea(cb: any) { cb(comp(this.ctl.createEl("textarea"))); return this; }
  addToggle(cb: any) { const t = this.ctl.createDiv({ cls: "checkbox-container" }); cb(comp(t)); return this; }
  addButton(cb: any) { cb(comp(this.ctl.createEl("button"))); return this; }
  addExtraButton(cb: any) { const b = this.ctl.createEl("button", { text: "↺" }); const c = comp(b); c.setIcon = () => c; c.setTooltip = () => c; cb(c); return this; }
  addSlider(cb: any) { const i = this.ctl.createEl("input", { type: "range" }); cb(comp(i)); return this; }
  addColorPicker(cb: any) { const i = this.ctl.createEl("input", { type: "color" }); cb(comp(i)); return this; }
  addDropdown(cb: any) {
    const sel = this.ctl.createEl("select");
    const c = comp(sel);
    c.addOption = (v: string, l: string) => { sel.createEl("option", { value: v, text: l }); return c; };
    cb(c);
    return this;
  }
}
export class PluginSettingTab {}
export class Plugin {}
export const requestUrl = async () => ({ status: 500, json: null });
import mermaidLib from "mermaid";
export const loadMermaid = async () => {
  mermaidLib.initialize({ startOnLoad: false });
  return mermaidLib;
};
export const normalizePath = (p: string) => p;
