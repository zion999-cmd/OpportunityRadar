import type { MatchingCase } from './cases.js';

// matching/probes.ts — 8 additional semantic probes.
//
// Unlike the 4 cases in `cases.ts` (which test whether the model
// can tell apart obvious-match / keyword-mismatch / uncertain /
// capability-transfer), these 8 probes are designed to *observe*
// whether the model can read the *nature* of a requirement and
// distinguish:
//
//   1. a hard constraint (legally or operationally non-negotiable)
//   2. a capability proxy (a credential/years line that stands in
//      for the real underlying skill the role actually needs)
//   3. a replaceable proxy (a degree / tenure / cert line that
//      CAN be satisfied by more direct demonstrated evidence)
//   4. an ambiguous requirement (jargon, "culture fit", soft
//      signals whose real meaning is unclear)
//   5. a mix of all four in one case
//
// No expected verdicts are encoded. The model is not being tested
// for cleverness; it is being observed for what it reads out of
// the raw material.
//
// Numbering matches the user's request: probe 1..8. CLI IDs are
// the same numbers.

export const probe1: MatchingCase = {
  id: '1-hard-credential',
  label: 'hard constraint — legally required California RPh + DEA + on-site',
  notes:
    'legally mandated credential + DEA registration + on-site presence. CA RPh is the legal floor (CA Bus. & Prof. Code §4115); out-of-state license is not substitutable. Candidate has pending CA application, ~7 weeks to issuance.',
  recruitingMaterial: `We are a regional hospital network (4 hospitals, ~1,800 beds total) and we are hiring a Clinical Pharmacist for our in-patient pharmacy at the Oakland campus. The role is regulated and has two non-negotiable hard constraints:

1. The candidate must hold an active California Pharmacist License (RPh). This is mandated by California Business and Professions Code §4115 for any pharmacist dispensing medications in California. Out-of-state licenses are not substitutable; the CA RPh is the legal floor.

2. The candidate must hold an active DEA registration listing California as the practice state, because the role includes dispensing Schedule II controlled substances.

3. The role requires on-site presence in the in-patient pharmacy during shift hours (a 7-on / 7-off schedule). State guidance does not permit remote order review for Schedule II dispenses.

The candidate will join a team of 14 pharmacists and 22 pharmacy technicians. Day-to-day work is clinical order review, dosing adjustment, and rounds with the hospitalist team. We have one other CA RPh opening at our Sacramento campus if the candidate has a preference.`,
  applyingMaterial: `I am a clinical pharmacist with 12 years of hospital pharmacy experience, currently licensed as an RPh in Texas. I hold an active DEA registration listing Texas as my practice state.

I sat the California licensure exam (CPJE) in March and passed. My California RPh application was submitted in April and is currently being processed by the California State Board of Pharmacy. The board's stated processing time is 6–10 weeks; my recruiter's most recent estimate is that the license will be issued in approximately 7 weeks from today. I have not yet received the license number, but I have the acknowledgment letter from the board confirming the application is in review.

I have agreed to relocate to the Bay Area. I have visited the Oakland campus and the pharmacy team, and we are aligned on the role. I have a current California address and have already started the California pharmacy-technician-supervision paperwork that the board requires at issuance.

I cannot start work in California before the CA RPh is in hand. I am not asking for a remote or hybrid arrangement; I understand the role is on-site. I am asking whether the team can wait ~7 weeks for the license to issue, or whether they need someone who already has the CA RPh in hand today.`,
};

export const probe2: MatchingCase = {
  id: '2-hard-onsite',
  label: 'hard constraint — 14-month on-site in Houston; candidate has hard family constraint',
  notes:
    'OSHA requires on-site safety walks by an on-site supervisor; remote is not an equivalent. Candidate has a hard family constraint (spouse is a physician, two kids in high school in Seattle) that makes 14-month Houston relocation genuinely infeasible.',
  recruitingMaterial: `We are a construction project management firm and we have just won a 14-month hospital-construction project in suburban Houston, Texas. The Site Manager role is fully on-site, Monday through Friday, for the full 14 months.

This is non-negotiable for two reasons:
1. The role includes daily safety walks on an active construction site, which state OSHA guidance requires be performed by an on-site supervisor. There is no remote equivalent.
2. The role coordinates directly with the on-site crew (12–18 trade workers at any given time), the owner's representative, and the city inspectors. The Site Manager's physical presence is required for daily coordination; this is a field role, not an office role.

We provide relocation assistance (including temporary housing for the first 60 days) and a per-diem. The project is shovel-ready; we break ground in 6 weeks. The role reports to the Project Executive and owns the day-to-day schedule, the safety program, and the owner's weekly progress meeting.`,
  applyingMaterial: `I am a construction project manager with 11 years of experience, including 4 hospital projects (two of which were greenfield). I am currently based in Seattle. I led the pre-construction and ground-breaking phase on my last project, so I know the early-stage cadence well.

I cannot relocate to Houston for 14 months. My spouse is a physician with her own practice in Seattle, and we have two children in high school. The 14-month commitment is genuinely not possible for my family, and I have been honest about that with recruiters.

I could potentially do 2–3 trips per month (e.g., week-long stints) if that would help in some advisory capacity, but I cannot be the on-site Site Manager. I have been clear about this constraint with every firm I have spoken with in the last 6 months.`,
};

