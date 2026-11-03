// Runs after `npm publish` in .github/workflows/deploy.yml.
// 1. Closes the milestone named after the version (and its open issues) with a comment.
// 2. Creates the GitHub Release (tag = version, name = v<version>) with release-note.md as the body.
// Uses the GitHub REST API through fetch, so it needs no dependencies.
import fs from 'node:fs';
import path from 'node:path';

const token = process.env.GITHUB_TOKEN;
const version = process.env.VERSION_NAME;
const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'suneditor/react').split('/');
const api = `https://api.github.com/repos/${owner}/${repo}`;

async function gh(method, url, body) {
	const res = await fetch(url.startsWith('http') ? url : api + url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${await res.text()}`);
	return res.status === 204 ? null : res.json();
}

/** GET every page of a list endpoint. */
async function ghList(url) {
	const sep = url.includes('?') ? '&' : '?';
	const all = [];
	for (let page = 1; ; page++) {
		const items = await gh('GET', `${url}${sep}per_page=100&page=${page}`);
		all.push(...items);
		if (items.length < 100) return all;
	}
}

/** release-note.md holds only the current version: drop the leading "## x.y.z" heading and return the rest. */
function readReleaseBody() {
	const notePath = path.resolve('release-note.md');
	if (!fs.existsSync(notePath)) return '';
	const lines = fs.readFileSync(notePath, 'utf8').split(/\r?\n/);
	if (/^##\s+/.test(lines[0] ?? '')) lines.shift();
	return lines.join('\n').trim();
}

async function closeMilestoneAndIssues() {
	const milestones = await ghList('/milestones?state=open');
	const milestone = milestones.find((m) => m.title === version);
	if (!milestone) {
		console.log(`No open milestone named "${version}".`);
		return;
	}
	// The issues endpoint also lists pull requests; only issues are commented on and closed.
	const issues = (await ghList(`/issues?state=open&milestone=${milestone.number}`)).filter((i) => !i.pull_request);
	for (const issue of issues) {
		await gh('POST', `/issues/${issue.number}/comments`, {
			body:
				`Thank you for your engagement with the project.\n` +
				`This issue has been resolved in version ${version}.\n` +
				`If the problem persists, please open a new issue referencing this one.`,
		});
		await gh('PATCH', `/issues/${issue.number}`, { state: 'closed' });
	}
	await gh('PATCH', `/milestones/${milestone.number}`, { state: 'closed' });
	console.log(`Milestone "${version}" closed (${issues.length} issue(s)).`);
}

async function createRelease() {
	await gh('POST', '/releases', {
		tag_name: version,
		target_commitish: process.env.GITHUB_SHA,
		name: `v${version}`,
		body: readReleaseBody(),
	});
	console.log(`Release "v${version}" created (tag ${version}).`);
}

if (!version) {
	console.log('VERSION_NAME is not set; nothing to do.');
} else {
	// The release first, so the issue comments refer to something that exists.
	await createRelease();
	try {
		await closeMilestoneAndIssues();
	} catch (error) {
		console.error(`Milestone step failed: ${error.message}`);
	}
}
