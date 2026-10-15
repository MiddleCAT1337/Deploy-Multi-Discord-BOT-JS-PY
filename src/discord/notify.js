import { nowBKK } from "../core/expiry.js";
import { getBotById } from "../core/registry.js";
import { emitBotStatusChange } from "../core/statusEvents.js";
import { panelStatusForBot } from "../core/botStatus.js";

const EVENT_LABEL = {
  online: "ออนไลน์",
  offline: "ออฟไลน์",
  error: "ข้อผิดพลาด",
};

/**
 * @param {{ ownerId?: string | null }} bot
 * @param {string | null} adminId
 */
export function recipientsForBot(bot, adminId) {
  const ids = new Set();
  if (bot.ownerId) ids.add(bot.ownerId);
  if (adminId) ids.add(adminId);
  return ids;
}

function buildNotifyText(bot, event, detail) {
  const st = panelStatusForBot(bot);
  const when = nowBKK().toFormat("dd/MM/yyyy HH:mm:ss");
  const lines = [
    `**DeployBot** — ${EVENT_LABEL[event] ?? event}`,
    `บอท #${bot.id} · ${bot.name}`,
    `สถานะ: ${st.label}`,
  ];
  if (detail) lines.push(detail);
  lines.push(`เวลา (Bangkok): ${when}`);
  return lines.join("\n");
}

/**
 * @param {import("discord.js").Client} client
 * @param {object} state
 * @param {string | null} adminId
 * @param {{ botId: number, event: "online" | "offline" | "error", detail?: string }} opts
 */
export async function sendStatusDm(client, state, adminId, { botId, event, detail }) {
  if (!client?.isReady()) return;
  const bot = getBotById(state, botId);
  if (!bot) return;

  const text = buildNotifyText(bot, event, detail);
  for (const userId of recipientsForBot(bot, adminId)) {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ content: text });
    } catch (e) {
      const msg = e?.message ?? String(e);
      emitBotStatusChange(`[WARN] discord DM user=${userId} bot=${botId}: ${msg}`);
    }
  }
}
