import { Request, RequestHandler } from "express";
import { createHash } from "crypto";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  key?: (request: Request) => string;
}

interface Bucket { count: number; resetAt: number; }

export function createRateLimiter({ windowMs, max, message, key }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  let requestsUntilCleanup = 500;

  return (request, response, next) => {
    const now = Date.now();
    if (--requestsUntilCleanup <= 0) {
      requestsUntilCleanup = 500;
      for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }

    const bucketKey = key?.(request) || request.ip || request.socket.remoteAddress || "unknown";
    const current = buckets.get(bucketKey);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    response.setHeader("RateLimit-Limit", max);
    response.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    response.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
    if (bucket.count <= max) { next(); return; }

    response.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
    response.status(429).json({ error: message });
  };
}

export function authenticatedActorOrIpKey(request: Request): string {
  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization) {
    return `auth:${createHash("sha256").update(authorization).digest("hex")}`;
  }
  return `ip:${request.ip || request.socket.remoteAddress || "unknown"}`;
}
