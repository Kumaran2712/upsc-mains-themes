import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogue, digest } from './contract.mjs';

// Register locally retrieved text (including text extracted from PDFs) with exact provenance.
// This checks integrity, not whether a source supports a concept; the independent review does that.
const [id, metadataPath, textPath] = process.argv.slice(2);
if (!catalogue.has(id) || !metadataPath || !textPath) throw new Error('Usage: node tools/content/source.mjs subject/slug metadata.json source.txt');
const metadata = JSON.parse(await readFile(metadataPath, 'utf8')), text = await readFile(textPath, 'utf8');
for (const field of ['title', 'url', 'locator', 'excerpt', 'retrievedAt']) if (!metadata[field]) throw new Error('Missing ' + field);
if (new URL(metadata.url).protocol !== 'https:' || !Number.isFinite(Date.parse(metadata.retrievedAt))) throw new Error('Invalid provenance');
if (!text.replace(/\s+/g, ' ').includes(metadata.excerpt.replace(/\s+/g, ' '))) throw new Error('Excerpt does not match retrieved text');
const root = resolve('content/stage0/sources'), filename = digest(text) + '.txt'; await mkdir(root, { recursive: true });
await writeFile(resolve(root, filename), text);
const packetPath = resolve(root, id.replace('/', '--') + '.json');
let packet = { sources: [] };
try { packet = JSON.parse(await readFile(packetPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const source = { ...metadata, sha256: digest(text), file: filename };
packet.sources = packet.sources.filter((s) => s.url !== source.url || s.locator !== source.locator); packet.sources.push(source);
await writeFile(packetPath, JSON.stringify(packet, null, 2) + '\n'); console.log(`Source registered for ${id}; independent claim review still required.`);
