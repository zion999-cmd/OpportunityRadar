// semantic-completion/cases.ts — the upstream-provided Raw A and Raw B
// for this experiment.
//
// These texts are FIXED by the upstream. They must be reproduced
// here verbatim. Do NOT modify, paraphrase, extend, trim, or
// replace them. Do NOT pull replacements from
// `matching/discovery/pools.ts` or any other module.
//
// The three output-category names used downstream
// (directly supported meaning / knowledge-supported completion /
// unknown) are *this experiment's* output boundary. They are
// intentionally NOT a generic domain schema or taxonomy.

export const RAW_A: string = `I was responsible for a Kafka production cluster. During peak periods we had several serious incidents involving consumer lag and broker failures, and I was the primary on-call owner. At first the team mostly responded by restarting services and adding capacity. I later revisited the partition strategy, consumer behavior, and alerting setup, and changed the failover runbook. Similar incidents became significantly less frequent afterward.`;

export const RAW_B: string = `We operate a real-time logistics tracking system. Recently we have been seeing increasing data delays and occasional backlogs lasting several hours. The underlying messaging layer currently uses RabbitMQ, but every incident turns into an ad-hoc firefight and nobody really owns the real-time data path end-to-end. We are preparing to redesign the system, but we have not decided whether to keep RabbitMQ, move to Pulsar, or use another approach.`;
