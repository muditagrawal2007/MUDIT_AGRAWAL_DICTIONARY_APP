# AI log — Dictionary App (Track 3)

> **Draft — Priyanshi, please fill in every "TODO (you)" with what you really did, and delete anything that isn't true.**

## Tools used

| Tool | Used for |
|---|---|
| Claude (claude.ai, Opus 5.5) | First version of the search engine, app code, tests, README; drafts of 44 new entries |
| TODO (you) | e.g. a Hindi dictionary or Shabdkosh / Wiktionary for checking entries |

Chat link: TODO (you) — paste the share link of the Claude chat.

## Key prompts

- Shared the full Track 3 brief and the Rishihood submission rules, and asked Claude to build the app.
- Gave HinDict (hindict.anuragshenoy.com) as a reference.
- TODO (you): any follow-up prompts you gave.

## What I rejected or corrected in the AI's output, and why

Caught while building, through tests and phone-size screenshots:

1. **Typo allowance was too strict.** It was based on the shortened sound key, so `bhsha` (5 letters typed, key "bs") got no typo allowance and found nothing. Changed it to use the length of what the user typed.
2. **`sh` showed सेवा before शिक्षा**, because sh and s share a key. Added a boost for literal prefixes of listed spellings.
3. **"Did you mean" suggested random words** for nonsense input (`asdfgh` → सदा). Tightened the limit.
4. **Exact hits came with noise.** `shaanti` also listed समय and सत्य as close matches. Typo guesses are now hidden when there's a confident match.
5. **Short prefixes gave nothing** (`sh`), which is bad for a search-as-you-type screen. Fixed.
6. **Devanagari was shown in fake italics** in the no-results tips. Fixed.
7. Removed `sarl` from सरल's spellings. It's a typo, not a common spelling.
8. TODO (you): entries you changed after checking (see below).

## How I checked facts, sources and code

**Code**
- 13 automated tests (`npm test`) with real spellings. They include one test that every headword, IAST form and listed spelling finds its own entry first, and one for spellings that are *not* in the list.
- An end-to-end run in Chrome at phone size (390×844), covering: search, entry, bookmark, no-results, `?q=` link, and offline reload. No console errors; no horizontal scroll.
- TODO (you): tested on your own phone (which one?), with your Hindi keyboard.

**Data** (the 44 added entries were drafted by AI, so each one needs a human check)
- TODO (you): checked each headword spelling, IAST, gender (m./f.), meanings and example against ________.
- Entries most worth a second look:
  - अग्नि: feminine in Hindi, masculine in Sanskrit; I used Hindi (f.)
  - चंद्र: in everyday Hindi people say चाँद / चंद्रमा
  - पुस्तक: f.
  - Rarer spellings like `jatra`, `kirpa`, `chhama`, `xama`, `hirday`
