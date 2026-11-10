// search.js — the dictionary search engine.
// No DOM, no dependencies: the same file runs in the browser (the app) and in Node (tests,
// or any other platform that wants to reuse Garuda's search).
//
// Idea: every way of writing a word (Devanagari headword, IAST transliteration, each listed
// romanised spelling) is turned into one loose "phonetic key". A user's query is turned into
// a key the same way. Two spellings that sound alike to a Hindi speaker get the same key,
// so "shaanti", "shanti", "santi" and "शान्ति" all land on शांति — even spellings that are
// not in the romanised list.

const DEVANAGARI = /[ऀ-ॿ]/;

// ---------- Roman side ----------

/** Turn any Roman / IAST spelling into the loose phonetic key. */
export function normalizeRoman(input) {
  let s = (input || '').toLowerCase().normalize('NFC');
  // IAST vocalic r/l are said "ri"/"li" by Hindi speakers (vṛkṣa -> vriksh)
  s = s.replace(/[ṛṝ]/g, 'ri').replace(/[ḷḹ]/g, 'li');
  // drop all diacritics: ā->a, ś->s, ṣ->s, ṃ->m, ñ->n, ṭ->t ...
  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  s = s.replace(/[^a-z]/g, '');
  if (!s) return '';

  s = s
    .replace(/x/g, 'ks')          // "xama" -> ksama
    .replace(/ksh/g, 'ks')        // क्ष
    .replace(/chh/g, 'c')         // छ
    .replace(/ch/g, 'c')          // च
    .replace(/sh/g, 's')          // श / ष / स all collapse (shanti = santi)
    .replace(/jn/g, 'gy')         // ज्ञ: jnana = gyan
    .replace(/w/g, 'v')           // vishwas = vishvas
    .replace(/z/g, 'j')           // zameen = jameen (nukta often dropped)
    .replace(/q/g, 'k')
    .replace(/f/g, 'ph')          // phal = fal
    .replace(/([kgjtdpbc])h/g, '$1') // drop aspiration: dharm = darm, padhna = padna
    .replace(/ee/g, 'i').replace(/ii/g, 'i')
    .replace(/oo/g, 'u').replace(/uu/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/[nm](?=[bcdgjklpqrstvy])/g, 'n') // anusvara: samskriti = sanskriti
    .replace(/(.)\1+/g, '$1');    // doubles: mittra = mitra, buddhi = budi

  // final schwa: shabd = shabda, samay = samaya
  if (s.length > 2 && s.endsWith('a')) s = s.slice(0, -1);
  return s;
}

// ---------- Devanagari side ----------

const VOWELS = { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ॠ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e', 'ऌ': 'li' };
const MATRAS = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'ॄ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e', 'ॢ': 'li' };
const CONSONANTS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh',
  'ज': 'j', 'झ': 'jh', 'ञ': 'n', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't',
  'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h' };
// consonant + nukta (after NFD the nukta is a separate mark)
const NUKTA = { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'd', 'ढ': 'dh', 'फ': 'f', 'य': 'y' };
const VIRAMA = '्', NUKTA_SIGN = '़', ANUSVARA = 'ं', CHANDRABINDU = 'ँ', VISARGA = 'ः';

/** Clean Devanagari for direct comparison: nukta, chandrabindu and half-nasals are written
 *  inconsistently by users (जमीन/ज़मीन, शान्ति/शांति, माँ/मां), so fold them. */
export function normalizeDevanagari(input) {
  return (input || '')
    .normalize('NFD')
    .replace(/[​-‍\s]/g, '')
    .replace(new RegExp(NUKTA_SIGN, 'g'), '')
    .replace(new RegExp(CHANDRABINDU, 'g'), ANUSVARA)
    .replace(/[ङञणनम]्(?=[क-ह])/g, ANUSVARA)
    .replace(/[।॥?!.,]/g, '')
    .normalize('NFC');
}

/** Devanagari -> rough Hindi pronunciation in Roman, with Hindi schwa deletion,
 *  then the same normalizeRoman() key. समय -> samay, पढ़ना -> padhna, ज्ञान -> gyaan. */
export function devanagariToKey(input) {
  const s = (input || '').normalize('NFD').replace(/[​-‍]/g, '');
  const ak = []; // aksharas: { c: consonant, v: vowel, inherent, nasal }
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = ak[ak.length - 1];
    if (ch === 'ज' && s[i + 1] === VIRAMA && s[i + 2] === 'ञ') { // ज्ञ = gy
      ak.push({ c: 'gy', v: 'a', inherent: true, nasal: false }); i += 2; continue;
    }
    if (CONSONANTS[ch]) {
      let c = CONSONANTS[ch];
      if (s[i + 1] === NUKTA_SIGN) { c = NUKTA[ch] || c; i++; }
      ak.push({ c, v: 'a', inherent: true, nasal: false });
    } else if (MATRAS[ch] && prev) {
      prev.v = MATRAS[ch]; prev.inherent = false;
    } else if (ch === VIRAMA && prev) {
      prev.v = ''; prev.inherent = false;
    } else if (VOWELS[ch]) {
      ak.push({ c: '', v: VOWELS[ch], inherent: false, nasal: false });
    } else if ((ch === ANUSVARA || ch === CHANDRABINDU) && prev) {
      prev.nasal = true;
    } else if (ch === VISARGA && prev) {
      prev.v += 'h';
    }
  }
  // Hindi schwa deletion, right to left: final inherent 'a' goes (शब्द -> shabd),
  // and a medial one goes in V C_ C V (पढ़ना -> padhna, लिखना -> likhna, but समय stays samay).
  const n = ak.length;
  if (n > 1 && ak[n - 1].inherent && !ak[n - 1].nasal) ak[n - 1].v = '';
  for (let i = n - 2; i >= 1; i--) {
    const a = ak[i], before = ak[i - 1], after = ak[i + 1];
    if (a.inherent && !a.nasal && before.v && after.c && after.v) a.v = '';
  }
  const roman = ak.map(a => a.c + a.v + (a.nasal ? 'n' : '')).join('');
  return normalizeRoman(roman);
}

