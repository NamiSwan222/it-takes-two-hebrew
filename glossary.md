# It Takes Two – Hebrew glossary and style guide

Our own work. Use these terms everywhere so the translation stays consistent. Add new terms
here before using them in `he.json`.

## Style

- **Register:** everyday spoken Hebrew, warm and funny, not formal. The game is a comedy.
- **Gender:** May is female (נקבה) and Cody is male (זכר). Dialogue follows the speaker and the
  person addressed.
- **Prompts that can target either player** (HUD hints, menus): use a gender-neutral form.
  Prefer the infinitive (`ללחוץ על {0} כדי לקפוץ`) or a noun phrase (`קפיצה`). Avoid a
  masculine-only imperative.
- **Keep every format token exactly:** `{0}`, `{Name}`, `<RichTag>…</>`, `\n`, button-glyph tags.
  Never translate or reorder what is inside them.
- **Text direction:** write normal (logical) Hebrew. Never reverse it by hand; the build
  handles direction (`--reverse` only if the game shows it backwards).
- **Length:** UI buttons are small. Keep menu items about as long as the English.
- **Numbers, units, brand names** (EA, Hazelight, PlayStation, Xbox, Steam) stay as they are.
- **Punctuation:** Hebrew quotation marks `"…"`; gershayim in abbreviations (`ד"ר`).

## Who is speaking (for verb gender)

Most dialogue keys don't name the speaker. Work it out from the namespace or key (`..._Cody`,
`..._May`, `..._Cutie`, `..._MoonBaboon`), from the line order (`Line_1`, `Line_2`…) and from
content. May, Rose, Cutie and the Wasp Queen are female. Cody, Dr. Hakim, Moon Baboon and the
Squirrel Chief are male. When it's truly unclear, use a form that works for both.

- Keep the leading `- ` of subtitle lines (it marks a new speaker) and every `\n`.
- Keep leading/trailing spaces exactly (`"    Boost    "` → `"    האצה    "`).
- Lines tagged `(DEV)` are developer menus: translate them anyway, short and plain.
- Swearing and jokes: keep the tone and translate the joke, not the words.

## Characters

| English | Hebrew |
|---|---|
| May | מיי |
| Cody | קודי |
| Rose | רוז |
| Dr. Hakim | ד"ר חכים |
| Book of Love | ספר האהבה |
| Cutie (the elephant) | קיוטי |
| Moon Baboon | בבון הירח |
| the Queen (of the wasps) | המלכה |
| Toolbox | ארגז הכלים |

## Chapters

| English | Hebrew |
|---|---|
| The Shed | המחסן |
| The Tree | העץ |
| Rose's Room | החדר של רוז |
| Cuckoo Clock | שעון הקוקייה |
| Snow Globe | כדור השלג |
| Garden | הגינה |
| The Attic | עליית הגג |

## Menus and system

| English | Hebrew |
|---|---|
| Continue | המשך |
| New Game | משחק חדש |
| Chapter Select | בחירת פרק |
| Chapter | פרק |
| Checkpoint | נקודת שמירה |
| Local Play | משחק מקומי |
| Online Play | משחק מקוון |
| Friend's Pass | כרטיס חבר |
| Invite Friend | הזמנת חבר |
| Options / Settings | אפשרויות / הגדרות |
| Controls | שליטה |
| Subtitles | כתוביות |
| Minigame | מיני-משחק |
| Player 1 / Player 2 | שחקן/ית 1 / שחקן/ית 2 |
| Restart from checkpoint | התחלה מחדש מנקודת השמירה |
| Quit to main menu | יציאה לתפריט הראשי |
| Loading | טוען… |
| Paused | מושהה |
| Achievement / Trophy | הישג |
| Credits | קרדיטים |

## Gameplay words

| English | Hebrew |
|---|---|
| Jump / Double jump | קפיצה / קפיצה כפולה |
| Dash | זינוק |
| Ground pound | הטחה לקרקע |
| Grapple | הצמדה בחבל |
| Swing | התנדנדות |
| Aim / Shoot | כיוון / ירי |
| Interact | פעולה |
| Revive | החייאה |
| Hammer / Nail(s) | פטיש / מסמר(ים) |
| Wasp(s) | צרעה / צרעות |
| Squirrel(s) | סנאי / סנאים |
| Sap / Match | שרף / גפרור |

## More names and terms (used in the translation)

| English | Hebrew |
|---|---|
| Joy (Cody's flower) | ג'וי |
| Miss Q | מיס קיו |
| Squirrel Chief | ראש שבט הסנאים |
| Wasp Queen | מלכת הצרעות |
| Hammer / Hammerhead (speaker) | פטיש |
| Sprout Man / Cactus Man | איש הנבט / איש הקקטוס |
| Clay Man / clay | איש החֵמר / חימר |
| Clock Town | עיר השעונים |
| snowglobers | תושבי כדור השלג |
| Book of Truth | ספר האמת |
| Clone / Teleport (May's power) | שיבוט / טלפורט |
| Fuse | נתיך |
| Vacuum (Tower Vacuum) | שואב האבק |
| nectar / hive / larvae | צוף / כוורת / זחלים |
| letter piece | חלק מכתב |
| relationship | זוגיות |
| Online Lobby / Online Co-Op | לובי מקוון / שיתופי מקוון |
| EA Friends List | רשימת החברים ב-EA |

- Subtitle captions: `CC:` / `NO_CC:` stay Latin (game markers); speaker tags inside `[ ]` are
  translated (`[קודי]`, `[מיי]`); sound descriptions are present tense in parentheses
  (`(מיי נאנחת)`).
- Keyboard key names printed on keys (Enter, Tab, Backspace) stay Latin.
- Dr. Hakim's Spanish exclamations stay Spanish or are transliterated (`¡Hola!`, `אסטה לה ויסטה`).
