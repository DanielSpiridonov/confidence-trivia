// Build shared first, then run this script to export the original drawings.
// Rasterize at 600x440 with a standard SVG renderer for the bundled PNG files.
import { writeFile, mkdir } from "node:fs/promises";
import { VECTOR_ARTWORKS } from "@confidence-trivia/shared";
const directory = new URL("../assets/visual/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const id of ["scene_01", "scene_02", "scene_03"]) {
  const artwork = VECTOR_ARTWORKS[id];
  const paths = artwork.paths.map((path) => `<path d="${path.d}" fill="${path.fill ?? "#DCC7F3"}" stroke="${path.stroke ?? "none"}" stroke-width="${path.strokeWidth ?? 0}"/>`).join("");
  await writeFile(new URL(`${id}.svg`, directory), `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="440" viewBox="${artwork.viewBox}">${paths}</svg>\n`);
}
