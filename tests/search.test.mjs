// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIndex, normalizeRoman, devanagariToKey, normalizeDevanagari } from '../search.js';

const data = JSON.parse(readFileSync(new URL('../data/dictionary.json', import.meta.url), 'utf8'));
const idx = createIndex(data);
const top = q => idx.search(q)[0]?.entry.headword;

test('romanised variants collapse to one key', () => {
  for (const group of [
    ['shanti', 'shaanti', 'santi', 'śānti'],
    ['shabd', 'shabda', 'sabd', 'śabda'],
    ['samay', 'samaya'],
    ['vishwas', 'vishvas', 'viswas'],
    ['gyan', 'gyaan', 'jnana', 'jñāna'],
    ['zameen', 'jameen', 'zamin'],
    ['sanskriti', 'samskriti', 'saṃskṛti'],
  ]) {
    const keys = new Set(group.map(normalizeRoman));
    assert.equal(keys.size, 1, `${group.join(', ')} -> ${[...keys].join(' | ')}`);
  }
});

test('Devanagari gives the same key as common Roman spelling (schwa deletion)', () => {
  const pairs = [['शब्द', 'shabd'], ['समय', 'samay'], ['कर्म', 'karm'], ['शांति', 'shanti'],
    ['शान्ति', 'shanti'], ['प्रकाश', 'prakash'], ['सत्य', 'satya'], ['पढ़ना', 'padhna'],
    ['लिखना', 'likhna'], ['ज्ञान', 'gyan'], ['ऋषि', 'rishi'], ['ज़मीन', 'zameen'],
    ['आनंद', 'anand'], ['परिवार', 'parivar'], ['हृदय', 'hriday'], ['स्वतंत्रता', 'swatantrata'],
    ['नगर', 'nagar'], ['विश्वास', 'vishwas'], ['संस्कृति', 'sanskriti'], ['उत्सव', 'utsav']];
  for (const [deva, roman] of pairs) {
    assert.equal(devanagariToKey(deva), normalizeRoman(roman), `${deva} vs ${roman}`);
  }
});

test('Devanagari spelling variants fold together', () => {
  assert.equal(normalizeDevanagari('शान्ति'), normalizeDevanagari('शांति'));
  assert.equal(normalizeDevanagari('ज़मीन'), normalizeDevanagari('जमीन'));
  assert.equal(normalizeDevanagari('माँ'), normalizeDevanagari('मां'));
});

test('must-have: Devanagari and romanised input return the same entry', () => {
  for (const [deva, ...romans] of [
    ['शिक्षा', 'shiksha', 'siksha', 'shiksa', 'shikshaa'],
    ['शब्द', 'shabd', 'shabda', 'sabd', 'shabdh'],
    ['शांति', 'shanti', 'shaanti', 'santi', 'shantee'],
    ['वृक्ष', 'vriksh', 'vriksha', 'vruksh', 'vrksha'],
    ['प्रकाश', 'prakash', 'parkash'],
  ]) {
    assert.equal(top(deva), deva);
    for (const r of romans) assert.equal(top(r), deva, `"${r}" should find ${deva}`);
  }
});

test('Devanagari written another way still finds the entry', () => {
  assert.equal(top('शान्ति'), 'शांति');
  assert.equal(top('शिक्षा '), 'शिक्षा');
});

test('typo tolerance', () => {
  assert.equal(top('shiksah'), 'शिक्षा');
  assert.equal(top('bhsha'), 'भाषा');
  assert.equal(top('prakesh'), 'प्रकाश');
});

test('prefix works while typing', () => {
  assert.equal(top('shik'), 'शिक्षा');
  assert.equal(top('प्रका'), 'प्रकाश');
});

test('English meaning lookup', () => {
  assert.equal(top('peace'), 'शांति');
  assert.equal(top('tree'), 'वृक्ष');
});

test('no results for nonsense, short noise stays strict', () => {
  assert.deepEqual(idx.search('xyzqw'), []);
  assert.deepEqual(idx.search(''), []);
  assert.deepEqual(idx.search('   '), []);
});

test('data: every headword and listed spelling finds its own entry first', () => {
  const misses = [];
  for (const e of data) {
    for (const q of [e.headword, e.transliteration, ...e.romanised]) {
      if (idx.search(q)[0]?.entry.id !== e.id) misses.push(`${q} -> ${top(q)} (want ${e.headword})`);
    }
  }
  assert.deepEqual(misses, []);
});

test('data: required fields present and at least 50 entries', () => {
  assert.ok(data.length >= 50);
  for (const e of data) {
    for (const f of ['id', 'headword', 'transliteration', 'romanised', 'pos', 'meanings', 'example']) {
      assert.ok(e[f] && (!Array.isArray(e[f]) || e[f].length), `entry ${e.id} missing ${f}`);
    }
  }
});

test('spellings NOT in the romanised list still work (brief: do not rely only on the list)', () => {
  for (const [q, want] of [['dharmaa', 'धर्म'], ['gyaana', 'ज्ञान'], ['rishii', 'ऋषि'],
    ['sanskritee', 'संस्कृति'], ['swatantrataa', 'स्वतंत्रता'], ['vishvaas', 'विश्वास'],
    ['prithwi', 'पृथ्वी'], ['parivaar', 'परिवार'], ['jamin', 'ज़मीन'], ['जमीन', 'ज़मीन'],
    ['pariwaar', 'परिवार'], ['chandrma', 'चंद्र'], ['utsaav', 'उत्सव'], ['likhnaa', 'लिखना']]) {
    assert.equal(top(q), want, `"${q}"`);
  }
});

test('brief example: धर्म, dharma and dharm return the same entry', () => {
  assert.equal(top('धर्म'), 'धर्म');
  assert.equal(top('dharma'), 'धर्म');
  assert.equal(top('dharm'), 'धर्म');
});