export const probe3: MatchingCase = {
  id: '3-proxy-years',
  label: 'capability proxy — "10+ years" line is in the JD, real ask is the actual work',
  notes:
    'the "10+ years distributed systems" line is an HR ask. The hiring manager cares about the second list (own Kafka cluster, on-call, postmortems, schema design). Candidate has 3.5 years total but maps 1:1 onto the actual work.',
  recruitingMaterial: `Series-B devtools company (Series B, $42M raised, 110 people, profitable). We are hiring a "Senior Infrastructure Engineer" for the team that owns the event-streaming platform. The JD lists:

  • 10+ years of distributed systems experience
  • Deep expertise debugging production incidents at scale
  • Strong systems-design fundamentals

The actual work, which is what we actually care about, is:
  • Own our Kafka cluster (12 brokers across 3 regions, 80k msg/s peak, 99.95% SLO)
  • Be on-call primary for the cluster on a 1-week-on / 3-week-off rotation
  • Lead incident response when something breaks
  • Write the postmortem and own the follow-up architectural changes
  • Partner with the 4 application teams on schema design and topic ownership

The "10+ years" line is in the JD because HR asked for it. The hiring manager cares about the second list.`,
  applyingMaterial: `I am a software engineer with 3.5 years of post-college experience. I do not have "10+ years of distributed systems experience" by any reasonable reading.

What I do have, in those 3.5 years:
- I was the on-call primary for a 9-broker Kafka cluster at my previous company for a 3-month rotation. During that rotation, I led 4 production incident postmortems, each of which resulted in a concrete architectural change (broker count increase, ISR tuning, consumer rebalance timeout change, schema-registry introduction).
- I wrote the team's runbook for broker failover and trained 3 other engineers on it.
- I have direct experience with the same broker version (Kafka 3.5) and the same monitoring stack (Burrow + Prometheus + Grafana) that your JD describes.
- I can read a partition-leader distribution and reason about it. I can debug consumer lag at the protocol level.

I am not going to pretend I have 10 years of experience. But I have done the work in your "actual work" list. The 10-year line is the part of the JD I cannot satisfy; the second list is the part I can.`,
};

export const probe4: MatchingCase = {
  id: '4-proxy-cert',
  label: 'capability proxy — "AWS Pro cert required" line, real ask is moving the cost number',
  notes:
    'the AWS Solutions Architect Professional cert line is in the JD; the hiring manager\'s actual bar is "can this person move the cost number." Candidate has no AWS Pro cert, but has cut AWS bills at three previous companies.',
  recruitingMaterial: `Mid-sized logistics company ($220M revenue, 600 employees, 14 distribution centers across the US). We are hiring a "Cloud Cost Optimization Lead" to own the AWS spend across 38 AWS accounts.

The JD lists, among other lines:
  • "AWS Solutions Architect Professional certification required."

The actual work, which is what the role will be measured on:
  • Review every AWS account's monthly bill and identify wasted spend.
  • Design and ship right-sizing, reservation, and Savings Plans changes.
  • Present findings and savings trajectory to engineering leadership monthly.
  • Partner with the 4 application teams on cost-aware architecture choices.

The "AWS Pro cert required" line is in the JD because someone in HR put it there. The hiring manager's actual bar is: "can this person move the cost number?" If a candidate can show us three previous roles where they moved the cost number by 20%+ and can talk us through the technical details, the cert is a footnote, not a gate.`,
  applyingMaterial: `I am a cloud engineer with 5 years of experience. I do not hold the AWS Solutions Architect Professional certification. I do hold the AWS Solutions Architect Associate certification (the lower one) and the GCP Professional Cloud Architect certification.

I have cut AWS spend at three previous companies:
- At Company A (B2B SaaS, $30M ARR), I took the monthly bill from $480k to $310k in 4 months. The biggest single move was identifying a fleet of oversized RDS instances that were running 4% average CPU.
- At Company B (e-commerce, peak Q4), I designed a multi-account reservation strategy that saved $1.2M annualized, including the carve-up of a single big-org consolidated billing into per-team OUs.
- At Company C (fintech startup), I built an internal "rightsizing recommender" (Lambda + Cost Explorer API) that 9 engineering teams adopted; it cut their average per-account waste by 27%.

I am happy to take the AWS Pro cert in the first 90 days if the team wants the line on the resume. I am not going to claim I have it today.`,
};

