import path from "node:path";

export function resolveAuthDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateRoot = env.VIBEAROUND_PLUGIN_STATE_DIR?.trim();
  if (!stateRoot) {
    throw new Error("VIBEAROUND_PLUGIN_STATE_DIR is required for persistent instance-isolated WhatsApp auth");
  }
  return path.join(stateRoot, "whatsapp-auth");
}
