/** fetch() with a timeout and retries; open-data portals are slow and occasionally flaky. */
export async function fetchJson<T = unknown>(url: string, { retries = 3, timeoutMs = 120_000 } = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        // Portals answer outages with an HTML page and status 200
        throw new Error(`Response is not JSON (starts with ${JSON.stringify(text.slice(0, 80))})`);
      }
    } catch (error) {
      lastError = error;
      console.warn(`  attempt ${attempt}/${retries} failed for ${url}: ${(error as Error).message}`);
      if (attempt < retries) await Bun.sleep(2_000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Giving up on ${url}: ${(lastError as Error)?.message}`);
}
