// app.js — UI only. All search logic lives in search.js so other apps can reuse it.
import { createIndex } from './search.js';

const $ = sel => document.querySelector(sel);
const view = $('#view'), input = $('#q'), clearBtn = $('#clear');
let index;

// ---------- small storage helper (localStorage can throw in private mode) ----------
const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ } },
};
const RECENT = 'garuda.recent', SAVED = 'garuda.bookmarks';
function addRecent(id) {
  store.set(RECENT, [id, ...store.get(RECENT).filter(x => x !== id)].slice(0, 8));
}
function isSaved(id) { return store.get(SAVED).includes(id); }
function toggleSaved(id) {
  const list = store.get(SAVED);
  store.set(SAVED, list.includes(id) ? list.filter(x => x !== id) : [id, ...list]);
  return isSaved(id);
}

// ---------- rendering helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TAGS = { typo: 'close match', meaning: 'English' };

function row(entry, how) {
  const tag = TAGS[how] ? `<span class="tag">${TAGS[how]}</span>` : `<span class="tag">${esc(entry.pos.split(' ')[0])}</span>`;
  return `<li><a class="row" href="#/word/${entry.id}">
    <span><span class="hw" lang="hi">${esc(entry.headword)}</span><span class="tr">${esc(entry.transliteration)}</span></span>
    ${tag}
    <span class="gloss">${esc(entry.meanings.join('; '))}</span>
  </a></li>`;
}
const chip = e => `<a class="chip" href="#/word/${e.id}"><span class="deva" lang="hi">${esc(e.headword)}</span> · ${esc(e.romanised[0])}</a>`;

function renderHome() {
  const recent = store.get(RECENT).map(index.get).filter(Boolean);
  const saved = store.get(SAVED).map(index.get).filter(Boolean);
  view.innerHTML = `
    ${saved.length ? `<h2 class="section">Bookmarks</h2><div class="chips">${saved.map(chip).join('')}</div>` : ''}
    ${recent.length ? `<h2 class="section">Recently looked up
        <button class="link-btn" id="clear-recent" type="button">clear</button></h2>
      <div class="chips">${recent.map(chip).join('')}</div>` : ''}
    <h2 class="section">All ${index.entries.length} words</h2>
    <ul class="list">${[...index.entries].sort((a, b) => a.headword.localeCompare(b.headword, 'hi'))
      .map(e => row(e)).join('')}</ul>`;
  $('#clear-recent')?.addEventListener('click', () => { store.set(RECENT, []); renderHome(); });
}

function renderResults(q) {
  const results = index.search(q);
  if (!results.length) return renderEmpty(q);
  const note = results[0].how === 'typo'
    ? `<h2 class="section">No exact match — closest words</h2>`
    : `<h2 class="section">${results.length} result${results.length > 1 ? 's' : ''}</h2>`;
  view.innerHTML = `${note}<ul class="list">${results.map(r => row(r.entry, r.how)).join('')}</ul>`;
}

function renderEmpty(q) {
  const near = index.suggest(q);
  view.innerHTML = `<div class="empty">
    <p class="big">No word found for “<span class="q">${esc(q)}</span>”</p>
    ${near.length ? `<p>Did you mean:</p><div class="chips">${near.map(chip).join('')}</div>` : ''}
    <ul>
      <li>Type it the way it sounds: <em>shanti</em>, <em>santi</em> and <em lang="hi">शांति</em> all work.</li>
      <li>Try the English meaning, like <em>peace</em> or <em>book</em>.</li>
      <li>This prototype has ${index.entries.length} words, so the word may not be added yet.</li>
    </ul>
  </div>`;
}

function renderEntry(id) {
  const e = index.get(id);
  if (!e) { view.innerHTML = `<div class="empty"><p class="big">This word does not exist.</p><a class="chip" href="#/">Go home</a></div>`; return; }
  addRecent(e.id);
  const back = input.value.trim() ? `#/search/${encodeURIComponent(input.value.trim())}` : '#/';
  view.innerHTML = `
    <a class="back" href="${back}">← ${input.value.trim() ? 'Back to results' : 'All words'}</a>
    <article class="entry">
      <div class="entry-head">
        <div>
          <h1 lang="hi">${esc(e.headword)}</h1>
          <p class="iast">${esc(e.transliteration)}</p>
          <span class="tag pos">${esc(e.pos)}</span>
        </div>
        <button class="bookmark" type="button" aria-pressed="${isSaved(e.id)}" aria-label="Bookmark ${esc(e.romanised[0])}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>
        </button>
      </div>
      <dl>
        <div><dt>Meanings</dt><dd><ol>${e.meanings.map(m => `<li>${esc(m)}</li>`).join('')}</ol></dd></div>
        <div><dt>Example</dt><dd class="example" lang="hi">${esc(e.example)}</dd></div>
        <div><dt>Also spelled</dt><dd class="chips">${e.romanised.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</dd></div>
      </dl>
      <div class="actions">
        <button class="chip" id="share" type="button">Share link</button>
      </div>
    </article>`;
  const bm = view.querySelector('.bookmark');
  bm.addEventListener('click', () => {
    const on = toggleSaved(e.id);
    bm.setAttribute('aria-pressed', on);
    toast(on ? 'Bookmarked' : 'Bookmark removed');
  });
  $('#share').addEventListener('click', async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${e.headword} — ${e.meanings[0]}`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied'); }
    } catch { /* user cancelled */ }
  });
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg, role: 'status' });
  document.body.append(t); setTimeout(() => t.remove(), 1600);
}

// ---------- routing: #/  #/search/<q>  #/word/<id> ----------
// Links like #/search/dharma or #/word/11 can be opened from any other app or chat.
function route() {
  const [, kind, arg] = location.hash.match(/^#\/(search|word)\/(.+)$/) || [];
  if (kind === 'word') return renderEntry(arg);
  if (kind === 'search') {
    const q = decodeURIComponent(arg);
    if (input.value !== q) input.value = q;
    clearBtn.hidden = !q;
    return renderResults(q);
  }
  // also accept ?q=... so a plain search form or bot can link in
  const qp = new URLSearchParams(location.search).get('q');
  if (qp && !location.hash) { history.replaceState(null, '', `#/search/${encodeURIComponent(qp)}`); return route(); }
  input.value = ''; clearBtn.hidden = true;
  renderHome();
}

let timer;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const q = input.value.trim();
    clearBtn.hidden = !q;
    // replaceState: typing should not fill the back button with every letter
    history.replaceState(null, '', q ? `#/search/${encodeURIComponent(q)}` : '#/');
    q ? renderResults(q) : renderHome();
  }, 60);
});
input.addEventListener('keydown', ev => {
  if (ev.key === 'Enter') {
    const first = view.querySelector('a.row');
    if (first) { input.blur(); location.hash = first.getAttribute('href'); }
  }
});
clearBtn.addEventListener('click', () => { location.hash = '#/'; input.focus(); });
window.addEventListener('hashchange', route);

const showOffline = () => { $('#offline').hidden = navigator.onLine; };
window.addEventListener('online', showOffline);
window.addEventListener('offline', showOffline);

async function start() {
  try {
    const data = await (await fetch('data/dictionary.json')).json();
    index = createIndex(data);
    $('#count').textContent = data.length;
    showOffline();
    route();
  } catch (err) {
    view.innerHTML = `<div class="empty"><p class="big">Could not load the dictionary.</p>
      <p>Open this app through a web server (see README), not as a file.</p></div>`;
    console.error(err);
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
