import { readEvents } from '../src/lib/stage0/sse.ts';
import { HttpError } from './errors.mjs';
import { assessmentSchema } from './lessons.mjs';

export class OpenAIProvider {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; this.ready = Boolean(config.apiKey); }
  async request(body, signal) {
    if (!this.ready) throw new HttpError(503, 'ai_not_configured', 'The live tutor is not activated yet. The concept guide and reusable prompt are still free to use.');
    let response;
    try {
      response = await this.fetcher(new URL('responses', this.config.endpoint), {
        method: 'POST', headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, store: false, ...body }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]),
      });
    } catch (error) {
      if (signal.aborted) throw new HttpError(499, 'cancelled', 'The request was cancelled.');
      throw new HttpError(504, 'ai_unavailable', 'The tutor could not finish this request. Please try again shortly.');
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new HttpError(response.status === 429 ? 503 : 502, 'ai_unavailable', 'The tutor is temporarily unavailable. Please try again shortly.');
    }
    return response;
  }
  async stream({ instructions, messages, signal, onDelta }) {
    const response = await this.request({ instructions, input: messages, stream: true, max_output_tokens: this.config.maxOutputTokens }, signal);
    if (!response.body) throw new HttpError(502, 'incomplete_reply', 'The tutor returned an empty reply.');
    let answer = '', completed = false, usage = null;
    for await (const event of readEvents(response.body)) {
      if (event.data === '[DONE]') continue;
      let data;
      try { data = JSON.parse(event.data); } catch { throw new HttpError(502, 'invalid_reply', 'The tutor returned an unreadable reply.'); }
      if (data.type === 'response.output_text.delta') {
        if (completed || typeof data.delta !== 'string') throw new HttpError(502, 'invalid_reply', 'The tutor returned an unreadable reply.');
        answer += data.delta;
        if (answer.length > 16000) throw new HttpError(502, 'invalid_reply', 'The tutor reply exceeded the lesson limit.');
        onDelta(data.delta);
      } else if (data.type === 'response.completed') {
        completed = data.response?.status === 'completed'; usage = data.response?.usage || null;
      } else if (['response.failed', 'response.incomplete', 'response.refusal.delta', 'error'].includes(data.type)) {
        throw new HttpError(502, 'incomplete_reply', 'The tutor could not complete this reply. Please rephrase your question or try again.');
      }
    }
    if (!completed || !answer.trim()) throw new HttpError(502, 'incomplete_reply', 'The connection ended before the tutor finished. Your previous conversation is safe.');
    return { text: answer.trim(), usage };
  }
  async assess({ instructions, answer, signal }) {
    const response = await this.request({ instructions, input: [{ role: 'user', content: JSON.stringify({ learner_answer: answer }) }],
      max_output_tokens: Math.max(1200, this.config.maxOutputTokens),
      text: { format: { type: 'json_schema', name: 'concept_evidence', strict: true, schema: assessmentSchema } },
    }, signal);
    const raw = await response.text();
    if (raw.length > 100_000) throw new HttpError(502, 'invalid_assessment', 'The check could not be completed. Your answer has not been graded.');
    let data, result;
    try {
      data = JSON.parse(raw);
      if (data.status !== 'completed') throw new Error('Incomplete');
      const content = data.output.flatMap((o) => o.content || []);
      if (content.some((c) => c.type === 'refusal')) throw new Error('Refused');
      result = JSON.parse(content.filter((c) => c.type === 'output_text').map((c) => c.text).join(''));
    } catch { throw new HttpError(502, 'invalid_assessment', 'The check could not be completed. Your answer has not been graded.'); }
    return { result: validateAssessment(result, answer), usage: data.usage };
  }
}

export function validateAssessment(value, answer) {
  // Models sometimes add quotation marks or change ASCII casing around a real
  // excerpt. Resolve only an exact, source-verifiable span; never invent evidence.
  let evidence = typeof value?.evidence === 'string' ? value.evidence : null;
  if (evidence && !answer.includes(evidence)) {
    const quoted = /^(?:"([\s\S]*)"|“([\s\S]*)”)$/.exec(evidence.trim());
    const candidate = quoted ? quoted[1] ?? quoted[2] : evidence;
    const fold = (text) => text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
    const position = candidate ? fold(answer).indexOf(fold(candidate)) : -1;
    if (position >= 0) evidence = answer.slice(position, position + candidate.length);
  }
  if (!value || ![0, 1, 2].includes(value.score) || typeof value.misconception !== 'boolean' ||
    !['evidence', 'gap', 'feedback'].every((k) => typeof value[k] === 'string' && value[k].length <= 2400) || !value.feedback.trim() ||
    (evidence && !answer.includes(evidence)) || (value.score === 2 && (!evidence?.trim() || value.misconception || value.gap.trim())) ||
    (value.score < 2 && !value.gap.trim())) {
    throw new HttpError(502, 'invalid_assessment', 'The feedback did not contain reliable evidence. Your answer has not been graded; please retry.');
  }
  return { score: value.score, misconception: value.misconception, evidence, gap: value.gap, feedback: value.feedback };
}

// UTF-8 byte length plus a framing allowance is a conservative preflight token bound.
// Reserve before contacting the provider; retain it if provider completion is uncertain.
export function tokenReservation(instructions, messages, maxOutputTokens) {
  return Buffer.byteLength(instructions + JSON.stringify(messages), 'utf8') + maxOutputTokens + 2048;
}
