import assert from "node:assert/strict";
import test from "node:test";

import { shouldHandleWhatsAppInbound } from "../dist/inbound-policy.js";

const botJids = [
  "15551234567:4@s.whatsapp.net",
  "873421987654321@lid",
];

test("direct messages do not require a mention", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: false,
    mentionedJids: [],
    botJids,
  }), true);
});

test("ordinary group messages require the current bot JID", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    mentionedJids: [],
    botJids,
  }), false);
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    mentionedJids: ["15551234567@s.whatsapp.net"],
    botJids,
  }), true);
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    mentionedJids: ["15557654321@s.whatsapp.net"],
    botJids,
  }), false);
});

test("group mentions accept either the bot PN or LID identity", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    mentionedJids: ["873421987654321@lid"],
    botJids,
  }), true);
});
