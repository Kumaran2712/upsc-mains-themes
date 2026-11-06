import { auth, api, request, ensureAuth, announceProgress, ApiError, type LiveEntry, type ConversationResult } from './api';
import { paintLiveStatus } from './live-progress';
import { readEvents } from './sse';

export function initialiseLiveConversation() {
  const root = document.querySelector<HTMLElement>('[data-live-workspace]');
  const workspace = document.querySelector<HTMLElement>('[data-workspace]'); if (!root || !workspace) return;
  const id = workspace.dataset.conceptId!, available = root.dataset.lessonAvailable === 'true';
  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const log = find<HTMLElement>('#s0-live-messages'), input = find<HTMLTextAreaElement>('#s0-live-input');
  const hint = find<HTMLElement>('[data-live-hint]');
  const check = find<HTMLElement>('[data-live-check]');
  const answerInput = find<HTMLTextAreaElement>('[data-live-answer]');
  const answerForm = find<HTMLFormElement>('[data-live-answer-form]');
  const dialog = find<HTMLDialogElement>('[data-live-restart-dialog]')!;
  let entry: LiveEntry | null = null, busy = false, generation = 0, controller: AbortController | null = null;
  let pending: { requestId: string; message: string; revision: number } | null = null;
  let assessmentPending: { requestId: string; answer: string; revision: number; assessmentId: string } | null = null;
  let checkVisible = false, activeUser: string | null = null;
  let renderedCheck = '', draftTimer: ReturnType<typeof setTimeout> | undefined;

  function message(text: string, role: 'student' | 'tutor' = 'tutor') {
    if (!log) return null;
    const article = document.createElement('article'), label = document.createElement('span'), p = document.createElement('p');
    article.className = 's0-message'; article.dataset.role = role;
    label.textContent = role === 'student' ? 'You' : 'Concept companion · AI'; p.textContent = text;
    article.append(label, p); log.append(article); return p;
  }
  function scroll() { if (log) log.scrollTop = log.scrollHeight; }
  function setHint(text: string) { if (hint) hint.textContent = text; }
  function controls() {
    const enabled = Boolean(auth.user && auth.reachable && entry && !busy);
    if (input) input.disabled = !enabled || !auth.ready;
    root!.querySelectorAll<HTMLButtonElement>('[data-live-send],[data-live-question],[data-live-open-check],[data-live-check-submit],[data-live-check-again]').forEach((b) => b.disabled = !enabled || !auth.ready);
    const restart = find<HTMLButtonElement>('[data-live-restart]'); if (restart) restart.disabled = !enabled;
    find<HTMLButtonElement>('[data-live-revisit]')!.disabled = !enabled;
    find<HTMLButtonElement>('[data-live-sign-in]')!.hidden = Boolean(auth.user);
    find<HTMLButtonElement>('[data-live-stop]')?.toggleAttribute('hidden', !busy);
    log?.setAttribute('aria-busy', String(busy));
    if (answerInput) answerInput.disabled = !enabled || !auth.ready;
  }
  function renderCheck() {
    if (!check) return;
    const assessment = entry?.assessment;
    check.hidden = !checkVisible || !assessment;
    const history = find<HTMLOListElement>('[data-live-check-history]')!; history.replaceChildren();
    if (!assessment) return;
    const checkKey = `${assessment.id}:${assessment.index}`;
    if (checkKey !== renderedCheck && answerInput) { answerInput.value = assessment.draft || ''; renderedCheck = checkKey; }
    for (const evidence of assessment.answers) {
      const li = document.createElement('li'), question = document.createElement('strong'), answer = document.createElement('p'), feedback = document.createElement('p');
      question.textContent = evidence.question; answer.textContent = `Your answer: ${evidence.answer}`;
      feedback.textContent = evidence.feedback; li.append(question, answer, feedback); history.append(li);
    }
    answerForm!.hidden = assessment.complete;
    find<HTMLElement>('[data-live-check-question]')!.textContent = assessment.question ? `${assessment.index + 1} of 3. ${assessment.question}` : '';
    const complete = find<HTMLElement>('[data-live-check-complete]')!;
    complete.hidden = !assessment.complete;
    complete.textContent = entry?.status === 'Understood' ? 'Your answers demonstrated the meaning, distinction and application in this check. Keep connecting the idea to your study.' : 'The feedback shows what to revisit. Try another explanation, then return for a fresh check.';
    find<HTMLButtonElement>('[data-live-check-again]')!.hidden = !assessment.complete;
  }
  function render() {
    paintLiveStatus(document.getElementById('s0-current-status')!, entry || undefined);
    find<HTMLButtonElement>('[data-live-revisit]')!.textContent = entry?.revisit ? 'Saved to revisit ✓' : 'Save to revisit';
    log?.replaceChildren();
    if (!auth.user) message('Sign in to begin. Your conversation and checks will be saved to your account. The concept guide and reusable prompt stay free to read.');
    else if (!entry) message('Your saved conversation could not be loaded. Use Refresh saved progress to try again.');
    else if (!auth.ready) message('Live AI is not activated yet. You can save this concept to revisit or use its reusable prompt below.');
    else if (!entry.messages.length) message('Bring your first question. Ask what the idea means, request an everyday example, or tell me which part feels unfamiliar.');
    else entry.messages.forEach((m) => message(m.text, m.role));
    setHint(!auth.user ? 'Sign in to begin a learning conversation.' : !auth.ready ? 'Live AI is not activated yet.' : 'Enter to send · Shift + Enter for a new line. Replies are saved when complete.');
    renderCheck(); controls(); scroll();
  }
  function accept(result: ConversationResult) {
    entry = result.conversation; auth.usage = result.usage; render(); announceProgress(result.usage);
  }
  async function refresh() {
    const current = ++generation, user = auth.user?.username || null;
    controller?.abort(); controller = null; busy = false;
    if (activeUser !== user) {
      clearTimeout(draftTimer); renderedCheck = '';
      entry = null; pending = null; assessmentPending = null; checkVisible = false;
      if (input) input.value = ''; if (answerInput) answerInput.value = '';
    }
    activeUser = user; render();
    if (!user) return;
    try {
      const result = await api<ConversationResult>(`/conversation?conceptId=${encodeURIComponent(id)}`);
      if (current !== generation || auth.user?.username !== user) return;
      entry = result.conversation; auth.usage = result.usage; render();
    } catch (error) { if (current === generation) { entry = null; render(); setHint((error as Error).message); } }
  }
  function currentOperation() {
    controller?.abort(); controller = new AbortController(); busy = true; controls();
    return { generation: ++generation, user: auth.user?.username, signal: controller.signal };
  }
  const stillCurrent = (op: ReturnType<typeof currentOperation>) => op.generation === generation && op.user === auth.user?.username;
  async function recover(requestId: string, op: ReturnType<typeof currentOperation>) {
    try {
      const saved = await api<{ state: string; result: ConversationResult | null }>(`/operation?id=${encodeURIComponent(requestId)}`);
      if (stillCurrent(op) && saved.state === 'completed' && saved.result) { accept(saved.result); return true; }
    } catch { /* Failure text and a retry are presented by the caller. */ }
    return false;
  }
  async function send(value: string) {
    const text = value.trim(); if (!text || !entry || !auth.user || !auth.ready || busy || !available) return;
    const requestData = pending?.message === text ? pending : { requestId: crypto.randomUUID(), message: text, revision: entry.revision };
    pending = requestData;
    const op = currentOperation(); input!.value = ''; renderCheck();
    const draft = message(text, 'student'), reply = message(''); setHint('Thinking…'); scroll();
    let done = false, failure = '';
    try {
      const response = await request('/chat', { conceptId: id, ...requestData }, op.signal);
      if (!response.body) throw new Error('The tutor returned an empty response.');
      for await (const event of readEvents(response.body)) {
        if (!stillCurrent(op)) break;
        const data = JSON.parse(event.data);
        if (event.event === 'delta') { reply!.textContent += data.text; setHint('Replying…'); scroll(); }
        if (event.event === 'done') { done = true; pending = null; accept(data as ConversationResult); }
        if (event.event === 'error') throw new ApiError(data.code, data.message);
      }
      if (!done && stillCurrent(op)) throw new Error('The connection ended before the reply finished. Refresh saved progress or send the same question to recover this attempt.');
    } catch (error) {
      if (!stillCurrent(op)) return;
      if (await recover(requestData.requestId, op)) { done = true; pending = null; }
      else {
        failure = op.signal.aborted ? 'Reply stopped. Refresh saved progress before retrying if it finished just as you stopped.' : (error as Error).message;
        if (error instanceof ApiError && ['request_failed', 'conversation_changed', 'daily_limit', 'invalid_input', 'ai_unavailable', 'incomplete_reply', 'invalid_reply'].includes(error.code)) pending = null;
        draft?.parentElement?.remove(); reply?.parentElement?.remove(); input!.value = text;
      }
    } finally {
      if (stillCurrent(op)) { busy = false; controller = null; controls(); setHint(failure || 'Enter to send · Shift + Enter for a new line.'); if (done) renderCheck(); }
    }
  }
  find<HTMLFormElement>('[data-live-form]')?.addEventListener('submit', (e) => { e.preventDefault(); void send(input!.value); });
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(input.value); } });
  const questions: Record<string, string> = { meaning: 'What does this concept mean?', example: 'Can you give me an everyday example?', different: 'I still do not understand. Please explain it differently.', distinction: 'What is this often confused with?' };
  root.querySelectorAll<HTMLButtonElement>('[data-live-question]').forEach((button) => button.addEventListener('click', () => void send(questions[button.dataset.liveQuestion!])));
  find<HTMLButtonElement>('[data-live-stop]')?.addEventListener('click', () => controller?.abort());
  find<HTMLButtonElement>('[data-live-sign-in]')!.addEventListener('click', () => window.dispatchEvent(new Event('stage0-sign-in')));
  find<HTMLButtonElement>('[data-live-refresh]')!.addEventListener('click', () => void refresh());
  async function mutate(path: string, body: Record<string, unknown>) {
    if (!entry || busy) return;
    const op = currentOperation();
    try {
      const result = await api<ConversationResult>(path, { conceptId: id, revision: entry.revision, ...body }, op.signal);
      if (stillCurrent(op)) { pending = null; assessmentPending = null; accept(result); }
    } catch (error) { if (stillCurrent(op)) setHint((error as Error).message); }
    finally { if (stillCurrent(op)) { busy = false; controller = null; controls(); } }
  }
  find<HTMLButtonElement>('[data-live-revisit]')!.addEventListener('click', () => void mutate('/conversation/bookmark', { revisit: !entry?.revisit }));
  find<HTMLButtonElement>('[data-live-restart]')?.addEventListener('click', () => { dialog.returnValue = ''; dialog.showModal(); });
  dialog.addEventListener('close', () => { if (dialog.returnValue === 'restart') { checkVisible = false; void mutate('/conversation/reset', {}); } });
  async function startCheck() {
    if (!entry || busy || !auth.ready) return;
    checkVisible = true;
    if (!entry.assessment || entry.assessment.complete) await mutate('/assessment/start', {});
    renderCheck();
    document.getElementById('s0-live-check-title')?.focus({ preventScroll: true });
    check?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  find<HTMLButtonElement>('[data-live-open-check]')?.addEventListener('click', () => void startCheck());
  find<HTMLButtonElement>('[data-live-check-again]')?.addEventListener('click', () => { if (answerInput) answerInput.value = ''; void startCheck(); });
  find<HTMLButtonElement>('[data-live-check-later]')?.addEventListener('click', () => { checkVisible = false; renderCheck(); });
  answerForm?.addEventListener('submit', async (event) => {
    event.preventDefault(); const answer = answerInput!.value.trim();
    if (!answer || !entry?.assessment || busy || !auth.user) return;
    const checkId = entry.assessment.id;
    const data = assessmentPending?.answer === answer && assessmentPending.assessmentId === checkId ? assessmentPending : { requestId: crypto.randomUUID(), answer, revision: entry.revision, assessmentId: checkId };
    clearTimeout(draftTimer); assessmentPending = data; const op = currentOperation();
    const notice = find<HTMLElement>('[data-live-check-message]')!; notice.textContent = 'Reading your answer…';
    try {
      const result = await api<ConversationResult>('/assessment/answer', { conceptId: id, ...data }, op.signal);
      if (stillCurrent(op)) { assessmentPending = null; answerInput!.value = ''; accept(result); notice.textContent = ''; }
    } catch (error) {
      if (!stillCurrent(op)) return;
      if (await recover(data.requestId, op)) { assessmentPending = null; answerInput!.value = ''; notice.textContent = ''; }
      else {
        notice.textContent = (error as Error).message;
        if (error instanceof ApiError && !['connection_failed', 'request_running'].includes(error.code)) assessmentPending = null;
      }
    } finally { if (stillCurrent(op)) { busy = false; controller = null; controls(); } }
  });
  answerInput?.addEventListener('input', () => {
    clearTimeout(draftTimer);
    const user = auth.user?.username, assessment = entry?.assessment, rev = entry?.revision;
    if (!user || !assessment || assessment.complete) return;
    const draft = answerInput.value;
    draftTimer = setTimeout(async () => {
      if (auth.user?.username !== user || busy || entry?.assessment?.id !== assessment.id || entry.assessment.index !== assessment.index) return;
      const notice = find<HTMLElement>('[data-live-check-message]')!;
      try {
        await api('/assessment/draft', { conceptId: id, revision: rev, assessmentId: assessment.id, index: assessment.index, draft });
        if (auth.user?.username === user && !busy) notice.textContent = 'Draft saved to your account.';
      } catch {
        if (auth.user?.username === user && !busy) notice.textContent = 'Draft could not be saved. Keep this page open or copy your answer before leaving.';
      }
    }, 600);
  });
  window.addEventListener('stage0-auth', () => void refresh());
  window.addEventListener('pagehide', () => { generation++; controller?.abort(); clearTimeout(draftTimer); });
  render(); void ensureAuth().then(refresh);
}
