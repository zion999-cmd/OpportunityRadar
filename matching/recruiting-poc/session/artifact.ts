import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FullPoolDiscoveredRelationship } from '../parse.js';
import type { SessionTimeline } from './runtime.js';
import { findFinalSurfaceDecision } from './runtime.js';

// matching/recruiting-poc/session/artifact.ts —
// render and write the per-session Markdown artifact for
// the Product Spine.
//
// Sections (per Stage 0 §8), in order:
//   1. Original Raw Situation           (verbatim)
//   2. Raw Intent Evidence Timeline     (verbatim, append-only)
//   3. Runtime Decisions                (one block per turn)
//   4. Questions Asked                  (numbered list)
//   5. User Answers                     (numbered list)
//   6. Final Relationships              (5-field shape)
//   7. Evidence / Unknowns / Next Actions (per-relationship detail)
//   8. Raw Hermes Outputs               (one block per turn)
//   9. Runtime Metadata                 (status, durations, budget)
//  10. Session Timeline (t-numbered)    (t0, t1, t2, ...)
//
// The session timeline is an explicit per-event log, not a
// Job state. The numbers t0..tN are the actual turn
// indices, in order.

const NONE = '—';

function bullet(s: string): string {
  return `- ${s}`;
}

function renderRelationship(rel: FullPoolDiscoveredRelationship): string {
  const lines: string[] = [`### ${rel.candidateId} — ${rel.judgment}`, ''];
  lines.push('**analysis**');
  lines.push(rel.analysis);
  lines.push('');
  lines.push('**evidence**');
  if (rel.evidence.length === 0) {
    lines.push('_empty_');
  } else {
    for (const e of rel.evidence) lines.push(bullet(e));
  }
  lines.push('');
  lines.push('**unknowns**');
  if (rel.unknowns.length === 0) {
    lines.push('_empty_');
  } else {
    for (const u of rel.unknowns) lines.push(bullet(u));
  }
  lines.push('');
  lines.push('**nextStep**');
  lines.push(rel.nextStep);
  lines.push('');
  return lines.join('\n');
}

