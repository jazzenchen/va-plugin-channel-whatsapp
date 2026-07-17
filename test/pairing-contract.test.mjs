import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { WHATSAPP_PAIRING_REQUIRED_MESSAGE } from "../dist/bot.js";

test("manifest advertises pairing-code auth instead of QR auth", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../plugin.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.capabilities.auth.methods, ["pairing_code"]);
});

test("runtime pairing hint contains no one-time credential", () => {
  assert.equal(
    WHATSAPP_PAIRING_REQUIRED_MESSAGE,
    "WhatsApp is not authenticated. Open Settings and use phone-number pairing to connect.",
  );
  assert.equal(WHATSAPP_PAIRING_REQUIRED_MESSAGE.includes("QR"), false);
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies["qrcode-terminal"], undefined);
});
