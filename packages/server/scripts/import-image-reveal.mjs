import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { triviaImageUrl, DIFFICULTY_REWARDS } from '@confidence-trivia/shared';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const catalogPath = path.join(root, '.private/image-reveal/storageImageCatalog.json');
const categories = ['animals', 'landmarks', 'objects'];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const secureUrl = (value) => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };

// A review is intentionally separate from discovery: a filename never proves
// the subject, count, source, or commercial rights of a photograph.
export function validateEntry(entry) {
  const fail = (reason) => { throw new Error(`${entry?.assetId ?? 'entry'}: ${reason}`); };
  if (!entry || !/^photo_[a-f0-9]{16}$/.test(entry.assetId)) fail('use an opaque photo_ plus 16 hex asset ID');
  if (!categories.includes(entry.category) || !entry.storagePath?.startsWith(`${entry.category}/`)
    || !triviaImageUrl('https://example.supabase.co', entry.storagePath)) fail('invalid Storage path/category');
  if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.width < 1 || entry.height < 1) fail('reviewed dimensions required');
  if (!entry.review?.inspectedAt || !entry.review?.subject || !/^[a-f0-9]{64}$/.test(entry.review.sha256)) fail('visual inspection and file SHA256 required');
  const rights = entry.rights;
  if (!rights || !['unsplash', 'documented-commercial', 'owner-reviewed'].includes(rights.license)
    || !rights.evidence?.trim()) fail('verified rights/source/evidence required');
  if (rights.license === 'owner-reviewed') {
    if (rights.provider !== 'Unsplash' || rights.reviewedBy !== 'game-owner' || !rights.reviewedAt
      || rights.documentation !== 'held-by-owner') fail('explicit owner review and documentation reference required');
    if ((rights.sourceUrl && !secureUrl(rights.sourceUrl)) || (rights.licenseUrl && !secureUrl(rights.licenseUrl))) fail('invalid optional source/license URL');
  } else if (!secureUrl(rights.sourceUrl) || !secureUrl(rights.licenseUrl)) fail('verified rights/source/evidence required');
  if (rights.license === 'unsplash' && (rights.unsplashPlus !== false || !/^https:\/\/(www\.)?unsplash\.com\/photos\//.test(rights.sourceUrl))) fail('free Unsplash source must be explicitly verified');
  if (/elephant|rushmore/i.test(entry.review.subject) && rights.license !== 'documented-commercial') fail('elephant/Rushmore require documented commercial rights or a verified replacement');
  const q = entry.question;
  if (!q || !/^reveal_photo_[a-f0-9]{16}$/.test(q.id) || q.id !== `reveal_${entry.assetId}`
    || !['easy', 'medium', 'hard'].includes(q.difficulty) || !['multiple_choice', 'word', 'estimate'].includes(q.type)
    || !q.text?.trim()) fail('invalid question');
  if (q.type === 'multiple_choice' && (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string' || !o.trim()) || new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4
    || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3)) fail('four distinct choices and a valid answer index required');
  if (q.type === 'word' && (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((s) => typeof s !== 'string' || !s.trim() || s.length > 64))) fail('written answer aliases required');
  if (q.type === 'estimate' && (!Number.isInteger(q.answer) || q.answer < 0 || !entry.review.countEvidence?.trim())) fail('exact count and visual count evidence required');
  return entry;
}

export function mergeCatalog(existing, incoming) {
  const merged = [...existing];
  for (const entry of incoming) {
    validateEntry(entry);
    const previous = merged.find((old) => old.assetId === entry.assetId || old.storagePath === entry.storagePath || old.question.id === entry.question.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error(`Refusing to overwrite existing image/question: ${entry.assetId}`);
    } else merged.push(entry);
  }
  return merged;
}

export function renderCatalog(entries) {
  const assets = Object.fromEntries(entries.map(e => [e.assetId, {kind:'raster',width:e.width,height:e.height,storagePath:e.storagePath}]));
  const credits = entries.map(e => ({assetId:e.assetId,...(e.rights.sourceUrl ? {sourceUrl:e.rights.sourceUrl} : {}),...(e.rights.photographer ? {photographer:e.rights.photographer} : {}),license:e.rights.license,...(e.rights.licenseUrl ? {licenseUrl:e.rights.licenseUrl} : {})}));
  const questions = entries.map(e => ({id:e.question.id,type:e.question.type,difficulty:e.question.difficulty,category:e.category,correctAnswer:e.question.answer,basePoints:DIFFICULTY_REWARDS[e.question.difficulty],presentation:{format:'image_reveal',assetId:e.assetId},difficultyNote:'Editorial rating; not calibrated against player performance.',translations:Object.fromEntries(['en','bg'].map(locale => [locale,{text:e.question.text,...(e.question.type === 'multiple_choice' ? {options:e.question.options} : {})}]))}));
  return {assets, credits, questions};
}

export function renderSharedCatalog(source, assets, credits) {
  const start = source.indexOf('export const STORAGE_VISUAL_ASSETS:');
  const end = source.indexOf('\n\nexport function triviaImageUrl',start);
  if (start < 0 || end < 0) throw new Error('Generated catalog markers missing');
  return source.slice(0,start) + `export const STORAGE_VISUAL_ASSETS: Record<string, RasterArtwork> = ${JSON.stringify(assets,null,2)};\nexport const IMAGE_CREDITS: ImageCredit[] = ${JSON.stringify(credits,null,2)};` + source.slice(end);
}

async function config() {
  const env = {...process.env};
  // Explicit environment wins; local Expo override wins over its defaults.
  for (const name of ['packages/mobile/.env.local','packages/mobile/.env','packages/server/.env']) {
    const text = await fs.readFile(path.join(root,name),'utf8').catch(() => '');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^['"]|['"]$/g,'');
    }
  }
  const url = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !triviaImageUrl(url,'animals/check.jpg')) throw new Error('Supabase HTTPS URL and listing key required (server-only service role if RLS hides files).');
  return {url, headers:{apikey:key,Authorization:`Bearer ${key}`}};
}

