import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "../..");
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
export const REGISTRY_PATH = path.join(DATA_DIR, "bots.json");
export const LOGS_DIR = path.join(DATA_DIR, "logs");
