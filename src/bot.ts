/**
 * WhatsAppBot — Baileys-based WhatsApp bot wrapper.
 *
 * Handles:
 *   - WebSocket connection to WhatsApp via Baileys
 *   - Pairing-code authentication managed through VibeAround Settings
 *   - Inbound message parsing → ACP prompt() to Host
 *   - Outbound message sending
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, isJidGroup, type proto } from "baileys";
import type { Agent, ChannelInboundContext, ContentBlock } from "@vibearound/plugin-channel-sdk";
import {
  cancelChannelPrompt,
  channelTargetFromInboundContext,
  extractErrorMessage,
  isChannelStopCommand,
  sendChannelPrompt,
} from "@vibearound/plugin-channel-sdk";
import type { AgentStreamHandler } from "./agent-stream.js";
import { normalizeWhatsAppPromptText, shouldHandleWhatsAppInbound } from "./inbound-policy.js";
import { resolveAuthDir } from "./auth-cache.js";

type LogFn = (level: string, msg: string) => void;

export const WHATSAPP_PAIRING_REQUIRED_MESSAGE =
  "WhatsApp is not authenticated. Open Settings and use phone-number pairing to connect.";

export function classifyWhatsAppError(error: unknown): "cancelled" | "timeout" | "runtime" {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (name === "aborterror") return "cancelled";
  if (name === "timeouterror" || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }
  return "runtime";
}

function messageContextInfo(message: proto.IMessage | null | undefined): proto.IContextInfo | null | undefined {
  return message?.extendedTextMessage?.contextInfo
    ?? message?.imageMessage?.contextInfo
    ?? message?.documentMessage?.contextInfo
    ?? message?.audioMessage?.contextInfo
    ?? message?.videoMessage?.contextInfo;
}

export class WhatsAppBot {
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private agent: Agent;
  private log: LogFn;
  private authDir: string;
  private channelInstanceId: string;
  private actorId: string;
  private streamHandler: AgentStreamHandler | null = null;
  private stopped = false;
  private retryCount = 0;

  /** Heartbeat check — authenticated and the inbound WebSocket is open. */
  public isConnected(): boolean {
    return this.socket?.user != null && this.socket.ws.isOpen;
  }

  constructor(
    agent: Agent,
    log: LogFn,
    _cacheDir: string,
    channelInstanceId: string,
    actorId: string,
  ) {
    this.agent = agent;
    this.log = log;
    this.authDir = resolveAuthDir();
    this.channelInstanceId = channelInstanceId;
    this.actorId = actorId;
  }

  setStreamHandler(handler: AgentStreamHandler): void {
    this.streamHandler = handler;
  }

  /** Start the WhatsApp connection. Authentication is completed in Settings. */
  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    // Fetch latest WA Web version to avoid "cannot link device" errors
    let version: [number, number, number] | undefined;
    try {
      const latest = await fetchLatestBaileysVersion();
      version = latest.version as [number, number, number];
      this.log("info", `using WA version: ${version.join(".")}`);
    } catch {
      this.log("warn", "failed to fetch latest version, using default");
    }

    const socket = makeWASocket({
      auth: state,
      ...(version ? { version } : {}),
      browser: Browsers.ubuntu("VibeAround"),
    });
    this.socket = socket;

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.log("info", WHATSAPP_PAIRING_REQUIRED_MESSAGE);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.log("info", `connection closed category=${shouldReconnect ? "transient" : "logged_out"}`);
        if (shouldReconnect && !this.stopped) {
          // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
          const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30_000);
          this.retryCount++;
          this.log("info", `reconnecting in ${delay}ms (attempt ${this.retryCount})...`);
          setTimeout(() => this.start(), delay);
        }
      } else if (connection === "open") {
        this.log("info", "connected to WhatsApp");
        this.retryCount = 0; // reset on successful connection
      }
    });

    // Save credentials on update
    socket.ev.on("creds.update", saveCreds);

    // Handle incoming messages
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        this.handleMessage(msg);
      }
    });
  }

  /** Stop the bot. */
  stop(): void {
    this.stopped = true;
    this.socket?.end(undefined);
  }

  /** Send a text message. */
  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.socket) throw new Error("Socket not connected");
    await this.socket.sendMessage(jid, { text });
  }

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    const key = msg.key;
    if (!key) return;

    // Ignore messages from self
    if (key.fromMe) return;
    // Ignore status broadcasts
    if (key.remoteJid === "status@broadcast") return;

    const jid = key.remoteJid;
    if (!jid) return;

    const rawText = msg.message?.conversation
      ?? msg.message?.extendedTextMessage?.text
      ?? msg.message?.imageMessage?.caption
      ?? msg.message?.documentMessage?.caption
      ?? msg.message?.videoMessage?.caption
      ?? "";

    const hasMedia = !!(
      msg.message?.imageMessage
      || msg.message?.documentMessage
      || msg.message?.audioMessage
      || msg.message?.videoMessage
    );

    if (!rawText && !hasMedia) return;

    const contextInfo = messageContextInfo(msg.message);
    const botJids = [
      this.socket?.user?.id,
      this.socket?.user?.lid,
      this.socket?.user?.phoneNumber,
    ].filter((identity): identity is string => Boolean(identity));
    if (!shouldHandleWhatsAppInbound({
      isGroup: isJidGroup(jid) === true,
      mentionedJids: contextInfo?.mentionedJid ?? [],
      botJids,
    })) {
      this.log("debug", "group message ignored without bot mention");
      return;
    }
    const text = normalizeWhatsAppPromptText({
      text: rawText,
      mentionedJids: contextInfo?.mentionedJid ?? [],
      botJids,
    });

    const chatId = jid;
    const isGroup = isJidGroup(jid) === true;
    const inboundContext = {
      channelInstanceId: this.channelInstanceId,
      actorId: this.actorId,
      chatId,
      senderId: key.participant ?? undefined,
      platformMessageId: key.id ?? undefined,
      scope: isGroup ? "group" : "dm",
      addressedBy: isGroup ? "mention" : "dm",
    } satisfies ChannelInboundContext;
    const target = channelTargetFromInboundContext(inboundContext);
    this.log(
      "debug",
      `message received scope=${isGroup ? "group" : "dm"} text=${Boolean(text)} media=${hasMedia}`,
    );

    if (text && isChannelStopCommand(text)) {
      await cancelChannelPrompt(this.agent, { context: inboundContext });
      return;
    }

    const contentBlocks: ContentBlock[] = [];

    if (text) {
      contentBlocks.push({ type: "text", text });
    }

    if (hasMedia) {
      const mediaType = msg.message?.imageMessage ? "image"
        : msg.message?.videoMessage ? "video"
        : msg.message?.audioMessage ? "audio"
        : "file";
      if (!text) {
        contentBlocks.push({ type: "text", text: `The user sent ${mediaType === "image" ? "an image" : `a ${mediaType}`}.` });
      }
    }

    if (contentBlocks.length === 0) return;

    if (text && this.streamHandler?.consumePendingText(target, text)) {
      return;
    }

    this.streamHandler?.onPromptSent(target);

    try {
      const response = await sendChannelPrompt(this.agent, {
        context: inboundContext,
        prompt: contentBlocks,
      });
      if (!response) {
        await this.streamHandler?.onTurnEnd(target);
        return;
      }
      this.log("info", "prompt completed");
      await this.streamHandler?.onTurnEnd(target);
    } catch (error: unknown) {
      const errMsg = extractErrorMessage(error);
      this.log("error", `prompt failed category=${classifyWhatsAppError(error)}`);
      await this.streamHandler?.onTurnError(target, errMsg);
    }
  }
}
