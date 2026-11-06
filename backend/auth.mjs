import { randomBytes, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { fail } from './errors.mjs';

const scrypt = promisify(scryptCallback);
const options = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
export const token = () => randomBytes(32).toString('base64url');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const ipHash = (ip, secret) => createHmac('sha256', secret).update(ip).digest('hex');
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function username(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(value)) fail(422, 'invalid_username', 'Choose a username of 3–32 letters, numbers or underscores.');
  return value.toLowerCase();
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) fail(422, 'invalid_password', 'Use a password of 12–128 characters.');
  return value;
}
export async function passwordHash(value) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${Buffer.from(await scrypt(value, salt, 64, options)).toString('hex')}`;
}
export async function verifyPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const [, salt, expected] = (stored || '').split(':');
  // Equal-cost verification for unknown accounts prevents a cheap username timing oracle.
  const actual = Buffer.from(await scrypt(value, salt || '00000000000000000000000000000000', 64, options)).toString('hex');
  return Boolean(expected) && equal(actual, expected);
}
export function cookie(config, value, maxAge = config.sessionSeconds) {
  return `${config.cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.production ? '; Secure' : ''}`;
}
export function readCookie(req, config) {
  const item = String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(config.cookieName + '='));
  const value = item?.slice(config.cookieName.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
