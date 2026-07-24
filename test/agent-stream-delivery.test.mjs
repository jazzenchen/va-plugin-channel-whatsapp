import assert from "node:assert/strict";
import test from "node:test";

import { AgentStreamHandler } from "../dist/agent-stream.js";

const target = {
  channelInstanceId: "whatsapp-primary",
  actorId: "whatsapp-bot",
  chatId: "user@s.whatsapp.net",
};

function failingRenderer(message) {
  const bot = {
    async sendMessage() {
      throw new Error(message);
    },
  };
  return new AgentStreamHandler(bot);
}

test("direct WhatsApp block delivery exposes send failures", async () => {
  const renderer = failingRenderer("direct delivery failed");

  await assert.rejects(
    renderer.sendBlock(target, "text", "answer"),
    /direct delivery failed/,
  );
});

test("WhatsApp renderer delegates files to the active chat", async () => {
  const sent = [];
  const renderer = new AgentStreamHandler({
    async sendFile(...args) {
      sent.push(args);
    },
  });
  const file = {
    path: "/workspace/report.pdf",
    name: "report.pdf",
  };

  await renderer.sendFile(target, file);

  assert.deepEqual(sent, [["user@s.whatsapp.net", file]]);
});
