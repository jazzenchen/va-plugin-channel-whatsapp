import { areJidsSameUser } from "baileys";

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
