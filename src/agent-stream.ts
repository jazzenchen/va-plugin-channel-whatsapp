/**
 * WhatsApp stream renderer — send-only (WhatsApp does not support editing messages).
 */

import {
  BlockRenderer,
  type BlockKind,
  type ChannelTarget,
  type OutboundFile,
  type VerboseConfig,
} from "@vibearound/plugin-channel-sdk";
import type { WhatsAppBot } from "./bot.js";

export class AgentStreamHandler extends BlockRenderer<string> {
  private bot: WhatsAppBot;

  constructor(bot: WhatsAppBot, verbose?: Partial<VerboseConfig>) {
    super({
      streaming: false,
      flushIntervalMs: 500,
      verbose,
    });
    this.bot = bot;
  }

  protected async sendText(target: ChannelTarget, text: string): Promise<void> {
    await this.bot.sendMessage(target.chatId, text);
  }

  protected async sendFile(
    target: ChannelTarget,
    file: OutboundFile,
  ): Promise<void> {
    await this.bot.sendFile(target.chatId, file);
  }

  protected async sendBlock(target: ChannelTarget, _kind: BlockKind, content: string): Promise<string | null> {
    await this.bot.sendMessage(target.chatId, content);
    return null;
  }
}
