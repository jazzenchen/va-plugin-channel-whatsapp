import assert from "node:assert/strict";
import test from "node:test";

import { WhatsAppBot } from "../dist/bot.js";

test("health requires both authentication and an open WebSocket", () => {
  const bot = Object.create(WhatsAppBot.prototype);

  bot.socket = null;
  assert.equal(bot.isConnected(), false);

  bot.socket = { user: { id: "bot" }, ws: { isOpen: false } };
  assert.equal(bot.isConnected(), false);

  bot.socket.ws.isOpen = true;
  assert.equal(bot.isConnected(), true);

  bot.socket.user = undefined;
  assert.equal(bot.isConnected(), false);
});
