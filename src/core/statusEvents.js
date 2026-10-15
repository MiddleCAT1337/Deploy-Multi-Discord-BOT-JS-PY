/** @typedef {"online" | "offline" | "error"} BotNotifyEvent */

/**
 * @typedef {object} BotStatusPayload
 * @property {"bot"} kind
 * @property {number} botId
 * @property {BotNotifyEvent} event
 * @property {string} [detail]
 * @property {string} [message]
 */

/** @typedef {{ message?: string | null } | BotStatusPayload} StatusPayload */

let listener = null;

export function onBotStatusChange(fn) {
  listener = fn;
}

/**
 * @param {string | null | StatusPayload} arg
 */
export function emitBotStatusChange(arg = null) {
  if (arg == null) {
    listener?.({ message: null });
    return;
  }
  if (typeof arg === "string") {
    listener?.({ message: arg });
    return;
  }
  listener?.(arg);
}

/**
 * @param {number} botId
 * @param {BotNotifyEvent} event
 * @param {{ detail?: string, message?: string }} [opts]
 */
export function emitBotLifecycle(botId, event, opts = {}) {
  /** @type {BotStatusPayload} */
  const payload = {
    kind: "bot",
    botId,
    event,
    ...opts,
  };
  listener?.(payload);
}
