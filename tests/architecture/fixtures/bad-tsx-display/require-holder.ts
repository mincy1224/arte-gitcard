/**
 * NEGATIVE fixture: proves the scanner also catches the CJS `require("node:fs")`
 * literal form, not just `import`/`from`.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const requireFs: unknown = require("node:fs");
