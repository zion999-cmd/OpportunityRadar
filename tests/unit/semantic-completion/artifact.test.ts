import { describe, it, expect } from 'vitest';
import {
  renderSemanticCompletionArtifact,
  type ArtifactInputs,
} from '../../../semantic-completion/artifact.js';

const RAW_A = 'RAW A TEXT — primary Kafka cluster owner, several peak-period incidents, later revisited partitions / consumer behavior / alerting / failover runbook.';
const RAW_B = 'RAW B TEXT — real-time logistics tracking, increasing data delays, RabbitMQ under firefight pattern, no end-to-end ownership, redesign undecided.';

const completionAFull = {
  directlySupported:
    'A owned a Kafka production cluster and was primary on-call during peak incidents. The team first responded with restarts and capacity additions. A later revisited partition strategy, consumer behavior, alerting, and the failover runbook. Similar incidents became less frequent afterward.',
  impliedMeaning:
    'A demonstrated a move from reactive incident response to structural diagnosis of the messaging layer, combined with end-to-end ownership of partitions, consumer behavior, alerting, and failover procedure. (Jointly supported by: "I was the primary on-call owner" + "the team mostly responded by restarting services and adding capacity" + "I later revisited the partition strategy, consumer behavior, and alerting setup, and changed the failover runbook" + "Similar incidents became significantly less frequent afterward".)',
  hypothesesAndUnknowns:
    'Candidate technical mechanisms behind the original incidents — partition imbalance, uneven consumer assignment, under-replicated partitions, slow/stuck consumers, re-keying during the partition revision — are not stated in the Raw Material and remain hypotheses. The exact scale of the cluster, prior vs. revised partition strategy, the specific alerting changes, and the quantitative reduction in incident frequency are unknown.',
};

const completionBFull = {
  directlySupported:
    'B runs a real-time logistics tracking system with growing data delays and occasional multi-hour backlogs. The current messaging layer is RabbitMQ. Incidents turn into ad-hoc firefights and no one owns the real-time data path end-to-end. A redesign is being prepared; messaging technology choice (RabbitMQ / Pulsar / other) is undecided.',
  impliedMeaning:
    'B exhibits a structural ownership gap on the real-time data path: incidents recur as firefights because no one is accountable for the path as a whole. (Jointly supported by: "every incident turns into an ad-hoc firefight" + "nobody really owns the real-time data path end-to-end" + "we have not decided whether to keep RabbitMQ, move to Pulsar, or use another approach".)',
  hypothesesAndUnknowns:
    'Candidate root causes for the backlogs — RabbitMQ capacity limits, routing configuration, back-pressure handling, queue accumulation under bursty load, slow consumers, unack\'d message pile-up — are not stated in the Raw Material and remain hypotheses. Traffic volume, message size, consumer count, and the team\'s operational maturity are unknown.',
};

const relationshipFull = {
  supportedReasoning:
    'The demonstrated capability in A is moving from reactive incident response to structural diagnosis of the messaging layer combined with end-to-end ownership of partitions, consumer behavior, alerting, and failover procedure. B exhibits the same organizational gap (ad-hoc firefights, no end-to-end owner) that A addressed, so the underlying capability transfers to B regardless of the eventual messaging technology choice. This is grounded in Raw Evidence and implied meaning from both sides; no specific technical mechanism is required to assert the transfer.',
  stillNeedsEvidence:
    'Whether B\'s backlogs are actually caused by the same structural weaknesses A fixed (ownership gap + ad-hoc response) or by unrelated upstream/downstream causes; whether the B team can sustain a single end-to-end owner; whether A is available and willing to take on B. Hypothesis-only causes (RabbitMQ capacity, routing, back-pressure, queue accumulation) are listed here as items to investigate, not as Evidence that the relationship holds.',
};

const baseSucceeded: ArtifactInputs = {
  rawA: RAW_A,
  rawB: RAW_B,
  completionA: {
    status: 'succeeded',
    durationMs: 1234,
    errorMessage: null,
    stdout: '',
    completion: completionAFull,
  },
  completionB: {
    status: 'succeeded',
    durationMs: 2345,
    errorMessage: null,
    stdout: '',
    completion: completionBFull,
  },
  relationship: {
    status: 'succeeded',
    durationMs: 3456,
    errorMessage: null,
    stdout: '',
    relationship: relationshipFull,
  },
  totalDurationMs: 7035,
  status: 'succeeded',
  errorMessage: null,
};

