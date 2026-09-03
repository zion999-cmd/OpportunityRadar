import { describe, it, expect } from 'vitest';
import { evidenceFingerprint } from '../../../evidence/normalization/evidence-fingerprint.js';

// Unit tests for the Evidence fingerprint.
//
// Per P0001 §Evidence Dedup, the fingerprint is the internal
// dedup key for an Evidence record. It is computed from the
// normalized subject + normalized claim + eventAt ISO + market.
// The fingerprint is an *internal* mechanism, not a business
// identity (per P0001 §Hashing).

describe('evidenceFingerprint', () => {
  it('returns a 64-character hex string (sha256)', () => {
    const fp = evidenceFingerprint({
      subject: 'Wonderful',
      claim: 'Wonderful raised USD 550M in a Series C round.',
      eventAt: '2026-08-30T00:00:00.000Z',
      market: 'US',
    });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable for the same normalized fact', () => {
    const input = {
      subject: 'Wonderful',
      claim: 'Wonderful raised USD 550M in a Series C round.',
      eventAt: '2026-08-30T00:00:00.000Z',
      market: 'US' as const,
    };
    const a = evidenceFingerprint(input);
    const b = evidenceFingerprint(input);
    expect(a).toBe(b);
  });

  it('changes when eventAt changes (different times, different facts)', () => {
    const base = {
      subject: 'Wonderful',
      claim: 'Wonderful raised USD 550M in a Series C round.',
      market: 'US' as const,
    };
    const a = evidenceFingerprint({ ...base, eventAt: '2025-08-30T00:00:00.000Z' });
    const b = evidenceFingerprint({ ...base, eventAt: '2026-08-30T00:00:00.000Z' });
    expect(a).not.toBe(b);
  });

  it('changes when market changes (same claim, different market context)', () => {
    const base = {
      subject: 'Wonderful',
      claim: 'Wonderful raised USD 550M in a Series C round.',
      eventAt: '2026-08-30T00:00:00.000Z',
    };
    const a = evidenceFingerprint({ ...base, market: 'US' });
    const b = evidenceFingerprint({ ...base, market: 'CN' });
    expect(a).not.toBe(b);
  });

  it('changes when subject changes', () => {
    const base = {
      claim: 'raised USD 550M in a Series C round.',
      eventAt: '2026-08-30T00:00:00.000Z',
      market: 'US' as const,
    };
    const a = evidenceFingerprint({ ...base, subject: 'Wonderful' });
    const b = evidenceFingerprint({ ...base, subject: 'XPeng Robotics' });
    expect(a).not.toBe(b);
  });

  it('changes when claim changes', () => {
    const base = {
      subject: 'Wonderful',
      eventAt: '2026-08-30T00:00:00.000Z',
      market: 'US' as const,
    };
    const a = evidenceFingerprint({
      ...base,
      claim: 'Wonderful raised USD 550M in a Series C round.',
    });
    const b = evidenceFingerprint({
      ...base,
      claim: 'Wonderful reached a USD 5B reported valuation.',
    });
    expect(a).not.toBe(b);
  });

  it('treats null eventAt as a stable "unknown time" fingerprint', () => {
    const a = evidenceFingerprint({
      subject: 'Wonderful',
      claim: 'Wonderful has an unreported financing.',
      eventAt: null,
      market: 'US',
    });
    const b = evidenceFingerprint({
      subject: 'Wonderful',
      claim: 'Wonderful has an unreported financing.',
      eventAt: null,
      market: 'US',
    });
    expect(a).toBe(b);
  });

  it('treats null eventAt as different from any concrete eventAt', () => {
    const base = {
      subject: 'Wonderful',
      claim: 'Wonderful has a financing.',
      market: 'US' as const,
    };
    const a = evidenceFingerprint({ ...base, eventAt: null });
    const b = evidenceFingerprint({
      ...base,
      eventAt: '2026-08-30T00:00:00.000Z',
    });
    expect(a).not.toBe(b);
  });
});
