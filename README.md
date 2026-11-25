# It Takes Two – עברית

A fan translation of **It Takes Two** (Hazelight / EA, Unreal Engine 4.26) into Hebrew, for the
[Tirgumim launcher](https://github.com/NamiSwan222/tirgumim). Unofficial; not affiliated with
Hazelight or EA.

- **Hebrew only when started from the launcher** ("שחק בעברית"). Started from Steam, the game
  is the original.
- Everything the game shows as text: menus, settings, HUD prompts, hints, minigames, and every
  subtitle. Voices stay English.
- Right-to-left works natively: Unreal 4.26 lays out Hebrew right-to-left itself. A font with
  Hebrew glyphs replaces the game's Latin UI fonts.

## How it works

The game reads all its text from `.locres` tables inside its `.pak` files. This pack adds one
file, `Nuts/Content/Paks/zzz_Tirgumim_Hebrew_P.pak`, which holds:

- the game's English text tables (`Nuts.locres`, `Nuts_Sage.locres`), with every line in Hebrew;
- the Latin UI fonts (Poppins, Mark, Roboto) replaced by a Hebrew + Latin font from `fonts/`.

The `_P` suffix makes Unreal mount it above the game's own paks.

Unreal 4.26 shipping builds have no launch argument to load an extra pak folder. So the pack
uses the launcher's **swap** mode:
1. The launcher keeps the pak in `.tirgumim/he/` and moves it into `Nuts/Content/Paks/` only for
   a Hebrew session.
2. It starts the game through Steam with `-culture=en`, so the English slot (now Hebrew) is the
   one used, whatever language the game is set to.
3. When the game exits, it takes the pak out again.

No game file is ever replaced, and save files are never touched.

**Co-op:** the online partner, including on Friend's Pass, doesn't need this pack. Text and
fonts are loaded on each PC from its own install, so the partner sees their own language.
Split-screen runs on one PC, so both halves are Hebrew.

## Repo layout

| path | what |
|---|---|
| `translation/*.json` | **the translation** `{ "<table>": { "<namespace>": { "<key>": "עברית" } } }` |
| `glossary.md` | names, chapters, terms, style rules (gender, tokens, spacing) |
| `fonts/` | the Hebrew font(s), its licence, and `fonts.json` (game font face → our TTF) |
| `tools/` | `pak.js` (UE 4.26 pak v11 reader/writer, Zlib, no decryption), `locres.js`, `coverage.js`, `check-batch.js`, `rtl.js` |
| `build.js` | export / coverage / pak build from your own install |
| `pack/` | `pack.config.json` (for the launcher's `make-pack`), `catalog-entry.json` |

Nothing from the game is in this repo. The English text and the pak are built on your PC from
your own install, into `work/`, which isn't committed.

## Build

```
node build.js export     # English text -> work/strings-en.json, untranslated -> work/todo/batch-NNN.json
node build.js coverage   # lists every untranslated string / broken {token}; exit 1 if not 100%
node build.js pak        # -> work/files/Nuts/Content/Paks/zzz_Tirgumim_Hebrew_P.pak (refuses below 100%)
node tools/check-batch.js work/todo/batch-007.json translation/batch-007.json   # check one translated batch
node --test test.js
```

`--game-dir "<folder>"` if the game isn't found automatically (Steam libraries are searched).
Then, in the launcher repo:

```
npm run make-pack -- <this repo>/pack/pack.config.json --game-dir "<clean install>" --out out/it-takes-two-he-<ver>.zip
```

## Coverage

Coverage counts every string in the game's two text tables, `Nuts` and `Nuts_Sage`: 8,687
strings, including all cutscene and in-game subtitles (`CS_*`, `VO_*`). Strings with no letters
(`{0}`, `%`) count as done.

**Not covered:**
- Unreal's own `Engine.locres` (editor and engine messages, almost never shown);
- text painted into textures or videos.

## Game version

Made for the Steam build 26237470. The pack checks the game's exe. After a game update, rebuild:
existing Hebrew is kept by key, and `coverage` lists new or changed lines.

## Credits

- Translation and glossary: Tirgumim (own work).
- Font: see `fonts/` and its licence.
- Pak and locres tools: own code.
