// Source: Natural Earth 1:110m admin-0 countries, public domain.
// Download https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
// Then: node packages/shared/scripts/import-geography.mjs path/to/download.json
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = await readFile(process.argv[2]);
const { features } = JSON.parse(source);
const selections = { IT: "Italy", JP: "Japan", AU: "Australia", CL: "Chile", MG: "Madagascar", NZ: "New Zealand", AF: "Africa", SA: "South America" };
const output = {};
for (const [id, name] of Object.entries(selections)) {
  const selected = features.filter((f) => id === "AF" || id === "SA" ? f.properties.CONTINENT === name : f.properties.ADMIN === name);
  if (!selected.length) throw Error(`Missing ${name}`);
  const polygons = selected.flatMap((f) => f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
  // France's country-level CONTINENT is Europe, but its French Guiana polygon
  // belongs to the South American silhouette. Keep that physical land part.
  if (id === "SA") {
    const france = features.find((f) => f.properties.ADMIN === "France");
    const parts = france.geometry.type === "Polygon" ? [france.geometry.coordinates] : france.geometry.coordinates;
    polygons.push(...parts.filter((p) => p[0].every(([x,y]) => x > -60 && x < -45 && y > -5 && y < 15)));
  }
  const points = polygons.flat(2);
  // Local equirectangular projection; identical scale on both projected axes.
  // Preserve all rings/islands; unwrap NZ around the dateline before fitting.
  const lon = (x) => id === "NZ" && x < 0 ? x + 360 : x;
  const minLat = Math.min(...points.map((p) => p[1])), maxLat = Math.max(...points.map((p) => p[1]));
  const cos = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const xs = points.map((p) => lon(p[0]) * cos), ys = points.map((p) => -p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(280 / (maxX-minX), 200 / (maxY-minY));
  const dx = (300 - (maxX-minX)*scale)/2, dy = (220 - (maxY-minY)*scale)/2;
  const paths = polygons.map((rings) => ({ d: rings.map((ring) => ring.map((p,i) => `${i ? "L" : "M"}${((lon(p[0])*cos-minX)*scale+dx).toFixed(2)},${((-p[1]-minY)*scale+dy).toFixed(2)}`).join("")+"Z").join(""), ...(id === "AF" || id === "SA" ? { stroke: "#DCC7F3", strokeWidth: 0.4 } : {}) }));
  output[`geo_${id === "AF" || id === "SA" ? "continent" : "country"}_${id}`] = { viewBox: "0 0 300 220", paths };
}
const hash = createHash("sha256").update(source).digest("hex");
await writeFile(new URL("../src/geographyAssets.ts", import.meta.url), `// Generated from Natural Earth public-domain admin-0 1:110m data.\n// Source SHA256: ${hash}\n// Rebuild with scripts/import-geography.mjs; see VISUAL_QUESTIONS.md for provenance.\nimport type { VectorArtwork } from './visualQuestions';\nexport const GEOGRAPHY_ASSETS: Record<string, VectorArtwork> = ${JSON.stringify(output)};\n`);
console.log(`Generated ${Object.keys(output).length} silhouettes; source sha256 ${hash}`);
