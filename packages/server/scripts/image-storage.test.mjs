import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { triviaImageUrl, isAnswerCorrect, STORAGE_VISUAL_ASSETS, IMAGE_CREDITS } from '@confidence-trivia/shared';
import { mergeCatalog, renderCatalog, renderSharedCatalog, validateEntry, verifyFile } from './import-image-reveal.mjs';
import { STORAGE_IMAGE_QUESTIONS } from '../dist/content/storageImageQuestions.js';
import { QUESTIONS, getQuestionSet, localize } from '../dist/content/questions.js';
import { ENDLESS_QUESTIONS } from '../dist/content/endlessQuestions.js';
import { readFile } from 'node:fs/promises';

// Synthetic test fixture, never imported into the real catalog or presented as
// an actual uploaded image, photographer, source, or license.
function fixture() {
  return {assetId:'photo_0123456789abcdef',storagePath:'animals/test fixture.jpg',category:'animals',width:600,height:400,
    review:{inspectedAt:'2026-10-24',subject:'test animal',sha256:'a'.repeat(64)},
    rights:{license:'unsplash',sourceUrl:'https://unsplash.com/photos/test-fixture',licenseUrl:'https://unsplash.com/license',unsplashPlus:false,evidence:'Synthetic test evidence'},
    question:{id:'reveal_photo_0123456789abcdef',type:'word',difficulty:'medium',text:'Synthetic prompt?',answer:['Lynx','Eurasian lynx']}};
}

test('Storage URLs encode known relative paths and reject traversal, arbitrary URLs and insecure config', () => {
  assert.equal(triviaImageUrl('https://example.supabase.co','animals/test fixture.jpg'),'https://example.supabase.co/storage/v1/object/public/trivia-images/animals/test%20fixture.jpg');
  for (const value of ['../x.jpg','animals/../x.jpg','animals/%2e%2e/x.jpg','animals//x.jpg','https://evil.test/x.jpg','other/x.jpg','animals/x.jpg?answer=owl','animals/x.svg']) assert.equal(triviaImageUrl('https://example.supabase.co',value),undefined);
  for (const base of [undefined,'http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?x=1']) assert.equal(triviaImageUrl(base,'objects/x.jpg'),undefined);
});

test('reviewed import is idempotent, rejects conflicts and does not mutate existing catalog', () => {
  const entry = fixture(); const once = mergeCatalog([], [entry]);
  assert.deepEqual(mergeCatalog(once, [structuredClone(entry)]),once);
  const changed = structuredClone(entry); changed.question.answer = ['Other'];
  assert.throws(() => mergeCatalog(once,[changed]), /overwrite/);
  assert.deepEqual(once,[entry]);
});

test('unreviewed rights, Unsplash+ and undocumented elephant/Rushmore never import', () => {
  for (const change of [e => delete e.rights, e => delete e.review.sha256, e => e.rights.unsplashPlus = true, e => e.review.subject = 'Elephant and calf', e => e.review.subject = 'Mount Rushmore']) {
    const entry = fixture(); change(entry); assert.throws(() => validateEntry(entry));
  }
  const licensed = fixture(); licensed.review.subject = 'Mount Rushmore'; licensed.rights.license = 'documented-commercial';
  assert.doesNotThrow(() => validateEntry(licensed));
});

test('owner-held documentation is recorded honestly without inventing source links or photographer names', () => {
  const entry = fixture();
  entry.rights = {license:'owner-reviewed',provider:'Unsplash',reviewedBy:'game-owner',reviewedAt:'2026-10-24',documentation:'held-by-owner',evidence:'Synthetic explicit owner attestation'};
  assert.doesNotThrow(() => validateEntry(entry));
  const credit = renderCatalog([entry]).credits[0];
  assert.equal(credit.sourceUrl,undefined); assert.equal(credit.photographer,undefined); assert.equal(credit.licenseUrl,undefined);
  const missing = structuredClone(entry); delete missing.rights.documentation;
  assert.throws(() => validateEntry(missing),/owner review/);
  for (const subject of ['Elephant and calf','Mount Rushmore']) {
    const excluded = structuredClone(entry); excluded.review.subject = subject;
    assert.throws(() => validateEntry(excluded),/commercial rights/);
  }
});

