import { ensureDep0190Disabled } from "./src/nodeFlags.js";

ensureDep0190Disabled();
await import("./src/main.js");
