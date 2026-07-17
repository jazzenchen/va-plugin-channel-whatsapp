import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { classifyWhatsAppError } from "../dist/bot.js";

test("error logging exposes only a bounded category", () => {
  const secret = "prompt failed for +8613812345678@s.whatsapp.net";
  assert.equal(classifyWhatsAppError(new Error(secret)), "runtime");
  assert.equal(classifyWhatsAppError(new DOMException(secret, "AbortError")), "cancelled");
  assert.equal(classifyWhatsAppError(new Error(`timeout ${secret}`)), "timeout");
});

test("runtime and auth log statements never interpolate identity credentials", () => {
  const source = ["../src/bot.ts", "../src/auth-standalone.ts"]
    .map((relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /log\([^\n]*(?:phoneNumber|user\?\.(?:name|id)|\$\{(?:jid|chatId|text|errMsg|code|qr)\})/);
  assert.doesNotMatch(source, /process\.stderr\.write\(code|qrcode-terminal/);
});
