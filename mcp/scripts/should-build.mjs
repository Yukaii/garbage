// Vercel "Ignored Build Step" for the MCP project: exit 0 skips the build, exit 1 builds.
// Any other exit code fails the deployment, so every uncertain case exits 1.
//
// Git isn't usable here (the root .vercelignore leaves no .git in the build), so the files
// changed since the last deployed commit come from GitHub's compare API (public repo).
// Keep RELEVANT in sync with what the server imports from src/ (see AGENTS.md).

const RELEVANT = ['mcp/', 'src/cities/', 'src/types.ts', 'src/utils/taipeiTime.ts', '.vercelignore'];

const BUILD = 1;
const SKIP = 0;

async function decide(env = process.env, fetchImpl = fetch) {
  const { VERCEL_GIT_PREVIOUS_SHA: base, VERCEL_GIT_COMMIT_SHA: head } = env;
  const owner = env.VERCEL_GIT_REPO_OWNER;
  const repo = env.VERCEL_GIT_REPO_SLUG;
  if (!base || !head || !owner || !repo) return [BUILD, 'no previous deployment to compare with'];

  const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vercel-ignore-step' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [BUILD, `GitHub compare returned HTTP ${res.status}`];
  const { status, files } = await res.json();
  // "behind"/"diverged" (force push, revert) or a truncated file list: don't guess
  if (status !== 'ahead' || !Array.isArray(files) || files.length >= 300) return [BUILD, `compare status ${status}`];

  const hit = files.map(f => f.filename).find(name => RELEVANT.some(path => name === path || name.startsWith(path)));
  return hit ? [BUILD, `${hit} changed`] : [SKIP, `${files.length} changed files, none used by the MCP server`];
}

export { decide, RELEVANT };

if (import.meta.url === `file://${process.argv[1]}`) {
  decide()
    .catch(error => [BUILD, `check failed: ${error.message}`])
    .then(([code, reason]) => {
      console.log(`${code === SKIP ? 'Skipping' : 'Building'}: ${reason}`);
      process.exit(code);
    });
}
