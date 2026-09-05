"use strict";
/**
 * Cross-platform release guard (Pass 1 / AC correction 3).
 * Verifies the required build artifacts exist before `npm pack` produces a .tgz.
 * No Bash-only commands — pure Node so it runs on Windows / Linux / macOS alike.
 *
 * Exits non-zero when a required artifact is missing, so a "successful" .tgz
 * can never ship without dist/cli.js.
 */

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const required = ["dist/cli.js", "dist/index.js", "dist/ci/main.cjs"];

const missing = required.filter((rel) => {
  const abs = path.join(projectRoot, rel);
  return !fs.existsSync(abs) || !fs.statSync(abs).isFile();
});

if (missing.length > 0) {
  console.error(
    `[verify-dist] FAIL: missing build artifacts: ${missing.join(", ")}\n` +
      `Run "npm run build" first, then pack again.`,
  );
  process.exit(1);
}

console.log(`[verify-dist] OK: ${required.join(", ")} present.`);
