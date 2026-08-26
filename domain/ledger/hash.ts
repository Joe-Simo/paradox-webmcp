import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import stableStringify from "fast-json-stable-stringify";

export function canonicalHash(value: unknown): string {
  const canonical = stableStringify(value) ?? "null";
  return bytesToHex(sha256(new TextEncoder().encode(canonical))).slice(0, 12);
}
