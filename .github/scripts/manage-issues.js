// Runs weekly from .github/workflows/issue-manager.yml.
// Issues and pull requests without activity are labelled `stale` with a warning comment, and closed when the
// grace period passes without a reply. Items in a milestone are left alone.
// Uses the GitHub REST API through fetch, so it needs no dependencies.

const token = process.env.GITHUB_TOKEN;
const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'suneditor/suneditor-react').split('/');
const api = `https://api.github.com/repos/${owner}/${repo}`;

const STALE_LABEL = 'stale';
const DAY = 24 * 60 * 60 * 1000;
// Days without activity before the warning, and days after the warning before closing.
const ISSUE_WARN_DAYS = 42;
const ISSUE_GRACE_DAYS = 7;
const PR_WARN_DAYS = 84;
const PR_GRACE_DAYS = 14;

const ISSUE_WARN_COMMENT =
	'This issue has been automatically marked as **stale** because it has not had any activity for 6 weeks.\n\n' +
	'It will be **closed in 1 week** if no further activity occurs.\n' +
	'If this issue is still relevant, please leave a comment or update it to keep it open.\n\n' +
	'If a new version has been released recently, please test your scenario with that version to see if the issue persists.';
const PR_WARN_COMMENT =
	'This pull request has been automatically marked as **stale** because it has not had any activity for 12 weeks.\n\n' +
	'It will be **closed in 2 weeks** if no further activity occurs.\n' +
	'If this PR is still relevant, please leave a comment, rebase, or update it to keep it open.';
const ISSUE_CLOSE_COMMENT =
	'Thank you for your interest in the project.\n' +
	'This issue has been automatically closed due to inactivity.\n' +
	'If this issue is still relevant, feel free to reopen it with additional context.';
const PR_CLOSE_COMMENT =
	'Thank you for your contribution to the project.\n' +
	'This pull request has been automatically closed due to inactivity.\n' +
	'If this PR is still relevant, please feel free to reopen it and update your changes.';

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

/** When the `stale` label was last added, or null if the events do not show it. */
async function staleLabelDate(number) {
	const events = await ghList(`/issues/${number}/events`);
	const labeled = events.filter((e) => e.event === 'labeled' && e.label?.name === STALE_LABEL).pop();
	return labeled ? new Date(labeled.created_at) : null;
}

/** True when someone other than a bot commented after `date`. */
async function hasHumanActivityAfter(number, date) {
	const comments = await ghList(`/issues/${number}/comments`);
	return comments.some((c) => c.user?.type !== 'Bot' && !c.performed_via_github_app && new Date(c.created_at) > date);
}

async function manage(item) {
	const isPR = Boolean(item.pull_request);
	const type = isPR ? 'PR' : 'Issue';
	const number = item.number;

	if (item.milestone) {
		console.log(`${type} #${number}: in milestone "${item.milestone.title}", skipped.`);
		return;
	}

	const isStale = item.labels.some((l) => l.name === STALE_LABEL);
	if (!isStale) {
		const warnAfter = new Date(Date.now() - (isPR ? PR_WARN_DAYS : ISSUE_WARN_DAYS) * DAY);
		if (new Date(item.updated_at) >= warnAfter) return;
		console.log(`${type} #${number}: marking stale (last updated ${item.updated_at}).`);
		await gh('POST', `/issues/${number}/comments`, { body: isPR ? PR_WARN_COMMENT : ISSUE_WARN_COMMENT });
		await gh('POST', `/issues/${number}/labels`, { labels: [STALE_LABEL] });
		return;
	}

	const staleSince = await staleLabelDate(number);
	if (!staleSince) return;
	if (await hasHumanActivityAfter(number, staleSince)) {
		console.log(`${type} #${number}: activity after the stale label, skipped.`);
		return;
	}
	const closeAfter = new Date(staleSince.getTime() + (isPR ? PR_GRACE_DAYS : ISSUE_GRACE_DAYS) * DAY);
	if (new Date() < closeAfter) {
		console.log(`${type} #${number}: in grace period until ${closeAfter.toISOString()}.`);
		return;
	}
	console.log(`${type} #${number}: grace period over, closing.`);
	await gh('POST', `/issues/${number}/comments`, { body: isPR ? PR_CLOSE_COMMENT : ISSUE_CLOSE_COMMENT });
	await gh('PATCH', `/issues/${number}`, { state: 'closed' });
}

// The issues endpoint lists pull requests too.
for (const item of await ghList('/issues?state=open')) {
	await manage(item);
}
