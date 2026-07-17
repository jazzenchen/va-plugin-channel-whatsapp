import assert from "node:assert/strict";
import test from "node:test";

import { WhatsAppBot } from "../dist/bot.js";

test("health stays false before start and follows the opened WebSocket", () => {
  const previousStateDir = process.env.VIBEAROUND_PLUGIN_STATE_DIR;
  process.env.VIBEAROUND_PLUGIN_STATE_DIR = "/tmp/whatsapp-health-test";
  const bot = new WhatsAppBot({}, () => {}, "/tmp", "whatsapp:bot", "whatsapp:bot");
  if (previousStateDir === undefined) delete process.env.VIBEAROUND_PLUGIN_STATE_DIR;
  else process.env.VIBEAROUND_PLUGIN_STATE_DIR = previousStateDir;

  // Construction is synchronous and does not wait for post-start identity.
  assert.equal(bot.isConnected(), false);

  bot.socket = { user: { id: "bot" }, ws: { isOpen: false } };
  assert.equal(bot.isConnected(), false);

  bot.socket.ws.isOpen = true;
  assert.equal(bot.isConnected(), true);

  bot.socket.user = undefined;
  assert.equal(bot.isConnected(), false);
});
