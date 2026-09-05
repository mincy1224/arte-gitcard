/** Synchronous sleep (blocks the event loop) for short file-op backoff windows. */
export function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
