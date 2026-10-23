const fs = require("node:fs/promises");
const path = require("node:path");
const { withFinalizedMod } = require("expo/config-plugins");

// Android displays the middle 72dp of a 108dp adaptive layer. The existing
// artwork already has some padding, but its emblem still fills ~94% of that
// viewport. An 8% inset on each side brings it to ~79%, matching the iOS icon.
// Apply this after Expo generates icons so rebuilding never loses the inset.
async function applyAndroidIconInset(androidProjectRoot) {
  const resourceRoot = path.join(androidProjectRoot, "app", "src", "main", "res", "mipmap-anydpi-v26");
  for (const filename of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const file = path.join(resourceRoot, filename);
    const xml = await fs.readFile(file, "utf8");
    const foreground = '<foreground android:drawable="@mipmap/ic_launcher_foreground"/>';
    const inset = '<foreground>\n        <inset android:drawable="@mipmap/ic_launcher_foreground" android:insetLeft="8%" android:insetTop="8%" android:insetRight="8%" android:insetBottom="8%"/>\n    </foreground>';
    // The replacement is deliberately idempotent for repeated prebuilds.
    if (!xml.includes(foreground) && !xml.includes(inset)) {
      throw new Error(`Unexpected adaptive icon foreground in ${filename}`);
    }
    await fs.writeFile(file, xml.replace(foreground, inset), "utf8");
  }
}

module.exports = function withAndroidIconInset(config) {
  return withFinalizedMod(config, ["android", async (config) => {
    await applyAndroidIconInset(config.modRequest.platformProjectRoot);
    return config;
  }]);
};

module.exports.applyAndroidIconInset = applyAndroidIconInset;
