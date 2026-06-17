// scripts/update_loc.js
//
// Walks every public, non-fork repo owned by GITHUB_USERNAME, sums additions
// and deletions across all commits authored by that user (via the GitHub
// REST API), and rewrites the block between
//   <!--START_SECTION:loc--> ... <!--END_SECTION:loc-->
// in README.md with the result. Designed to be run by the accompanying
// GitHub Actions workflow on a schedule.
//
// Requires: GITHUB_TOKEN (provided automatically in Actions) and
// GITHUB_USERNAME as env vars.

const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = path.join(__dirname, "..", "README.md");

if (!USERNAME || !TOKEN) {
  console.error("Missing GITHUB_USERNAME or GITHUB_TOKEN env vars.");
  process.exit(1);
}

const API = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-readme-loc-script",
};

async function ghJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}`);
  }
  return res.json();
}

async function getAllRepos() {
  let repos = [];
  let page = 1;
  while (true) {
    const batch = await ghJson(
      `${API}/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner`
    );
    if (batch.length === 0) break;
    repos = repos.concat(batch.filter((r) => !r.fork));
    page += 1;
  }
  return repos;
}

async function getRepoStats(owner, repo) {
  // /stats/contributors gives weekly additions/deletions per author.
  // GitHub sometimes returns 202 while it computes stats; retry briefly.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `${API}/repos/${owner}/${repo}/stats/contributors`,
      { headers }
    );
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok) return { additions: 0, deletions: 0 };
    const data = await res.json();
    if (!Array.isArray(data)) return { additions: 0, deletions: 0 };

    const mine = data.find(
      (c) => c.author && c.author.login === USERNAME
    );
    if (!mine) return { additions: 0, deletions: 0 };

    let additions = 0;
    let deletions = 0;
    for (const week of mine.weeks) {
      additions += week.a;
      deletions += week.d;
    }
    return { additions, deletions };
  }
  return { additions: 0, deletions: 0 };
}

async function main() {
  const repos = await getAllRepos();
  console.log(`Found ${repos.length} owned, non-fork repos.`);

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const repo of repos) {
    try {
      const { additions, deletions } = await getRepoStats(
        repo.owner.login,
        repo.name
      );
      totalAdditions += additions;
      totalDeletions += deletions;
      console.log(`${repo.name}: +${additions} / -${deletions}`);
    } catch (err) {
      console.warn(`Skipping ${repo.name}: ${err.message}`);
    }
  }

  const formatted = (n) => n.toLocaleString("en-US");
  const summary = `**Lines of Code on GitHub:** ${formatted(
    totalAdditions + totalDeletions
  )} ( \`+${formatted(totalAdditions)}\` / \`-${formatted(
    totalDeletions
  )}\` )`;

  let readme = fs.readFileSync(README_PATH, "utf8");
  const startTag = "<!--START_SECTION:loc-->";
  const endTag = "<!--END_SECTION:loc-->";
  const startIdx = readme.indexOf(startTag);
  const endIdx = readme.indexOf(endTag);

  if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find LOC markers in README.md");
    process.exit(1);
  }

  const before = readme.slice(0, startIdx + startTag.length);
  const after = readme.slice(endIdx);
  readme = `${before}\n${summary}\n${after}`;

  fs.writeFileSync(README_PATH, readme, "utf8");
  console.log("README.md updated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
