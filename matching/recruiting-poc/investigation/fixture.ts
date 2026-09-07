import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInvestigationState } from './state.js';

export function loadCollision01P004PatchFixture() {
  const base = resolve(process.cwd(), 'research', 'semantic-native', 'real-evidence', 'collision-01');
  const discovery = readFileSync(resolve(base, 'relationship-discovery.md'), 'utf8');
  const falsification = readFileSync(resolve(base, 'relationship-falsification.md'), 'utf8');
  return createInvestigationState({
    personId: 'P004',
    employerId: 'Patch Employer-01',
    relationship: 'The P004 relationship candidate received from the frozen Collision-01 discovery and falsification evidence.',
  }, `SOURCE: relationship-discovery.md (verbatim)\n${discovery}\n\nSOURCE: relationship-falsification.md (verbatim)\n${falsification}`);
}

export function loadPilot01P012PatchFixture() {
  const pilotBase = resolve(process.cwd(), 'research', 'semantic-native', 'real-evidence', 'pilot-01', 'sources');
  const employerBase = resolve(process.cwd(), 'research', 'semantic-native', 'real-evidence', 'employer-01');
  const person = readFileSync(resolve(pilotBase, 'P012.md'), 'utf8');
  const employerExpression = readFileSync(resolve(employerBase, 'raw-employer-expression.md'), 'utf8');
  const employerReconstruction = readFileSync(resolve(employerBase, 'evidence-reconstruction.md'), 'utf8');
  return createInvestigationState({
    personId: 'P012',
    employerId: 'Patch Employer-01',
    relationship: 'The P012 relationship candidate received from the frozen pilot-01 person evidence and employer-01 employer evidence.',
  }, `SOURCE: pilot-01/sources/P012.md (verbatim)\n${person}\n\nSOURCE: employer-01/raw-employer-expression.md (verbatim)\n${employerExpression}\n\nSOURCE: employer-01/evidence-reconstruction.md (verbatim)\n${employerReconstruction}`);
}
