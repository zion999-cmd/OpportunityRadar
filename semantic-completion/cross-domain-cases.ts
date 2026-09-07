// semantic-completion/cross-domain-cases.ts — the 3 fixed
// cross-domain cases for this experiment.
//
// Each case is a fixed upstream-defined pair (Raw A, Raw B).
// The texts are reproduced VERBATIM from the upstream spec; do
// NOT modify, paraphrase, extend, trim, or replace them. Do not
// pull replacements from `semantic-completion/cases.ts` (the
// Kafka→RabbitMQ case) or any other module.
//
// The 3 cases test whether the same Boundary v2 epistemic rules
// (`directly_supported` / `implied_meaning` / `hypotheses_and_unknowns`)
// and the same Relationship core question
// ("Could the capability demonstrated in A meaningfully change
// situation B toward a better outcome?") transfer across
// non-shared-domain pairs.

import type { CaseSpec } from './run.js';

export const CROSS_DOMAIN_CASES: ReadonlyArray<CaseSpec> = [
  {
    caseId: 'manufacturing-to-fulfillment',
    title: 'Semantic Completion — Manufacturing → E-commerce Fulfillment',
    rawA: `I ran production for a small electronics assembly operation. We kept missing delivery dates even though individual workstations usually had spare capacity. Adding overtime helped for a few days but the delays always came back. I started tracking how work moved between stations and found that jobs were spending most of their time waiting rather than being processed. We changed the release sequence, reduced work-in-progress between several stages, and gave one supervisor responsibility for the flow across the whole line. Within two months, average order lead time fell from eleven days to six without adding equipment.`,
    rawB: `Our online store has grown quickly, but customers are increasingly complaining that orders marked in stock still take four or five days before they leave the warehouse. Picking teams say they are busy, packing says work arrives in unpredictable waves, and customer service keeps asking each department separately where delayed orders are. We are considering hiring more warehouse staff before the holiday season, but we do not yet understand why orders spend so long inside the building.`,
  },
  {
    caseId: 'restaurant-to-support',
    title: 'Semantic Completion — Restaurant → Customer Support Operation',
    rawA: `I managed a neighborhood restaurant where Friday and Saturday nights had become chaotic. We had enough tables and enough staff on paper, but guests waited too long, servers kept interrupting the kitchen to ask about missing dishes, and the kitchen would suddenly receive large batches of orders at once. Instead of adding more people, I changed how tables were seated during peaks, introduced a simple handoff between the dining room and kitchen, and made one person responsible for watching the flow during the rush. Over the following month, complaints about waiting dropped substantially and we served more covers on busy nights with the same staffing level.`,
    rawB: `Our software company has a support team of twelve people. Ticket volume has increased, but the bigger problem is that urgent customer issues often sit untouched and then suddenly become escalations. Support says engineering responds too slowly, engineering says requests arrive without enough context, and account managers frequently message individual engineers directly when an important customer gets angry. Management is discussing whether to hire another five support agents, but there is no clear view of where the delays actually occur.`,
  },
  {
    caseId: 'event-production-to-release',
    title: 'Semantic Completion — Event Production → Software Release Organization',
    rawA: `I coordinated technical production for a company running large live conferences. We used to have frequent last-minute failures because lighting, audio, video, venue staff, and outside vendors each prepared their own part and assumed someone else had checked the dependencies. I introduced a shared readiness review several days before each event, assigned an owner to every unresolved dependency, and required the teams to rehearse the critical handoffs before doors opened. We still had individual equipment failures, but they stopped turning into event-wide emergencies and the number of last-minute escalations dropped sharply.`,
    rawB: `We release our mobile app every two weeks. Individual teams usually finish their features on time, but releases are still stressful because problems appear during the final day: backend changes are sometimes not deployed, analytics events are missing, app-store materials are incomplete, or nobody knows whether a dependency owned by another team is ready. Each release ends with senior engineers and product managers coordinating through chat until everything is resolved. The company is considering slowing the release schedule because the current process feels unreliable.`,
  },
];
