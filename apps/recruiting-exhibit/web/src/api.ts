// Typed client for the six existing exhibit HTTP endpoints.
// No endpoint is added here except the read-only fields the
// backend inbox query already returns.

import type { InboxEntry, ObservationStatus } from '../../../../apps/recruiting-exhibit/views.js';

export type { InboxEntry, ObservationStatus };

export interface SituationResponse {
  readonly rawText: string;
  readonly updatedAt: string;
}

export interface FeedEntry {
  readonly evidenceId: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly feedUrl: string;
  readonly claim: string;
  readonly impliedMeaning: string;
  readonly relationshipStatus: 'surfaced' | 'not_surfaced';
  readonly capturedAt: string;
}

export interface StatusResponse extends ObservationStatus {}

export interface RunResponse {
  readonly runId: string;
  readonly status: 'succeeded' | 'failed' | 'skipped';
  readonly newEvidenceCount: number;
  readonly newRelationshipCount: number;
  readonly errorMessage: string | null;
}

export type FeedbackButton = 'worth_talking' | 'investigate_more' | 'not_relevant';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function fetchSituation(): Promise<SituationResponse> {
  return getJson<SituationResponse>('/api/situation');
}

export function saveSituation(rawText: string): Promise<SituationResponse> {
  return fetch('/api/situation', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rawText }),
  }).then(async (res) => {
    if (!res.ok) throw new Error((await res.json()).error ?? 'save failed');
    return (await res.json()) as SituationResponse;
  });
}

export function fetchStatus(): Promise<StatusResponse> {
  return getJson<StatusResponse>('/api/status');
}

export function fetchInbox(): Promise<ReadonlyArray<InboxEntry>> {
  return getJson<{ entries: ReadonlyArray<InboxEntry> }>('/api/inbox').then((r) => r.entries);
}

export function fetchFeed(): Promise<ReadonlyArray<FeedEntry>> {
  return getJson<{ entries: ReadonlyArray<FeedEntry> }>('/api/feed').then((r) => r.entries);
}

export async function triggerObservationRun(): Promise<RunResponse> {
  const res = await fetch('/api/observation/run', { method: 'POST' });
  if (res.status === 409) throw new Error('已有一轮 observation 正在运行');
  if (!res.ok) throw new Error(`run → HTTP ${res.status}`);
  return (await res.json()) as RunResponse;
}

export async function postFeedback(relationshipId: string, button: FeedbackButton): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ relationshipId, button }),
  });
  if (!res.ok) throw new Error(`feedback → HTTP ${res.status}`);
}
