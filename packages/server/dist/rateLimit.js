"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = createRateLimiter;
exports.authenticatedActorOrIpKey = authenticatedActorOrIpKey;
const crypto_1 = require("crypto");
const auth_1 = require("./auth");
function createRateLimiter({ windowMs, max, message, key }) {
    const buckets = new Map();
    let requestsUntilCleanup = 500;
    return (request, response, next) => {
        const applyLimit = (resolvedKey) => {
            const now = Date.now();
            if (--requestsUntilCleanup <= 0) {
                requestsUntilCleanup = 500;
                for (const [bucketKey, bucket] of buckets)
                    if (bucket.resetAt <= now)
                        buckets.delete(bucketKey);
            }
            const bucketKey = resolvedKey || request.ip || request.socket.remoteAddress || "unknown";
            const current = buckets.get(bucketKey);
            const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
            bucket.count += 1;
            buckets.set(bucketKey, bucket);
            response.setHeader("RateLimit-Limit", max);
            response.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
            response.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
            if (bucket.count <= max) {
                next();
                return;
            }
            response.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
            response.status(429).json({ error: message });
        };
        if (key) {
            Promise.resolve().then(() => key(request)).then(applyLimit).catch(next);
        }
        else
            applyLimit();
    };
}
async function authenticatedActorOrIpKey(request) {
    const identity = await (0, auth_1.requestIdentity)(request);
    if (identity) {
        return `auth:${(0, crypto_1.createHash)("sha256").update(identity.userId).digest("hex")}`;
    }
    return `ip:${request.ip || request.socket.remoteAddress || "unknown"}`;
}
