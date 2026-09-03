import { describe, it, expect, afterEach } from 'vitest';
import { HermesStubClient } from '../../../../runtime/hermes/stub-client.js';

// Unit tests for the Hermes stub client. The stub is the test
// and dev fallback when no real Hermes binary is available. It
// must always report available and must always return a parseable
// JSON line so the adapter's parse path is exercised even
// without a real Hermes process.

describe('HermesStubClient', () => {
  afterEach(() => {
    HermesStubClient.reset();
  });

  it('reports available', () => {
    const client = new HermesStubClient();
    expect(client.isAvailable()).toBe(true);
  });

  it('returns a parseable JSON line on the last line by default', async () => {
    const client = new HermesStubClient();
    const result = await client.oneShot({ prompt: 'whatever', safeMode: true });
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split('\n');
    const last = lines[lines.length - 1] ?? '';
    expect(() => JSON.parse(last)).not.toThrow();
    const parsed = JSON.parse(last) as { summary: string; sources: unknown[]; evidenceCandidates: unknown[] };
    expect(parsed.summary).toMatch(/stub/i);
    expect(parsed.sources).toEqual([]);
    expect(parsed.evidenceCandidates).toEqual([]);
  });

  it('honors a test-programmed next payload', async () => {
    const client = new HermesStubClient();
    HermesStubClient.setNext({
      summary: 'injected',
      sources: [],
      evidenceCandidates: [],
    });
    const result = await client.oneShot({ prompt: 'whatever', safeMode: true });
    const last = result.stdout.split('\n').pop() ?? '';
    const parsed = JSON.parse(last) as { summary: string };
    expect(parsed.summary).toBe('injected');
  });
});
