/** Binary sniffing (plan.md §60): NUL byte within the first 8 KiB → binary. */

const SNIFF_BYTES = 8192;

export function isBinary(buf: Uint8Array): boolean {
  const n = Math.min(buf.length, SNIFF_BYTES);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}
