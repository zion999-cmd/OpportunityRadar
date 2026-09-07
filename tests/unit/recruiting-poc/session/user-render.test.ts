import { describe, it, expect } from 'vitest';
import {
  renderAskForUser,
  renderSurfaceForUser,
  renderRelationshipForUser,
  renderDecisionForUser,
} from '../../../../matching/recruiting-poc/session/user-render.js';
import type { AskDecision, SurfaceDecision } from '../../../../matching/recruiting-poc/session/parse.js';

const askDecision: AskDecision = {
  action: 'ask',
  question: '当你说把架构问题解决掉，主要指的是 broker 架构还是 on-call 流程？',
  whyItMatters: '如果是 broker 架构，C01/C02/C03 留在前列；如果是流程，C07/C08 可能更合适。',
};

const surfaceDecision: SurfaceDecision = {
  action: 'surface',
  relationships: [
    {
      candidateId: 'C03',
      judgment: 'worth_exploring',
      analysis: 'C03 实际拥有过一个 Kafka 集群并自己处理事故。',
      evidence: ['C03: "I owned the Kafka deployment that handled order events."'],
      unknowns: ['C03 没有提到最近一次事故的规模。'],
      nextStep: '问 C03 最近一次 postmortem 的内容。',
    },
    {
      candidateId: 'C10',
      judgment: 'uncertain',
      analysis: 'C10 是强 SRE，但没有 streaming 经验。',
      evidence: ['C10: "I do incident command, write postmortems."'],
      unknowns: ['C10 多久能补上 streaming 层。'],
      nextStep: '问 C10 第一周的学习计划。',
    },
  ],
};

describe('recruiting-poc/session/user-render — natural language (no score, no rank, no filter, no tags)', () => {
  it('renders an ask decision with the question framing and whyItMatters', () => {
    const out = renderAskForUser(askDecision);
    expect(out).toContain('我还需要确认一件真正会影响我替你找谁的事情：');
    expect(out).toContain(askDecision.question);
    expect(out).toContain(askDecision.whyItMatters);
  });

  it('does NOT include any score, rank, filter, tag, or skill-extraction token in ask rendering', () => {
    const out = renderAskForUser(askDecision);
    const lower = out.toLowerCase();
    for (const forbidden of ['match %', 'match%', 'score', 'rank', 'ranking', 'tags', 'skills[]', 'filter', 'extracted']) {
      expect(lower, `forbidden token: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('renders a single relationship with candidateId, analysis, unknowns, and nextStep', () => {
    const r = surfaceDecision.relationships[0]!;
    const out = renderRelationshipForUser(r);
    expect(out).toContain('C03');
    expect(out).toContain('C03 实际拥有过一个 Kafka 集群');
    expect(out).toContain('还需要确认：');
    expect(out).toContain('C03 没有提到最近一次事故的规模。');
    expect(out).toContain('下一步：');
    expect(out).toContain('问 C03 最近一次 postmortem 的内容。');
  });

  it('does NOT include any score, rank, filter, tag, or extracted-skills token in relationship rendering', () => {
    const out = renderRelationshipForUser(surfaceDecision.relationships[0]!);
    const lower = out.toLowerCase();
    for (const forbidden of ['match %', 'match%', 'score', 'rank', 'ranking', 'tags', 'skills[]', 'filter', 'extracted']) {
      expect(lower, `forbidden token: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('renders a surface decision with the preamble and one block per relationship', () => {
    const out = renderSurfaceForUser(surfaceDecision);
    expect(out).toContain('我找到几个值得你了解的人。');
    expect(out).toContain('C03');
    expect(out).toContain('C10');
  });

  it('renders an empty surface with a humane empty message (not a schema field)', () => {
    const out = renderSurfaceForUser({ action: 'surface', relationships: [] });
    expect(out).toContain('我找到几个值得你了解的人。');
    expect(out).toContain('没有足够有行动价值的人选');
  });

  it('renderDecisionForUser dispatches to ask or surface', () => {
    expect(renderDecisionForUser(askDecision)).toBe(renderAskForUser(askDecision));
    expect(renderDecisionForUser(surfaceDecision)).toBe(renderSurfaceForUser(surfaceDecision));
  });
});
