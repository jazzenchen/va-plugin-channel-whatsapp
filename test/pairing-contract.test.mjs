import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("manifest advertises pairing-code auth instead of QR auth", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../plugin.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.capabilities.auth.methods, ["pairing_code"]);
});
