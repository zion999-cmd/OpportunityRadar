// matching/discovery/pools.ts — the two raw material pools.
//
// 6 recruiting materials (organizations describing roles they
// need to fill) + 8 applying materials (people describing their
// situations, intentions, and capability). The materials are
// realistic and complete natural-language text. They are NOT
// pre-paired: which pairs (if any) the discovery model surfaces
// is the discovery's output, not its input.
//
// The IDs (R1..R6, A1..A8) are stable and used in the prompt,
// the JSON output schema, and the rendered artifact.

export interface RecruitingMaterial {
  readonly id: string;
  readonly material: string;
}

export interface ApplyingMaterial {
  readonly id: string;
  readonly material: string;
}

export const recruitingPool: ReadonlyArray<RecruitingMaterial> = [
  {
    id: 'R1',
    material: `We are a regional hospital network (4 hospitals, ~1,800 beds total) and we are hiring a Clinical Pharmacist for our in-patient pharmacy at the Oakland campus. Three non-negotiable constraints:

1. Active California Pharmacist License (RPh), mandated by California Business and Professions Code §4115.
2. Active DEA registration listing California as the practice state (the role includes Schedule II dispensing).
3. On-site presence in the in-patient pharmacy during shift hours (a 7-on / 7-off rotation). State guidance does not permit remote order review for Schedule II dispenses.

Day-to-day: clinical order review, dosing adjustment, rounds with the hospitalist team. The candidate will join a team of 14 pharmacists and 22 pharmacy technicians. There is a parallel CA-RPh opening at our Sacramento campus for candidates with a location preference.`,
  },
  {
    id: 'R2',
    material: `Series-B devtools company ($42M raised, 110 people, profitable). We are hiring a Senior Infrastructure Engineer for the team that owns the event-streaming platform.

The JD's stated asks:
  • 10+ years of distributed systems experience
  • Deep expertise debugging production incidents at scale

The actual work, which is what the hiring manager cares about:
  • Own our Kafka cluster (12 brokers, 3 regions, 80k msg/s peak, 99.95% SLO)
  • Be on-call primary on a 1-week-on / 3-week-off rotation
  • Lead incident response and own postmortem follow-ups
  • Partner with 4 application teams on schema design and topic ownership

The "10+ years" line is in the JD because HR asked for it. The hiring manager cares about the second list.`,
  },
  {
    id: 'R3',
    material: `We are a construction project management firm and we have just won a 14-month hospital-construction project in suburban Houston, Texas. The Site Manager role is fully on-site, Monday through Friday, for the full 14 months.

This is non-negotiable for two reasons:
1. The role includes daily safety walks on an active construction site, which state OSHA guidance requires be performed by an on-site supervisor. There is no remote equivalent.
2. The role coordinates directly with the on-site crew (12–18 trade workers at any given time), the owner's representative, and the city inspectors.

We provide relocation assistance (60 days of temporary housing) and a per-diem. The project is shovel-ready; we break ground in 6 weeks.`,
  },
  {
    id: 'R4',
    material: `We are an early-stage crypto wallet company (10 people, $8M raised, seed stage). We are hiring our first marketing hire.

The JD's first half (the founder's voice):
  • "Looking for a rockstar, a 10x marketer, a hustle-mode builder."
  • "An OG crypto native who can meme as well as they can model."
  • "Comfortable with ambiguous goals, fast pivots, and 80-hour weeks."

The JD's second half (the actual deliverables):
  • Build our content engine (X/Twitter, blog, newsletter).
  • Own the X/Twitter account end-to-end.
  • Manage 2 community moderators.
  • Hit 100k X followers in 12 months.
  • Plan and run 4 IRL events.
  • Report to the CEO.

The first half is cultural; the second half is what the role will actually be measured on.`,
  },
  {
    id: 'R5',
    material: `B2B SaaS company (250 people, $60M ARR, profitable, growing 50% YoY). Enterprise tier. We are hiring a Senior Solutions Engineer for the SEA region.

The JD mixes four kinds of requirements:
[HARD] Must be physically based in Singapore; able to attend in-person customer meetings across Southeast Asia (Jakarta, Bangkok, Manila, KL) on 24-hour notice. Travel up to 40%.
[PROXY] "5+ years of pre-sales experience in enterprise SaaS."
[PROXY] "Bachelor's degree in Computer Science, Electrical Engineering, or a related technical field."
[SOFT] "Polished executive presence; someone our CRO is excited to bring into a C-suite meeting."

The actual work: own the technical side of enterprise sales cycles ($250k–$2M ACV) from first discovery call through to signed contract, partnering with the AE. ~40% of time on customer calls, ~40% building POCs, ~20% internal.`,
  },
  {
    id: 'R6',
    material: `We are a two-person independent podcast production studio. Most of our work is narrative documentary podcasts for streaming platforms, and we have just been asked to bid on a six-episode series about urban infrastructure.

We need a "producer who can also do technical sound design" — someone who can take a rough tape, do their own dialogue editing and noise reduction to a broadcast standard, build the episode, and also do the producer work (interview prep, host handling, transcript workflow, deliverable). We are open to either an established producer willing to pick up the technical craft, or an established sound designer willing to pick up the producer work. We do not need both; we will hire one person.

Day-to-day: remote, async, with one synchronous 30-minute call per week.`,
  },
];

