# Quick Move — community listing

Paste these into community.obsidian.md. Search (in the app and on the website)
only looks at the **name + short description**, so the short description is
written for search; About is written to convince.

## Short description (≤200, 182 chars)

Move the current note to a folder in one click: a button in the note header opens a menu of your favorite preset folders, in your order, with aliases. Updates links. Works on mobile.

Why this wording (checked against the 2026-10 registry, app-search rules: every
word must appear as a substring, results sorted by downloads):

- Matches 14 of 24 test queries, e.g. "move note to folder", "quick move",
  "note folder menu".
- For 8 of them fewer than 5 plugins match, so a new plugin can still show up
  in the top 5: "favorite folders", "preset folders", "move button",
  "header button", "move mobile", "move note mobile", "move current note",
  "one click move".
- "or file" was left out on purpose: the button only appears on Markdown notes.

## About (≤1000, 955 chars, plain text)

The backend field is plain text: Markdown list markers and emphasis are not rendered,
so this is written as short paragraphs. Paste everything between the lines.

---

Most notes end up in the same few folders, yet moving one still takes a right-click, "Move file to…", and typing the folder name.

Quick Move adds a "Move to…" button to the note header, right next to the reading-view button. It opens a menu of your own folders, in the order you set, with optional short aliases. One click and the note is moved.

The folder the note is already in is shown checked and greyed out. "Other folder…" at the bottom searches every folder in the vault for one-off moves, and works even if the core Files plugin is turned off.

Moves go through Obsidian's own rename, so links to the note are updated. If a note with the same name is already in the target folder, the moved note becomes name-1 instead of overwriting anything. Renaming a folder updates your preset list.

The same button works on phones and tablets, where the menu opens as a bottom sheet. The interface is in English and Chinese, following Obsidian's language.

---

## Icon

`folder-input` (the same icon as the button), any color.

## Categories

1. Files (primary)
2. Interface

## Screenshots

- Desktop slot: `desktop-1200x800.png` (from `../hero.svg`)
- Mobile slot: `phone-900x1600.png` (from `phone.svg`)