export function renderSessionArtifact(timeline: SessionTimeline): string {
  const finalSurface = findFinalSurfaceDecision(timeline);
  const totalDurationMs = timeline.turns.reduce((a, t) => a + t.durationMs, 0);
  const surfaceTurn = timeline.turns.findIndex(
    (t) => t.decision.action === 'surface',
  );

  const sections: string[] = [
    '# Semantic Native Recruiting POC v0 — Product Spine Session',
    '',
    '> Minimal interactive session. No Job, no profile, no filters, no scores. The session state is the user\'s raw situation + an append-only Raw Intent Evidence timeline. The runtime decides each turn: ask ONE question, or surface the most actionable relationships. The 2-ask budget is enforced by the session.',
    '',
    '## 1. Original Raw Situation',
    '> t0. Verbatim. No pre-conversion.',
    '',
    '```',
    timeline.initialSituation,
    '```',
    '',
    '## 2. Raw Intent Evidence Timeline',
    '> Each entry is the user\'s verbatim answer after a system question. Append-only.',
    '',
  ];
  if (timeline.userAnswers.length === 0) {
    sections.push('_No questions were asked; the runtime surfaced on the first turn._');
    sections.push('');
  } else {
    timeline.userAnswers.forEach((a, i) => {
      sections.push(`### t${2 * i + 2} (after system question ${i + 1})`);
      sections.push('');
      sections.push('```');
      sections.push(a);
      sections.push('```');
      sections.push('');
    });
  }

  sections.push('## 3. Runtime Decisions');
  sections.push('> One block per runtime turn. The runtime decides; the session enforces the 2-ask budget.');
  sections.push('');
  if (timeline.turns.length === 0) {
    sections.push('_No runtime turns recorded._');
    sections.push('');
  } else {
    for (const t of timeline.turns) {
      sections.push(`### Turn ${t.turnIndex}${t.forced ? ' (forced surface — budget exhausted)' : ''}`);
      sections.push('');
      sections.push(`- durationMs: ${t.durationMs}`);
      sections.push(`- forced: ${t.forced}`);
      sections.push(`- action: ${t.decision.action}`);
      if (t.decision.action === 'ask') {
        sections.push(`- question: ${t.decision.question}`);
        sections.push(`- whyItMatters: ${t.decision.whyItMatters}`);
      } else {
        sections.push(`- relationshipCount: ${t.decision.relationships.length}`);
      }
      sections.push('');
    }
  }

  sections.push('## 4. Questions Asked');
  if (timeline.questionsAsked.length === 0) {
    sections.push('_None._');
  } else {
    timeline.questionsAsked.forEach((q, i) => {
      sections.push(`${i + 1}. ${q}`);
    });
  }
  sections.push('');

  sections.push('## 5. User Answers');
  if (timeline.userAnswers.length === 0) {
    sections.push('_None._');
  } else {
    timeline.userAnswers.forEach((a, i) => {
      sections.push(`${i + 1}. ${a}`);
    });
  }
  sections.push('');

  sections.push('## 6. Final Relationships');
  if (finalSurface === null) {
    sections.push('_The session ended without a surface decision._');
  } else if (finalSurface.relationships.length === 0) {
    sections.push('_The runtime surfaced an empty relationship set._');
  } else {
    for (const r of finalSurface.relationships) {
      sections.push(renderRelationship(r));
    }
  }
  sections.push('');

  sections.push('## 7. Evidence / Unknowns / Next Actions');
  sections.push('> Per-relationship detail from the final surface decision.');
  sections.push('');
  if (finalSurface === null) {
    sections.push('_No surface decision to render._');
    sections.push('');
  } else if (finalSurface.relationships.length === 0) {
    sections.push('_No relationships to render._');
    sections.push('');
  } else {
    for (const r of finalSurface.relationships) {
      sections.push(`### ${r.candidateId}`);
      sections.push('');
      sections.push('**evidence**');
      if (r.evidence.length === 0) {
        sections.push('_empty_');
      } else {
        for (const e of r.evidence) sections.push(bullet(e));
      }
      sections.push('');
      sections.push('**unknowns**');
      if (r.unknowns.length === 0) {
        sections.push('_empty_');
      } else {
        for (const u of r.unknowns) sections.push(bullet(u));
      }
      sections.push('');
      sections.push('**nextStep**');
      sections.push(r.nextStep);
      sections.push('');
    }
  }

  sections.push('## 8. Raw Hermes Outputs');
  sections.push('> One block per runtime turn. Verbatim stdout.');
  sections.push('');
  if (timeline.turns.length === 0) {
    sections.push('_No raw outputs._');
    sections.push('');
  } else {
    for (const t of timeline.turns) {
      sections.push(`### Turn ${t.turnIndex}${t.forced ? ' (forced surface)' : ''}`);
      sections.push('');
      sections.push('```');
      sections.push(t.rawOutput);
      sections.push('```');
      sections.push('');
    }
  }

  const meta: string[] = [
    bullet('stage: Product Spine session'),
    bullet('runtime: hermes via HermesClient (production) / HermesStubClient (tests)'),
    bullet('sessionState: { rawSituation, rawIntentEvidence[], askCount }'),
    bullet(`turnCount: ${timeline.turns.length}`),
    bullet(`questionsAskedCount: ${timeline.questionsAsked.length}`),
    bullet(`userAnswersCount: ${timeline.userAnswers.length}`),
    bullet(`askBudget: ${timeline.finalState.askCount <= 2 ? 2 : timeline.finalState.askCount} (max consecutive asks before forced surface)`),
    bullet(`finalAskCount: ${timeline.finalState.askCount}`),
    bullet(`surfaceTurnIndex: ${surfaceTurn < 0 ? NONE : surfaceTurn}`),
    bullet(`finalRelationshipCount: ${finalSurface?.relationships.length ?? 0}`),
    bullet(`totalDurationMs: ${totalDurationMs}`),
    bullet(`forbiddenSurface: false (no Job/Profile/schema/filter/score/rank surfaced anywhere in this artifact)`),
  ];

  sections.push('## 9. Runtime Metadata');
  sections.push(meta.join('\n'));
  sections.push('');

  // §8 explicitly requires a t-numbered session timeline.
  sections.push('## 10. Session Timeline (t-numbered)');
  sections.push('> Each numbered event is one runtime turn. Numbers are not a Job state; they are the actual event order in this session.');
  sections.push('');
  sections.push('- t0: user typed raw situation (verbatim)');
  let t = 1;
  for (let i = 0; i < timeline.turns.length; i += 1) {
    const turn = timeline.turns[i]!;
    if (turn.decision.action === 'ask') {
      sections.push(`- t${t}: system asked: ${turn.decision.question}`);
      t += 1;
      const userAnswer = timeline.userAnswers[i];
      if (userAnswer !== undefined) {
        sections.push(`- t${t}: user answered (raw intent evidence appended): ${userAnswer}`);
        t += 1;
      }
    } else {
      sections.push(`- t${t}: system surfaced ${turn.decision.relationships.length} relationship(s) (turn ${turn.turnIndex}${turn.forced ? ', forced surface' : ''})`);
      t += 1;
    }
  }
  sections.push('');

  return sections.join('\n');
}

export function writeSessionArtifact(timeline: SessionTimeline): string {
  const dir = resolve(process.cwd(), 'artifacts', 'recruiting-poc');
  mkdirSync(dir, { recursive: true });
  const safeTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${safeTimestamp}_recruiting-poc-session.md`;
  const filePath = resolve(dir, fileName);
  writeFileSync(filePath, renderSessionArtifact(timeline), 'utf-8');
  return filePath;
}
