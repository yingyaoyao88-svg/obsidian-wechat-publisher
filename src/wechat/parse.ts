/**
 * 纯文本解析（不依赖 Obsidian，便于单元测试）。
 */

import type { WechatAccount } from "../settings";

/** 40164 时微信在 errmsg 里写出它看到的出口 IP，如 “invalid ip 1.2.3.4 ipv6 ::ffff:1.2.3.4, not in whitelist” */
export function parseBlockedIp(msg: string): string | null {
  return msg.match(/invalid ip\s+([0-9a-fA-F.:]+)/)?.[1] ?? null;
}

/**
 * 从微信开发者平台「基础信息」页整页复制的文字里识别账号。
 * AppID 固定是 wx + 16 位十六进制；AppSecret 是 32 位十六进制；名称取“公众号/名称”下一行。
 */
export function parseAccountText(text: string): Partial<WechatAccount> | null {
  const appId = text.match(/\b(wx[0-9a-f]{16})\b/i)?.[1];
  const appSecret = text.match(/\b([0-9a-f]{32})\b/i)?.[1];
  if (!appId && !appSecret) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = "";
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^(公众号|名称|账号名称|公众号名称)[:：]?$/.test(lines[i]) && !/^(AppID|AppSecret)/i.test(lines[i + 1])) {
      name = lines[i + 1];
      break;
    }
  }
  return { appId, appSecret, name: name || undefined };
}
