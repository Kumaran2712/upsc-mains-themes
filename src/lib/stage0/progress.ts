import { concepts } from './curriculum';

export const statuses = ['Not started', 'Exploring', 'Developing', 'Understood', 'Revisit'] as const;
export type Status = typeof statuses[number];
export type Message = { role: 'student' | 'tutor'; text: string };
export type Entry = { status: Status; updated: number; messages: Message[]; sampleAssessment?: boolean; assessmentDraft?: string[] };
export type Progress = { version: 1; entries: Record<string, Entry> };
export const STORAGE_KEY = 'upscthemes-stage0-prototype-v1';
const known = new Set(concepts.map((c) => c.id));

export function readProgress(): Progress {
  const progress: Progress = { version: 1, entries: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (raw?.version !== 1 || !raw.entries || typeof raw.entries !== 'object') return progress;
    for (const [id, entry] of Object.entries(raw.entries)) {
      if (!known.has(id) || !entry || typeof entry !== 'object') continue;
      const e = entry as Partial<Entry>;
      if (!statuses.includes(e.status as Status) || !Number.isFinite(e.updated) || !Array.isArray(e.messages)) continue;
      progress.entries[id] = {
        status: e.status!, updated: e.updated!, sampleAssessment: e.sampleAssessment === true,
        assessmentDraft: Array.isArray(e.assessmentDraft) ? e.assessmentDraft.slice(0, 3).map((a) => typeof a === 'string' ? a.slice(0, 1200) : '') : [],
        messages: e.messages.filter((m) => m && (m.role === 'student' || m.role === 'tutor') && typeof m.text === 'string')
          .slice(-60).map((m) => ({ role: m.role, text: m.text.slice(0, 8000) })),
      };
    }
  } catch { /* A corrupt or unavailable store starts a clean prototype session. */ }
  return progress;
}

export function saveEntry(id: string, entry: Entry): boolean {
  if (!known.has(id)) return false;
  const progress = readProgress();
  progress.entries[id] = { ...entry, messages: entry.messages.slice(-60) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new Event('stage0-progress'));
    return true;
  } catch { return false; }
}

export function paintStatus(el: HTMLElement, status: Status) {
  el.textContent = status;
  el.dataset.status = status;
}

export function initialiseProgress() {
  const progress = readProgress();
  document.querySelectorAll<HTMLElement>('[data-concept-status]').forEach((el) => {
    paintStatus(el, progress.entries[el.dataset.conceptStatus!]?.status || 'Not started');
  });
  document.querySelectorAll<HTMLElement>('[data-subject-progress]').forEach((el) => {
    const list = concepts.filter((c) => c.subject.id === el.dataset.subjectProgress);
    const explored = list.filter((c) => progress.entries[c.id]).length;
    const understood = list.filter((c) => progress.entries[c.id]?.status === 'Understood').length;
    const count = el.querySelector('[data-count]');
    if (count) count.textContent = `${understood} of ${list.length} understood`;
    const bar = el.querySelector<HTMLElement>('[data-fill]');
    if (bar) bar.style.width = `${100 * understood / list.length}%`;
    const state = el.querySelector('[data-subject-state]');
    if (state) state.textContent = explored ? `${explored} explored` : 'Ready when you are';
  });
  return progress;
}
