const DEFAULT_DEBUG_LINES = 40;

export function parseKeyValueArgs(rest) {
  const pairs = {};
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|(\S*))/g;
  let m;
  while ((m = regex.exec(rest)) !== null) {
    const key = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    pairs[key] = value;
  }
  return pairs;
}

export function parseCommand(line) {
  const trimmed = line.trim();
  if (!trimmed) return { type: "empty" };

  const lower = trimmed.toLowerCase();
  if (lower === "help" || lower === "?") return { type: "help" };
  if (lower === "clear") return { type: "clear" };
  if (lower === "status") return { type: "status" };
  if (lower === "exit" || lower === "quit") return { type: "exit" };

  const parts = trimmed.split(/\s+/);
  const verb = parts[0].toLowerCase();
  const rest = trimmed.slice(parts[0].length).trim();
  const kv = parseKeyValueArgs(rest);

  switch (verb) {
    case "new":
      return {
        type: "new",
        path: kv.path,
        date: kv.date,
        name: kv.name,
      };
    case "start":
      return { type: "start", bot: kv.bot != null ? Number(kv.bot) : NaN };
    case "stop":
      return { type: "stop", bot: kv.bot != null ? Number(kv.bot) : NaN };
    case "restart":
      return { type: "restart", bot: kv.bot != null ? Number(kv.bot) : NaN };
    case "remove":
      return { type: "remove", bot: kv.bot != null ? Number(kv.bot) : NaN };
    case "set":
      return {
        type: "set",
        bot: kv.bot != null ? Number(kv.bot) : NaN,
        date: kv.date,
      };
    case "addday":
      return {
        type: "addday",
        bot: kv.bot != null ? Number(kv.bot) : NaN,
        day: kv.day != null ? Number(kv.day) : NaN,
      };
    case "debug":
      return {
        type: "debug",
        bot: kv.bot != null ? Number(kv.bot) : NaN,
        lines: kv.lines != null ? Number(kv.lines) : DEFAULT_DEBUG_LINES,
      };
    default:
      return { type: "unknown", raw: trimmed };
  }
}
