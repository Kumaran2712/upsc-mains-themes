export class HttpError extends Error {
  constructor(status, code, message, retryAfter = undefined) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export const fail = (status, code, message, retryAfter) => { throw new HttpError(status, code, message, retryAfter); };

export function text(value, name, min = 1, max = 1200) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || value.includes('\0')) fail(422, 'invalid_input', `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function revision(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail(422, 'invalid_revision', 'Refresh this conversation and try again.');
  return value;
}
export function requestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(value)) fail(422, 'invalid_request_id', 'A valid request ID is required.');
  return value;
}
