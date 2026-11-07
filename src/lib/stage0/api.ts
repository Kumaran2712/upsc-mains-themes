export const API_ROOT = String(import.meta.env.PUBLIC_STAGE0_API_URL || '').replace(/\/$/, '');
export const liveEnabled = Boolean(API_ROOT);
export type Usage = { used: number; limit: number; remaining: number; tokenRemaining: number; resetsIn: number };
export type Evidence = { score: 0 | 1 | 2; misconception: boolean; evidence: string; gap: string; feedback: string; question: string; answer: string };
export type LiveAssessment = { id: string; index: number; complete: boolean; question: string | null; answers: Evidence[]; draft: string };
export type LiveEntry = {
  conceptId: string; status: 'Not started' | 'Exploring' | 'Developing' | 'Understood';
  revisit: boolean; revision: number; updated: number;
  hasOlderMessages?: boolean;
  messages: { id: number; role: 'student' | 'tutor'; text: string; created: number }[];
  assessment: LiveAssessment | null;
};
export type ProgressEntry = Pick<LiveEntry, 'conceptId' | 'status' | 'revisit' | 'revision' | 'updated'>;
export type ConversationResult = { conversation: LiveEntry; usage: Usage };
export type AuthState = { loaded: boolean; reachable: boolean; ready: boolean; user: { username: string } | null; csrf: string | null; usage: Usage | null };
export const auth: AuthState = { loaded: false, reachable: false, ready: false, user: null, csrf: null, usage: null };
let loading: Promise<void> | undefined;
let authGeneration = 0;
const channel = liveEnabled && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('upscthemes-stage0-account') : null;

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) { super(message); }
}
export function announceAuth() { window.dispatchEvent(new Event('stage0-auth')); }
export function announceProgress(usage?: Usage) {
  if (usage) auth.usage = usage;
  window.dispatchEvent(new Event('stage0-live-progress'));
}
export async function request(path: string, value?: unknown, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { 'X-Stage0-Client': 'web' };
  if (value !== undefined) { headers['Content-Type'] = 'application/json'; if (auth.csrf) headers['X-CSRF-Token'] = auth.csrf; }
  let response: Response;
  try { response = await fetch(API_ROOT + path, { method: value === undefined ? 'GET' : 'POST', credentials: 'include', headers, body: value === undefined ? undefined : JSON.stringify(value), signal, cache: 'no-store' }); }
  catch (error) { if (signal?.aborted) throw error; throw new ApiError('connection_failed', 'Could not reach the tutor. Your concept guide and reusable prompt remain available.'); }
  if (!response.ok) {
    let error: { error?: { code?: string; message?: string } } = {};
    try { error = await response.json(); } catch { /* An intermediary may return HTML. */ }
    if (response.status === 401 && !path.startsWith('/auth/')) {
      auth.user = null; auth.csrf = null; auth.usage = null; announceAuth();
    }
    throw new ApiError(error.error?.code || 'request_failed', error.error?.message || 'The request could not be completed. Please refresh and try again.', response.status);
  }
  return response;
}
export async function api<T>(path: string, value?: unknown, signal?: AbortSignal): Promise<T> {
  return (await request(path, value, signal)).json();
}
export function ensureAuth() {
  if (!loading) loading = refreshAuth();
  return loading;
}
export async function refreshAuth() {
  const generation = ++authGeneration;
  try {
    const [health, session] = await Promise.all([
      api<{ ready: boolean }>('/health'), api<{ user: AuthState['user']; csrf: string | null; usage: Usage | null }>('/session'),
    ]);
    if (generation !== authGeneration) return;
    Object.assign(auth, session, { reachable: true, ready: health.ready, loaded: true });
  } catch {
    if (generation !== authGeneration) return;
    Object.assign(auth, { user: null, csrf: null, usage: null, reachable: false, ready: false, loaded: true });
  }
  announceAuth();
}
export function acceptSession(session: { user: AuthState['user']; csrf: string; usage: Usage }) {
  authGeneration++; Object.assign(auth, { user: session.user, csrf: session.csrf, usage: session.usage }); announceAuth(); channel?.postMessage('changed');
}
export async function signOut() {
  await api('/auth/logout', {});
  authGeneration++; auth.user = null; auth.csrf = null; auth.usage = null; announceAuth(); channel?.postMessage('changed');
}
export function accountDeleted() {
  authGeneration++; auth.user = null; auth.csrf = null; auth.usage = null; announceAuth(); channel?.postMessage('changed');
}
channel?.addEventListener('message', () => {
  // Clear private views immediately, before looking up the shared cookie's new owner.
  authGeneration++; auth.user = null; auth.csrf = null; auth.usage = null; announceAuth();
  void refreshAuth();
});
window.addEventListener('pageshow', (event) => { if (event.persisted && liveEnabled) void refreshAuth(); });
window.addEventListener('pagehide', () => {
  if (!liveEnabled) return;
  // A back/forward cache snapshot must not retain another account's private views.
  authGeneration++; auth.user = null; auth.csrf = null; auth.usage = null; announceAuth();
});
