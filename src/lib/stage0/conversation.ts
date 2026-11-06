import { previews, developingAnswers } from './previews';
import { readProgress, saveEntry, paintStatus, type Entry, type Status, type Message } from './progress';

/** A browser-only interaction prototype. No provider call or actual evaluation occurs. */
export function initialiseConversation() {
  const workspace = document.querySelector<HTMLElement>('[data-workspace]');
  if (!workspace) return;
  const id = workspace.dataset.conceptId!, slug = workspace.dataset.conceptSlug!;
  const lesson = previews[slug];
  if (!lesson) return;
  const messages = document.getElementById('s0-messages')!;
  const input = document.getElementById('s0-message-input') as HTMLTextAreaElement;
  const form = document.getElementById('s0-message-form') as HTMLFormElement;
  const status = document.getElementById('s0-current-status')!;
  const hint = document.getElementById('s0-message-hint')!;
  const assessment = document.getElementById('s0-assessment')!;
  const feedback = document.getElementById('s0-feedback')!;
  const dialog = document.getElementById('s0-restart-dialog') as HTMLDialogElement;
  const answers = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-answer]'));
  let entry: Entry = readProgress().entries[id] || { status: 'Exploring', updated: Date.now(), messages: [{ role: 'tutor', text: lesson.opening }] };
  let busy = false, generation = 0;

  function persist() {
    entry.updated = Date.now();
    const saved = saveEntry(id, entry);
    document.querySelector<HTMLElement>('[data-storage-warning]')!.hidden = saved;
    paintStatus(status, entry.status);
    status.setAttribute('aria-label', `${entry.status}, sample progress`);
    document.getElementById('s0-revisit')!.textContent = entry.status === 'Revisit' ? 'Saved to revisit ✓' : 'Save to revisit';
  }

  function appendMessage(message: Message) {
    const article = document.createElement('article'), name = document.createElement('span'), text = document.createElement('p');
    article.className = 's0-message'; article.dataset.role = message.role;
    name.textContent = message.role === 'student' ? 'You' : 'Companion · sample';
    text.textContent = message.text; article.append(name, text); messages.append(article);
    return text;
  }

  function scrollConversation() { messages.scrollTop = messages.scrollHeight; }
  function render() {
    messages.replaceChildren();
    if (!entry.messages.length) entry.messages.push({ role: 'tutor', text: lesson.opening });
    entry.messages.forEach(appendMessage); scrollConversation();
    answers.forEach((el, i) => { el.value = entry.assessmentDraft?.[i] || ''; });
    persist();
  }

  function setBusy(value: boolean) {
    busy = value;
    form.querySelector<HTMLButtonElement>('button')!.disabled = value;
    document.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((b) => { b.disabled = value; });
    messages.setAttribute('aria-busy', String(value));
    hint.textContent = value ? 'Showing a prepared sample reply…' : 'Sample replies only. Enter to send · Shift + Enter for a new line.';
  }

  function replyFor(text: string, action?: string) {
    const q = text.toLowerCase();
    if (/python|programming|write.*code|javascript|recipe|football|cricket/.test(q)) {
      return 'Let’s stay with this concept for now. Stage 0 is a space to get comfortable with the language of these subjects. Try asking for an everyday example or a different explanation.\n\nThis is a prepared boundary-response example, not a live AI answer.';
    }
    if (slug === 'inflation' && /monetary|phillips|cpi|wpi|rbi/.test(q)) {
      return 'Monetary policy includes central-bank decisions that can influence borrowing and spending, which can affect prices. Detailed frameworks and models belong to later Economics preparation.\n\nFor now, the useful connection is that changes in spending and production can affect prices and what your money buys.\n\nThis is a prepared sample showing the Stage 0 boundary.';
    }
    if (/westphali|historical evolution|jurisprudence|advanced|theor(y|ies)|detailed.*(analysis|framework)|ignore.*(instruction|rule)/.test(q)) {
      return 'That takes us into a deeper part of the subject that you can explore during structured preparation. Here, we’ll stay with the central idea and a familiar example so it feels comfortable first.\n\n' + lesson.explanation + '\n\nThis prepared sample demonstrates how the live tutor should redirect advanced questions.';
    }
    if (slug === 'state' && /government.*(same|state)|state.*same.*government/.test(q)) {
      return 'It’s easy to mix them up because we often use the words loosely. A government is part of the state, but they are not the same.\n\n' + lesson.example + '\n\n' + lesson.distinction;
    }
    if (action === 'different' || /don.?t understand|do not understand|confus|simpler|differently|another way/.test(q)) return lesson.differently;
    if (action === 'distinction' || /difference|different from|versus|\bvs\b|confused with/.test(q)) return lesson.distinction;
    if (action === 'example' || /example|everyday|real.world|household/.test(q)) return lesson.example;
    if (action === 'meaning' || /what (does|is|are)|explain.*(simply|simple)|meaning|define|india.*sovereign/.test(q)) return lesson.explanation;
    return 'The live tutor will respond naturally to questions like yours. This preview has a small set of prepared replies, so it cannot answer every question yet.\n\nTry “Give me an example,” “Explain differently,” or “What is it often confused with?” to explore this sample lesson.';
  }

  async function send(text: string, action?: string) {
    text = text.trim().slice(0, 1200);
    if (!text || busy) return;
    const current = ++generation;
    setBusy(true); input.value = '';
    const student: Message = { role: 'student', text };
    const tutor: Message = { role: 'tutor', text: replyFor(text, action) };
    // Save the complete authored reply before animating, so navigation cannot lose it.
    entry.messages.push(student, tutor); entry.messages = entry.messages.slice(-60); persist();
    appendMessage(student);
    const paragraph = appendMessage({ role: 'tutor', text: '' });
    scrollConversation();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) paragraph.textContent = tutor.text;
    else {
      for (let end = 16; end < tutor.text.length + 16; end += 16) {
        if (current !== generation) return;
        paragraph.textContent = tutor.text.slice(0, end); scrollConversation();
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    }
    if (current !== generation) return;
    setBusy(false); scrollConversation();
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); void send(input.value); });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!busy && input.value.trim()) form.requestSubmit(); }
  });
  const questionText: Record<string, string> = {
    meaning: 'What does it mean?', example: 'Can you give me an everyday example?',
    different: 'I still don’t understand. Could you explain differently?', distinction: 'What is it often confused with?',
  };
  document.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((button) => button.addEventListener('click', () => {
    void send(questionText[button.dataset.question!], button.dataset.question);
  }));

  document.getElementById('s0-open-assessment')!.addEventListener('click', () => {
    assessment.hidden = false;
    document.getElementById('s0-check-title')!.focus({ preventScroll: true });
    assessment.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  document.getElementById('s0-assessment-later')!.addEventListener('click', () => {
    assessment.hidden = true; document.getElementById('s0-open-assessment')!.focus();
  });
  answers.forEach((el) => el.addEventListener('input', () => {
    entry.assessmentDraft = answers.map((a) => a.value.slice(0, 1200)); persist();
  }));

  function showExample(kind: 'Developing' | 'Understood') {
    feedback.replaceChildren();
    const label = document.createElement('span'); label.className = 's0-status'; paintStatus(label, kind);
    const intro = document.createElement('p'); intro.textContent = 'Example assessment · this feedback does not evaluate your typed answers.';
    const answerList = document.createElement('ol'); answerList.style.cssText = 'padding-left:20px;font-size:.83rem';
    const sample = kind === 'Understood' ? lesson.answers : developingAnswers[slug];
    sample.forEach((answer) => { const li = document.createElement('li'); li.textContent = answer; answerList.append(li); });
    const explanation = document.createElement('p'); explanation.textContent = kind === 'Understood' ? lesson.understood : lesson.gap;
    const note = document.createElement('p'); note.className = 's0-muted'; note.textContent = 'Your sample progress now shows this state so you can review the dashboard. The live version will assess evidence from your own answers.';
    const again = document.createElement('button'); again.className = 's0-text-button'; again.textContent = 'Explore another explanation →'; again.type = 'button';
    again.addEventListener('click', () => { assessment.hidden = true; void send(questionText.different, 'different'); input.focus({ preventScroll: true }); });
    feedback.append(label, intro, answerList, explanation, note, again);
    entry.status = kind; entry.sampleAssessment = true; persist();
  }

  document.getElementById('s0-preview-feedback')!.addEventListener('click', () => {
    feedback.replaceChildren(); feedback.hidden = false;
    const title = document.createElement('strong'); title.textContent = 'Preview two kinds of feedback';
    const note = document.createElement('p'); note.textContent = 'Your answers stay saved as a draft. Choose an authored example below to see how feedback and sample progress could look.';
    const actions = document.createElement('div'); actions.className = 's0-assessment-actions';
    for (const [label, value] of [['An idea needs more work', 'Developing'], ['The idea has clicked', 'Understood']] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 's0-button'; button.textContent = label;
      button.addEventListener('click', () => showExample(value)); actions.append(button);
    }
    feedback.append(title, note, actions);
  });

  document.getElementById('s0-revisit')!.addEventListener('click', () => { entry.status = 'Revisit'; persist(); });
  document.getElementById('s0-restart')!.addEventListener('click', () => { dialog.returnValue = ''; dialog.showModal(); });
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'restart') return;
    generation++; setBusy(false);
    entry = { status: 'Exploring' as Status, updated: Date.now(), messages: [{ role: 'tutor', text: lesson.opening }], assessmentDraft: [] };
    assessment.hidden = true; feedback.hidden = true; input.value = ''; render(); input.focus({ preventScroll: true });
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    generation++; setBusy(false);
    entry = readProgress().entries[id] || { status: 'Exploring', updated: Date.now(), messages: [{ role: 'tutor', text: lesson.opening }] };
    render();
  });
  render();
}
