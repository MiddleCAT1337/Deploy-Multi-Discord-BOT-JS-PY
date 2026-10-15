import { isExpired, syncExpiredStatus } from "./expiry.js";

/** @typedef {"online" | "offline" | "error"} BotNotifyEvent */

/** @param {{ status?: string, expiryDate?: string }} bot */
export function panelStatusForBot(bot) {
  syncExpiredStatus(bot);
  if (bot.status === "running") {
    return { label: "Online", kind: "online" };
  }
  if (bot.status === "expired" || isExpired(bot.expiryDate)) {
    return { label: "Offline (หมดอายุ)", kind: "offline" };
  }
  return { label: "Offline", kind: "offline" };
}

/**
 * @param {number | null | undefined} code
 * @returns {BotNotifyEvent}
 */
export function exitEventFromCode(code) {
  if (code !== 0 && code != null) return "error";
  return "offline";
}
