const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const browserAliases = {
  "colyseus-native-websocket-base": path.resolve(workspaceRoot, "node_modules/colyseus.js/lib/transport/WebSocketTransport.js"),
  "colyseus.js": path.resolve(workspaceRoot, "node_modules/colyseus.js/lib/index.js"),
  httpie: path.resolve(workspaceRoot, "node_modules/httpie/xhr/index.js"),
  ws: path.resolve(workspaceRoot, "node_modules/ws/browser.js"),
};

const config = getDefaultConfig(projectRoot);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "./transport/WebSocketTransport" && /colyseus\.js[/\\]lib[/\\]Connection\.js$/.test(context.originModulePath)) {
    return context.resolveRequest(context, path.resolve(projectRoot, "src/network/colyseusWebSocketTransport.ts"), platform);
  }
  const alias = browserAliases[moduleName];
  return context.resolveRequest(context, alias ?? moduleName, platform);
};

module.exports = config;
