// apps/recruiting-exhibit/static/app.js
//
// Plain ES module. No bundler, no framework. The page polls the
// backend every 4 seconds and re-renders the four sections.
//
// Per task.md §"UI 原则", the page shows four sections and
// three buttons per inbox entry. There is no score, no
// percentage, no skill overlap, no keyword hit, no candidate
// ranking number. We deliberately do not display them.

const POLL_MS = 4000;

const situationText = document.getElementById('situation-text');
const saveSituation = document.getElementById('save-situation');
const runNow = document.getElementById('run-now');
const saveStatus = document.getElementById('save-status');

const statusLast = document.getElementById('status-last');
const statusNext = document.getElementById('status-next');
const statusEvidence = document.getElementById('status-evidence');
const statusRelationship = document.getElementById('status-relationship');
const statusTotal = document.getElementById('status-total');

const inboxList = document.getElementById('inbox-list');
const feedList = document.getElementById('feed-list');

async function api(method, path, body) {
  const init = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  if (res.status === 204) return null;
  const text = await res.text();
  return text.length === 0 ? null : JSON.parse(text);
}

function fmtTime(iso) {
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function relTime(iso) {
  if (iso === null) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
}

async function loadSituation() {
  const row = await api('GET', '/api/situation');
  if (row === null) return;
  if (document.activeElement !== situationText) {
    situationText.value = row.rawText;
  }
}

async function loadStatus() {
  const s = await api('GET', '/api/status');
  if (s === null) return;
  statusLast.textContent = s.lastObservationAt === null ? 'never' : `${fmtTime(s.lastObservationAt)} (${relTime(s.lastObservationAt)})`;
  statusNext.textContent = s.nextObservationAt === null ? '—' : `${fmtTime(s.nextObservationAt)} (${relTime(s.nextObservationAt)})`;
  statusEvidence.textContent = String(s.newEvidenceCount);
  statusRelationship.textContent = String(s.newRelationshipCount);
  statusTotal.textContent = String(s.totalSurfaces);
}

function inboxItemHtml(entry) {
  const safeClaim = escapeHtml(entry.claim);
  const safeWhy = escapeHtml(entry.whyRelevant);
  const safeUsed = escapeHtml(entry.evidenceUsed);
  const safeUnknown = escapeHtml(entry.mostImportantUnknown);
  const safeSource = escapeHtml(entry.sourceLabel);
  const safeUrl = escapeHtml(entry.sourceUrl);
  const surfacedAt = escapeHtml(fmtTime(entry.surfacedAt));
  return `
    <article class="inbox-item" data-rel-id="${escapeHtml(entry.relationshipId)}">
      <p class="subject">${safeClaim}</p>
      <p class="source">${safeSource} · ${surfacedAt} · <a href="${safeUrl}" target="_blank" rel="noopener">source</a></p>
      <div class="field">
        <div class="field-label">Why it may matter</div>
        <div class="field-body">${safeWhy}</div>
      </div>
      <div class="field">
        <div class="field-label">Supporting evidence</div>
        <div class="field-body">${safeUsed}</div>
      </div>
      <div class="field">
        <div class="field-label">Most important unknown</div>
        <div class="field-body">${safeUnknown}</div>
      </div>
      <div class="actions">
        <button data-button="worth_talking">值得聊</button>
        <button data-button="investigate_more">继续确认</button>
        <button data-button="not_relevant">不合适</button>
      </div>
    </article>
  `;
}

function feedItemHtml(entry) {
  const badge = entry.relationshipStatus === 'surfaced'
    ? '<span class="badge surfaced">surfaced</span>'
    : '<span class="badge not_surfaced">not surfaced</span>';
  return `
    <li class="feed-item">
      <div class="meta">${escapeHtml(entry.sourceLabel)} · ${escapeHtml(fmtTime(entry.capturedAt))} ${badge}</div>
      <p class="summary">${escapeHtml(entry.claim)}</p>
    </li>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadInbox() {
  const r = await api('GET', '/api/inbox');
  if (r === null) return;
  if (r.entries.length === 0) {
    inboxList.innerHTML = '<p class="empty">The system has not surfaced anything yet. Click "Run observation now" or wait for the next scheduled run.</p>';
    return;
  }
  inboxList.innerHTML = r.entries.map(inboxItemHtml).join('');
}

async function loadFeed() {
  const r = await api('GET', '/api/feed');
  if (r === null) return;
  if (r.entries.length === 0) {
    feedList.innerHTML = '<li class="empty">No Evidence has been captured yet.</li>';
    return;
  }
  feedList.innerHTML = r.entries.map(feedItemHtml).join('');
}

async function refresh() {
  await Promise.all([loadSituation(), loadStatus(), loadInbox(), loadFeed()]);
}

saveSituation.addEventListener('click', async () => {
  saveSituation.disabled = true;
  saveStatus.textContent = 'Saving…';
  try {
    await api('PUT', '/api/situation', { rawText: situationText.value });
    saveStatus.textContent = 'Saved.';
  } catch (err) {
    saveStatus.textContent = 'Save failed.';
  } finally {
    saveSituation.disabled = false;
    setTimeout(() => { saveStatus.textContent = ''; }, 2000);
  }
});

runNow.addEventListener('click', async () => {
  runNow.disabled = true;
  runNow.textContent = 'Running…';
  try {
    await api('POST', '/api/observation/run');
    await refresh();
  } finally {
    runNow.disabled = false;
    runNow.textContent = 'Run observation now';
  }
});

inboxList.addEventListener('click', async (e) => {
  const button = e.target;
  if (!(button instanceof HTMLElement)) return;
  if (button.tagName !== 'BUTTON') return;
  const item = button.closest('.inbox-item');
  if (item === null) return;
  const relId = item.getAttribute('data-rel-id');
  const buttonName = button.getAttribute('data-button');
  if (relId === null || buttonName === null) return;
  button.disabled = true;
  button.textContent = '✓ ' + button.textContent;
  try {
    await api('POST', '/api/feedback', { relationshipId: relId, button: buttonName });
  } finally {
    setTimeout(() => { if (button.isConnected) { button.disabled = false; } }, 800);
  }
});

refresh();
setInterval(refresh, POLL_MS);
