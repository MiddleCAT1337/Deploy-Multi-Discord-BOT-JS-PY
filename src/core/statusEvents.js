let listener = null;

export function onBotStatusChange(fn) {
  listener = fn;
}

export function emitBotStatusChange(message = null) {
  listener?.({ message });
}
