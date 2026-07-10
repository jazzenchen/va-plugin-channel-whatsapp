import { areJidsSameUser } from "baileys";

export function isExplicitSlashCommand(text: string): boolean {
  return text.trimStart().startsWith("/");
}

export function shouldHandleWhatsAppInbound(params: {
  isGroup: boolean;
  text: string;
  mentionedJids: readonly string[];
  botJid?: string;
}): boolean {
  if (!params.isGroup) return true;
  if (isExplicitSlashCommand(params.text)) return true;
  return params.mentionedJids.some((jid) => areJidsSameUser(jid, params.botJid));
}
