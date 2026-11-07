import { readConfig } from './config.mjs';
import { createApplication } from './app.mjs';

const config = readConfig();
let store;
if (config.databaseUrl) {
  const { PostgresDatabase } = await import('./postgres.mjs');
  const { PostgresStore } = await import('./postgres-store.mjs');
  const database = new PostgresDatabase(config.databaseUrl);
  await database.migrate(); store = new PostgresStore(database); await store.cleanup();
}
const app = createApplication(config, store ? { store } : {});
app.server.listen(config.port, config.host, () => {
  console.log(`Stage 0 service listening on ${config.host}:${app.server.address().port}`);
  if (!app.provider.ready) console.log('Live AI is inactive: set OPENAI_API_KEY in the backend environment.');
});
let stopping = false;
async function shutdown() {
  if (stopping) return; stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000); deadline.unref();
  await app.close(); clearTimeout(deadline);
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
