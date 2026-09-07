// matching/cases.ts — the four Ground Truth inputs.
//
// Each case is two long natural-language blocks (recruiting-side
// and applying-side) plus a short `notes` line that names the
// experimental variable the case is designed to probe. Cases are
// data, not code; there are no logic-bearing helpers here.
//
// Naming convention: caseA = obvious match, caseB = keyword
// mismatch, caseC = uncertain, caseD = capability transfer. The
// letters are kept stable so artifacts are comparable across
// runs.

export interface MatchingCase {
  readonly id: string;
  readonly label: string;
  readonly notes: string;
  readonly recruitingMaterial: string;
  readonly applyingMaterial: string;
}

export const caseA: MatchingCase = {
  id: 'A-obvious-match',
  label: 'obvious match beyond keyword overlap',
  notes:
    'situation/capability match, but surface titles differ — tests whether the model reads the work, not the job title',
  recruitingMaterial: `We are a mid-sized B2B SaaS company (about 280 people, $50M ARR, growing 60% YoY). Our supply-chain customers are asking us to help them rethink their internal operations, not just their software. We are hiring an "Operations Excellence Lead" who will sit between our customer success team and our product team and own the re-engineering of customer processes end-to-end.

This person should have:
- at least 5 years of hands-on experience inside a manufacturing or supply-chain environment, not just having sold to one;
- the ability to walk into a customer's plant, look at how parts actually flow, and identify the 2-3 process changes that would unblock the next 12 months;
- comfort with a lot of ambiguity; we do not have a playbook for this yet.

We are NOT hiring a consultant. We are NOT hiring a project manager. We want someone who has personally run a line, a shift, or a plant process, ideally in a role where the cost of a bad decision showed up in inventory or on-time-delivery within weeks.`,
  applyingMaterial: `I am a manufacturing engineer with 6 years at a tier-1 automotive supplier. I have personally run the line changeover process on a stamping line (12 minutes target, I averaged 9.4), and I led a project last year integrating a new MES with the existing PLC stack — that project is the one I am proudest of, because the previous integrators had tried twice and failed.

I have been doing this for six years. I am good at it. I want to move out of plant operations into a role where I can apply the same end-to-end thinking at a higher level — ideally in a company that supplies into manufacturing, but is not itself a factory. I do not want to be a consultant; I want to be on a product/customer team with long-term ownership.`,
};

export const caseB: MatchingCase = {
  id: 'B-keyword-mismatch',
  label: 'shared AI / Python / agent keywords, but real situation does not match',
  notes:
    'trap: high keyword overlap; tests that the model does not collapse to keyword matching',
  recruitingMaterial: `We are a 6-person seed-funded startup. We just closed $4M. We are building an "AI Agent Platform for SMBs" — basically a no-code way for a non-technical owner of a bakery, a dental clinic, or a small logistics shop to set up a custom agent that handles their scheduling, their WhatsApp replies, their inventory, etc.

We are hiring our first ML engineer. We need someone who is happy to:
- be the only ML person in the room for a while;
- write production code (Python, mostly) end-to-end, including the boring parts (CI, deployment, on-call);
- build a real product from zero, not optimise a model on someone else's data;
- be okay with our runway being 14 months and our sales being 6 pilots.

We do not have a research budget. We do not have a research team. We have a small set of paying SMB customers and a 3-month technical roadmap.`,
  applyingMaterial: `I am a senior ML engineer with 9 years of experience. I spent the last 5 years at a 1200-person fintech (publicly listed, well-funded, stable) where I owned the credit-card fraud model end-to-end. I led a team of 4. The work was mature: I was tuning, scaling, and defending a model that was already in production, and I had the budget and the platform team behind me.

I am now looking for my next role. I would strongly prefer a stable, well-resourced company — ideally an established tech company or a regulated industry with a real ML platform team. I do not want to be the only ML person. I do not want to do "build from zero in a startup". I am also not interested in agent / chatbot / no-code products; my background is in serious tabular ML on financial data, and that is what I want to keep doing.`,
};

export const caseC: MatchingCase = {
  id: 'C-uncertain',
  label: 'potential relationship exists, but key facts are missing',
  notes:
    'tests whether the model exposes unknowns and questions instead of forcing a verdict',
  recruitingMaterial: `We are a two-person independent podcast production studio. Most of our work is narrative documentary podcasts for streaming platforms, and we have just been asked to bid on a six-episode series about urban infrastructure.

We need a "producer who can also do technical sound design" — someone who can take a rough tape, do their own dialogue editing and noise reduction to a broadcast standard, build the episode, and also do the producer work (interview prep, host handling, transcript workflow, deliverable). We are open to either an established producer who is willing to pick up the technical craft, or an established sound designer who is willing to pick up the producer work. We do not need both. We will hire one person.

Day-to-day setup is remote, async, with one synchronous 30-minute call per week.`,
  applyingMaterial: `I am a producer with 4 years at a podcast agency and before that 2 years at an ad agency. I have done interviewing, episode structure, host handling, and rough-cut feedback. My technical sound work is thin: I can do basic dialogue editing in Hindenburg and I understand levels, but I have never done broadcast-standard noise reduction end-to-end on my own.

I am open to a role that requires me to learn. I have started watching tutorials on iZotope RX. But I would not call myself a technical sound designer today. I would be honest about that on day one.

I am most interested in jobs that have a long-form narrative documentary or interview-driven focus, not branded content.`,
};

export const caseD: MatchingCase = {
  id: 'D-capability-transfer',
  label: 'no clinical degree, but demonstrated capability in past clinical-data projects',
  notes:
    'tests whether the model reads demonstrated capability, not declared titles / degrees',
  recruitingMaterial: `Series-B healthtech (about 90 people, two hospital systems as design partners). We are hiring our first "Clinical Workflow Product Manager" for our clinical-data integration product. Explicitly: we would strongly prefer a candidate with an RN background or a clinical-research background, because our customers (hospital IT and clinical informatics teams) need a PM who can sit in a 30-minute meeting with a CMIO and earn credibility by understanding their actual workflow, not just their procurement process.

We are NOT looking for a generic B2B PM. We are NOT looking for a "data PM". We are looking for someone who has personally worked in or alongside a clinical setting and can hold their own on a hospital floor.`,
  applyingMaterial: `I am a backend software engineer with 8 years of experience. I have spent the last 3 years at a digital-health startup (Series A → B) where I owned the data pipeline that ingested HL7 messages from 7 hospital partners and surfaced structured clinical data to the rest of our product. I have personally been in HL7 integration calls with hospital IT teams, sat in CMIO meetings to understand their data dictionary, and debugged production issues on Friday nights when a partner hospital's lab feed broke.

I do not have an RN degree. I do not have a clinical-research degree. I have not worked as a clinician. I have spent the last 3 years working on exactly the kind of clinical-data product this job is about, from the engineering side. I have never been the PM, but I have been the technical half of the conversation in every clinical-meeting I have been in.`,
};

export const allCases: ReadonlyArray<MatchingCase> = [caseA, caseB, caseC, caseD];
