---
name: release-note
description: changes.md를 release-note.md 형식으로 변환
---

Rewrite `changes.md` into `release-note.md` following `prompts/release-note.md` exactly.

1. Read `prompts/release-note.md`.
2. Read `version` from `package.json`.
3. Read `changes.md`.
4. Rewrite every entry into one condensed sentence: no source-file references, no root cause,
   no internal identifiers. Never copy an entry through unchanged.
5. Replace the whole `release-note.md` with the new `## <version>` section only.
6. Leave `changes.md` as it is. It is emptied after the release is published, or when the user asks.

Before writing, check the draft: no ``(`path`)`` references, no item longer than one sentence,
no empty category.
