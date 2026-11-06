# AGENTS.md

Entry point for AI coding agents working on `@suneditor/suneditor-react`. `CLAUDE.md` is an alias of this file.

## What this repository is

A thin React wrapper around the SunEditor engine (`suneditor` on npm, source at github.com/JiHong88/suneditor).
The whole runtime is `src/SunEditor.tsx`. Engine behavior (options, plugins, content, rendering) is not changed here.

## Hard rules

- **Git safety:** never `git add`, `commit`, `push`, `stash`, `reset` or `checkout <path>` unless the user asks for it
  in this conversation. For commits follow `.agents/skills/commit/SKILL.md` (approval gate).
- **Small surface:** do not add a prop that mirrors an engine option. Engine options go through `options` untouched.
  React-level props are `value` / `onChange`, `readOnly`, `disabled`, `className` / `style` and `ref`, plus `name` on
  `SunEditorRoot` (the engine `rootKey`). Multi-root is `SunEditorGroup` + `SunEditorRoot`. See CONTRIBUTING.md.
- **No static engine import in `src/`:** the engine touches `window` at import time. It is loaded with `import('suneditor')`
  inside an effect. Type-only imports are fine.
- **Generated output:** never edit `dist/`; it is built by `tsup` and is not committed.

## Workflow

1. Read the relevant part of `src/SunEditor.tsx` and the matching spec in `test/SunEditor.test.tsx`.
2. Make the change with a test. Behavior must hold under React StrictMode and when rendered with `renderToString`.
3. Validate with `.agents/skills/post-edit/SKILL.md` (`npm run check`).
4. **Update `changes.md`** for user-facing changes (`feat` / `enhance` / `fix` / `change` / `breaking`) following
   `prompts/changes-guide.md`. Skip docs, tests, tooling and playground-only changes.

## Release note

When asked for a release note, rewrite `changes.md` into `release-note.md` following `prompts/release-note.md`
(`.agents/skills/release-note/SKILL.md`). Replace the whole file with the current version's section.

## Skills

`.agents/skills/` holds the project skills; `.claude/skills` links there.

| Skill           | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `/post-edit`    | Validation after a change (`npm run check`, SSR check)      |
| `/code-review`  | Review the diff or named files; reports only, fixes nothing |
| `/changes`      | Add user-made changes to `changes.md`                       |
| `/release-note` | Convert `changes.md` into `release-note.md`                 |
| `/commit`       | Commit message format and approval gate                     |
