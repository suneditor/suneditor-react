---
name: commit
description: 커밋 메시지를 생성하고, 승인 후 커밋한다. 커밋 요청 시 반드시 이 스킬을 따른다.
---

# Commit

Only when the user asked for a commit in this conversation. Never stage, commit or push on your own.

1. `git status` to see the changed files.
2. Stage only the files that belong to the approved work. Do not include or unstage other staged work.
3. Read `git diff --staged` and write the message in the format below.
4. **Approval gate:** show the draft in a code block and ask "이대로 커밋할까요?" — then stop.
   Run `git commit` only after the user approves. Skip the gate only when the user explicitly asked
   to commit without confirmation.

## Format

```
<type>(<scope>): <summary in English, ≤ 50 chars>

- <change 1>
- <change 2>
```

Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `chore`, `ci`, `build`.
Scope is optional. Omit the body for a simple change; otherwise 3–6 bullets grouped by intent,
not by file. No signatures or trailers (`Co-Authored-By`, `Generated with ...`).
