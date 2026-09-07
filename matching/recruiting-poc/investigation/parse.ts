import { z } from 'zod';
import { extractJsonObject } from '../../../runtime/hermes/parse.js';

const investigationQuestionSchema = z.object({
  transferMechanism: z.string().min(1),
  decisiveUnknown: z.string().min(1),
}).strict();

const reevaluationSchema = z.object({
  outcome: z.enum([
    'surface_worth_exploring',
    'surface_uncertain',
    'do_not_surface',
  ]),
  reasoning: z.string().min(1),
  evidenceUsed: z.array(z.string()),
  remainingUncertainty: z.array(z.string()),
}).strict();

const acquisitionFields = {
  requiredEvidence: z.string().min(1),
  evidenceHolder: z.string().min(1),
  acquisitionRoute: z.string().min(1),
  acquisitionAction: z.string().min(1),
  recipientJustification: z.string().min(1),
};

const acquisitionPlanSchema = z.discriminatedUnion(
  'currentUserIsAppropriateEvidenceHolder',
  [
    z.object({
      ...acquisitionFields,
      currentUserIsAppropriateEvidenceHolder: z.literal(true),
      humanQuestion: z.string().min(1),
    }).strict(),
    z.object({
      ...acquisitionFields,
      currentUserIsAppropriateEvidenceHolder: z.literal(false),
      humanQuestion: z.null(),
    }).strict(),
  ],
);

export type InvestigationQuestionDecision = z.infer<typeof investigationQuestionSchema>;
export type ReevaluationDecision = z.infer<typeof reevaluationSchema>;
export type AcquisitionPlanDecision = z.infer<typeof acquisitionPlanSchema>;

export const ACQUISITION_VERDICTS = ['EVIDENCE_FOUND', 'EVIDENCE_NOT_FOUND'] as const;
export type AcquisitionVerdict = typeof ACQUISITION_VERDICTS[number];

function isAcquisitionVerdict(value: unknown): value is AcquisitionVerdict {
  return typeof value === 'string' && (ACQUISITION_VERDICTS as ReadonlyArray<string>).includes(value);
}

function parseWith<T>(stdout: string, schema: z.ZodType<T>, name: string): T {
  const raw = extractJsonObject(stdout);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${name}: failed schema validation at ${issue?.path.join('.') || '<root>'}: ${issue?.message ?? 'unknown'}`);
  }
  return parsed.data;
}

export const parseInvestigationQuestion = (stdout: string): InvestigationQuestionDecision =>
  parseWith(stdout, investigationQuestionSchema, 'parseInvestigationQuestion');

export const parseReevaluation = (stdout: string): ReevaluationDecision =>
  parseWith(stdout, reevaluationSchema, 'parseReevaluation');

export const parseAcquisitionPlan = (stdout: string): AcquisitionPlanDecision =>
  parseWith(stdout, acquisitionPlanSchema, 'parseAcquisitionPlan');
