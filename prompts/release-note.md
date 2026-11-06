# Release note writing rules

Audience: React and Next.js developers who use `@suneditor/suneditor-react`. Tone: technical, factual, minimal.
Third person, no "we" or "you", English only, sentence case.

`release-note.md` holds **only the current version**: a single `## <version>` heading followed by the
categories below. The Deploy workflow strips the heading and uses the rest as the GitHub Release body.

## Categories

| Category         | When to use                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| New Feature      | A new prop, export or capability that did not exist before                   |
| Enhancement      | Improves existing behavior, typing or performance; adds no new capability    |
| Changes          | Different result, but existing code keeps working                            |
| Bugfix           | Corrects incorrect or unexpected behavior                                    |
| Breaking Changes | A prop, export or the `suneditor` peer range changes so existing code breaks |
| Hotfix           | Critical fix released immediately; bold the message, place it at the top     |

Mapping from `changes.md`: `feat` → New Feature, `enhance` → Enhancement, `fix` → Bugfix,
`change` → Changes (or Breaking Changes when existing code stops working), `breaking` → Breaking Changes.

## Writing rules

- **Condense first.** Rewrite every `changes.md` entry; never copy one through. Keep the user-visible
  symptom or capability and the prop / export it touches, in backticks. Drop source-file references
  such as ``(`src/SunEditor`)``, root causes, implementation details and internal identifiers.
- One sentence per item, one item per line, starting with `*`.
- Backticks for props, options, methods, packages and code values.
- Issue references at the end: `[#12](https://github.com/suneditor/suneditor-react/issues/12)`.
  Contributor attribution: `([@username](https://github.com/username))`.
- Omit empty categories.

### Patterns

- New Feature: `Support <capability>.` / ``A `<prop>` prop has been added.`` / `` `<prop>` now accepts <type> for <use case>. ``
- Enhancement: start with "Improved", "Added", "Updated".
- Bugfix: "Fixed a bug where ..." / "Fixed an issue where ...", symptom only.
- Changes: state the old behavior so the reader can tell whether it affects them, and how to get it back.
- Breaking Changes: say what was removed or changed and the migration.

## Output

```
## 1.2.0

### New Feature

* ...

### Enhancement

* ...

### Changes

* ...

### Bugfix

* ...

### Breaking Changes

* ...
```

## Anti-patterns

- `We added ...` → no "we"
- ``Fixed the value sync (`src/SunEditor`)`` → no source-file references
- `Fixed a bug where ... because the ref was read before the effect ran` → no root cause
- A copied `changes.md` entry → every entry is rewritten
