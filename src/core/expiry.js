import { DateTime } from "luxon";

export const TZ = "Asia/Bangkok";

export function nowBKK() {
  return DateTime.now().setZone(TZ);
}

export function parseDateDDMMYYYY(input) {
  const trimmed = String(input).trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const dt = DateTime.fromObject({ year, month, day }, { zone: TZ });
  if (!dt.isValid || dt.day !== day || dt.month !== month || dt.year !== year) {
    return null;
  }
  return dt.startOf("day");
}

export function expiryToStorage(dt) {
  return dt.toISODate();
}

export function expiryFromStorage(isoDate) {
  return DateTime.fromISO(isoDate, { zone: TZ }).startOf("day");
}

export function formatDisplayDate(dt) {
  return dt.toFormat("dd/MM/yyyy");
}

export function todayDateBKK() {
  return nowBKK().startOf("day");
}

export function isExpired(expiryIso) {
  const today = todayDateBKK();
  const expiry = expiryFromStorage(expiryIso);
  return today > expiry;
}

export function shutdownInstant(expiryIso) {
  const expiry = expiryFromStorage(expiryIso);
  return expiry.plus({ days: 1 }).startOf("day");
}

export function shouldAutoStop(expiryIso) {
  return nowBKK() >= shutdownInstant(expiryIso);
}

export function remainingText(expiryIso) {
  if (isExpired(expiryIso)) return "Expired";
  const end = shutdownInstant(expiryIso);
  const diff = end.diff(nowBKK(), ["days", "hours", "minutes"]).toObject();
  const days = Math.floor(diff.days ?? 0);
  const hours = Math.floor(diff.hours ?? 0);
  const minutes = Math.floor(diff.minutes ?? 0);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function remainingDaysApprox(expiryIso) {
  if (isExpired(expiryIso)) return -1;
  const end = shutdownInstant(expiryIso);
  return end.diff(nowBKK(), "days").days;
}

export function computeAddDayExpiry(expiryIso, daysToAdd) {
  const today = todayDateBKK();
  const expiry = expiryFromStorage(expiryIso);
  const base = isExpired(expiryIso) ? today : expiry;
  const newExpiry = base.plus({ days: daysToAdd });
  return expiryToStorage(newExpiry);
}

export function syncExpiredStatus(bot) {
  if (isExpired(bot.expiryDate)) {
    if (bot.status === "running") return bot.status;
    bot.status = "expired";
  } else if (bot.status === "expired") {
    bot.status = "stopped";
  }
  return bot.status;
}
