# Contributing to @suneditor/suneditor-react

Thanks for helping out. This package is a thin React wrapper around the [SunEditor](https://github.com/JiHong88/suneditor) engine.
The engine itself (options, plugins, events, rendering) lives in that repository. Please file engine bugs there.

## Design rule: keep the surface small

The wrapper deliberately has very few management points:

- Engine options are passed through `options` untouched. **Do not add a prop that mirrors an engine option.**
  New engine options must work without a wrapper release.
- Only `value` / `onChange`, `readOnly`, `disabled`, `className` / `style` and `ref` are React-level props, plus `name`
  on `SunEditorRoot` (the engine `rootKey`). Multi-root is `SunEditorGroup` + `SunEditorRoot`, with the root's `options`
  being the engine's frame options untouched.
- The engine is loaded with a dynamic `import('suneditor')` inside an effect because it touches `window` at import time.
  Never add a top-level `import ... from 'suneditor'` to `src/`. Type-only imports are fine.
- `events` and `theme` are re-synced on every render; everything else is applied once at creation.

If a change needs more API surface, open an issue first so we can discuss it.

## Setup

Node 20 or newer.

```bash
npm install
npm run dev      # Vite playground at playground/, imports src/ directly
npm test         # Vitest + jsdom, runs the real engine
npm run check    # lint, format check, typecheck, test, build (what CI runs)
```

### Project layout

| Path                | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `src/SunEditor.tsx` | The component. The whole runtime is this one file.             |
| `src/index.ts`      | Public exports.                                                |
| `test/`             | Vitest specs and the jsdom setup (browser API shims).          |
| `playground/`       | Manual testing app (`npm run dev`).                            |
| `tsup.config.ts`    | Build: ESM + CJS + `.d.ts`, injects the `"use client"` banner. |

### Working against a local engine checkout

```bash
npm link ../suneditor     # or wherever your SunEditor clone is
```

Do not commit a `file:` dependency; CI installs the engine from npm.

### Verifying in Next.js

The unit tests cover server rendering with `renderToString`, but for a real check build a tarball and install it in a Next.js app.
Install from the tarball rather than `npm link` so the app does not end up with two copies of React.

```bash
npm pack
cd ../my-next-app && npm install ../suneditor-react/suneditor-react-*.tgz
```

Then confirm `next build` prerenders a page that renders `<SunEditor />` and that the editor works in the browser.

## Pull requests

- Use a feature branch. Keep PRs focused.
- Add or update a test in `test/` for behavior changes.
- `npm run check` must pass.
- Add an entry to `changes.md` for user-facing changes (`feat` / `enhance` / `fix` / `change` / `breaking`), following `prompts/changes-guide.md`.
- Follow the engine's [commit message convention](https://github.com/JiHong88/suneditor/blob/master/CONTRIBUTING.md#-commit-message-convention):
  `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`, ... with an optional issue link such as `fix(#12): ...`.

## Releasing (maintainers)

Releases are published by GitHub Actions from the `release` branch, like the engine. `main` is never published directly.

1. On `main`: bump `version` in `package.json`, run `npm install` to sync the lock file.
2. Write the release note: `/release-note` rewrites `changes.md` into `release-note.md` (rules in `prompts/release-note.md`).
3. Commit and push `main`.
4. `npm run release:archive` snapshots `main` onto `release` as one commit named after the version and pushes it.
5. The **Deploy** workflow (`.github/workflows/deploy.yml`) checks that the version differs from the last tag, runs `npm run check`,
   publishes to npm with provenance, creates the GitHub Release (tag `<version>`, body from `release-note.md`) and closes the
   milestone named after the version together with its issues.
6. After the release is live, empty `changes.md` (keep the file) and commit.

npm publishing uses [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so no npm token is stored in the
repository. The package on npmjs.com must list this repository and the `deploy.yml` workflow as a trusted publisher.

Stale issues and pull requests are handled by `.github/workflows/issue-manager.yml` (weekly), which skips anything in a
milestone.

## Agent skills

The repository ships skills for AI coding agents in `.agents/skills/` (`.claude/skills` links there). `AGENTS.md` is the entry point.

| Skill           | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| `/post-edit`    | Validation after a change (`npm run check`, SSR check)      |
| `/code-review`  | Review the diff or named files; reports only, fixes nothing |
| `/changes`      | Add user-made changes to `changes.md`                       |
| `/release-note` | Convert `changes.md` into `release-note.md`                 |
| `/commit`       | Commit message format and approval gate                     |
