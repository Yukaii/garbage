#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const outBase = path.join(root, "data-input", "routes");

function readJsonFromGit(refPath) {
  const stdout = execSync(`git show ${refPath}`, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });
  return JSON.parse(stdout);
}

function slugify(value, fallback) {
  const base = (value || "").toString().normalize("NFKD");
  const cleaned = base.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const hash = createHash("md5").update(base).digest("hex").slice(0, 6);
  const head = cleaned || fallback || "route";
  return `${head.toLowerCase()}-${hash}`;
}

function toNumber(value, defaultValue = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseTimeHHMM(str) {
  if (!str) return 9999;
  const cleaned = String(str).replace(":", "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 9999;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function featureCollectionFromPoints(points) {
  return {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: p.properties,
    })),
  };
}

async function buildTaipei() {
  const taipei = readJsonFromGit("data:trash-collection-points.json");
  const results = taipei?.result?.results || [];
  const groups = new Map();

  for (const row of results) {
    const route = row["路線"]?.toString().trim() || "unknown-route";
    const carSeq = row["車次"]?.toString().trim() || "default";
    const key = `${route}__${carSeq}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      lon: toNumber(row["經度"]),
      lat: toNumber(row["緯度"]),
      arrival: parseTimeHHMM(row["抵達時間"]),
      raw: row,
      route,
      carSeq,
    });
  }

  const cityDir = path.join(outBase, "taipei");
  await ensureDir(cityDir);

  let written = 0;
  for (const [key, points] of groups.entries()) {
    const sorted = points
      .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
      .sort((a, b) => a.arrival - b.arrival);

    if (sorted.length < 2) continue;

    const routeId = ["taipei", slugify(sorted[0].route, "route"), slugify(sorted[0].carSeq, "car")].join("-");
    const fc = featureCollectionFromPoints(
      sorted.map((p) => ({
        lon: p.lon,
        lat: p.lat,
        properties: {
          routeId,
          city: "taipei",
          route_name: p.route,
          car_seq: p.carSeq,
          arrival_time: p.raw["抵達時間"],
          leave_time: p.raw["離開時間"],
          district: p.raw["行政區"],
          team: p.raw["分隊"],
          car_no: p.raw["車號"],
          route_code: p.raw["局編"],
          stop_name: p.raw["地點"],
        },
      }))
    );

    const outPath = path.join(cityDir, `${routeId}.geojson`);
    await fs.writeFile(outPath, JSON.stringify(fc, null, 2));
    written++;
  }

  console.log(`Taipei route waypoint files written: ${written}`);
}

async function buildNewTaipei() {
  const data = readJsonFromGit("data:new-taipei-trash-collection-points.json");
  const groups = new Map();

  for (const row of data) {
    const routeId = row.lineid?.toString().trim() || "unknown";
    if (!groups.has(routeId)) groups.set(routeId, []);
    groups.get(routeId).push({
      lon: toNumber(row.longitude),
      lat: toNumber(row.latitude),
      rank: toNumber(row.rank, Infinity),
      raw: row,
    });
  }

  const cityDir = path.join(outBase, "new-taipei");
  await ensureDir(cityDir);

  let written = 0;
  for (const [routeId, points] of groups.entries()) {
    const sorted = points
      .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
      .sort((a, b) => a.rank - b.rank);

    if (sorted.length < 2) continue;

    const safeRouteId = `new-taipei-${routeId}`;
    const name = sorted[0].raw.linename;

    const fc = featureCollectionFromPoints(
      sorted.map((p) => ({
        lon: p.lon,
        lat: p.lat,
        properties: {
          routeId: safeRouteId,
          city: "new-taipei",
          lineid: routeId,
          linename: name,
          rank: p.raw.rank,
          village: p.raw.village,
          name: p.raw.name,
        },
      }))
    );

    const outPath = path.join(cityDir, `${safeRouteId}.geojson`);
    await fs.writeFile(outPath, JSON.stringify(fc, null, 2));
    written++;
  }

  console.log(`New Taipei route waypoint files written: ${written}`);
}

async function main() {
  await ensureDir(outBase);
  await buildTaipei();
  await buildNewTaipei();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
