import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InvestigationFailure } from './runtime.js';
import type { InvestigationState } from './state.js';

/**
 * Slugify an arbitrary identifier for use in a filename. Lowercases
 * the input, collapses runs of non-alphanumerics to a single dash,
 * and trims leading/trailing dashes. Returns 'unnamed' if the
 * resulting slug is empty.
 */
function slugifyForFilename(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'unnamed';
}

export function writeInvestigationArtifact(state: InvestigationState, failures: ReadonlyArray<InvestigationFailure>): string {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc', 'investigation');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const person = slugifyForFilename(state.relationshipCandidate.personId);
  const employer = slugifyForFilename(state.relationshipCandidate.employerId);
  const path = resolve(dir, `${stamp}_${person}-${employer}-investigation.json`);
  writeFileSync(path, JSON.stringify({ state, failures }, null, 2), 'utf8');
  return path;
}
