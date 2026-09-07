// matching/recruiting-poc/cases.ts — Full-Pool Relationship
// Discovery Baseline fixtures.
//
// This Stage intentionally has NO pre-conversion of the employer
// situation into a job schema, skills list, tags, categories,
// keyword query, or filter condition. The employer material is
// stored verbatim in Chinese; the 20 candidate materials are
// stored verbatim in natural English. The discovery model
// (Hermes) sees the raw materials directly.
//
// Data model:
//
//   { id: string; rawExperience: string }
//
// `id` is identity only. It does NOT encode category, expected
// match, expected label, or any other domain signal. The order
// (C01..C20) is the order in which the materials are presented
// to the model; the order is not a ranking signal.
//
// The 20 candidates are mixed by archetype, with no
// pre-declared "correct" pairing:
//
//   C01–C03  Strong Kafka production ownership
//   C04–C06  Kafka expertise, no production on-call ownership
//   C07–C09  RabbitMQ / Pulsar / streaming-mix with production
//            incident + ownership + structural improvement
//   C10–C12  SRE / distributed infrastructure, no Kafka keyword,
//            with incident + postmortem + system improvement
//   C13–C14  Kafka keyword-rich, but demonstrated capability
//            is weak for the situation
//   C15–C16  Different surface domain, transferable capability
//   C17–C18  Strong technical background, current evidence does
//            not support the needed capability
//   C19–C20  Obviously irrelevant
//
// Fixtures are deterministic. No time-of-day, no randomized IDs.

export const EMPLOYER_RAW_SITUATION: string = `Kafka 这块现在没人真正 owner。最近出了几次事故，我想找个人接过去。HR 写了个 Senior Infrastructure Engineer，要求 10 年经验，但我其实不在乎几年，我要的是能扛 on-call、处理事故、写 postmortem，然后把架构问题解决掉的人。地点无所谓，能做就行。`;

export interface Candidate {
  readonly id: string;
  readonly rawExperience: string;
}

