import { ensureDep0190Disabled } from "./src/nodeFlags.js";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) {
  console.error(
    `DeployBot requires Node.js 18 or newer (see package.json engines). Current: ${process.version}`,
  );
  process.exit(1);
}

ensureDep0190Disabled();

import("./src/main.js").catch((e) => {
  console.error(e);
  process.exit(1);
});
