import { areJidsSameUser, jidDecode } from "baileys";

export function shouldHandleWhatsAppInbound(params: {
  isGroup: boolean;
  mentionedJids: readonly string[];
  botJids: readonly string[];
}): boolean {
  if (!params.isGroup) return true;
  return params.mentionedJids.some((mentioned) =>
    params.botJids.some((botJid) => areJidsSameUser(mentioned, botJid)),
  );
}

export function normalizeWhatsAppPromptText(params: {
  text: string;
  mentionedJids: readonly string[];
  botJids: readonly string[];
}): string {
  let text = params.text;
  for (const mentioned of params.mentionedJids) {
    if (!params.botJids.some((botJid) => areJidsSameUser(mentioned, botJid))) {
      continue;
    }
    const user = jidDecode(mentioned)?.user;
    if (!user) continue;
    const escaped = user.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`@${escaped}(?=\\s|$)`, "g"), "");
  }
  return text.trim();
}
