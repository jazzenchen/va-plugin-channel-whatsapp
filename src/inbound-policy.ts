import { areJidsSameUser } from "baileys";

export function shouldHandleWhatsAppInbound(params: {
  isGroup: boolean;
  mentionedJids: readonly string[];
  botJid?: string;
}): boolean {
  if (!params.isGroup) return true;
  return params.mentionedJids.some((jid) => areJidsSameUser(jid, params.botJid));
}
