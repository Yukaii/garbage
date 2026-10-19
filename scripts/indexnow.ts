#!/usr/bin/env bun
/**
 * Submit the URLs in the site's sitemap to IndexNow.
 *
 * IndexNow is a shared protocol used by Bing, Yandex, Naver, Seznam and others
 * to learn about changed URLs immediately instead of waiting for a crawl.
 * Google does not participate in IndexNow; use Search Console for Google.
 *
 * Usage:
 *   INDEXNOW_KEY=<key> bun scripts/indexnow.ts
 *   INDEXNOW_KEY=<key> bun scripts/indexnow.ts --dry-run
 *   INDEXNOW_KEY=<key> bun scripts/indexnow.ts public/sitemap.xml
 *
 * Environment:
 *   INDEXNOW_KEY   Required unless --dry-run. The key generated for the owner.
 *   SITE_URL       Optional. Origin of the site. Default: https://garbage.yukai.dev
 *
 * The key protocol:
 *   1. Generate a key (8-128 chars, a-z A-Z 0-9 and "-"), e.g. `openssl rand -hex 16`.
 *   2. Serve the key as plain text at https://<host>/<key>.txt. The file name and
 *      its entire contents must both be the key. In this repo that means adding
 *      `public/<key>.txt` (it is public by design, not a secret) and deploying.
 *   3. Send the key with the URL list (this script). The search engine fetches the
 *      key file to prove the submitter controls the host.
 *
 * The CI job treats failures as non-fatal; this script still exits non-zero so
 * manual runs surface real problems.
 */

import { join, resolve } from "node:path";

const ENDPOINT = "https://api.indexnow.org/indexnow";
const DEFAULT_SITE_URL = "https://garbage.yukai.dev";
const MAX_URLS_PER_REQUEST = 10_000;
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const repoRoot = join(import.meta.dir, "..");

interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

interface SubmitResult {
  urlCount: number;
  status: number;
  ok: boolean;
}

function log(message: string): void {
  console.log(`[indexnow] ${message}`);
}

function warn(message: string): void {
  console.warn(`[indexnow] WARN ${message}`);
}

function fail(message: string): never {
  console.error(`[indexnow] ERROR ${message}`);
  process.exit(1);
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function parseSitemapUrls(xml: string): string[] {
  const entries = xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi);
  const urls = new Set<string>();

  for (const entry of entries) {
    const raw = entry[1];
    if (!raw) continue;

    const value = decodeXml(raw.trim());
    try {
      urls.add(new URL(value).toString());
    } catch {
      warn(`skipping invalid URL in sitemap: ${value}`);
    }
  }

  return [...urls];
}

async function pickSitemapPath(explicitPath?: string): Promise<string> {
  if (explicitPath) {
    const candidate = resolve(explicitPath);
    if (await Bun.file(candidate).exists()) return candidate;
    fail(`sitemap not found at ${candidate}`);
  }

  const candidates = [
    join(repoRoot, "public", "sitemap.xml"),
    join(repoRoot, "dist", "sitemap.xml"),
  ];

  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) return candidate;
  }

  return fail(
    `sitemap not found; looked in ${candidates.map((path) => path.replace(repoRoot + "/", "")).join(", ")}`,
  );
}

async function checkKeyFile(key: string): Promise<void> {
  const keyFile = Bun.file(join(repoRoot, "public", `${key}.txt`));

  if (!(await keyFile.exists())) {
    warn(
      `public/${key}.txt is missing. Add a file with that exact name containing the key, then deploy; ` +
        `IndexNow will reject submissions until https://<host>/${key}.txt is reachable.`,
    );
    return;
  }

  const contents = (await keyFile.text()).trim();
  if (contents !== key) {
    warn(`public/${key}.txt must contain exactly the key, found ${JSON.stringify(contents.slice(0, 40))}.`);
  }
}

async function submit(payload: IndexNowPayload): Promise<SubmitResult> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.text()).trim();
  const details = body ? `: ${body.slice(0, 300)}` : "";

  switch (response.status) {
    case 200:
      log(`accepted ${payload.urlList.length} URL(s) (200 OK)`);
      break;
    case 202:
      log(`accepted ${payload.urlList.length} URL(s), key validation pending (202 Accepted)`);
      break;
    case 400:
      console.error(`[indexnow] ERROR HTTP 400, invalid request format${details}`);
      break;
    case 403:
      console.error(
        `[indexnow] ERROR HTTP 403, key rejected. Check that https://${payload.host}/${payload.key}.txt ` +
          `is deployed and contains the key${details}`,
      );
      break;
    case 422:
      console.error(
        `[indexnow] ERROR HTTP 422, URLs do not belong to ${payload.host} or the key does not match${details}`,
      );
      break;
    case 429:
      console.error(
        `[indexnow] ERROR HTTP 429, rate limited (retry after ${response.headers.get("retry-after") ?? "unknown"})${details}`,
      );
      break;
    default:
      console.error(`[indexnow] ERROR HTTP ${response.status}${details}`);
      break;
  }

  return {
    urlCount: payload.urlList.length,
    status: response.status,
    ok: response.status === 200 || response.status === 202,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const explicitSitemap = args.find((arg) => !arg.startsWith("--"));

  const key = (process.env.INDEXNOW_KEY ?? "").trim();
  if (!key) {
    if (dryRun) {
      fail("INDEXNOW_KEY is required even for --dry-run, so the payload can be validated");
    }
    log("INDEXNOW_KEY is not set; skipping IndexNow submission.");
    return;
  }

  if (!KEY_PATTERN.test(key)) {
    fail("INDEXNOW_KEY must be 8-128 characters using only a-z, A-Z, 0-9 and '-'");
  }

  const siteUrl = (process.env.SITE_URL ?? DEFAULT_SITE_URL).trim();
  let origin: URL;
  try {
    origin = new URL(siteUrl);
  } catch {
    fail(`SITE_URL is not a valid URL: ${siteUrl}`);
  }

  origin.pathname = "/";
  origin.search = "";
  origin.hash = "";
  const host = origin.host;
  const keyLocation = `${origin.origin}/${key}.txt`;

  const sitemapPath = await pickSitemapPath(explicitSitemap);
  const sitemap = await Bun.file(sitemapPath).text();

  log(`sitemap: ${sitemapPath.replace(repoRoot + "/", "")}`);
  log(`host: ${host}`);

  const sitemapUrls = parseSitemapUrls(sitemap);
  const urls = sitemapUrls.filter((url) => new URL(url).host === host);
  const skipped = sitemapUrls.length - urls.length;

  if (skipped > 0) {
    warn(`skipped ${skipped} URL(s) that do not belong to ${host}`);
  }

  if (urls.length === 0) {
    warn("sitemap contains no URLs for this host; nothing to submit.");
    return;
  }

  await checkKeyFile(key);

  if (dryRun) {
    log(`dry run: would submit ${urls.length} URL(s) to ${ENDPOINT}`);
    console.log(JSON.stringify({ host, key, keyLocation, urlList: urls }, null, 2));
    return;
  }

  let submitted = 0;
  let failures = 0;

  for (let offset = 0; offset < urls.length; offset += MAX_URLS_PER_REQUEST) {
    const urlList = urls.slice(offset, offset + MAX_URLS_PER_REQUEST);
    const result = await submit({ host, key, keyLocation, urlList });

    if (result.ok) {
      submitted += result.urlCount;
    } else {
      failures += 1;
    }
  }

  log(`done: ${submitted}/${urls.length} URL(s) submitted in ${Math.ceil(urls.length / MAX_URLS_PER_REQUEST)} request(s)`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
