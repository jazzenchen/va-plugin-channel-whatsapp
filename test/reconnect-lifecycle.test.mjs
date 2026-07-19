import assert from "node:assert/strict";
import test from "node:test";

import { WhatsAppBot } from "../dist/bot.js";

function createBot(log = () => {}) {
  const previousStateDir = process.env.VIBEAROUND_PLUGIN_STATE_DIR;
  process.env.VIBEAROUND_PLUGIN_STATE_DIR = "/tmp/whatsapp-reconnect-test";
  const bot = new WhatsAppBot({}, log, "/tmp", "whatsapp:bot", "whatsapp:bot");
  if (previousStateDir === undefined) delete process.env.VIBEAROUND_PLUGIN_STATE_DIR;
  else process.env.VIBEAROUND_PLUGIN_STATE_DIR = previousStateDir;
  return bot;
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("repeated reconnect requests share one timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const bot = createBot();
  let starts = 0;
  bot.start = async () => {
    starts++;
  };

  bot.scheduleReconnect();
  bot.scheduleReconnect();

  assert.equal(bot.retryCount, 1);
  t.mock.timers.tick(1_000);
  await flushAsyncWork();
  assert.equal(starts, 1);
  bot.stop();
});

test("stop clears reconnect and detaches the current socket before ending it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const bot = createBot();
  let starts = 0;
  let ended = false;
  bot.start = async () => {
    starts++;
  };
  bot.scheduleReconnect();
  bot.socket = {
    end() {
      ended = true;
      assert.equal(bot.socket, null);
    },
  };

  bot.stop();
  t.mock.timers.tick(1_000);
  await flushAsyncWork();

  assert.equal(ended, true);
  assert.equal(starts, 0);
  assert.equal(bot.reconnectTimer, null);
});

test("failed reconnect attempts are logged and rescheduled", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const logs = [];
  const bot = createBot((level, message) => logs.push({ level, message }));
  let attempts = 0;
  bot.start = async () => {
    attempts++;
    throw new Error("connect failed");
  };

  bot.scheduleReconnect();
  t.mock.timers.tick(1_000);
  await flushAsyncWork();

  assert.equal(attempts, 1);
  assert.equal(bot.retryCount, 2);
  assert.ok(logs.some(({ level, message }) =>
    level === "error" && message === "reconnect failed category=runtime"
  ));

  t.mock.timers.tick(1_999);
  await flushAsyncWork();
  assert.equal(attempts, 1);

  t.mock.timers.tick(1);
  await flushAsyncWork();
  assert.equal(attempts, 2);
  bot.stop();
});

test("a stale socket close cannot replace the current connection", () => {
  const bot = createBot();
  const staleSocket = { end() {} };
  const currentSocket = { end() {} };
  bot.socket = currentSocket;

  bot.handleConnectionUpdate(staleSocket, { connection: "close" });

  assert.equal(bot.socket, currentSocket);
  assert.equal(bot.retryCount, 0);
  bot.stop();
});