async function listFolder(config, prefix) {
  const files = [];
  for (let offset = 0;; offset += 100) {
    const response = await fetch(`${config.url}/storage/v1/object/list/trivia-images`, {method:'POST',headers:{...config.headers,'Content-Type':'application/json'},body:JSON.stringify({prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}}),signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`Storage listing failed (${response.status}) for ${prefix}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Unexpected Storage response');
    for (const item of page) {
      const storagePath = `${prefix}/${item.name}`;
      if (item.id) files.push({storagePath,metadata:item.metadata});
      else files.push(...await listFolder(config, storagePath));
    }
    if (page.length < 100) break;
  }
  return files;
}

export async function verifyFile(config, entry) {
  // Public URL is intentional: the mobile client must load the same object
  // without a service key. Private buckets fail safely rather than ship broken.
  const response = await fetch(triviaImageUrl(config.url, entry.storagePath), {signal:AbortSignal.timeout(20000)});
  if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error(`Image not publicly loadable: ${entry.storagePath} (${response.status})`);
  if (Number(response.headers.get('content-length')) > 10_000_000) throw new Error('Optimize image to less than 10 MB');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 10_000_000) throw new Error('Optimize image to less than 10 MB');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length > 10_000_000 || sha(bytes) !== entry.review.sha256) throw new Error(`Image differs from inspected file: ${entry.storagePath}`);
}

export async function main(args) {
  const configValue = await config();
  const files = (await Promise.all(categories.map(category => listFolder(configValue,category)))).flat();
  console.log(JSON.stringify({bucket:'trivia-images',visibleFiles:files.length,files},null,2));
  if (!files.length) {
    const message = 'No visible files. Empty listings do not prove an empty bucket; verify project and Storage SELECT policy/server listing credentials.';
    if (args[0] === '--discover') throw new Error(message);
    console.warn(message + ' Import will verify each explicitly reviewed path with a public download.');
  }
  if (args[0] === '--discover') return;
  if (args[0] !== '--import' || !args[1]) throw new Error('Use --discover or --import reviewed-manifest.json');
  const incoming = JSON.parse(await fs.readFile(path.resolve(args[1]),'utf8'));
  if (!Array.isArray(incoming) || !incoming.length) throw new Error('Nonempty reviewed manifest array required');
  const existing = JSON.parse(await fs.readFile(catalogPath,'utf8'));
  const merged = mergeCatalog(existing,incoming);
  for (const entry of incoming) {
    await verifyFile(configValue,entry);
  }
  // Validate all records and collisions before touching any output.
  const {QUESTIONS} = await import('../dist/content/questions.js');
  for (const entry of incoming) if (!existing.some(e => e.question.id === entry.question.id) && QUESTIONS.some(q => q.id === entry.question.id)) throw new Error(`Question ID already exists: ${entry.question.id}`);
  const {assets,credits,questions} = renderCatalog(merged);
  const sharedPath = path.join(root,'packages/shared/src/storageVisualAssets.ts');
  const shared = await fs.readFile(sharedPath,'utf8');
  const nextShared = renderSharedCatalog(shared,assets,credits);
  await fs.writeFile(catalogPath,JSON.stringify(merged,null,2)+'\n');
  await fs.writeFile(sharedPath,nextShared);
  await fs.writeFile(path.join(root,'packages/server/src/content/storageImageQuestions.ts'),`import type { QuestionRecord } from "@confidence-trivia/shared";\n// Generated by import-image-reveal.mjs; answers stay server-side.\nexport const STORAGE_IMAGE_QUESTIONS: QuestionRecord[] = ${JSON.stringify(questions,null,2)};\n`);
  console.log(`Imported ${merged.length-existing.length} questions; ${merged.length} total. Rebuild shared, server and mobile together.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
