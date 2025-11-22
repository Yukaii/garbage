#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    let key = argv[i];
    if (!key.startsWith("--")) continue;

    // Support --key=value form
    if (key.includes("=")) {
      const [k, ...rest] = key.split("=");
      const value = rest.join("=");
      args[k.slice(2)] = value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key.slice(2)] = next;
      i++;
    } else {
      args[key.slice(2)] = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const routesDir = path.resolve(args["routes-dir"] || path.join(__dirname, "..", "data-input", "routes"));
const outDir = path.resolve(args["out-dir"] || path.join(__dirname, "..", "build", "routes"));
const valhallaConfigHost = path.resolve(
  args["valhalla-config-host"] ||
    args["valhalla-config"] ||
    path.join(process.cwd(), "valhalla.json")
);
const valhallaConfigContainer =
  args["valhalla-config-container"] || valhallaConfigHost;
// ghcr.io/valhalla/valhalla images expose valhalla_run_route (not valhalla_route)
const valhallaRouteCmd =
  args["valhalla-route-cmd"] || args["valhalla_route_cmd"] || "valhalla_run_route";
const maxLocationsPerRequest = Number(args["max-locations"] || process.env.MAX_VALHALLA_LOCS || 20);
const limitFiles = args["limit"] ? Number(args["limit"]) : null;

const valhallaPort = 8002;
const containerName = "valhalla_service_runner";

async function startValhallaService(configPathContainer) {
  console.log(`Starting Valhalla service (config: ${configPathContainer})...`);
  
  try {
    execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
  } catch (e) {}

  const args = [
    "run",
    "-d",
    "--rm",
    "--name", containerName,
    "-v", `${repoRoot}:/data`,
    "-p", `${valhallaPort}:8002`,
    "ghcr.io/valhalla/valhalla:latest",
    "valhalla_service",
    configPathContainer,
    "1"
  ];

  await runCommand("docker", args);

  console.log("Waiting for Valhalla service to be ready...");
  const start = Date.now();
  while (Date.now() - start < 30000) {
    if (await checkServiceHealth()) {
      console.log("Valhalla service is ready.");
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Timed out waiting for Valhalla service");
}

function stopValhallaService() {
  try {
    console.log("Stopping Valhalla service...");
    execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
  } catch (e) {}
}

function checkServiceHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${valhallaPort}/status`, (res) => {
      if (res.statusCode === 200) resolve(true);
      else resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function routeWithValhallaHttp(request) {
  const postData = JSON.stringify(request);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: valhallaPort,
      path: '/route',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Failed to parse JSON response"));
          }
        } else {
          reject(new Error(`Valhalla error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listGeojsonFiles(dir) {
  try {
    const stdout = execSync(`find ${JSON.stringify(dir)} -type f -name "*.geojson"`, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50,
    });
    return stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.warn(`find failed for ${dir}: ${err.message}`);
    return [];
  }
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

async function routeWithValhalla(requestFileHost, configPathContainer) {
  const content = await fs.readFile(requestFileHost, "utf-8");
  const request = JSON.parse(content);
  return routeWithValhallaHttp(request);
}

async function routeInChunks(coords, truckOptions, tempReqDir, baseName, configPathContainer) {
  // Chunk waypoints to respect Valhalla max locations; overlap by 1 to keep continuity.
  const segments = [];
  let start = 0;
  while (start < coords.length - 1) {
    const end = Math.min(start + maxLocationsPerRequest - 1, coords.length - 1);
    segments.push(coords.slice(start, end + 1));
    start = end;
  }

  const legs = [];
  for (let idx = 0; idx < segments.length; idx++) {
    const segment = segments[idx];
    if (segment.length < 2) continue;
    const req = buildRequest(segment, truckOptions);
    const reqFileHost = path.join(tempReqDir, `${baseName}-seg-${idx}.json`);
    await fs.writeFile(reqFileHost, JSON.stringify(req));
    legs.push(await routeWithValhalla(reqFileHost, configPathContainer));
  }
  return legs;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function toContainerPath(hostPath) {
  return hostPath.startsWith(repoRoot) ? hostPath.replace(repoRoot, "/data") : hostPath;
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
  if (!(await pathExists(valhallaConfigHost))) {
    throw new Error(`Valhalla config not found at host path ${valhallaConfigHost}`);
  }

  let files = await listGeojsonFiles(routesDir);
  console.log(`Found ${files.length} route definition files under ${routesDir}`);
  if (files.length === 0) {
    console.log("No route definition files found. Nothing to do.");
    return;
  }
  
  if (limitFiles !== null && limitFiles > 0) {
    files = files.slice(0, limitFiles);
    console.log(`Limiting processing to ${files.length} file(s) for testing`);
  }

  // Start the Valhalla service
  const configContainer = toContainerPath(valhallaConfigHost);
  await startValhallaService(configContainer);

  try {

  const tempReqDir = path.join(outDir, "..", ".valhalla-requests");
  await ensureDir(tempReqDir);

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

    let tripLegs = [];
    let summary = {};
    try {
      if (coords.length <= maxLocationsPerRequest) {
        const req = buildRequest(coords, truckOptions);
        const reqFileHost = path.join(tempReqDir, `${routeId}.json`);
        await fs.writeFile(reqFileHost, JSON.stringify(req));
        const response = await routeWithValhalla(reqFileHost, valhallaConfigContainer);
        tripLegs = response?.trip?.legs || [];
        summary = response?.trip?.summary || {};
      } else {
        const responses = await routeInChunks(coords, truckOptions, tempReqDir, routeId, valhallaConfigContainer);
        tripLegs = responses.flatMap((r) => r?.trip?.legs || []);
        // Sum distances/times across chunks if available
        summary = {
          length: responses.reduce((acc, r) => acc + (r?.trip?.summary?.length || 0), 0),
          time: responses.reduce((acc, r) => acc + (r?.trip?.summary?.time || 0), 0),
        };
      }
    } catch (err) {
      totalFailed++;
      if (!cityManifests.has(city)) {
        cityManifests.set(city, { routes: [], failed: [] });
      }
      cityManifests.get(city).failed.push({ routeId, reason: err.message });
      console.warn(`Failed to route ${routeId} from ${filePath}: ${err.message}`);
      continue;
    }

    const shapes = tripLegs.map((leg) => decodePolyline(leg.shape || ""));
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
            valhalla_config: path.basename(valhallaConfigHost),
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
      valhalla_config: path.basename(valhallaConfigHost),
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
  } finally {
    stopValhallaService();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
