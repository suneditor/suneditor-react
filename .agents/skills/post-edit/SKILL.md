---
name: post-edit
description: 코드 수정 후 lint, 포맷, 타입, 테스트, 빌드 검증을 실행
allowed-tools:
    - Bash
---

Validate the change without touching unrelated work. Read `git status --short` and `git diff` first.
Never stage, restore or stash to prepare validation.

- Docs or harness only (`*.md`, `.github/`, `prompts/`, `.agents/`): `npm run format:check`, then check that
  any command or file named in the text exists.
- `src/`, `test/`, `playground/` or config: `npm run check` (lint → format check → typecheck → test → build).
  Fix formatting only in the files you changed (`npx prettier --write <file>`).
- A change to how the engine is loaded or to the SSR path: also build a tarball (`npm pack`) and verify
  `next build` in a Next.js app, as described in CONTRIBUTING.md.

Report the commands actually run and anything not covered.
