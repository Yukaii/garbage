import { afterEach, beforeEach, expect, test } from 'bun:test';
import { migrateLegacyPointIds } from './legacyPointIds';

const MAPS: Record<string, Record<string, string>> = {
  taipei: { '1': 'snew1' },
  taichung: { 'KEQ-0315-321': 'snew2' },
  kaohsiung: { '120.423699_22.659096': 'snew3' },
};

let store: Record<string, string>;
let href: string;
let fetched: string[];
const realFetch = globalThis.fetch;

beforeEach(() => {
  store = {};
  fetched = [];
  href = 'https://garbage.yukai.dev/';
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
    window: {
      get location() {
        return { href };
      },
      history: {
        state: null,
        replaceState: (_s: unknown, _t: string, url: URL) => {
          href = String(url);
        },
      },
    },
  });
  globalThis.fetch = (async (url: string) => {
    fetched.push(url);
    const city = /point-ids-v1-(.+)\.json$/.exec(url)?.[1] ?? '';
    return MAPS[city] ? new Response(JSON.stringify(MAPS[city])) : new Response('', { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('upgrades starred legacy IDs and keeps current ones', async () => {
  store.starredPoints = JSON.stringify([
    'taipei-1',
    'taichung-KEQ-0315-321-d3-recycling',
    'kaohsiung-120.423699_22.659096-KEM-1760',
    'taipei-salreadynew',
  ]);
  await migrateLegacyPointIds();
  expect(JSON.parse(store.starredPoints!)).toEqual(['taipei-snew1', 'taichung-snew2', 'kaohsiung-snew3', 'taipei-salreadynew']);
});

test('rewrites a legacy shared link', async () => {
  href = 'https://garbage.yukai.dev/?point=taipei-1&q=x';
  await migrateLegacyPointIds();
  expect(new URL(href).searchParams.get('point')).toBe('taipei-snew1');
  expect(new URL(href).searchParams.get('q')).toBe('x');
});

test('fetches nothing when there is nothing to migrate', async () => {
  store.starredPoints = JSON.stringify(['taipei-sabc']);
  await migrateLegacyPointIds();
  expect(fetched).toEqual([]);
});

test('leaves IDs alone when their map cannot load, so the next visit retries', async () => {
  store.starredPoints = JSON.stringify(['new-taipei-207001-3']);
  await migrateLegacyPointIds();
  expect(JSON.parse(store.starredPoints!)).toEqual(['new-taipei-207001-3']);
});

test('drops stars for stops that no longer exist', async () => {
  store.starredPoints = JSON.stringify(['taipei-1', 'taipei-99999']);
  await migrateLegacyPointIds();
  expect(JSON.parse(store.starredPoints!)).toEqual(['taipei-snew1']);
});
