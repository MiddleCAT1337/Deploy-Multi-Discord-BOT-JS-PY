import fs from "node:fs";
import { CONFIG_PATH } from "./paths.js";

/**
 * @returns {{ discordToken: string | null, adminId: string | null, discordEnabled: boolean }}
 */
export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { discordToken: null, adminId: null, discordEnabled: false };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const data = JSON.parse(raw);
    const discordToken =
      typeof data.discordToken === "string" && data.discordToken.trim()
        ? data.discordToken.trim()
        : null;
    const adminId =
      typeof data.adminId === "string" && data.adminId.trim()
        ? data.adminId.trim()
        : null;
    return {
      discordToken,
      adminId,
      discordEnabled: discordToken != null,
    };
  } catch {
    return { discordToken: null, adminId: null, discordEnabled: false };
  }
}
