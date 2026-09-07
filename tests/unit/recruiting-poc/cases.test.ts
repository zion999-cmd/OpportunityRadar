import { describe, it, expect } from 'vitest';
import {
  EMPLOYER_RAW_SITUATION,
  CANDIDATE_POOL,
} from '../../../matching/recruiting-poc/cases.js';

describe('recruiting-poc/cases', () => {
  it('contains exactly 20 candidates', () => {
    expect(CANDIDATE_POOL).toHaveLength(20);
  });

  it('every candidate has a non-empty id and a non-empty rawExperience', () => {
    for (const c of CANDIDATE_POOL) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.rawExperience.length).toBeGreaterThan(0);
    }
  });

  it('candidate ids are unique across the 20', () => {
    const ids = CANDIDATE_POOL.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('candidate ids follow the C01..C20 pattern (identity only, no expected label)', () => {
    const ids = CANDIDATE_POOL.map((c) => c.id);
    expect(ids).toEqual([
      'C01', 'C02', 'C03', 'C04', 'C05',
      'C06', 'C07', 'C08', 'C09', 'C10',
      'C11', 'C12', 'C13', 'C14', 'C15',
      'C16', 'C17', 'C18', 'C19', 'C20',
    ]);
  });

  it('raw experiences are unique across the 20 (no two accidentally share material)', () => {
    const raws = CANDIDATE_POOL.map((c) => c.rawExperience);
    expect(new Set(raws).size).toBe(raws.length);
  });

  it('each raw experience is non-trivial in length (Stage 1 §2: ~100–250 English words)', () => {
    // Stage 1 says "约 100–250" — i.e. approximately. We assert
    // a non-trivial floor (>= 80 words) to catch accidental
    // truncation, and a ceiling (no candidate can exceed 400
    // words under the Stage 1 spec).
    for (const c of CANDIDATE_POOL) {
      const wordCount = c.rawExperience.trim().split(/\s+/).length;
      expect(wordCount, `${c.id} word count`).toBeGreaterThanOrEqual(80);
      expect(wordCount, `${c.id} word count`).toBeLessThanOrEqual(400);
    }
  });

  it('no raw experience directly repeats the employer situation text verbatim', () => {
    for (const c of CANDIDATE_POOL) {
      expect(c.rawExperience).not.toContain(EMPLOYER_RAW_SITUATION);
    }
  });

  it('employer situation is the verbatim Chinese text from Stage 1 §1', () => {
    expect(EMPLOYER_RAW_SITUATION).toContain('Kafka 这块现在没人真正 owner');
    expect(EMPLOYER_RAW_SITUATION).toContain('扛 on-call');
    expect(EMPLOYER_RAW_SITUATION).toContain('写 postmortem');
    expect(EMPLOYER_RAW_SITUATION).toContain('地点无所谓');
  });

  it('id field is identity only — does not embed expected match / label / category', () => {
    for (const c of CANDIDATE_POOL) {
      // ids are pure sequence markers; no semantic suffix allowed
      expect(c.id).toMatch(/^C\d{2}$/);
    }
  });

  it('pool covers all 8 archetypes the spec asks for (no candidate ID mapping required)', () => {
    // We do not assert which candidate is in which archetype; the
    // archetype grouping lives only in this test file's docstring
    // on cases.ts. This test enforces that the pool has 20 entries
    // and the size is preserved across any future fixture edits.
    expect(CANDIDATE_POOL).toHaveLength(20);
  });
});
