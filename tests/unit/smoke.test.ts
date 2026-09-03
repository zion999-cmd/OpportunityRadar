import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Smoke test for the Bootstrap stage.
//
// Goals:
//   1. Prove the Vitest pipeline is wired correctly.
//   2. Prove the Zod runtime dependency is loadable from the test graph.
//   3. Exercise the AAA pattern required by project rules.
//
// This test does NOT exercise any Opportunity Radar business concept. Such
// behavior will arrive via its owning Proposal (likely P0001).

describe('bootstrap smoke', () => {
  it('validates a minimal zod object schema', () => {
    // Arrange
    const schema = z.object({
      label: z.string().min(1),
    });

    // Act
    const result = schema.parse({ label: 'opportunity-radar' });

    // Assert
    expect(result.label).toBe('opportunity-radar');
  });

  it('rejects an empty label with a structured issue', () => {
    // Arrange
    const schema = z.object({
      label: z.string().min(1),
    });

    // Act
    const outcome = schema.safeParse({ label: '' });

    // Assert
    expect(outcome.success).toBe(false);
    if (!outcome.success) {
      expect(outcome.error.issues[0]?.path).toEqual(['label']);
    }
  });
});
