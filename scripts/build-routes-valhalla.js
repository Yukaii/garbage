#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key.slice(2)] = next;
        i++;
      } else {
        args[key.slice(2)] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const routesDir = path.resolve(args["routes-dir"] || path.join(__dirname, "..", "data-input", "routes"));
const outDir = path.resolve(args["out-dir"] || path.join(__dirname, "..", "build", "routes"));
const valhallaConfig = path.resolve(args["valhalla-config"] || path.join(process.cwd(), "valhalla.json"));
const valhallaRouteCmd = args["valhalla-route-cmd"] || "valhalla_route";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listGeojsonFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listGeojsonFiles(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".geojson")) {
      files.push(full);
    }
  }
  return files;
}

function decodePolyline(str, precision = 6) {
  const factor = Math.pow(10, precision);
  let index = 0;
  let lat = 0;
  let lon = 0;
  const coords = [];

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLon = (result & 1) ? ~(result >> 1) : result >> 1;
    lon += deltaLon;

    coords.push([lon / factor, lat / factor]);
  }

  return coords;
}

async function runCommand(cmd, args, input) {
  const commandString = [cmd, ...args].join(" ");
  console.log(`Running: ${commandString}`);

  const child = spawn(cmd, args, {
    shell: true,
    stdio: ["pipe", "pipe", "inherit"],
  });

  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });

  if (input) {
    child.stdin.write(input);
  }
  child.stdin.end();

  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${commandString}`);
  }
  return stdout;
}

function buildRequest(locations, truckOptions) {
  const request = {
    locations: locations.map(([lon, lat]) => ({ lon, lat })),
    costing: "truck",
    units: "kilometers",
  };
  if (truckOptions) {
    request.costing_options = { truck: truckOptions };
  }
  return request;
}

async function routeWithValhalla(request) {
  const stdout = await runCommand(valhallaRouteCmd, ["-j", JSON.stringify(request), "-c", valhallaConfig], null);
  return JSON.parse(stdout);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadFeatureCollection(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(content);
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`Invalid FeatureCollection: ${filePath}`);
  }
  return parsed;
}

async function main() {
  if (!(await pathExists(routesDir))) {
    console.log(`No routes directory found at ${routesDir}. Nothing to do.`);
    return;
  }
  if (!(await pathExists(valhallaConfig))) {
    throw new Error(`Valhalla config not found at ${valhallaConfig}`);
  }

  const files = await listGeojsonFiles(routesDir);
  if (files.length === 0) {
    console.log("No route definition files found. Nothing to do.");
    return;
  }

  const cityManifests = new Map();
  let totalProcessed = 0;
  let totalFailed = 0;

  for (const filePath of files) {
    const relative = path.relative(routesDir, filePath);
    const [city] = relative.split(path.sep);
    const baseName = path.basename(filePath, ".geojson");

    let fc;
    try {
      fc = await loadFeatureCollection(filePath);
    } catch (err) {
      totalFailed++;
      if (!cityManifests.has(city)) {
        cityManifests.set(city, { routes: [], failed: [] });
      }
      cityManifests.get(city).failed.push({ routeId: baseName, reason: err.message });
      console.warn(`Skipping invalid file ${filePath}: ${err.message}`);
      continue;
    }

    if (fc.features.length < 2) {
      totalFailed++;
      if (!cityManifests.has(city)) {
        cityManifests.set(city, { routes: [], failed: [] });
      }
      cityManifests.get(city).failed.push({ routeId: baseName, reason: "need at least 2 waypoints" });
      console.warn(`Skipping ${filePath}: need at least 2 waypoints`);
      continue;
    }

    const routeId = fc.features[0]?.properties?.routeId || baseName;
    const truckOptions = fc.features[0]?.properties?.truckOptions;

    const coords = fc.features.map((f) => {
      const coord = f?.geometry?.coordinates;
      if (!Array.isArray(coord) || coord.length < 2) {
        throw new Error(`Invalid coordinate in ${filePath}`);
      }
      return [Number(coord[0]), Number(coord[1])];
    });

    const request = buildRequest(coords, truckOptions);

    let response;
    try {
      response = await routeWithValhalla(request);
    } catch (err) {
      totalFailed++;
      if (!cityManifests.has(city)) {
        cityManifests.set(city, { routes: [], failed: [] });
      }
      cityManifests.get(city).failed.push({ routeId, reason: err.message });
      console.warn(`Failed to route ${routeId} from ${filePath}: ${err.message}`);
      continue;
    }

    const legs = response?.trip?.legs || [];
    const summary = response?.trip?.summary || {};
    const shapes = legs.map((leg) => decodePolyline(leg.shape || ""));
    const merged = [];
    for (let i = 0; i < shapes.length; i++) {
      const legCoords = shapes[i];
      if (i > 0) {
        merged.push(...legCoords.slice(1));
      } else {
        merged.push(...legCoords);
      }
    }

    if (!merged.length) {
      totalFailed++;
      if (!cityManifests.has(city)) {
        cityManifests.set(city, { routes: [], failed: [] });
      }
      cityManifests.get(city).failed.push({ routeId, reason: "no geometry returned" });
      console.warn(`No geometry returned for ${routeId} (${filePath})`);
      continue;
    }

    const cityOutDir = path.join(outDir, city);
    await ensureDir(cityOutDir);

    const outGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: merged },
          properties: {
            routeId,
            city,
            source_file: relative,
            distance_km: summary.length,
            duration_min: summary.time ? summary.time / 60 : null,
            valhalla_config: path.basename(valhallaConfig),
          },
        },
      ],
    };

    const outPath = path.join(cityOutDir, `${routeId}.geojson`);
    await fs.writeFile(outPath, JSON.stringify(outGeojson, null, 2));

    const manifestEntry = {
      routeId,
      file: `routes/${city}/${routeId}.geojson`,
      distance_km: summary.length,
      duration_min: summary.time ? summary.time / 60 : null,
      source_file: relative,
    };

    if (!cityManifests.has(city)) {
      cityManifests.set(city, { routes: [], failed: [] });
    }
    cityManifests.get(city).routes.push(manifestEntry);
    totalProcessed++;
  }

  for (const [city, data] of cityManifests.entries()) {
    const manifest = {
      city,
      generated_at: new Date().toISOString(),
      routes: data.routes,
      route_count: data.routes.length,
      failed_routes: data.failed,
      valhalla_config: path.basename(valhallaConfig),
      notes: "Generated offline via valhalla_route; Taipei/New Taipei waypoints come from official lat/lon sources.",
    };
    const cityOutDir = path.join(outDir, city);
    await ensureDir(cityOutDir);
    await fs.writeFile(path.join(cityOutDir, "routes-manifest.json"), JSON.stringify(manifest, null, 2));
  }

  if (!totalProcessed) {
    console.log(`No routes processed. Failed: ${totalFailed}`);
  } else {
    console.log(`Processed ${totalProcessed} routes. Failed: ${totalFailed}`);
    console.log(`Outputs written to ${outDir}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
