import { spawn } from 'node:child_process';
import { mkdir, open, chmod, rm, stat, appendFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

const magic = Buffer.from('UPSCPG01');
function encryptionKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be a separately retained 32-byte base64 key');
  return key;
}
export function pgEnvironment(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL connection required');
  return { PATH: process.env.PATH, LANG: process.env.LANG || 'en_US.UTF-8', PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'prefer', PGOPTIONS: url.searchParams.get('options') || '' };
}
export async function pgCommand(binary, args, connectionString) {
  const child = spawn(binary, args, { env: pgEnvironment(connectionString), stdio: ['ignore', 'ignore', 'pipe'] });
  let diagnostic = '';
  child.stderr.on('data', (part) => { diagnostic = (diagnostic + part).slice(-8000); });
  await new Promise((yes, no) => {
    child.once('error', () => no(new Error('PostgreSQL client utility is unavailable: ' + binary)));
    child.once('exit', (code) => code === 0 ? yes() : no(new Error('PostgreSQL utility failed; inspect restricted job diagnostics. Exit: ' + code)));
  });
}
export async function backupPostgres(connectionString, output, keyValue, dumpBinary = 'pg_dump') {
  const key = encryptionKey(keyValue), target = resolve(output), temporary = target + '.' + randomBytes(8).toString('hex') + '.plain';
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  let created = false;
  const handle = await open(temporary, 'wx', 0o600); await handle.close();
  try {
    await pgCommand(dumpBinary, ['--format=custom', '--no-owner', '--no-acl', '--file', temporary], connectionString);
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
    const destination = await open(target, 'wx', 0o600); created = true;
    try {
      await destination.write(Buffer.concat([magic, iv]));
    } finally { await destination.close(); }
    await pipeline(createReadStream(temporary), cipher, createWriteStream(target, { flags: 'a', mode: 0o600 }));
    await appendFile(target, cipher.getAuthTag());
    const completed = await open(target, 'r+'); try { await completed.sync(); } finally { await completed.close(); }
    await chmod(target, 0o600);
    return { bytes: (await stat(target)).size, encrypted: true };
  } catch (error) { if (created) await rm(target, { force: true }); throw error; }
  finally { await rm(temporary, { force: true }); }
}
export async function restorePostgres(connectionString, input, keyValue, restoreBinary = 'pg_restore') {
  const key = encryptionKey(keyValue), source = resolve(input), temporary = source + '.' + randomBytes(8).toString('hex') + '.plain';
  const size = (await stat(source)).size;
  if (size <= magic.length + 28) throw new Error('Invalid encrypted backup');
  const file = await open(source, 'r'), header = Buffer.alloc(magic.length + 12), tag = Buffer.alloc(16);
  try { await file.read(header, 0, header.length, 0); await file.read(tag, 0, 16, size - 16); } finally { await file.close(); }
  if (!header.subarray(0, magic.length).equals(magic)) throw new Error('Unsupported backup format');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length)); decipher.setAuthTag(tag);
  try {
    await pipeline(createReadStream(source, { start: header.length, end: size - 17 }), decipher, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    await pgCommand(restoreBinary, ['--exit-on-error', '--single-transaction', '--no-owner', '--no-acl', '--dbname', pgEnvironment(connectionString).PGDATABASE, temporary], connectionString);
  } finally { await rm(temporary, { force: true }); }
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (!process.env.DATABASE_URL || !process.argv[2]) throw new Error('Set DATABASE_URL and BACKUP_ENCRYPTION_KEY; pass a new encrypted output path');
  console.log(JSON.stringify(await backupPostgres(process.env.DATABASE_URL, process.argv[2], process.env.BACKUP_ENCRYPTION_KEY, process.env.PG_DUMP_BIN || 'pg_dump')));
}
