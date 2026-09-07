import { describe, it, expect } from 'vitest';
import {
  renderFullPoolDiscoveryArtifact,
  writeFullPoolDiscoveryArtifact,
} from '../../../matching/recruiting-poc/artifact.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const baseSucceeded = {
  status: 'succeeded' as const,
  summary: 'Two strong Kafka owners stood out, plus one transferable SRE.',
  relationships: [
    {
      candidateId: 'C03',
      judgment: 'worth_exploring' as const,
      analysis: 'C03 actually owned a Kafka deployment, did on-call, did postmortems.',
      evidence: ['C03: "I owned the Kafka deployment that handled order events."'],
      unknowns: ['C03 has not run a cluster at the scale implied by the employer situation.'],
      nextStep: 'Ask C03 for the most recent postmortem.',
    },
    {
      candidateId: 'C10',
      judgment: 'uncertain' as const,
      analysis: 'C10 has no streaming experience but has SRE on-call + postmortem depth.',
      evidence: ['C10: "I do incident command, write postmortems"'],
      unknowns: ['Whether C10 can ramp on Kafka in a reasonable time.'],
      nextStep: 'Probe C10 on how they would learn the Kafka layer in week 1.',
    },
  ],
  errorMessage: null,
  durationMs: 12345,
  stdout: '',
  recoveryNote: null,
  recoverySourcePath: null,
};

describe('recruiting-poc/artifact', () => {
  it('contains the 5 required sections in order (Run Metadata, Employer, Candidate Pool, Summary, Discovered Relationships, Not Surfaced)', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    const order = [
      '## Run Metadata',
      '## Employer Raw Situation',
      '## Candidate Pool (20)',
      '## Agent Summary',
      '## Discovered Relationships (2)',
      '## Not Surfaced',
    ];
    let last = -1;
    for (const heading of order) {
      const idx = md.indexOf(heading);
      expect(idx, `missing heading: ${heading}`).toBeGreaterThan(-1);
      expect(idx, `out-of-order: ${heading}`).toBeGreaterThan(last);
      last = idx;
    }
  });

  it('embeds the Employer Raw Situation verbatim', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('Kafka 这块现在没人真正 owner');
    expect(md).toContain('扛 on-call');
  });

  it('embeds all 20 candidate IDs in the Candidate Pool section', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    for (let i = 1; i <= 20; i += 1) {
      const id = `C${String(i).padStart(2, '0')}`;
      expect(md, `missing candidate ${id}`).toContain(`### ${id}`);
    }
  });

  it('lists surfaced candidates under Discovered Relationships with their judgment', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('### C03 — worth_exploring');
    expect(md).toContain('### C10 — uncertain');
  });

  it('Not Surfaced section lists exactly the IDs not surfaced (20 - 2 = 18)', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    const idx = md.indexOf('## Not Surfaced');
    expect(idx).toBeGreaterThan(-1);
    const after = md.slice(idx);
    // count candidate bullet lines
    const surfaced = new Set(baseSucceeded.relationships.map((r) => r.candidateId));
    let count = 0;
    for (let i = 1; i <= 20; i += 1) {
      const id = `C${String(i).padStart(2, '0')}`;
      if (!surfaced.has(id)) {
        expect(after, `${id} missing from Not Surfaced`).toContain(`- ${id}`);
        count += 1;
      } else {
        expect(after, `${id} should NOT be in Not Surfaced`).not.toContain(`- ${id}\n`);
      }
    }
    expect(count).toBe(18);
  });

  it('does not explain why non-surfaced candidates were not surfaced (per Stage 1 §6)', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    const idx = md.indexOf('## Not Surfaced');
    const section = md.slice(idx);
    // Should contain only IDs as bullet list. No narrative paragraphs.
    const lines = section.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    for (const line of lines) {
      if (line.startsWith('##')) continue;
      if (line.startsWith('_')) continue;
      if (line.startsWith('>')) continue;
      // Every other non-empty line must be a `- C\d{2}` ID bullet
      expect(line, `non-ID line in Not Surfaced: "${line}"`).toMatch(/^- C\d{2}$/);
    }
  });

  it('includes runtime metadata: status, duration, counts', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    expect(md).toContain('status: succeeded');
    expect(md).toContain('durationMs: 12345');
    expect(md).toContain('relationshipCount: 2');
    expect(md).toContain('notSurfacedCount: 18');
    expect(md).toContain('poolSize: 20');
  });

  it('includes the full 5-field per-relationship shape (analysis/evidence/unknowns/nextStep)', () => {
    const md = renderFullPoolDiscoveryArtifact(baseSucceeded);
    for (const r of baseSucceeded.relationships) {
      expect(md).toContain(r.analysis);
      for (const e of r.evidence) expect(md).toContain(e);
      for (const u of r.unknowns) expect(md).toContain(u);
      expect(md).toContain(r.nextStep);
    }
  });

  it('failed runs include the Raw output (debug) section', () => {
    const md = renderFullPoolDiscoveryArtifact({
      ...baseSucceeded,
      status: 'failed',
      errorMessage: 'parse failed',
      relationships: [],
      stdout: 'partial agent output that did not parse',
    });
    expect(md).toContain('status: failed');
    expect(md).toContain('partial agent output that did not parse');
  });

  it('empty relationships case surfaces all 20 candidates in Not Surfaced', () => {
    const md = renderFullPoolDiscoveryArtifact({
      ...baseSucceeded,
      relationships: [],
    });
    expect(md).toContain('_No relationships were surfaced by the Agent._');
    const idx = md.indexOf('## Not Surfaced');
    const after = md.slice(idx);
    for (let i = 1; i <= 20; i += 1) {
      const id = `C${String(i).padStart(2, '0')}`;
      expect(after, `expected ${id} in Not Surfaced`).toContain(`- ${id}`);
    }
  });

  it('writeFullPoolDiscoveryArtifact writes a file under artifacts/recruiting-poc/ with expected content', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'recruiting-poc-art-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const path = writeFullPoolDiscoveryArtifact(baseSucceeded);
      // path is absolute; just verify file exists and is readable.
      // (macOS may resolve /var/folders/.../artifacts via the
      // /private/var symlink, so don't string-compare against
      // the tmp prefix directly.)
      const body = readFileSync(path, 'utf-8');
      expect(body).toContain('Kafka 这块现在没人真正 owner');
      expect(body).toContain('relationshipCount: 2');
      expect(body).toContain('### C03 — worth_exploring');
      expect(body).toContain('### C10 — uncertain');
      expect(body).toContain('## Not Surfaced');
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
