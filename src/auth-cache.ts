import path from "node:path";

export function resolveAuthDir(env: NodeJS.ProcessEnv = process.env): string {
  const cacheRoot = env.VIBEAROUND_PLUGIN_CACHE_DIR?.trim();
  if (!cacheRoot) {
    throw new Error("VIBEAROUND_PLUGIN_CACHE_DIR is required for instance-isolated WhatsApp auth");
  }
  return path.join(cacheRoot, "whatsapp-auth");
}