describe('renderSemanticCompletionArtifact', () => {
  it('contains the 5 required sections in order', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    const idxRawA = md.indexOf('## Raw A');
    const idxCompA = md.indexOf('## Semantic Completion A');
    const idxRawB = md.indexOf('## Raw B');
    const idxCompB = md.indexOf('## Semantic Completion B');
    const idxRel = md.indexOf('## Relationship Reasoning');
    expect(idxRawA).toBeGreaterThanOrEqual(0);
    expect(idxCompA).toBeGreaterThan(idxRawA);
    expect(idxRawB).toBeGreaterThan(idxCompA);
    expect(idxCompB).toBeGreaterThan(idxRawB);
    expect(idxRel).toBeGreaterThan(idxCompB);
  });

  it('includes Raw A and Raw B verbatim in code fences', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain('## Raw A');
    expect(md).toContain(RAW_A);
    expect(md).toContain('## Raw B');
    expect(md).toContain(RAW_B);
  });

  it('renders the 3 NEW boundary labels (directly supported / implied meaning / hypotheses and unknowns)', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain('### directly supported');
    expect(md).toContain('### implied meaning');
    expect(md).toContain('### hypotheses and unknowns');
  });

  it('does NOT render the OLD boundary labels (directly supported meaning / knowledge-supported completion)', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).not.toContain('### directly supported meaning');
    expect(md).not.toContain('### knowledge-supported completion');
  });

  it('renders the 3 completion regions for A and B with the new field text', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain(completionAFull.directlySupported);
    expect(md).toContain(completionBFull.directlySupported);
    expect(md).toContain(completionAFull.impliedMeaning);
    expect(md).toContain(completionBFull.impliedMeaning);
    expect(md).toContain(completionAFull.hypothesesAndUnknowns);
    expect(md).toContain(completionBFull.hypothesesAndUnknowns);
  });

  it('renders the 2 relationship categories', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain('### supported reasoning');
    expect(md).toContain(relationshipFull.supportedReasoning);
    expect(md).toContain('### still needs evidence');
    expect(md).toContain(relationshipFull.stillNeedsEvidence);
  });

  it('reports succeeded status and total duration in metadata', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain('status: succeeded');
    expect(md).toContain('totalDurationMs: 7035');
  });

  it('handles a failed completion-A step without breaking the artifact', () => {
    const md = renderSemanticCompletionArtifact({
      ...baseSucceeded,
      completionA: {
        status: 'failed',
        durationMs: 111,
        errorMessage: 'parseCompletionOutput: failed schema validation at <root>: expected object',
        stdout: 'partial output',
        completion: null,
      },
    });
    expect(md).toContain('## Semantic Completion A');
    expect(md).toContain('_No completion was parsed from the Agent output._');
    expect(md).toContain('### Raw output (debug)');
    expect(md).toContain('partial output');
  });

  it('handles a skipped relationship step (because a prior step failed)', () => {
    const md = renderSemanticCompletionArtifact({
      ...baseSucceeded,
      relationship: {
        status: 'skipped',
        durationMs: 0,
        errorMessage: 'skipped: a prior step did not produce a parseable completion',
        stdout: '',
        relationship: null,
      },
    });
    expect(md).toContain('## Relationship Reasoning');
    expect(md).toContain('status: skipped');
    expect(md).toContain('_No relationship reasoning was parsed from the Agent output._');
  });

  it('handles a fully-failed run with no completions and no relationship', () => {
    const md = renderSemanticCompletionArtifact({
      ...baseSucceeded,
      completionA: {
        status: 'failed',
        durationMs: 1,
        errorMessage: 'errA',
        stdout: 'a-out',
        completion: null,
      },
      completionB: {
        status: 'failed',
        durationMs: 1,
        errorMessage: 'errB',
        stdout: 'b-out',
        completion: null,
      },
      relationship: {
        status: 'skipped',
        durationMs: 0,
        errorMessage: 'skipped: a prior step did not produce a parseable completion',
        stdout: '',
        relationship: null,
      },
      status: 'failed',
      errorMessage: 'errA',
    });
    expect(md).toContain('status: failed');
    expect(md).toContain('errorMessage: errA');
    expect(md).toContain('a-out');
    expect(md).toContain('b-out');
  });

  it('uses the default title when none supplied (legacy Kafka→RabbitMQ behavior)', () => {
    const md = renderSemanticCompletionArtifact(baseSucceeded);
    expect(md).toContain('# Semantic Completion — Kafka→RabbitMQ Cross-Surface');
  });

  it('uses the provided title when supplied (cross-domain case)', () => {
    const md = renderSemanticCompletionArtifact({
      ...baseSucceeded,
      title: 'Semantic Completion — Manufacturing → E-commerce Fulfillment',
    });
    expect(md).toContain('# Semantic Completion — Manufacturing → E-commerce Fulfillment');
    expect(md).not.toContain('# Semantic Completion — Kafka→RabbitMQ Cross-Surface');
  });

  it('preserves all 5 required sections when a cross-domain title is supplied', () => {
    const md = renderSemanticCompletionArtifact({
      ...baseSucceeded,
      title: 'Semantic Completion — Restaurant → Customer Support Operation',
    });
    expect(md.indexOf('## Raw A')).toBeGreaterThan(0);
    expect(md.indexOf('## Semantic Completion A')).toBeGreaterThan(
      md.indexOf('## Raw A'),
    );
    expect(md.indexOf('## Raw B')).toBeGreaterThan(
      md.indexOf('## Semantic Completion A'),
    );
    expect(md.indexOf('## Semantic Completion B')).toBeGreaterThan(
      md.indexOf('## Raw B'),
    );
    expect(md.indexOf('## Relationship Reasoning')).toBeGreaterThan(
      md.indexOf('## Semantic Completion B'),
    );
  });
});
