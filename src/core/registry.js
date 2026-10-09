import fs from "node:fs";
import { DATA_DIR, REGISTRY_PATH } from "./paths.js";

const DEFAULT_STATE = {
  nextId: 1,
  bots: [],
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadRegistry() {
  ensureDataDir();
  if (!fs.existsSync(REGISTRY_PATH)) {
    saveRegistry(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }
  const raw = fs.readFileSync(REGISTRY_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!data.nextId) data.nextId = 1;
  if (!Array.isArray(data.bots)) data.bots = [];
  return data;
}

export function saveRegistry(state) {
  ensureDataDir();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function getBotById(state, id) {
  const num = Number(id);
  return state.bots.find((b) => b.id === num) ?? null;
}

export function listBotsSorted(state) {
  return [...state.bots].sort((a, b) => a.id - b.id);
}

export function allocateBot(state, { name, botPath, expiryDate }) {
  const id = state.nextId;
  state.nextId += 1;
  const bot = {
    id,
    name,
    path: botPath,
    expiryDate,
    runtime: null,
    startCommand: null,
    pid: null,
    status: "stopped",
  };
  state.bots.push(bot);
  saveRegistry(state);
  return bot;
}

export function persist(state) {
  saveRegistry(state);
}

export function removeBotEntry(state, id) {
  const num = Number(id);
  const idx = state.bots.findIndex((b) => b.id === num);
  if (idx === -1) return false;
  state.bots.splice(idx, 1);
  saveRegistry(state);
  return true;
}
