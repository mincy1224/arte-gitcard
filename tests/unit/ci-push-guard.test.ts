/**
 * CI push stale/deleted-race guard + hardened git argv (Phase 6 P0):
 *  - pushWithStaleGuard NEVER recreates a deleted branch and NEVER pushes on an
 *    unverifiable remote:
 *      * remote target must be EXACTLY base to push;
 *      * remote ref absent (deleted) → stale success, no push;
 *      * ls-remote failure → fail closed, no push;
 *      * push rejected → re-lookup: moved/absent → stale; still base → REAL error;
 *      * never retry / never force / never force-with-lease;
 *  - gitArgv always uses `--literal-pathspecs` + `-c core.hooksPath=<empty>`;
 *  - pathspecs with glob-ish characters stay single literal tokens.
 */

import { describe, expect, it } from "vitest";
import { gitArgv, pushWithStaleGuard } from "../../src/ci/runtime.js";
import type { RemoteLookup } from "../../src/ci/runtime.js";

const BASE = "1111111111111111111111111111111111111111";
const MOVED = "2222222222222222222222222222222222222222";

const PRESENT = (sha: string): RemoteLookup => ({ ok: true, sha });
const ABSENT: RemoteLookup = { ok: true, sha: null };
const FAILED: RemoteLookup = { ok: false, error: "ls-remote exited 128" };

function hooks(runPushResult: { code: number }, remote: () => RemoteLookup) {
  let pushCalls = 0;
  return {
    pushCalls: () => pushCalls,
    runPush: () => {
      pushCalls += 1;
      return { out: "", code: runPushResult.code };
    },
    lsRemote: remote,
  };
}

describe("pushWithStaleGuard", () => {
  it("remote already moved → stale success, push NOT attempted", () => {
    const h = hooks({ code: 1 }, () => PRESENT(MOVED));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.pushed).toBe(false);
    expect(r.code).toBe(0);
    expect(h.pushCalls()).toBe(0); // never force/race a push
  });

  it("clean push succeeds when the remote is EXACTLY base", () => {
    const h = hooks({ code: 0 }, () => PRESENT(BASE));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.pushed).toBe(true);
    expect(r.code).toBe(0);
    expect(h.pushCalls()).toBe(1);
  });

  it("remote branch ABSENT (deleted) before push → stale success, push NOT attempted, never recreated", () => {
    const h = hooks({ code: 0 }, () => ABSENT);
    const r = pushWithStaleGuard(BASE, h);
    expect(r.pushed).toBe(false);
    expect(r.code).toBe(0);
    expect(r.reason).toMatch(/deleted|absent|NEVER recreated/i);
    expect(h.pushCalls()).toBe(0); // a deleted branch is never recreated
  });

  it("ls-remote FAILURE before push → fail closed, push NOT attempted", () => {
    const h = hooks({ code: 0 }, () => FAILED);
    const r = pushWithStaleGuard(BASE, h);
    expect(r.pushed).toBe(false);
    expect(r.code).toBe(1);
    expect(r.reason).toMatch(/fail|verify|ls-remote/i);
    expect(h.pushCalls()).toBe(0);
  });

  it("race-after-precheck: pre-check==base, push fails non-FF, remote moved → stale success (no force/merge/rebase)", () => {
    let lsCalls = 0;
    // first ls-remote == base; after the failed push the remote shows a NEW head
    const h = hooks({ code: 1 }, () => (lsCalls++ === 0 ? PRESENT(BASE) : PRESENT(MOVED)));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.code).toBe(0);
    expect(r.pushed).toBe(false);
    expect(r.reason).toMatch(/raced|remote moved/i);
    expect(h.pushCalls()).toBe(1); // one normal (non-force) push attempt
  });

  it("push rejected then the remote ref is ABSENT → stale success, branch never recreated", () => {
    let lsCalls = 0;
    const h = hooks({ code: 1 }, () => (lsCalls++ === 0 ? PRESENT(BASE) : ABSENT));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.code).toBe(0);
    expect(r.pushed).toBe(false);
    expect(r.reason).toMatch(/deleted|NEVER recreated/i);
    expect(h.pushCalls()).toBe(1);
  });

  it("push rejected then the re-lookup FAILS → real error, no force", () => {
    let lsCalls = 0;
    const h = hooks({ code: 1 }, () => (lsCalls++ === 0 ? PRESENT(BASE) : FAILED));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.code).toBe(1);
    expect(r.reason).toMatch(/REAL error/);
    expect(h.pushCalls()).toBe(1);
  });

  it("push rejected while remote is STILL base → real error, fail clearly", () => {
    const h = hooks({ code: 1 }, () => PRESENT(BASE));
    const r = pushWithStaleGuard(BASE, h);
    expect(r.code).toBe(1);
    expect(r.reason).toMatch(/REAL error|protection/);
  });
});

describe("hardened git argv", () => {
  it("always passes --literal-pathspecs and disables hooks", () => {
    const argv = gitArgv(["add", "--", "x.svg"], "C:/nohooks");
    expect(argv[0]).toBe("--literal-pathspecs");
    expect(argv).toContain("core.hooksPath=C:/nohooks");
    expect(argv).toContain("--");
  });

  it("glob-ish characters in a path are kept as ONE literal token (no shell/glob)", () => {
    const weird = "docs/cards/*.svg?[a]:b.svg";
    const argv = gitArgv(["add", "--", weird], "nohooks");
    expect(argv.filter((a) => a === weird)).toEqual([weird]); // a single literal argument
    expect(argv).not.toContain("*.svg"); // never split/expanded
  });
});
