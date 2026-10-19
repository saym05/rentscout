import { writeFileSync } from "node:fs";
import { buildVectors } from "./vectors";

const path = new URL("../../docs/test-vectors.json", import.meta.url);
writeFileSync(path, JSON.stringify(buildVectors(), null, 1) + "\n");
console.log(`wrote ${path.pathname}`);
