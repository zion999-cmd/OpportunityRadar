// matching/recruiting-poc/intent-update/answers.ts —
// verbatim fixtures for the Stage 3 counterfactual experiment.
//
// These strings are FIXED and not derived from the model.
// They are:
//   - STAGE2_INTENT_BOUNDARY_QUESTION  — the Stage 2 question,
//     not regenerated at Stage 3.
//   - ANSWER_A_VERBATIM                — counterfactual Answer A
//     ("Immediate Kafka depth is required").
//   - ANSWER_B_VERBATIM                — counterfactual Answer B
//     ("Operational ownership is primary").
//
// The answers are stored as raw Chinese text. They are NOT
// converted into fields, filters, tags, or schema values
// anywhere in Stage 3 — they are passed to the prompt as
// raw intent evidence, and the model is told to treat them
// as clarification of what the employer actually needs, not
// as filter inputs.
//
// Stage 1 / Stage 2 modules are NOT modified to consume
// these constants. The values are only used inside the
// intent-update module.

export const STAGE2_INTENT_BOUNDARY_QUESTION = `When you say '把架构问题解决掉', are you pointing at Kafka broker/topology architecture (partition layout, replication, broker sizing, MirrorMaker) that the candidate needs to already understand, or are you mainly pointing at the operational architecture (on-call rotation, runbooks, postmortem discipline, monitoring) where the priority is finding someone who can stabilize the on-call burden and the broker knowledge can be ramped?`;

export const ANSWER_A_VERBATIM = `现在事故太频繁了，我没有时间让他慢慢补 Kafka。这个人进来以后很快就要直接接 Kafka on-call，也要能判断 partition、replication、broker、consumer 这些问题。事故管理能力当然重要，但 Kafka production depth 是现在真实的硬约束。`;

export const ANSWER_B_VERBATIM = `Kafka 本身不是硬约束，两三个月能补起来就可以。我真正缺的是一个愿意把生产责任接过去的人：能扛 on-call、把事故搞清楚、做 postmortem、推动长期整改，不要每次只是救火。以前是不是主要做 Kafka，我不在乎。`;

export type IntentUpdateAnswer = 'A' | 'B';

export const ANSWER_TEXT: Readonly<Record<IntentUpdateAnswer, string>> = {
  A: ANSWER_A_VERBATIM,
  B: ANSWER_B_VERBATIM,
};
