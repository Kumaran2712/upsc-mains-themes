import { createHash } from 'node:crypto';
import { fail, requestId, revision } from '../../errors.mjs';
import { themes, scorePractice, validateMap, practiceVersion } from './catalogue.mjs';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class ActivityService {
  constructor(store) { this.store = store; this.db = store.db; }
  async snapshot(userId) {
    const roadmap = await this.db.prepare('SELECT theme_id,completed,revision,updated FROM roadmap_progress WHERE user_id=?').all(userId);
    const practice = await this.db.prepare('SELECT id,day,payload,created FROM practice_attempts WHERE user_id=? ORDER BY created DESC LIMIT 1000').all(userId);
    const maps = await this.db.prepare('SELECT id,map_id,payload,created FROM map_attempts WHERE user_id=? ORDER BY created DESC LIMIT 1000').all(userId);
    return { practiceVersion, roadmap: roadmap.map((r) => ({ themeId: r.theme_id, completed: Boolean(r.completed), revision: r.revision, updated: r.updated })), practice: practice.map((r) => ({ id: r.id, day: r.day, ...JSON.parse(r.payload), created: r.created })), maps: maps.map((r) => ({ id: r.id, ...JSON.parse(r.payload), created: r.created })) };
  }
  validate(kind, value) {
    if (kind === 'roadmap') {
      if (!themes.has(value.themeId) || typeof value.completed !== 'boolean') fail(422, 'invalid_theme', 'Choose a valid theme completion.');
      return { themeId: value.themeId, completed: value.completed, revision: revision(value.revision) };
    }
    if (kind === 'practice') return { id: requestId(value.id), day: value.day, ...scorePractice(value.day, value.answers, this.store.now()) };
    if (kind === 'maps') return { id: requestId(value.id), ...validateMap(value) };
    fail(404, 'not_found', 'This activity was not found.');
  }
  async apply(userId, kind, value, importing = false) {
    if (kind === 'roadmap') {
      const prior = await this.db.prepare('SELECT revision FROM roadmap_progress WHERE user_id=? AND theme_id=?').get(userId, value.themeId);
      if (importing && prior) return { skipped: true };
      if ((prior?.revision || 0) !== value.revision) fail(409, 'activity_changed', 'This theme changed on another device. Reload its progress before saving.');
      await this.db.prepare('INSERT INTO roadmap_progress VALUES(?,?,?,?,?) ON CONFLICT(user_id,theme_id) DO UPDATE SET completed=excluded.completed,revision=excluded.revision,updated=excluded.updated').run(userId, value.themeId, Number(value.completed), value.revision + 1, this.store.now());
      return { ...value, revision: value.revision + 1 };
    }
    const table = kind === 'practice' ? 'practice_attempts' : 'map_attempts', fingerprint = hash(value);
    const prior = await this.db.prepare(`SELECT fingerprint,payload FROM ${table} WHERE user_id=? AND id=?`).get(userId, value.id);
    if (prior) {
      if (prior.fingerprint !== fingerprint) fail(409, 'attempt_changed', 'A saved attempt cannot be replaced. Start a new attempt.');
      return JSON.parse(prior.payload);
    }
    await this.db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?)`).run(userId, value.id, kind === 'practice' ? value.day : value.mapId, fingerprint, JSON.stringify(value), this.store.now());
    return value;
  }
  async save(userId, kind, value) {
    const validated = this.validate(kind, value);
    return this.store.transaction(() => this.apply(userId, kind, validated));
  }
  async import(userId, input) {
    const id = requestId(input.receiptId);
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 25) fail(422, 'invalid_import', 'Import between 1 and 25 entries at a time.');
    const items = input.items.map((item) => ({ kind: item.kind, value: this.validate(item.kind, item.value) })), fingerprint = hash(items);
    return this.store.transaction(async () => {
      const prior = await this.db.prepare('SELECT fingerprint,result FROM import_receipts WHERE user_id=? AND id=?').get(userId, id);
      if (prior) { if (prior.fingerprint !== fingerprint) fail(409, 'import_changed', 'This import receipt belongs to different entries.'); return JSON.parse(prior.result); }
      const results = [];
      for (const item of items) results.push(await this.apply(userId, item.kind, item.value, true));
      const result = { receiptId: id, imported: results.filter((r) => !r.skipped).length, skipped: results.filter((r) => r.skipped).length };
      await this.db.prepare('INSERT INTO import_receipts VALUES(?,?,?,?,?)').run(userId, id, fingerprint, JSON.stringify(result), this.store.now());
      return result;
    });
  }
}