export const probe5: MatchingCase = {
  id: '5-replace-degree',
  label: 'replaceable proxy — "Bachelor\'s in CS required" is a contract line, real ask is the actual work',
  notes:
    'the Bachelor\'s line is a procurement checkbox for the prime contract\'s labor category; the hiring manager\'s actual ask is "take a half-built system from a different contractor and ship it." Candidate has 4 successful handovers, no CS degree.',
  recruitingMaterial: `Government contractor (mid-size, 400 people, $90M revenue, 3 offices in the DC area). We are hiring a "Senior Software Engineer" for a defense-adjacent project.

The HR requirement: "Bachelor's degree in Computer Science or related field required." This is a procurement checkbox; the prime contract lists it as a minimum education requirement for the labor category, and HR cannot waive it. The actual ask (per the hiring manager): we need someone who can take a partially-formed system from a different contractor's handover and make it production-ready, with strong systems thinking and good written communication. The degree line is a gate for the contract, not for the role.

Day-to-day: own a service that ingests data from 6 upstream sources, normalizes to an internal schema, and exposes both a REST API and a Kafka topic to downstream consumers. Stack: Go, Postgres, Kafka, deployed on EKS.`,
  applyingMaterial: `I am a senior software engineer with 11 years of experience. I do not have a Bachelor's degree in Computer Science, or in any related field. I have a Bachelor's degree in English Literature (2013) and I learned to code at a coding bootcamp in 2014.

What I have done that maps to your actual role:
- 4 successful handover projects on my resume. The most recent was a 7-month engagement where I took over a half-built real-time data pipeline from a different contractor and shipped it to production. I have the postmortems and the customer references.
- I have shipped production Go + Postgres + Kafka code at 3 different companies, including one on EKS.
- My writing is a strength; I write the team's runbooks and I have co-authored two internal design docs that have been adopted by adjacent teams.

I cannot satisfy the "Bachelor's in CS" line as it is written. I can satisfy the actual work. I am happy to discuss how the degree line interacts with the contract's labor category, and whether an equivalent-discipline waiver applies.`,
};

export const probe6: MatchingCase = {
  id: '6-replace-tenure',
  label: 'replaceable proxy — "8+ years PM, consumer fintech" lines, real ask is onboarding-completion result',
  notes:
    'the "8+ years" and "consumer fintech" lines are filters; the actual bar is the 38%→65% onboarding-completion result. Candidate has 4 years PM, no consumer-fintech, but took onboarding from 41→78% at a B2B SaaS in 9 months.',
  recruitingMaterial: `Consumer fintech (Series C, $180M raised, 240 people). We are hiring a "Product Manager, Consumer" to own the credit-card-onboarding flow.

The JD lists:
  • 8+ years of product management experience
  • Ideally in consumer fintech

The actual job, as described by the hiring manager (this is what the PM will be measured on):
  • Own the credit-card-onboarding flow end-to-end. Current completion is 38%; the target is 65% within 12 months.
  • The team has 1 designer, 4 backend engineers, 1 iOS engineer, 1 Android engineer, 1 data analyst.
  • Diagnose where users drop, prioritize the fix, ship, measure. Repeat.

The "8+ years" and "consumer fintech" lines are the recruiting filter. The hiring manager cares about the second list.`,
  applyingMaterial: `I am a product manager with 4 years of total PM experience. I have zero consumer-fintech experience. My background is B2B SaaS.

What I have done that maps to your actual job:
- At my previous company (B2B SaaS, $40M ARR), I owned the user-onboarding flow. I took it from 41% to 78% completion in 9 months. The team shape was similar: 1 designer, 4 engineers, 1 data analyst, me.
- My framework for the work is the same: diagnose where users drop, prioritize the fix, ship, measure, repeat. I have done this exact loop multiple times.
- I am comfortable with the team's day-to-day. I can read a Mixpanel funnel. I can write a PR-FAQ. I can run a weekly review with engineering.

I cannot satisfy the "8+ years" line or the "consumer fintech" line. I can satisfy the second list, including the 41 → 78 onboarding-completion result, which is a stronger signal than my years count.`,
};

