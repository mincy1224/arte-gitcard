/**
 * CI runtime event gate (default-branch pass) — field-level verification. The
 * GitHub event payload is an INDEPENDENT authority: state.json is only an
 * installation snapshot. An accepted run requires eventName/ref/ref_name AND
 * github.event.repository.default_branch all to agree with the state snapshot.
 * ANY mismatch must skip (no generation/commit/push).
 */

import { describe, expect, it } from "vitest";
import { verifyPushEvent } from "../../src/ci/runtime.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER = "abcdef0123456789abcdef0123456789abcdef01";
const env = { eventName: "push", ref: "refs/heads/main", refName: "main", sha: SHA };
const payload = {
  ref: "refs/heads/main",
  deleted: false,
  after: SHA,
  repository: { default_branch: "main" },
};

describe("verifyPushEvent (event payload is the authority)", () => {
  it("accepts a fully matching push (ref == state default == event repository default)", () => {
    expect(verifyPushEvent(env, payload, "main", SHA)).toEqual({ ok: true });
  });

  it.each([
    ["event name not push", { ...env, eventName: "pull_request" }, payload],
    ["GITHUB_REF mismatch", { ...env, ref: "refs/heads/other" }, payload],
    ["GITHUB_REF_NAME mismatch", { ...env, refName: "other" }, payload],
    ["GITHUB_REF MISSING (undefined)", { ...env, ref: undefined }, payload],
    ["GITHUB_REF_NAME MISSING (undefined)", { ...env, refName: undefined }, payload],
    ["payload.ref mismatch", env, { ...payload, ref: "refs/heads/other" }],
    ["deleted event", env, { ...payload, deleted: true }],
    ["event repository default branch mismatch (stale old-default workflow)", env, { ...payload, repository: { default_branch: "trunk" } }],
    ["event repository default branch MISSING", env, { ref: "refs/heads/main", deleted: false, after: SHA }],
    ["after all-zeros", env, { ...payload, after: "0".repeat(40) }],
    ["after short/invalid", env, { ...payload, after: "abc" }],
    ["GITHUB_SHA != after", env, { ...payload, after: OTHER }],
    ["HEAD != after", env, payload, OTHER],
  ])("rejects %s", (_name, e, p, head = SHA) => {
    const v = verifyPushEvent(e as typeof env, p as typeof payload, "main", head);
    expect(v.ok).toBe(false);
    expect(v.skip).toBe(true); // never a mutation, just a no-op skip
  });

  it("an arbitrary VALID default branch is accepted when every field agrees", () => {
    const trunkEnv = { eventName: "push", ref: "refs/heads/trunk", refName: "trunk", sha: SHA };
    const trunkPayload = { ref: "refs/heads/trunk", deleted: false, after: SHA, repository: { default_branch: "trunk" } };
    expect(verifyPushEvent(trunkEnv, trunkPayload, "trunk", SHA)).toEqual({ ok: true });
  });
});
