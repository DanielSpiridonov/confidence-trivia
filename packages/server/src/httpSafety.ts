import { ErrorRequestHandler, Request, RequestHandler, Response } from "express";
import { logServerError } from "./logging";

// Express 4 does not forward rejected async handlers to error middleware.
export function asyncRoute(handler: (request: Request, response: Response) => Promise<unknown>): RequestHandler {
  return (request, response, next) => {
    Promise.resolve().then(() => handler(request, response)).catch(next);
  };
}

export const httpErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) { next(error); return; }
  if (error?.type === "entity.parse.failed") {
    response.status(400).json({ error: "Invalid JSON request" });
  } else if (error?.type === "entity.too.large") {
    response.status(413).json({ error: "Request is too large" });
  } else if (error?.status === 415) {
    response.status(415).json({ error: "Unsupported request encoding" });
  } else {
    logServerError("HTTP request failed", error);
    response.status(503).json({ error: "Service is temporarily unavailable" });
  }
};
