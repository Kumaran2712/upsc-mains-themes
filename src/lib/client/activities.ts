import { auth, api, ensureAuth, liveEnabled } from '../stage0/api';
type LocalSnapshot = { quizzes: Record<string, number>; roadmap: number[]; daily: Record<string, { p: (string | null)[]; checked: boolean; done: boolean }>; maps: Record<string, { t: number; s: number; n: number; sec: number | null }[]> };
type ServerSnapshot = { practiceVersion: string; roadmap: { themeId: number; completed: boolean; revision: number }[]; practice: { id: string; day: string; answers: (string | null)[]; version: string }[]; maps: { id: string; mode?: 'quiz' | 'sketch'; mapId: string; score: number; total: number; seconds: number | null; created: number }[] };
type Change = { kind: 'roadmap' | 'practice' | 'maps'; value: Record<string, unknown> };
declare global { interface Window { __activityScope?: 'pending' | 'guest' | 'account'; __activitySnapshot?: LocalSnapshot } }
const empty = (): LocalSnapshot => ({ roadmap: [], daily: {}, maps: {}, quizzes: {} });
function read<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; } }
function guest(): LocalSnapshot { const quizzes: Record<string, number> = {}; try { for (const key of Object.keys(localStorage)) if (key.startsWith('upscthemes-quiz-')) { const score = Number(localStorage.getItem(key)); if (Number.isSafeInteger(score) && score >= 0) quizzes[key.slice('upscthemes-quiz-'.length)] = score; } } catch {} return { roadmap: read('upscthemes-done', []), daily: read('upscthemes-daily', {}), maps: read('upscthemes-lab', {}), quizzes }; }
export function initialiseActivities() {
  if (!liveEnabled) { window.__activityScope = 'guest'; return; }
  const status = document.querySelector<HTMLElement>('[data-activity-status]')!; if (!status) return;
  const retry = document.querySelector<HTMLButtonElement>('[data-activity-retry]')!, importButton = document.querySelector<HTMLButtonElement>('[data-activity-import]')!, dialog = document.querySelector<HTMLDialogElement>('[data-activity-import-dialog]')!;
  let generation = 0, owner: string | undefined, server: ServerSnapshot | undefined, loading: Promise<void> | undefined;
  const pending: { owner: string; change: Change }[] = [];
  function publish(snapshot: LocalSnapshot) { window.__activitySnapshot = snapshot; window.dispatchEvent(new CustomEvent('activity-snapshot', { detail: snapshot })); }
  function render(data: ServerSnapshot) {
    const snapshot = empty(); snapshot.roadmap = data.roadmap.filter((r) => r.completed).map((r) => r.themeId);
    for (const attempt of data.practice) if (attempt.version === data.practiceVersion && !snapshot.daily[attempt.day]) snapshot.daily[attempt.day] = { p: attempt.answers, checked: true, done: true };
    for (const attempt of [...data.maps].reverse()) { if (attempt.mode === 'quiz') { snapshot.quizzes[attempt.mapId] = Math.max(snapshot.quizzes[attempt.mapId] || 0, attempt.score); continue; } (snapshot.maps[attempt.mapId] ||= []).push({ t: attempt.created, s: attempt.score, n: attempt.total, sec: attempt.seconds }); }
    publish(snapshot);
  }
  async function refresh() {
    const current = ++generation; owner = auth.user?.username; server = undefined; importButton.hidden = true;
    window.__activityScope = owner ? 'pending' : 'guest'; publish(owner ? empty() : guest());
    pending.splice(0); retry.hidden = true;
    if (!owner) { status.textContent = 'Guest activities stay on this device. Sign in to save across devices.'; return; }
    const user = owner; status.textContent = 'Loading your saved activities…';
    try {
      const data = await api<ServerSnapshot>('/activity');
      if (current !== generation || auth.user?.username !== user) return;
      server = data; window.__activityScope = 'account'; render(data); status.textContent = 'Activities saved to your account.'; importButton.hidden = false;
    } catch { if (current === generation) { status.textContent = 'Saved activities could not load. Retry before changing progress.'; retry.hidden = false; } }
  }
  async function drain() {
    if (loading) return loading;
    loading = (async () => {
      while (pending.length) {
        const item = pending[0]; if (auth.user?.username !== item.owner || owner !== item.owner || !server) { pending.shift(); continue; }
        const value = { ...item.change.value };
        if (item.change.kind === 'roadmap') value.revision = server.roadmap.find((r) => r.themeId === value.themeId)?.revision || 0;
        status.textContent = 'Saving activity…';
        try {
          const saved = await api<any>('/activity/' + item.change.kind, value);
          if (auth.user?.username !== item.owner || owner !== item.owner) return;
          if (item.change.kind === 'roadmap') server.roadmap = [...server.roadmap.filter((r) => r.themeId !== saved.themeId), saved];
          pending.shift(); status.textContent = 'Saved to your account.'; retry.hidden = true;
        } catch { if (auth.user?.username === item.owner) { status.textContent = 'This activity has not saved yet. Keep this page open and retry.'; retry.hidden = false; } return; }
      }
    })().finally(() => { loading = undefined; });
    return loading;
  }
  window.addEventListener('activity-change', ((event: CustomEvent<Change>) => {
    if (window.__activityScope === 'guest') return;
    if (window.__activityScope !== 'account' || !owner || owner !== auth.user?.username) { status.textContent = 'Wait for your saved activities to load before saving.'; return; }
    const change = { kind: event.detail.kind, value: { ...event.detail.value } };
    if (change.kind !== 'roadmap') change.value.id ||= crypto.randomUUID();
    pending.push({ owner, change }); void drain();
  }) as EventListener);
  retry.addEventListener('click', () => { if (pending.length) void drain(); else void refresh(); });
  importButton.addEventListener('click', () => {
    const data = guest(); document.querySelector('[data-activity-import-summary]')!.textContent = `${data.roadmap.length} theme completions, ${Object.values(data.daily).filter((d) => d.checked).length} daily submissions and ${Object.values(data.maps).reduce((n, entries) => n + entries.length, 0)} map attempts and ${Object.keys(data.quizzes).length} quiz best scores are stored on this device. Guest entries remain on the device after import.`; dialog.showModal();
  });
  document.querySelector<HTMLButtonElement>('[data-activity-import-confirm]')!.addEventListener('click', async (event) => {
    const button = event.currentTarget as HTMLButtonElement, user = owner; if (!user || user !== auth.user?.username || !server) return;
    button.disabled = true;
    try {
      const data = guest(), items: Change[] = data.roadmap.map((themeId) => ({ kind: 'roadmap', value: { themeId, completed: true, revision: 0 } }));
      for (const [day, entry] of Object.entries(data.daily)) if (entry.checked) items.push({ kind: 'practice', value: { id: await importId(user, ['practice', day, entry.p]), day, answers: entry.p } });
      for (const [mapId, attempts] of Object.entries(data.maps)) for (const attempt of attempts) items.push({ kind: 'maps', value: { id: await importId(user, ['maps', mapId, attempt]), mapId, score: attempt.s, seconds: attempt.sec ?? null } });
      for (const [mapId, score] of Object.entries(data.quizzes)) items.push({ kind: 'maps', value: { id: await importId(user, ['quiz-best', mapId, score]), mode: 'quiz', mapId, score, seconds: null } });
      for (let i = 0; i < items.length; i += 25) {
        if (owner !== user || auth.user?.username !== user) throw new Error('Account changed');
        const batch = items.slice(i, i + 25); await api('/activity/import', { receiptId: await importId(user, batch), items: batch });
      }
      dialog.close(); await refresh(); status.textContent = 'Guest work imported. Existing account theme decisions were preserved.';
    } catch { status.textContent = 'Import could not finish. You can retry safely; guest work remains on this device.'; }
    finally { button.disabled = false; }
  });
  window.addEventListener('stage0-auth', () => { dialog.close(); void refresh(); });
  window.addEventListener('beforeunload', (event) => { if (pending.length) { event.preventDefault(); event.returnValue = ''; } });
  void ensureAuth().then(refresh);
}
async function importId(owner: string, input: unknown) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([owner, input]))); return 'import_' + [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
