import { createHash } from 'node:crypto';
import type { Market } from '../contracts/source-document.js';

// Evidence fingerprint — the internal dedup key for an Evidence
// record. Per P0001 §Evidence Dedup, the fingerprint is computed
// from the normalized subject + normalized claim + eventAt ISO + market.
//
// Per P0001 §Hashing: Node built-in `crypto`, no extra dependency,
// fingerprint is an *internal* dedup mechanism (never the
// business identity).

export interface FingerprintInput {
  subject: string;
  claim: string;
  eventAt: string | null;
  market: Market;
}

function normalizeField(value: string): string {
  // Collapse runs of whitespace and trim. The fingerprint is a
  // *dedup* key, not a claim-equivalence engine, so we only apply
  // a small set of surface normalisations that we know are stable.
  return value.replace(/\s+/g, ' ').trim();
}

export function evidenceFingerprint(input: FingerprintInput): string {
  // Arrange: normalize the textual fields into a canonical form.
  const subject = normalizeField(input.subject);
  const claim = normalizeField(input.claim);
  const eventAt = input.eventAt === null ? '' : input.eventAt;
  const market = input.market;

  // Act: hash the canonical tuple with sha256.
  const payload = `${subject}␟${claim}␟${eventAt}␟${market}`;
  const digest = createHash('sha256').update(payload).digest('hex');

  // Assert: 64-char hex string (sha256).
  return digest;
}
