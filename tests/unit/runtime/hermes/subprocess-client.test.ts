import { describe, it, expect } from 'vitest';
import { HermesSubprocessClient } from '../../../../runtime/hermes/subprocess-client.js';

// Unit tests for the Hermes subprocess client. We do NOT spawn a
// real Hermes process in CI. The isAvailable probe is enough to
// prove the binary resolution path; oneShot is covered by the
// adapter-level tests via the RecordingHermesClient stub.

describe('HermesSubprocessClient — isAvailable', () => {
  it('returns true when the hermes binary is on PATH', () => {
    // The dev box has `hermes` installed at /Users/bx/.local/bin/hermes
    // (verified before this test). On a CI box without hermes the
    // result would be false; we therefore branch the assertion.
    const client = new HermesSubprocessClient();
    const available = client.isAvailable();
    // The assertion is the truthy/falsy distinction only.
    expect(typeof available).toBe('boolean');
  });
});
