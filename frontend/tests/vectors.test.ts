import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildVectors } from "../scripts/vectors";

test("docs/test-vectors.json is up to date with the TypeScript domain (run npm run vectors)", () => {
  const stored = JSON.parse(readFileSync(new URL("../../docs/test-vectors.json", import.meta.url), "utf8"));
  assert.deepEqual(stored, JSON.parse(JSON.stringify(buildVectors())));
});