export const applyingPool: ReadonlyArray<ApplyingMaterial> = [
  {
    id: 'A1',
    material: `I am a manufacturing engineer with 6 years at a tier-1 automotive supplier. I have personally run the line changeover process on a stamping line (12-minute target, I averaged 9.4), and I led a project last year integrating a new MES with the existing PLC stack — the previous integrators had tried twice and failed.

I am good at this. I want to move out of plant operations into a role where I can apply the same end-to-end thinking at a higher level — ideally in a company that supplies into manufacturing, but is not itself a factory. I do not want to be a consultant; I want to be on a product/customer team with long-term ownership. I am open to relocation; no hard family constraints.`,
  },
  {
    id: 'A2',
    material: `I am a senior ML engineer with 9 years of experience. I spent the last 5 years at a 1200-person fintech (publicly listed, well-funded, stable) where I owned the credit-card fraud model end-to-end. I led a team of 4. The work was mature: tuning, scaling, and defending a model that was already in production, with the budget and the platform team behind me.

I am now looking for a stable, well-resourced company — ideally an established tech company or a regulated industry with a real ML platform team. I do not want to be the only ML person. I do not want to "build from zero in a startup." I am also not interested in agent / chatbot / no-code products; my background is in serious tabular ML on financial data, and that is what I want to keep doing.`,
  },
  {
    id: 'A3',
    material: `I am a cloud engineer with 5 years of experience. I do not hold the AWS Solutions Architect Professional certification. I do hold the AWS Solutions Architect Associate certification and the GCP Professional Cloud Architect certification.

I have cut AWS spend at three previous companies:
- Company A (B2B SaaS): monthly bill $480k → $310k in 4 months. The biggest single move was an oversized RDS fleet at 4% avg CPU.
- Company B (e-commerce, peak Q4): designed a multi-account reservation strategy that saved $1.2M annualized, including a consolidated-billing → per-team OU carve-up.
- Company C (fintech startup): built a Lambda + Cost Explorer "rightsizing recommender" that 9 engineering teams adopted; 27% per-account waste reduction.

I am happy to take the AWS Pro cert in the first 90 days if needed. I am not going to claim I have it today.`,
  },
  {
    id: 'A4',
    material: `I am a backend software engineer with 8 years of experience. I have spent the last 3 years at a digital-health startup (Series A → B) where I owned the data pipeline that ingested HL7 messages from 7 hospital partners and surfaced structured clinical data to the rest of our product. I have personally been in HL7 integration calls with hospital IT teams, sat in CMIO meetings to understand their data dictionary, and debugged production issues on Friday nights when a partner hospital's lab feed broke.

I do not have an RN degree or a clinical-research degree. I have spent the last 3 years working on exactly the kind of clinical-data product that hospitals actually need, from the engineering side. I have never been the PM, but I have been the technical half of the conversation in every clinical-meeting I have been in.`,
  },
  {
    id: 'A5',
    material: `I am a marketing lead with 7 years of experience, all of it in B2B SaaS. I have zero crypto experience. I do not consider myself an "OG crypto native" and I am uncomfortable with the "rockstar / 10x / hustle-mode" framing I see in some early-stage JDs.

What I have done:
- Grew a B2B SaaS LinkedIn following from 0 to 80k in 18 months through long-form content (twice-weekly essays, 1500–2500 words each).
- Managed 2 community moderators.
- Planned and run 8 industry events (3 conferences, 5 smaller meetups).

I am open to a wide range of content + community + events roles. I am not a fit for "OG / meme / 80-hour" cultural postures, and I would rather know that up front than discover it after a 4-month ramp.`,
  },
  {
    id: 'A6',
    material: `I am a solutions engineer with 3 years of pre-sales experience at a smaller B2B SaaS company in Singapore. I have closed 14 enterprise deals personally, with an average deal size of $350k. I am Singapore-based, with no family constraints, and I can be at a customer meeting in Jakarta on 24-hour notice.

I do not have a CS or EE degree. I have a BA in Communications. I have been told by customers that I "feel like a peer" in a CIO meeting, and I am comfortable in those calls; I would not describe myself as having "polished executive presence" in the way the phrase is usually meant, but I do well in the actual room.

I have built 30+ POCs, run security reviews, and defended pricing conversations.`,
  },
  {
    id: 'A7',
    material: `I am a construction project manager with 11 years of experience, including 4 hospital projects (two of which were greenfield). I am currently based in Seattle. I led the pre-construction and ground-breaking phase on my last project, so I know the early-stage cadence well.

I cannot relocate to Houston for 14 months. My spouse is a physician with her own practice in Seattle, and we have two children in high school. The 14-month commitment is genuinely not possible for my family. I have been clear about this constraint with every firm I have spoken with in the last 6 months.

I could do 2–3 trips per month (week-long stints) in an advisory capacity, but I cannot be the on-site Site Manager.`,
  },
  {
    id: 'A8',
    material: `I am a producer with 4 years at a podcast agency and before that 2 years at an ad agency. I have done interviewing, episode structure, host handling, and rough-cut feedback. My technical sound work is thin: I can do basic dialogue editing in Hindenburg and I understand levels, but I have never done broadcast-standard noise reduction end-to-end on my own.

I am open to a role that requires me to learn. I have started watching tutorials on iZotope RX. But I would not call myself a technical sound designer today. I would be honest about that on day one.

I am most interested in jobs that have a long-form narrative documentary or interview-driven focus, not branded content.`,
  },
];