export const CANDIDATE_POOL: ReadonlyArray<Candidate> = [
  {
    id: 'C01',
    rawExperience: `I was the only person on-call for a Kafka cluster that served 200+ downstream services for about 18 months. We had one major outage a quarter on average — usually consumer lag cascading into producer backpressure, sometimes broker leader elections gone wrong. I owned the full incident response: paged in, coordinated the on-call rotation, drove the postmortem, and pushed the follow-up work. I rewrote our alerting so consumer lag paged earlier, changed the topic partition layout to spread load more evenly, and put a runbook in place for the most common failure modes. By the time I left, we had gone from roughly one outage a quarter to about one in nine months. The infra was by no means perfect, but the patterns I had not seen in any runbook before I started were at least documented.`,
  },
  {
    id: 'C02',
    rawExperience: `My previous team inherited a Kafka deployment from a senior engineer who left. There was no runbook and the alerting was a mess. I became the de facto owner and ended up doing on-call for about a year. I handled three serious incidents: a network partition that caused producer timeouts, a rebalance storm after a deployment, and a slow consumer that nobody had noticed for weeks. I wrote postmortems for each, which forced us to actually fix things rather than just patch them. I retired two custom scripts, replaced them with sensible defaults, and added proper lag monitoring. After I moved teams, the new owner thanked me because the cluster stopped surprising people.`,
  },
  {
    id: 'C03',
    rawExperience: `At a mid-size e-commerce company, I owned the Kafka deployment that handled order events. We were a small team so I shared on-call with one other engineer. I handled incidents like the time our retention policy caused old segments to fill up disk, and another time a poorly-named topic was being flooded by a misbehaving service. I did the postmortems, set up a proper mirror-maker setup for DR, and simplified the topic layout. The biggest thing I changed was adding structured incident reviews so we stopped having the same fire-drill every two months. I don't think of myself as a Kafka expert — I think of myself as someone who got paged a lot and learned what to fix.`,
  },
  {
    id: 'C04',
    rawExperience: `I've been a backend engineer for six years and I work with Kafka a lot. I designed and built the Kafka-based event pipeline at my current company — topic layout, partition strategy, schema registry, consumer group semantics. I do capacity planning and I help onboard new services onto the pipeline. But I have never been on the on-call rotation for the cluster. The team that owns the production infrastructure runs a separate on-call, and I get pulled in only if the issue looks like a consumer bug. I know Kafka reasonably well but I have never been the person getting paged at 3am because a broker died.`,
  },
  {
    id: 'C05',
    rawExperience: `I'm a senior engineer on the data team. Most of my work is building Kafka Streams applications and writing consumers. I've configured topics, set up retention, dealt with serialization issues, and built out the consumer side. What I have not done is run the cluster itself — I don't do on-call, I don't do capacity planning for brokers, and I have never owned an incident end to end. There's a separate platform team that owns the cluster. I can talk fluently about Kafka because I use it, but if you sat me in front of a broken broker I'd be calling the platform team.`,
  },
  {
    id: 'C06',
    rawExperience: `For three years I was a Kafka consultant. I helped maybe a dozen companies set up or migrate their Kafka deployments. I know the configuration knobs, I can debug consumer lag, I can design a sensible topic layout, and I have seen a lot of failure modes. But my pattern was always: come in, fix the immediate thing, write a doc, hand off. I was never on-call for any of those clusters after the engagement ended. Some of my clients came back to me when things broke, but most of the time the handover was clean. I have a lot of breadth but very little depth on any one production system.`,
  },
  {
    id: 'C07',
    rawExperience: `I owned a RabbitMQ cluster for a fintech startup for about two years. The system was critical to trade settlement, so on-call was intense. I handled fan-out failures where a single slow consumer would back up queues, mirror queue drift between data centers, and one memorable incident where a deployment accidentally enabled publisher confirms in a way that deadlocked exchanges. I did postmortems for each, including a major one after a 40-minute settlement delay that cost us a relationship with a large counterparty. I redesigned the exchange layout, added proper quorum queues, and introduced shovel policies so we wouldn't have to manually fail over again. I left the team with runbooks for the most common failure modes and a monitoring setup that actually paged on queue depth, not just connection count.`,
  },
  {
    id: 'C08',
    rawExperience: `I was the primary on-call for a Pulsar deployment at a media company for about 14 months. We ran Pulsar because we needed very low latency and tiered storage for retention. I handled broker outages, bookie disk failures, and a few interesting incidents where producers would silently drop messages because of clock skew. I wrote postmortems, added monitoring around backlog latency, and led the migration to tiered storage which cut our storage costs by about 40%. I also owned the operational side of a cross-region replication setup. I wouldn't say I'm a Pulsar expert — I'd say I'm an operations person who learned Pulsar because the company was using it.`,
  },
  {
    id: 'C09',
    rawExperience: `I run streaming infrastructure for a logistics company. We use a mix of Kafka, Kinesis, and Redis Streams — different services have different needs. I am on-call for the streaming platform as a whole, which means I get paged for the Kafka brokers, the Kinesis shard errors, and the Redis Streams consumer groups. I have done postmortems for things like a Kinesis throttle that cascaded into Kafka lag, and a Redis Streams consumer that fell behind because of a bug in our ack logic. The thing I am best at is not the specific technology — it's figuring out where the bottleneck actually is when three different streaming systems are involved. I consolidated monitoring across all three and gave the on-call a single dashboard.`,
  },
  {
    id: 'C10',
    rawExperience: `I am a senior SRE at a SaaS company. I do not work with Kafka — our messaging layer is RabbitMQ. But I am on-call for the data platform, which includes the message broker, the data warehouse, and the ingestion pipelines. I do incident command, write postmortems, and chase down follow-up actions. The most recent postmortem I led was about a two-hour ingestion outage caused by a misconfigured RabbitMQ policy that throttled publishers at exactly the wrong time. I don't have streaming-architecture expertise specifically, but I do have a track record of being the person who takes a chaotic incident and turns it into a structured set of fixes that actually ship.`,
  },
  {
    id: 'C11',
    rawExperience: `I am a site reliability lead at a logistics company. We do not use Kafka or any streaming technology — our infrastructure is built around Postgres and a custom event-sourcing layer. I do on-call, incident command, and postmortems. The most significant thing I changed in the last two years was the postmortem process itself: I pushed for blameless reviews with action items that have owners and dates, and I built the dashboard that tracks action items to closure. I have also restructured the on-call rotation twice. I don't have direct streaming-architecture experience, but I know how to take a system that is paging too much and figure out why.`,
  },
  {
    id: 'C12',
    rawExperience: `I am a senior engineer on a distributed systems team. Our infrastructure is built on gRPC for service-to-service and NATS for pub/sub — we deliberately avoided Kafka. I am on-call for the platform, I handle incidents, and I write postmortems. One thing I led was a redesign of the retry logic across the platform after a series of cascading failures. I also wrote the runbook for how to handle the most common NATS slow-consumer scenarios. I have not used Kafka in production, but I have been the person who got paged when a pub/sub layer was misbehaving, and I know what to look at first.`,
  },
  {
    id: 'C13',
    rawExperience: `My resume mentions Kafka prominently because I have used it in a few different contexts: I built a small Kafka pipeline for a side project, I took an internal Kafka training course, and I have configured topics and written consumers for analytics jobs. In my current role I am mostly doing frontend work in React, and I do not do on-call or own any infrastructure. I am interested in getting back into infrastructure work, which is why I am exploring options. I have not been responsible for a production Kafka deployment, but I have read enough about it to talk through the concepts.`,
  },
  {
    id: 'C14',
    rawExperience: `I was a Kafka consultant for four years before moving into a more general engineering role. I helped a lot of companies set up and migrate their Kafka deployments. I can talk fluently about partitions, consumer groups, replication, and the various gotchas. But I have never stayed long enough at any one company to actually own a production cluster for an extended period. I always came in for a 2-6 month engagement, fixed the immediate problem, and moved on. I am not currently on any on-call rotation. I have breadth but I cannot claim deep operational experience on a single live system.`,
  },
  {
    id: 'C15',
    rawExperience: `I owned the Postgres + Redis stack at a small e-commerce company for three years. I was on-call, I handled incidents, I wrote postmortems. The biggest structural change I led was splitting a monolithic Postgres database that had become a single point of failure into a set of sharded databases, with a migration plan that we executed over six months without any downtime. I also rewrote the backup and restore procedures after we discovered our restore time was actually closer to 14 hours, not the 2 hours the runbook claimed. I do not have streaming-architecture experience, but the pattern of 'find the structural issue, design a fix, execute it carefully' is what I am best at.`,
  },
  {
    id: 'C16',
    rawExperience: `I am a principal engineer on the IT operations team at a regional hospital. I am on-call for the electronic health records system and several other clinical systems. I do incident command and postmortems. The most significant thing I changed in the last two years was the change management process for clinical systems — it used to be that every change required multiple layers of approval, which led to people making changes informally. I introduced a tiered change management process that distinguishes emergency changes, planned changes, and routine changes, with appropriate review for each. The result was that emergency changes dropped significantly because the planned change process actually worked. My domain is healthcare IT, not software infrastructure, but the pattern of fixing process before adding people is the same.`,
  },
  {
    id: 'C17',
    rawExperience: `I am a distinguished engineer at a large technology company. I have spent most of my career in infrastructure — distributed systems, storage, and messaging. I have personally designed and shipped infrastructure that serves billions of requests. In my current role I lead a small team focused on internal developer tooling, and I am not on any on-call rotation. I have not personally responded to a production incident in over two years. I am exploring options for a role that would put me back close to operational responsibility, which is the kind of work I find most meaningful.`,
  },
  {
    id: 'C18',
    rawExperience: `I lead an ML platform team at a mid-size technology company. We provide training infrastructure, feature stores, and model serving to data scientists across the company. I do not do on-call. The closest I get to incident response is when a training job fails and a data scientist needs help debugging, which is a very different kind of problem. I am technically strong and I understand distributed systems well, but my current role is not really an operations role. I have done incident response in past roles — I was on the storage team at a previous company and did on-call for about a year — but it has been several years since I was regularly paged. I am not opposed to going back to operations work but I would want to be honest that I am not currently practicing it.`,
  },
  {
    id: 'C19',
    rawExperience: `I am a junior full-stack engineer with about two years of experience. I mostly work in TypeScript and React, with some Node.js on the backend. I have not done infrastructure work, I have never been on-call, and I do not have experience with messaging systems like Kafka or RabbitMQ. I am interested in eventually moving into more backend and infrastructure work, but I have not done it yet. I am looking for a role where I can grow into a more senior position and learn from experienced engineers who can show me the operational side of building reliable systems. I know the basics of distributed systems from reading but I have not run any of them in production myself.`,
  },
  {
    id: 'C20',
    rawExperience: `I am a marketing analyst with eight years of experience in B2B SaaS companies. I work with SQL, Tableau, and a bit of Python for data analysis. My day-to-day is analyzing campaign performance, building dashboards for marketing leadership, and helping the team understand which channels are working. I do not have an engineering background, I do not work with infrastructure, and I have no experience with messaging systems or on-call work. I am not looking for a role in engineering or operations. I am currently exploring options in marketing leadership at a larger company, but I am not a fit for a technical operations role and I would not be honest if I pretended otherwise.`,
  },
];
