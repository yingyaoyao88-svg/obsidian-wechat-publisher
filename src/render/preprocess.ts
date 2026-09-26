/**
 * Obsidian 专有语法 → 标准 Markdown / 少量内联 HTML。
 *
 * markdown-it 只认 CommonMark，所以在交给它之前先把 Obsidian 的方言“翻译”掉：
 *   - frontmatter           → 删除（元数据由插件层单独读取）
 *   - %%注释%%               → 删除
 *   - ![[img.png|300]]      → <img src="img.png" data-width="300">
 *   - ![[其他笔记]]           → 笔记名（纯文本，公众号无法嵌入笔记）
 *   - [[笔记#标题|别名]]      → 别名 / 笔记名（纯文本）
 *   - ==高亮==               → <mark>高亮</mark>
 *   - - [ ] / - [x] 任务     → ☐ / ☑
 *   - $行内公式$ / $$块公式$$   → 占位元素，渲染阶段转成图片
 *
 * 代码块（``` / ~~~）和行内代码里的内容必须原样保留，所以先按“围栏”切分，只处理正文部分。
 */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;

export function stripFrontmatter(md: string): string {
  return md.replace(/^﻿?---\r?\n[\s\S]*?\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/, "");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 处理不在代码里的一段纯文本 */
function transformProse(text: string): string {
  // 嵌入：![[target|size]]
  text = text.replace(/!\[\[([^\]\n]+?)\]\]/g, (_m, inner: string) => {
    const [targetRaw, ...rest] = inner.split("|");
    const target = targetRaw.trim();
    const pathOnly = target.split("#")[0];
    if (IMAGE_EXT.test(pathOnly)) {
      const size = rest.find((r) => /^\d+(x\d+)?$/.test(r.trim()));
      const width = size ? size.trim().split("x")[0] : "";
      const alt = rest.find((r) => !/^\d+(x\d+)?$/.test(r.trim())) ?? "";
      return `<img src="${escapeAttr(pathOnly)}" alt="${escapeAttr(alt.trim())}"${width ? ` data-width="${width}"` : ""}>`;
    }
    return escapeText(rest[0]?.trim() || pathOnly.replace(/\.md$/i, ""));
  });

  // 双链：[[target#heading|alias]]
  text = text.replace(/\[\[([^\]\n]+?)\]\]/g, (_m, inner: string) => {
    const [target, alias] = inner.split("|");
    if (alias) return escapeText(alias.trim());
    const [note, heading] = target.split("#");
    return escapeText(note.trim() || (heading ?? "").trim());
  });

  // 高亮
  text = text.replace(/==(?=\S)([^=\n]*?\S)==/g, "<mark>$1</mark>");

  // 行内公式：$...$，开头结尾不能是空白，结尾 $ 后不能紧跟数字（避免把 “$5 和 $10” 当公式）
  text = text.replace(/(^|[^\\$])\$(?=\S)([^$\n]*?[^\s\\])\$(?!\d)/g, (_m, lead: string, tex: string) =>
    `${lead}<span class="wx-math" data-tex="${encodeURIComponent(tex)}"></span>`,
  );

  // 任务列表
  text = text.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]\s/gm, (_m, lead: string, mark: string) =>
    `${lead}${mark === " " ? "☐" : "☑"} `,
  );
  return text;
}

/** 在一行（或多行）文本中，跳过 `行内代码` 只处理其余部分 */
function transformOutsideInlineCode(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const tick = text.indexOf("`", i);
    if (tick === -1) {
      out.push(transformProse(text.slice(i)));
      break;
    }
    out.push(transformProse(text.slice(i, tick)));
    // 计算反引号串长度，找对应的闭合串
    let n = 0;
    while (text[tick + n] === "`") n++;
    const fence = "`".repeat(n);
    const close = text.indexOf(fence, tick + n);
    if (close === -1) {
      out.push(text.slice(tick, tick + n));
      i = tick + n;
      continue;
    }
    out.push(text.slice(tick, close + n));
    i = close + n;
  }
  return out.join("");
}

export function preprocessObsidian(md: string): string {
  md = stripFrontmatter(md);
  md = md.replace(/%%[\s\S]*?%%/g, "");

  const lines = md.split(/\r?\n/);
  const result: string[] = [];
  let buffer: string[] = [];
  let fence: string | null = null;

  const flush = () => {
    if (buffer.length) {
      // 块公式 $$...$$（可跨行）；data-tex 用 URI 编码，后续的双链/高亮等替换不会误伤公式内容
      const text = buffer
        .join("\n")
        .replace(/^[ \t]*\$\$([\s\S]+?)\$\$[ \t]*$/gm, (_m, tex: string) =>
          `\n<section class="wx-math-block" data-tex="${encodeURIComponent(tex.trim())}"></section>\n`,
        );
      result.push(transformOutsideInlineCode(text));
    }
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence === null && m) {
      flush();
      fence = m[1];
      result.push(line);
    } else if (fence !== null) {
      result.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
    } else {
      buffer.push(line);
    }
  }
  flush();
  return result.join("\n");
}