export const probe7: MatchingCase = {
  id: '7-ambiguous-jargon',
  label: 'ambiguous requirement — "rockstar / 10x / hustle-mode" cultural language, real ask is the deliverable list',
  notes:
    'the founder\'s-voice half of the JD ("rockstar / 10x / OG crypto native / meme / 80-hour weeks") is cultural; the actual deliverables (build content engine, own X, manage 2 mods, hit 100k followers, plan 4 events) are concrete. Candidate can do the deliverables but does not match the cultural half.',
  recruitingMaterial: `We are an early-stage crypto wallet company (10 people, $8M raised, seed stage). We are hiring our first marketing hire.

The JD, as posted on our careers page, reads in part:
  • "Looking for a rockstar, a 10x marketer, a hustle-mode builder."
  • "Someone who thrives in chaos."
  • "An OG crypto native who can meme as well as they can model."
  • "Comfortable with ambiguous goals, fast pivots, and 80-hour weeks."

The actual deliverables, buried in the JD:
  • Build our content engine (X/Twitter, blog, newsletter).
  • Own the X/Twitter account end-to-end.
  • Manage 2 community moderators.
  • Hit 100k X followers in 12 months.
  • Plan and run 4 IRL events.
  • Report to the CEO.

The first half of the JD is the founder's voice. The second half is what the role will actually be measured on.`,
  applyingMaterial: `I am a marketing lead with 7 years of experience, all of it in B2B SaaS. I have zero crypto experience. I do not consider myself an "OG crypto native" and I am uncomfortable with the "rockstar / 10x / hustle-mode" framing in the JD.

What I can do:
- I have grown a B2B SaaS LinkedIn following from 0 to 80k in 18 months through long-form content (twice-weekly essays, 1500–2500 words each). I know the long-form content engine cold.
- I have managed 2 community moderators at a previous company.
- I have planned and run 8 industry events (3 conferences, 5 smaller meetups).
- I am comfortable with the deliverable half of your JD. I can do the work.

What I cannot do:
- I cannot be the "OG crypto native who can meme as well as they can model." I have no crypto fluency, and the meme voice is not mine. I can learn the crypto space, but I cannot fake the cultural signal.
- I would find 80-hour weeks incompatible with my life and a yellow flag about the company's expectations, not a feature.`,
};

export const probe8: MatchingCase = {
  id: '8-mixed',
  label: 'mixed — all four requirement types in one JD',
  notes:
    'one JD, four different requirement natures, four different evaluations. hard = Singapore + SEA travel; capability proxy = "5+ years pre-sales"; replaceable proxy = CS/EE degree; ambiguous = "polished executive presence."',
  recruitingMaterial: `B2B SaaS company (250 people, $60M ARR, profitable, growing 50% YoY). Enterprise tier. We are hiring a "Senior Solutions Engineer" for the SEA region.

The JD mixes four kinds of requirements:

[HARD CONSTRAINT] Must be physically based in Singapore, with the ability to attend in-person customer meetings across Southeast Asia (Singapore, Jakarta, Bangkok, Manila, KL) on 24-hour notice. Travel up to 40%.

[CAPABILITY PROXY] "5+ years of pre-sales experience in enterprise SaaS."

[REPLACEABLE PROXY] "Bachelor's degree in Computer Science, Electrical Engineering, or a related technical field."

[AMBIGUOUS] "Polished executive presence; someone our CRO is excited to bring into a C-suite meeting. The candidate should 'feel like a peer' to a regional bank CIO on the first call."

The actual work: own the technical side of enterprise sales cycles ($250k–$2M ACV) from first discovery call through to signed contract, partnering with the AE. Demo, POC, security review, and pricing conversations. ~40% of time on customer calls, ~40% building POCs, ~20% internal.`,
  applyingMaterial: `I am a solutions engineer with 3 years of pre-sales experience at a smaller B2B SaaS company in Singapore. I have closed 14 enterprise deals personally, with an average deal size of $350k. I am Singapore-based, with no family constraints, and I can be at a customer meeting in Jakarta on 24-hour notice.

I do not have a CS or EE degree. I have a BA in Communications. I have been told by customers that I "feel like a peer" in a CIO meeting, and I am comfortable in those calls; I would not describe myself as having "polished executive presence" in the way the phrase is usually meant, but I do well in the actual room.

What the JD asks vs. what I have:
- HARD CONSTRAINT (Singapore + SEA travel): fully satisfied.
- CAPABILITY PROXY (5+ years pre-sales): 3 years, not 5+. The 14 closed enterprise deals are the demonstrated part of the ask; the years count is not.
- REPLACEABLE PROXY (CS/EE degree): I have a Communications degree. I cannot satisfy this line as written. I can satisfy the actual technical side of the role (I have built 30+ POCs, I can run a security review, I can defend a pricing conversation).
- AMBIGUOUS (polished executive presence): I will let you judge. I have references from 4 customers who will tell you what their CIO meeting felt like.`,
};

export const allProbes: ReadonlyArray<MatchingCase> = [
  probe1,
  probe2,
  probe3,
  probe4,
  probe5,
  probe6,
  probe7,
  probe8,
];
