#!/usr/bin/env bash
#
# release-archive.sh — snapshot the current `main` state onto the `release` branch as a SINGLE
# squashed version commit. Pushing `release` triggers .github/workflows/deploy.yml (npm publish +
# GitHub Release).
#
# Run this AFTER the main-side release work is committed and pushed:
#   1. bump "version" in package.json   2. npm install (sync package-lock)
#   3. write release-note.md            4. commit + push main
#
# Then:  npm run release:archive            # message = package.json "version"
#    or: bash scripts/release-archive.sh 1.2.0
#
# Tags are NOT created here — the deploy workflow creates the tag with the GitHub Release.
set -euo pipefail

SOURCE_BRANCH="main"
RELEASE_BRANCH="release"
VERSION_ARG="${1:-}"

if ! git diff --quiet || ! git diff --cached --quiet; then
	echo "✗ Uncommitted changes present. Commit or stash them first." >&2
	exit 1
fi

START_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
cleanup() { git checkout --quiet "$START_BRANCH" 2>/dev/null || true; }
trap cleanup EXIT

git checkout --quiet "$SOURCE_BRANCH"
git pull --ff-only

# Read the version from the up-to-date main, not from whatever branch the script was started on.
VERSION="${VERSION_ARG:-$(node -p "require('./package.json').version")}"
echo "→ Archiving $SOURCE_BRANCH → $RELEASE_BRANCH as \"$VERSION\""

# First release: create the branch from main.
if ! git show-ref --verify --quiet "refs/heads/$RELEASE_BRANCH"; then
	if git ls-remote --exit-code --heads origin "$RELEASE_BRANCH" >/dev/null 2>&1; then
		git checkout --quiet -b "$RELEASE_BRANCH" "origin/$RELEASE_BRANCH"
	else
		git checkout --quiet -b "$RELEASE_BRANCH"
		git push -u origin "$RELEASE_BRANCH"
		echo "✓ Created $RELEASE_BRANCH from $SOURCE_BRANCH and pushed it."
		exit 0
	fi
else
	git checkout --quiet "$RELEASE_BRANCH"
	git pull --ff-only
fi

if [ "$(git rev-parse "$SOURCE_BRANCH^{tree}")" = "$(git rev-parse 'HEAD^{tree}')" ]; then
	echo "✓ $RELEASE_BRANCH already matches $SOURCE_BRANCH — nothing to archive."
	exit 0
fi

# The new commit's tree IS main's tree (like a squash-merge), so it can never conflict.
NEW_COMMIT="$(git commit-tree "$SOURCE_BRANCH^{tree}" -p HEAD -m "$VERSION")"
git merge --ff-only "$NEW_COMMIT"
git push origin "$RELEASE_BRANCH"

echo "✓ Pushed $RELEASE_BRANCH commit \"$VERSION\" — the Deploy workflow will publish it."
