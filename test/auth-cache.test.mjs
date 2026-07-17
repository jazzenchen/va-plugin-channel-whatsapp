import assert from "node:assert/strict";
import test from "node:test";

import { resolveAuthDir } from "../dist/auth-cache.js";

test("auth state is rooted in the host-provided persistent instance state", () => {
  assert.equal(
    resolveAuthDir({ VIBEAROUND_PLUGIN_STATE_DIR: "/tmp/instance-a" }),
    "/tmp/instance-a/whatsapp-auth",
  );
});

test("auth refuses the old shared global fallback", () => {
  assert.throws(() => resolveAuthDir({}), /VIBEAROUND_PLUGIN_STATE_DIR is required/);
  assert.throws(
    () => resolveAuthDir({ VIBEAROUND_PLUGIN_CACHE_DIR: "/tmp/ephemeral" }),
    /VIBEAROUND_PLUGIN_STATE_DIR is required/,
  );
});
