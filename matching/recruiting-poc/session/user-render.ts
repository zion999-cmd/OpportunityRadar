import type { FullPoolDiscoveredRelationship } from '../parse.js';
import type {
  AskDecision,
  SurfaceDecision,
  RuntimeDecision,
} from './parse.js';

// matching/recruiting-poc/session/user-render.ts —
// pure functions that turn a runtime decision into
// natural-language text the user reads in the CLI.
//
// Per Stage 0 §6, the CLI surface is:
//   - Ask: a single line of natural-language framing
//     followed by the question.
//   - Surface: a header + per-relationship block with
//     reason, unknowns, and next step. NO score, NO
//     ranking number, NO extracted skills, NO tags,
//     NO filters, NO match %. Candidate ID is shown as
//     identity only.
//
// These functions are pure. They do not call Hermes, do
// not read stdin, do not print. They are tested directly.

const QUESTION_PREAMBLE =
  '我还需要确认一件真正会影响我替你找谁的事情：';

const SURFACE_PREAMBLE = '我找到几个值得你了解的人。';

const UNKNOWN_PREAMBLE = '还需要确认：';
const NEXT_STEP_PREAMBLE = '下一步：';

function joinLines(lines: ReadonlyArray<string>): string {
  return lines.filter((l) => l.length > 0).join('\n');
}

export function renderAskForUser(decision: AskDecision): string {
  return joinLines([
    QUESTION_PREAMBLE,
    decision.question,
    '',
    decision.whyItMatters,
  ]);
}

export function renderRelationshipForUser(
  rel: FullPoolDiscoveredRelationship,
): string {
  const lines: string[] = [];
  lines.push(`${rel.candidateId}`);
  lines.push(rel.analysis);
  if (rel.unknowns.length > 0) {
    lines.push('');
    lines.push(UNKNOWN_PREAMBLE);
    for (const u of rel.unknowns) lines.push(`- ${u}`);
  }
  if (rel.nextStep.trim().length > 0) {
    lines.push('');
    lines.push(NEXT_STEP_PREAMBLE);
    lines.push(rel.nextStep);
  }
  return lines.join('\n');
}

export function renderSurfaceForUser(decision: SurfaceDecision): string {
  if (decision.relationships.length === 0) {
    return joinLines([
      SURFACE_PREAMBLE,
      '_（当前证据下，池子里没有足够有行动价值的人选。）_',
    ]);
  }
  const blocks = decision.relationships.map(renderRelationshipForUser);
  return joinLines([SURFACE_PREAMBLE, '', ...blocks]);
}

export function renderDecisionForUser(decision: RuntimeDecision): string {
  if (decision.action === 'ask') return renderAskForUser(decision);
  return renderSurfaceForUser(decision);
}
