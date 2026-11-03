---
name: code-review
description: 코드 리뷰 — 버그, 로직 오류, 생명주기·SSR 문제, 프로젝트 규칙 위반 검출 (보고만 함)
---

Review the specified file(s) or the current git diff for bugs, logic errors and project-rule violations.

Target: `$ARGUMENTS` (file path, or blank for the current diff)

Steps:

1. Read `AGENTS.md` and the "Design rule" section of `CONTRIBUTING.md`. If arguments are provided, read
   those files. Otherwise inspect `git diff` and `git diff --cached`, plus relevant untracked files from
   `git status --short`. Do not alter the index.
2. For changes in `src/`, read the matching spec in `test/SunEditor.test.tsx` and check that the changed
   behavior is covered. `playground/` is a manual test app, not a review target unless named.
3. Analyze for:
    - Logic bugs (inverted conditions, null access, stale closures in engine callbacks, missing `await`)
    - Dead code (unreachable branches, unused variables, left-over refs)
    - Effect lifecycle: every effect that creates, subscribes or assigns cleans up; behavior must hold under
      React StrictMode (double effect run) and when the engine import resolves after unmount
    - SSR safety: no `window`/`document`/engine access outside effects; `renderToString` must stay clean
    - Engine contract: verify a called instance API (`editor.$.ui.*`, `editor.events`, `html.set`, ...)
      against the engine source in `node_modules/suneditor/src` instead of assuming its timing or shape
    - Project rules: a new prop that mirrors an engine option, a static `import ... from 'suneditor'` in
      `src/`, an edit to `dist/`
    - `changes.md` has an entry for user-facing changes (`prompts/changes-guide.md`)
      Trace actual callers and cleanup before reporting a violation.
4. Report findings with file path and line numbers, each with the triggering scenario and source evidence.
5. Do NOT fix anything — report only. Let the user decide what to fix.

Review guidelines — avoid false positives:

- **Null/guard checks**: If a null check already exists upstream in the call chain, do NOT flag the callee
  for lacking its own guard. Only flag a realistic unguarded path.
- **Engine behavior**: Bugs in the engine itself are out of scope here; note them as "engine issue" with the
  engine file so they can be filed at github.com/JiHong88/suneditor.
- **Intentional patterns**: If code looks intentional and consistent with surrounding patterns, do NOT report
  it as a bug. If unsure, note it as a confirmation question (e.g. "의도된 동작인지 확인: ...") rather than
  a bug.
- **Severity filtering**: Report concrete incorrect behavior, a demonstrable resource or performance
  regression, or a specific project-rule violation on the changed path. Label unmeasured cost concerns as
  such. Do not report style preferences, hypothetical future risks or "would be nice" improvements.
- **staged/unstaged diff**: Do not flag git staging state differences as findings.
