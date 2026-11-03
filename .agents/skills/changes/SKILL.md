---
name: changes
description: 사용자가 직접 코드를 수정한 뒤 changes.md에 누락된 항목을 추가
---

The user edited code by hand and wants `changes.md` updated. (When an agent edits code it updates
`changes.md` itself per `AGENTS.md`; this skill is for user-made changes.)

Follow `prompts/changes-guide.md` exactly.

1. Read `prompts/changes-guide.md`.
2. Run `git diff --staged` and `git diff`. If both are empty, run `git diff HEAD~1`.
3. Read the current `changes.md`.
4. Classify each user-facing change as `feat`, `enhance`, `fix`, `change` or `breaking`.
   Skip `style`, `docs`, `test`, `chore`, `ci`, `build` and playground-only changes.
5. Add the new entries to their group without duplicating existing ones.
6. Ask before adding when a classification is unclear.
