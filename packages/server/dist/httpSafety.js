"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpErrorHandler = void 0;
exports.asyncRoute = asyncRoute;
const logging_1 = require("./logging");
// Express 4 does not forward rejected async handlers to error middleware.
function asyncRoute(handler) {
    return (request, response, next) => {
        Promise.resolve().then(() => handler(request, response)).catch(next);
    };
}
const httpErrorHandler = (error, _request, response, next) => {
    if (response.headersSent) {
        next(error);
        return;
    }
    if (error?.type === "entity.parse.failed") {
        response.status(400).json({ error: "Invalid JSON request" });
    }
    else if (error?.type === "entity.too.large") {
        response.status(413).json({ error: "Request is too large" });
    }
    else if (error?.status === 415) {
        response.status(415).json({ error: "Unsupported request encoding" });
    }
    else {
        (0, logging_1.logServerError)("HTTP request failed", error);
        response.status(503).json({ error: "Service is temporarily unavailable" });
    }
};
exports.httpErrorHandler = httpErrorHandler;
