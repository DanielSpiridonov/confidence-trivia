const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const browserAliases = {
  "colyseus.js": path.resolve(workspaceRoot, "node_modules/colyseus.js/lib/index.js"),
  httpie: path.resolve(workspaceRoot, "node_modules/httpie/xhr/index.js"),
  ws: path.resolve(workspaceRoot, "node_modules/ws/browser.js"),
};

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const alias = browserAliases[moduleName];
  return context.resolveRequest(context, alias ?? moduleName, platform);
};

module.exports = config;