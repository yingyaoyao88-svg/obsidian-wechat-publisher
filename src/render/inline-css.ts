/**
 * 极简 CSS 内联器（juice 的核心思路）：把样式表“烫”到元素的 style 属性上。
 *
 * 公众号只保留内联样式，所以样式表必须在发布前内联。与按顺序追加不同，这里实现了真正的层叠：
 *   优先级 = !important > 选择器特异度 > 出现顺序
 * 同一属性取胜者；输出时按优先级从低到高排列，这样简写（border）与展开（border-left）之间
 * 的覆盖关系在内联后依然成立，!important 本身可以去掉。
 *
 * 只支持普通规则（不支持 @media 等），足够主题样式表使用。
 */

interface Decl {
  prop: string;
  value: string;
  important: boolean;
}

interface Rule {
  selector: string;
  specificity: number;
  order: number;
  decls: Decl[];
}

export function parseCss(css: string): { selector: string; decls: Decl[] }[] {
  const out: { selector: string; decls: Decl[] }[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const selectors = m[1].trim();
    if (!selectors || selectors.startsWith("@")) continue;
    const decls: Decl[] = [];
    for (const part of m[2].split(";")) {
      const i = part.indexOf(":");
      if (i < 0) continue;
      const prop = part.slice(0, i).trim().toLowerCase();
      let value = part.slice(i + 1).trim();
      if (!prop || !value) continue;
      const important = /!\s*important\s*$/i.test(value);
      if (important) value = value.replace(/!\s*important\s*$/i, "").trim();
      decls.push({ prop, value, important });
    }
    if (!decls.length) continue;
    for (const sel of selectors.split(",")) {
      const s = sel.trim();
      if (s) out.push({ selector: s, decls });
    }
  }
  return out;
}

/** (id, class/属性/伪类, 标签) 三元组编码成一个数字 */
export function specificity(selector: string): number {
  const s = selector.replace(/::?[a-z-]+\([^)]*\)/gi, (x) => (x.startsWith("::") ? " x" : " .x")).replace(/::[a-z-]+/gi, " x");
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:[a-z-]+/gi) ?? []).length;
  const tags = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[a-z-]+/gi, " ").match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return ids * 10000 + classes * 100 + tags;
}

export function inlineCss(root: Element, css: string): void {
  const rules: Rule[] = parseCss(css).map((r, order) => ({ ...r, order, specificity: specificity(r.selector) }));
  const matched = new Map<Element, { decl: Decl; spec: number; order: number }[]>();
  for (const rule of rules) {
    let els: Element[];
    try {
      els = Array.from(root.querySelectorAll(rule.selector));
      if (root.matches(rule.selector)) els.unshift(root);
    } catch {
      continue; // 不支持的选择器直接跳过
    }
    for (const el of els) {
      let list = matched.get(el);
      if (!list) matched.set(el, (list = []));
      rule.decls.forEach((decl, i) => list!.push({ decl, spec: rule.specificity, order: rule.order * 1000 + i }));
    }
  }

  const rank = (x: { decl: Decl; spec: number; order: number }) =>
    (x.decl.important ? 1e12 : 0) + x.spec * 1e6 + x.order;

  matched.forEach((list, el) => {
    const winners = new Map<string, { decl: Decl; spec: number; order: number }>();
    for (const item of list) {
      const cur = winners.get(item.decl.prop);
      if (!cur || rank(item) >= rank(cur)) winners.set(item.decl.prop, item);
    }
    const css = Array.from(winners.values())
      .sort((a, b) => rank(a) - rank(b))
      .map((w) => `${w.decl.prop}:${w.decl.value};`)
      .join("");
    // 元素自带的内联样式（代码块、公式、图片宽度等）优先级最高，放在最后
    el.setAttribute("style", css + (el.getAttribute("style") ?? ""));
  });
}
