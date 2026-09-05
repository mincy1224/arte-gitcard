/**
 * POSITIVE fixture (LC-2): a Display importing repository data through the
 * approved terminal boundary src/statistics/** → the guard must PASS, even
 * though Statistics' own audited reader imports (scanner etc.) are not treated
 * as Display imports.
 */
import { codebaseStatistics } from "../../../../src/statistics/index.js";

export const readerReach = codebaseStatistics;
