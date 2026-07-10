import assert from "node:assert/strict";
import test from "node:test";

import { shouldHandleWhatsAppInbound } from "../dist/inbound-policy.js";

const botJid = "15551234567:4@s.whatsapp.net";

test("direct messages do not require a mention", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: false,
    text: "hello",
    mentionedJids: [],
    botJid,
  }), true);
});

test("ordinary group messages require the current bot JID", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    text: "hello",
    mentionedJids: [],
    botJid,
  }), false);
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    text: "@bot hello",
    mentionedJids: ["15551234567@s.whatsapp.net"],
    botJid,
  }), true);
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    text: "@other hello",
    mentionedJids: ["15557654321@s.whatsapp.net"],
    botJid,
  }), false);
});

test("explicit slash commands remain valid in groups", () => {
  assert.equal(shouldHandleWhatsAppInbound({
    isGroup: true,
    text: " /new",
    mentionedJids: [],
    botJid,
  }), true);
});
