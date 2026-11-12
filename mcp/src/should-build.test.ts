import { expect, test } from 'bun:test';
// @ts-expect-error plain .mjs (runs under Node in Vercel's build image), no type declarations
import { decide } from '../scripts/should-build.mjs';

const env = { VERCEL_GIT_PREVIOUS_SHA: 'a', VERCEL_GIT_COMMIT_SHA: 'b', VERCEL_GIT_REPO_OWNER: 'o', VERCEL_GIT_REPO_SLUG: 'r' };
const github = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const ahead = (...files: string[]) => github({ status: 'ahead', files: files.map(filename => ({ filename })) });

test('skips when only web files changed', async () => {
  expect((await decide(env, ahead('src/App.tsx', 'public/llms.txt', 'src/utils/share.ts')))[0]).toBe(0);
});

test('builds when anything the server uses changed', async () => {
  for (const file of ['mcp/vercel.json', 'src/cities/schedule.ts', 'src/types.ts', 'src/utils/taipeiTime.ts', '.vercelignore']) {
    expect((await decide(env, ahead('src/App.tsx', file)))[0]).toBe(1);
  }
});

test('builds whenever it cannot be sure', async () => {
  expect((await decide({}, ahead()))[0]).toBe(1); // first deployment of a branch
  expect((await decide(env, github({}, 403)))[0]).toBe(1); // rate limited
  expect((await decide(env, github({ status: 'diverged', files: [] })))[0]).toBe(1); // force push
  expect((await decide(env, ahead(...Array.from({ length: 300 }, (_, i) => `x${i}`))))[0]).toBe(1); // truncated list
});
