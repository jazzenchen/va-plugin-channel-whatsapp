import assert from "node:assert/strict";
import test from "node:test";

import { AuthPersistenceGate } from "../dist/auth-persistence.js";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("open does not resolve a fresh pairing before credentials are durable", async () => {
  const gate = new AuthPersistenceGate(false);
  let settled = false;
  const waiting = gate.waitUntilDurable().then((result) => { settled = true; return result; });
  gate.markConnected();
  await tick();
  assert.equal(settled, false);

  let finishWrite;
  gate.trackWrite(() => new Promise((resolve) => { finishWrite = resolve; }));
  await tick();
  assert.equal(settled, false);
  finishWrite();
  assert.deepEqual(await waiting, { connected: true, message: "WhatsApp connected successfully." });
});

test("wait observes the latest queued credential write", async () => {
  const gate = new AuthPersistenceGate(false);
  let finishFirst;
  let finishSecond;
  gate.markConnected();
  gate.trackWrite(() => new Promise((resolve) => { finishFirst = resolve; }));
  gate.trackWrite(() => new Promise((resolve) => { finishSecond = resolve; }));
  let settled = false;
  const waiting = gate.waitUntilDurable().then((result) => { settled = true; return result; });

  await tick();
  finishFirst();
  await tick();
  assert.equal(settled, false);
  finishSecond();
  assert.equal((await waiting).connected, true);
});

test("credential write failure is returned instead of connected", async () => {
  const gate = new AuthPersistenceGate(false);
  gate.markConnected();
  gate.trackWrite(async () => { throw new Error("disk full"); });
  assert.deepEqual(await gate.waitUntilDurable(), {
    connected: false,
    message: "Failed to persist WhatsApp credentials: disk full",
  });
});

test("an already persisted session may resolve without a new write", async () => {
  const gate = new AuthPersistenceGate(true);
  gate.markConnected();
  assert.equal((await gate.waitUntilDurable()).connected, true);
});
