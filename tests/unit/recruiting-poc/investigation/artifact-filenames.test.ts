import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeInvestigationArtifact } from '../../../../matching/recruiting-poc/investigation/artifact.js';
import { createInvestigationState } from '../../../../matching/recruiting-poc/investigation/state.js';

const TRACKED = new Set<string>();

function makeState(personId: string, employerId: string) {
  TRACKED.add(personId);
  return createInvestigationState(
    { personId, employerId, relationship: `${personId} ${employerId} candidate` },
    `ORIGINAL evidence for ${personId}`,
  );
}

function cleanupTracked(): void {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc', 'investigation');
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir)) {
      for (const personId of TRACKED) {
        if (entry.includes(`${personId.toLowerCase()}-patch-employer-01-investigation`)) {
          rmSync(resolve(dir, entry));
        }
      }
    }
  }
  TRACKED.clear();
}

afterEach(cleanupTracked);

describe('writeInvestigationArtifact filename derivation', () => {
  it('derives the filename identity from runtime state, not from a hard-coded p004', () => {
    const p004 = makeState('P004', 'Patch Employer-01');
    const p012 = makeState('P012', 'Patch Employer-01');
    const p004Path = writeInvestigationArtifact(p004, []);
    const p012Path = writeInvestigationArtifact(p012, []);

    expect(p004Path).not.toBe(p012Path);
    expect(p004Path).toContain('p004-patch-employer-01-investigation.json');
    expect(p012Path).toContain('p012-patch-employer-01-investigation.json');
    // The legacy hard-coded name is no longer produced.
    expect(p004Path).not.toMatch(/_p004-patch-investigation\.json$/);
    expect(p012Path).not.toMatch(/_p004-patch-investigation\.json$/);
  });

  it('preserves a JSON envelope of state and failures that the runtime can read back', () => {
    const state = makeState('P004', 'Patch Employer-01');
    const path = writeInvestigationArtifact(state, []);
    const round = JSON.parse(readFileSync(path, 'utf8')) as { state: { relationshipCandidate: { personId: string } } };
    expect(round.state.relationshipCandidate.personId).toBe('P004');
  });

  it('produces a stable slug for unusual employer identifiers', () => {
    const a = makeState('P004', 'Patch Employer-01');
    const b = makeState('P004', 'patch employer 01');
    const c = makeState('P004', 'PATCH__Employer__01');
    const aPath = writeInvestigationArtifact(a, []);
    const bPath = writeInvestigationArtifact(b, []);
    const cPath = writeInvestigationArtifact(c, []);
    const aBase = aPath.split('/').pop();
    const bBase = bPath.split('/').pop();
    const cBase = cPath.split('/').pop();
    // Same timestamp is not guaranteed across calls, so we only assert
    // that the slug substring is identical.
    expect(aBase).toContain('p004-patch-employer-01-investigation');
    expect(bBase).toContain('p004-patch-employer-01-investigation');
    expect(cBase).toContain('p004-patch-employer-01-investigation');
  });
});