/** One entry point for any query string. */
export function toKey(text) {
  return DEVANAGARI.test(text) ? devanagariToKey(text) : normalizeRoman(text);
}

// ---------- typo tolerance ----------

/** Optimal string alignment distance (Levenshtein + adjacent swaps), with early exit. */
export function editDistance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

// Typo budget is based on what the user typed, not the shortened key: "bhsha" is 5 letters
// typed but only "bs" as a key. Short queries get none, or "kal" would match everything.
function allowedTypos(len) { return len <= 3 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : 3; }

// ---------- index ----------

export function createIndex(entries) {
  const docs = entries.map(e => {
    const keys = new Set([devanagariToKey(e.headword), normalizeRoman(e.transliteration),
      ...e.romanised.map(normalizeRoman)].filter(Boolean));
    const words = new Set();
    for (const m of e.meanings) for (const w of m.toLowerCase().split(/[^a-z]+/)) if (w) words.add(w);
    return { entry: e, deva: normalizeDevanagari(e.headword),
      romanised: e.romanised.map(r => r.toLowerCase()), keys: [...keys], words: [...words],
      meaningsLower: e.meanings.map(m => m.toLowerCase()) };
  });
  const byId = new Map(entries.map(e => [e.id, e]));

  function scoreDoc(doc, q) {
    let best = { score: 0, how: null };
    const take = (score, how) => { if (score > best.score) best = { score, how }; };

    if (q.isDeva) {
      if (doc.deva === q.deva) take(100, 'exact');
      else if (doc.deva.startsWith(q.deva)) take(80 - (doc.deva.length - q.deva.length), 'prefix');
    } else {
      if (doc.romanised.includes(q.raw)) take(97, 'exact');
      // literal prefix of a listed spelling beats a phonetic one: "sh" -> शिक्षा before सेवा
      else if (doc.romanised.some(r => r.startsWith(q.raw))) take(74, 'prefix');
      if (doc.meaningsLower.includes(q.raw)) take(75, 'meaning');
      else if (q.raw.length >= 3 && doc.words.includes(q.raw)) take(72, 'meaning');
      else if (q.raw.length >= 3 && doc.words.some(w => w.startsWith(q.raw))) take(45, 'meaning');
    }
    if (!q.key) return best;
    const maxTypos = allowedTypos(q.isDeva ? q.key.length : q.raw.replace(/[^a-z]/g, '').length);
    for (const k of doc.keys) {
      if (k === q.key) { take(95, 'spelling'); continue; }
      if (k.startsWith(q.key) && (q.key.length >= 2 || q.raw.length >= 2)) take(70 - Math.min(10, k.length - q.key.length), 'prefix');
      if (maxTypos) {
        const d = editDistance(q.key, k, maxTypos);
        if (d <= maxTypos) take(60 - d * 8, 'typo');
      }
    }
    return best;
  }

  function prepare(query) {
    const raw = (query || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const isDeva = DEVANAGARI.test(raw);
    return { raw, isDeva, deva: isDeva ? normalizeDevanagari(raw) : '', key: toKey(raw) };
  }

  /** Ranked results: [{ entry, score, how }] where how is
   *  exact | spelling | prefix | typo | meaning. */
  function search(query, { limit = 20 } = {}) {
    const q = prepare(query);
    if (!q.raw) return [];
    const ranked = docs.map(doc => ({ entry: doc.entry, ...scoreDoc(doc, q) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.id - b.entry.id);
    // If the user clearly found their word, typo guesses are noise ("shaanti" should not list सत्य).
    const confident = ranked.length && ranked[0].score >= 90;
    return (confident ? ranked.filter(r => r.how !== 'typo') : ranked).slice(0, limit);
  }

  /** For the no-results screen: the closest headwords even beyond the typo limit. */
  function suggest(query, { limit = 3 } = {}) {
    const key = toKey((query || '').trim());
    if (!key) return [];
    const cap = Math.max(1, Math.round(key.length / 3));
    return docs.map(doc => ({ entry: doc.entry,
      d: Math.min(...doc.keys.map(k => editDistance(key, k, cap))) }))
      .filter(r => r.d <= cap)
      .sort((a, b) => a.d - b.d || a.entry.id - b.entry.id)
      .slice(0, limit).map(r => r.entry);
  }

  return { search, suggest, get: id => byId.get(Number(id)), entries };
}
