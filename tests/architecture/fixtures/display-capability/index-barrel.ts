/**
 * NEGATIVE fixture (LC-2): a Display that reaches the mixed/global public barrel
 * src/index.ts, which re-exports scanRepository / analyzeCodebase /
 * runGitActivity. The resolved module target is src/index.ts → the guard must
 * FAIL (a path-substring blacklist would not catch this).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { scanRepository, analyzeCodebase, runGitActivity } from "../../../../src/index.js";

export const barrelReach = { scanRepository, analyzeCodebase, runGitActivity };
