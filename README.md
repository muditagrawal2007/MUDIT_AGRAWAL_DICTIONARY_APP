# शब्दकोश — Hindi dictionary prototype (Garuda Prakashan, Track 3)

A small, mobile-first Hindi–English dictionary of 54 words. You can search in **Devanagari or Roman letters, typed any way you say the word**: `shanti`, `shaanti`, `santi`, `शांति` and `शान्ति` all open the same entry. It works offline after the first visit.

- **Live demo:** _add your GitHub Pages link here_
- **Demo video:** _add your Loom link here_

## How to run

There's no build step and nothing to install.

```bash
git clone <this repo> && cd garuda-dictionary
python3 -m http.server 8080      # or: npx serve .
# open http://localhost:8080 (on a phone: http://<your-laptop-ip>:8080)
```

It must be served over HTTP. Opening `index.html` as a file blocks the data from loading.

Run the tests (Node 18+):

```bash
npm test        # = node --test tests/*.test.mjs
```

To deploy, use GitHub Pages: Settings → Pages → Branch `main`, folder `/ (root)`. All paths are relative, so it works under `/<repo-name>/`.

## Files

| File | What it is |
|---|---|
| `data/dictionary.json` | 54 entries in the brief's format (10 given + 44 added) |
| `search.js` | The search engine. It has no DOM and no dependencies, so it runs in the browser and in Node |
| `app.js`, `index.html`, `styles.css` | The app screens: search, results, entry, no-results, bookmarks, recents |
| `sw.js`, `manifest.webmanifest` | Offline support (service worker) and "Add to home screen" |
| `tests/search.test.mjs` | Tests with real Hindi spellings |
| `AI_LOG.md` | How AI was used and what was checked or corrected |

## How search works

The brief says people will mostly type in Roman, and the data only has a few spelling variants per word. The romanised list can never hold every spelling, so the app doesn't rely on it. Instead:

1. **Every spelling becomes one "sound key".** `normalizeRoman()` folds differences that Hindi speakers don't hear as different:
   - `sh/s` (shanti = santi)
   - `aa/a`, `ee/i`, `oo/u`
   - `w/v` (vishwas = vishvas)
   - `z/j` (zameen = jameen)
   - `jn/gy` (jnana = gyan)
   - dropped `h` after consonants (dharm = darm)
   - double letters (mittra = mitra)
   - `m/n` before a consonant (samskriti = sanskriti)
   - a final `a` (shabd = shabda)
2. **The headword itself is also turned into a key.** `devanagariToKey()` reads the Devanagari and applies **Hindi schwa deletion**: समय → *samay*, पढ़ना → *padhna*, लिखना → *likhna*, not *samaya*, *padhana*, *likhana*. A user can type a spelling that is in no list (`swatantrataa`, `prithwi`, `pariwaar`) and still get the right word. This is tested.
3. **Devanagari input is cleaned first.** `normalizeDevanagari()` treats nukta (ज़मीन = जमीन), chandrabindu (माँ = मां) and half-nasals (शान्ति = शांति) as the same, since people type these both ways.
4. **Ranking:**
   - exact match
   - same sound key
   - prefix (results show while typing; `sh` shows श words first)
   - typo match (edit distance; the allowance grows with what was typed, so `kal` doesn't match everything)
   - English meaning (`peace` → शांति)

   Typo guesses are hidden when there's already a confident match.
5. **No results:** the app says so clearly, offers "Did you mean" words (e.g. `krm` → कर्म), and gives tips. It never shows a blank screen.

## Built for Garuda's use: easy to plug into other apps

The brief asks how the dictionary can fit into other apps, AI tools and platforms. This prototype keeps that path open:

- **Deep links:** `…/#/word/11` opens an entry and `…/?q=dharm` runs a search. A WhatsApp bot, a book's e-reader or a chatbot answer can link straight to a word.
- **`search.js` is a plain ES module.** Any JS platform (Node server, browser extension, React Native) can import it and get the same results as the app.
- **The data is one JSON file** in the brief's schema, so it can be served as a static API as it is.

## Trade-offs I made

- **Plain HTML/JS, no framework.** The app is under 30 KB, loads quickly on slow phones, needs no build and is easy to read. The cost: if it grows into many screens, a framework would be better.
- **Loose sound keys mean some false matches.** For example, माता (*mata*) and a future मत (*mat*) would share a key. With exact-match ranking first this is fine for 54 words, but not for 50,000 (see below).
- **Search scans every entry on each keystroke.** That takes well under a millisecond for 54 words, but would need an index for a full dictionary.
- **Fixed data, not an LLM.** Some apps (e.g. HinDict) create meanings with an LLM at search time. For a publisher, wrong meanings are the main risk, so every entry here is fixed, checked data. The cost is that words outside the list return nothing.
- **Bookmarks and recents are saved on the device only** (localStorage). There are no accounts and no syncing.
- **Web app, not an APK.** It installs to the home screen and works offline, which covers most of what an APK would give for this scope.

## What I'd build with 2 more weeks

1. **Scale the search:** a prebuilt key → id index (or a trie for prefixes), and frequency-based ranking so common words win ties.
2. **A spelling log:** record the Roman spellings that returned no result (anonymously). That list shows which variants real users type and feeds them back into the data.
3. **An embeddable widget and a small HTTP API** (`/api/search?q=`) so partner sites and AI assistants can call the dictionary directly.
4. **Audio pronunciation** and more fields: synonyms, related words, Sanskrit origin.
5. **A review tool for editors** to check and approve new entries before they go live.
6. **A Devanagari keyboard helper** (type Roman, see Devanagari suggestions) for users who want to learn the script.

## Search examples to try (also in the demo)

| Type | Finds | Why |
|---|---|---|
| `dharm`, `dharma`, `धर्म` | धर्म | brief's example |
| `shaanti`, `santi`, `शान्ति` | शांति | vowel length, sh/s, half-nasal in Devanagari |
| `jnana`, `gyaan` | ज्ञान | ज्ञ is typed two ways |
| `jamin`, `जमीन` | ज़मीन | nukta dropped |
| `swatantrataa` | स्वतंत्रता | not in the list; works from the headword |
| `shiksah`, `prakesh` | शिक्षा, प्रकाश | typos |
| `peace`, `water` | शांति, जल | English meaning |
| `krm` | no result → "Did you mean कर्म" | clear no-results state |
