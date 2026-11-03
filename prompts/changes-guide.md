# changes.md guide

`changes.md` records only the changes of the version currently being developed. It is the source
for `release-note.md` (`/release-note`) and the GitHub Release body. After a release it is emptied
and the next version starts fresh.

## When to add an entry

| Type       | Record when                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------- |
| `feat`     | A new prop, export or capability of the wrapper                                               |
| `enhance`  | Existing behavior gets better with the same result (performance, messages, typing)            |
| `fix`      | A bug fix that affects users                                                                  |
| `change`   | Existing code keeps working but the result differs (defaults, timing of a sync, peer range)   |
| `breaking` | A prop, export or the peer dependency range changes in a way that makes existing code migrate |

Do **not** record `style`, `docs`, `test`, `chore`, `ci`, `build` or playground-only changes.
Engine behavior is not recorded here. If an entry would describe SunEditor itself, it belongs to the engine repository.

## Format

```markdown
### feat

- Description (`src/SunEditor`)
- Description (#issue)

### enhance

- Description (`src/SunEditor`)

### fix

- Description (`src/SunEditor`)

### change

- Description

### breaking

- ⚠️ What changed — how to migrate
```

## Rules

1. Current version only. No history of earlier versions.
2. Group by type: `feat`, `enhance`, `fix`, `change`, `breaking`.
   `enhance` vs `change`: same result but better → `enhance`; different result the user must check → `change`.
3. One line per entry, commit-message style.
4. End with the related file or an issue number in parentheses.
5. `breaking` entries include the migration.
6. English.

## At release

1. `/release-note` rewrites the entries into `release-note.md`.
2. The Deploy workflow uses `release-note.md` as the GitHub Release body.
3. After the release has been published, empty `changes.md` (keep the file).

## Agent instructions

**After the agent itself changed code:** read `changes.md`, add the entry under its type group
(create the group if missing), skip duplicates, skip the excluded types.

**When the user edited code and asks for an update (`/changes`):** run `git diff` (staged and
unstaged), fall back to `git diff HEAD~1` when there is nothing; classify each user-facing change;
add only entries that are not already present; ask before adding when the classification is unclear.
