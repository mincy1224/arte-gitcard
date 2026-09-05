/**
 * Version consistency (RC). package.json and the single exported VERSION must
 * never drift apart — arte-gitcard is distributed as arte-gitcard-<version>.tgz,
 * so a mismatch breaks installs and the packed smoke checks.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { VERSION } from "../../src/version.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

describe("version consistency", () => {
  it("package.json version === exported VERSION === 1.0.0", () => {
    expect(pkg.version).toBe("1.0.0");
    expect(VERSION).toBe("1.0.0");
    expect(VERSION).toBe(pkg.version);
  });

  it("the tarball example name matches the release version", () => {
    // Local distribution is arte-gitcard-<version>.tgz (see README).
    const readme = readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf8");
    expect(readme).toContain(`arte-gitcard-${VERSION}.tgz`);
  });
});
