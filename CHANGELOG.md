# Changelog

## 0.1.1

Cleans up everything the community review flagged. No change in how moving works.

- **Settings show up in Obsidian's settings search** (Obsidian 1.13+). The folder
  list now uses Obsidian's own list layout, with its built-in **+** and delete
  buttons; the up/down arrows for ordering are unchanged. Older Obsidian
  versions keep the previous settings page.
- **Language detection** uses Obsidian's `getLanguage()` instead of reading
  local storage. Because of this the minimum Obsidian version is now **1.8.7**.
- The folder list for "Other folder…" and the path autocomplete now asks the
  vault for folders only, instead of going through every file.
- Code-quality fixes from the review: no untyped `any`, every promise is
  handled, timers use `window.setTimeout` so they behave in pop-out windows.

## 0.1.0

First release: a "Move to…" button in the note header that moves the note to
one of your preset folders.
