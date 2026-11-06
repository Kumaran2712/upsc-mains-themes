import { concepts, conceptPath } from './curriculum';
import { auth, api, ensureAuth, type ProgressEntry, type Usage } from './api';

export function paintLiveStatus(el: HTMLElement, entry?: Pick<ProgressEntry, 'status' | 'revisit'>) {
  el.dataset.status = entry?.status || 'Not started';
  el.textContent = (entry?.status || 'Not started') + (entry?.revisit ? ' · Saved' : '');
}
export function observeLiveProgress(render: (entries: ProgressEntry[]) => void) {
  let generation = 0;
  async function refresh() {
    const current = ++generation, user = auth.user?.username;
    render([]); // Private progress is never carried between accounts or read from prototype storage.
    if (!user) return;
    try {
      const result = await api<{ entries: ProgressEntry[]; usage: Usage }>('/progress');
      if (current !== generation || auth.user?.username !== user) return;
      auth.usage = result.usage; render(result.entries);
    } catch {
      if (current === generation) {
        const caption = document.getElementById('s0-progress-caption');
        if (caption) caption.textContent = 'Saved progress could not be loaded. Refresh to try again.';
      }
    }
  }
  window.addEventListener('stage0-auth', () => void refresh());
  window.addEventListener('stage0-live-progress', () => void refresh());
  void ensureAuth().then(refresh);
}

export function paintSubjects(entries: ProgressEntry[]) {
  const byId = new Map(entries.map((e) => [e.conceptId, e]));
  document.querySelectorAll<HTMLElement>('[data-concept-status]').forEach((el) => paintLiveStatus(el, byId.get(el.dataset.conceptStatus!)));
  document.querySelectorAll<HTMLElement>('[data-subject-progress]').forEach((el) => {
    const list = concepts.filter((c) => c.subject.id === el.dataset.subjectProgress);
    const seen = list.filter((c) => byId.has(c.id));
    const understood = seen.filter((c) => byId.get(c.id)?.status === 'Understood').length;
    const count = el.querySelector('[data-count]'); if (count) count.textContent = `${understood} of ${list.length} understood`;
    const fill = el.querySelector<HTMLElement>('[data-fill]'); if (fill) fill.style.width = `${100 * understood / list.length}%`;
    const state = el.querySelector('[data-subject-state]'); if (state) state.textContent = seen.length ? `${seen.length} explored` : auth.user ? 'Ready when you are' : 'Sign in to save progress';
  });
}
export function initialiseLiveDashboard() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  observeLiveProgress((entries) => {
    paintSubjects(entries);
    const understood = entries.filter((e) => e.status === 'Understood').length;
    document.getElementById('s0-explored')!.textContent = String(entries.length);
    document.getElementById('s0-understood')!.textContent = String(understood);
    document.getElementById('s0-revisit')!.textContent = String(entries.filter((e) => e.revisit).length);
    document.getElementById('s0-overall-fill')!.style.width = `${100 * understood / concepts.length}%`;
    const list = document.getElementById('s0-recent-list')!; list.replaceChildren();
    const known = entries.filter((e) => concepts.some((c) => c.id === e.conceptId));
    document.getElementById('s0-recent-empty')!.hidden = known.length > 0;
    document.getElementById('s0-progress-caption')!.textContent = auth.user ? 'Your account progress · return whenever you need to' : 'Sign in to save your learning across devices.';
    const resume = document.getElementById('s0-continue') as HTMLAnchorElement;
    resume.href = base + '/stage-0/polity/sovereignty/'; resume.textContent = 'Explore Sovereignty ↗';
    document.getElementById('s0-continue-caption')!.textContent = 'Start with one idea. Return to any concept whenever you need it.';
    if (known.length) {
      const recent = concepts.find((c) => c.id === known[0].conceptId)!;
      resume.href = base + conceptPath(recent); resume.textContent = 'Continue exploring →';
      document.getElementById('s0-continue-caption')!.textContent = `Pick up where you left off: ${recent.name}.`;
    }
    for (const entry of known.slice(0, 4)) {
      const c = concepts.find((c) => c.id === entry.conceptId)!;
      const li = document.createElement('li'), link = document.createElement('a'), name = document.createElement('span');
      link.href = base + conceptPath(c); name.textContent = c.name;
      const sub = document.createElement('small'); sub.textContent = c.subject.name; name.append(sub);
      const status = document.createElement('span'); status.className = 's0-status'; paintLiveStatus(status, entry);
      link.append(name, status); li.append(link); list.append(li);
    }
  });
}
