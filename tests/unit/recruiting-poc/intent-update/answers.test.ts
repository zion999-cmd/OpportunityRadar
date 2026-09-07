import { describe, it, expect } from 'vitest';
import {
  STAGE2_INTENT_BOUNDARY_QUESTION,
  ANSWER_A_VERBATIM,
  ANSWER_B_VERBATIM,
  ANSWER_TEXT,
} from '../../../../matching/recruiting-poc/intent-update/answers.js';

// Stage 3 §1: Stage 2 Question is fixed. §2: two answers
// are fixed. None of these strings may drift from the spec.

describe('recruiting-poc/intent-update/answers — verbatim fixtures', () => {
  it('STAGE2_INTENT_BOUNDARY_QUESTION is the Stage 2 question verbatim', () => {
    expect(STAGE2_INTENT_BOUNDARY_QUESTION).toBe(
      `When you say '把架构问题解决掉', are you pointing at Kafka broker/topology architecture (partition layout, replication, broker sizing, MirrorMaker) that the candidate needs to already understand, or are you mainly pointing at the operational architecture (on-call rotation, runbooks, postmortem discipline, monitoring) where the priority is finding someone who can stabilize the on-call burden and the broker knowledge can be ramped?`,
    );
  });

  it('ANSWER_A_VERBATIM is the Answer A text verbatim', () => {
    expect(ANSWER_A_VERBATIM).toBe(
      `现在事故太频繁了，我没有时间让他慢慢补 Kafka。这个人进来以后很快就要直接接 Kafka on-call，也要能判断 partition、replication、broker、consumer 这些问题。事故管理能力当然重要，但 Kafka production depth 是现在真实的硬约束。`,
    );
  });

  it('ANSWER_B_VERBATIM is the Answer B text verbatim', () => {
    expect(ANSWER_B_VERBATIM).toBe(
      `Kafka 本身不是硬约束，两三个月能补起来就可以。我真正缺的是一个愿意把生产责任接过去的人：能扛 on-call、把事故搞清楚、做 postmortem、推动长期整改，不要每次只是救火。以前是不是主要做 Kafka，我不在乎。`,
    );
  });

  it('ANSWER_TEXT maps A and B to their verbatim strings', () => {
    expect(ANSWER_TEXT.A).toBe(ANSWER_A_VERBATIM);
    expect(ANSWER_TEXT.B).toBe(ANSWER_B_VERBATIM);
  });

  it('A and B answers are distinct (no cross-contamination of strings)', () => {
    expect(ANSWER_A_VERBATIM).not.toBe(ANSWER_B_VERBATIM);
  });
});