test('all eighteen inspected photos enter normal category selection and Endless with correct existing answer methods', () => {
  assert.equal(STORAGE_IMAGE_QUESTIONS.length,18);
  for (const [category,count] of [['animals',6],['landmarks',5],['objects',7]]) {
    const photos = STORAGE_IMAGE_QUESTIONS.filter(q => q.category === category);
    assert.equal(photos.length,count);
    const selected = getQuestionSet(QUESTIONS.length,[],[category]);
    for (const question of photos) {
      assert.ok(selected.some(q => q.id === question.id));
      assert.ok(ENDLESS_QUESTIONS.some(q => q.id === question.id && q.answerType === question.type));
      assert.equal('correctAnswer' in localize(question,'en'),false);
      assert.ok(triviaImageUrl('https://wgzltvwdiqrzmopvmtpi.supabase.co',STORAGE_VISUAL_ASSETS[question.presentation.assetId].storagePath));
      if (question.type === 'multiple_choice') {
        for (let i=0;i<4;i++) assert.equal(isAnswerCorrect(question.type,i,question.correctAnswer),i === question.correctAnswer);
      } else if (question.type === 'word') {
        for (const alias of question.correctAnswer) assert.equal(isAnswerCorrect('word',`  ${alias.toUpperCase()}  `,question.correctAnswer),true);
        assert.equal(isAnswerCorrect('word','not the answer',question.correctAnswer),false);
      } else {
        assert.equal(isAnswerCorrect('estimate',question.correctAnswer,question.correctAnswer),true);
        assert.equal(isAnswerCorrect('estimate',question.correctAnswer+1,question.correctAnswer),false);
      }
    }
  }
  const countByPath = Object.fromEntries(STORAGE_IMAGE_QUESTIONS.filter(q => q.type === 'estimate').map(q => [STORAGE_VISUAL_ASSETS[q.presentation.assetId].storagePath,q.correctAnswer]));
  assert.deepEqual(countByPath,{'animals/giraffe.jpg':3,'objects/dice.jpg':2});
});

test('all categories render into existing question records, with private aliases and public credits separated', () => {
  for (const category of ['animals','landmarks','objects']) {
    const entry = fixture(); entry.category = category; entry.storagePath = `${category}/test.jpg`;
    const rendered = renderCatalog(mergeCatalog([], [entry]));
    const question = rendered.questions[0];
    assert.equal(question.category,category); assert.equal(question.presentation.format,'image_reveal');
    assert.equal(isAnswerCorrect('word','  EURASIAN LYNX ',question.correctAnswer),true);
    assert.equal(isAnswerCorrect('word','Tiger',question.correctAnswer),false);
    assert.equal(JSON.stringify(rendered.assets).includes('Lynx'),false);
    assert.equal(JSON.stringify(rendered.credits).includes('Lynx'),false);
    assert.equal(rendered.credits[0].photographer,undefined);
  }
});

test('multiple choices require plausible unique options and exact counts require inspection evidence', () => {
  const entry = fixture(); entry.question = {...entry.question,type:'multiple_choice',answer:2,options:['A','B','C','D']};
  assert.doesNotThrow(() => validateEntry(entry));
  entry.question.options[3] = 'C'; assert.throws(() => validateEntry(entry));
  entry.question = {...entry.question,type:'estimate',answer:2};
  assert.throws(() => validateEntry(entry), /count/);
  entry.review.countEvidence = 'Two clearly visible subjects in inspected fixture';
  assert.doesNotThrow(() => validateEntry(entry));
});

test('download verification rejects missing, changed, non-image and oversized files before import', async () => {
  const previous = globalThis.fetch;
  const entry = fixture(); const bytes = Buffer.from('synthetic image bytes');
  entry.review.sha256 = createHash('sha256').update(bytes).digest('hex');
  try {
    globalThis.fetch = async () => new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
    await verifyFile({url:'https://example.supabase.co'}, entry);
    for (const response of [new Response(null,{status:404}), new Response('changed',{headers:{'Content-Type':'image/jpeg'}}), new Response('html',{headers:{'Content-Type':'text/html'}}),new Response(bytes,{headers:{'Content-Type':'image/jpeg','Content-Length':'10000001'}})]) {
      globalThis.fetch = async () => response;
      await assert.rejects(verifyFile({url:'https://example.supabase.co'}, entry));
    }
  } finally { globalThis.fetch = previous; }
});

test('generated catalogs match private review records when locally available', async (context) => {
  const source = await readFile(new URL('../../../.private/image-reveal/storageImageCatalog.json',import.meta.url),'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (source === null) { context.skip('Private review records are intentionally excluded from Git and CI.'); return; }
  const entries = JSON.parse(source);
  const rendered = renderCatalog(mergeCatalog([],entries));
  assert.deepEqual(STORAGE_VISUAL_ASSETS,rendered.assets);
  assert.deepEqual(IMAGE_CREDITS,rendered.credits);
  assert.deepEqual(STORAGE_IMAGE_QUESTIONS,rendered.questions);
});

test('generated public source can be regenerated twice without duplication or damage to URL resolver', async () => {
  const source = await readFile(new URL('../../shared/src/storageVisualAssets.ts',import.meta.url),'utf8');
  const entry = fixture(); entry.rights.photographer = 'Synthetic; test name';
  const {assets,credits} = renderCatalog([entry]);
  const once = renderSharedCatalog(source,assets,credits);
  assert.equal(renderSharedCatalog(once,assets,credits),once);
  assert.ok(once.includes('export function triviaImageUrl'));
  assert.equal(once.split('Synthetic; test name').length,2);
  assert.throws(() => renderSharedCatalog('invalid',assets,credits),/markers/);
});
