/**
 * WhatsApp stream renderer — send-only (WhatsApp does not support editing messages).
 */

import {
  BlockRenderer,
  type BlockKind,
  type ChannelTarget,
  type VerboseConfig,
} from "@vibearound/plugin-channel-sdk";
import type { WhatsAppBot } from "./bot.js";

type LogFn = (level: string, msg: string) => void;

export class AgentStreamHandler extends BlockRenderer<string> {
  private bot: WhatsAppBot;
  private log: LogFn;

  constructor(bot: WhatsAppBot, log: LogFn, verbose?: Partial<VerboseConfig>) {
    super({
      streaming: false,
      flushIntervalMs: 500,
      verbose,
    });
    this.bot = bot;
    this.log = log;
  }

  protected async sendText(target: ChannelTarget, text: string): Promise<void> {
    await this.bot.sendMessage(target.chatId, text);
  }

  protected async sendBlock(target: ChannelTarget, _kind: BlockKind, content: string): Promise<string | null> {
    try {
      await this.bot.sendMessage(target.chatId, content);
    } catch (e) {
      this.log("error", `sendBlock failed: ${e}`);
    }
    return null;
  }
}
