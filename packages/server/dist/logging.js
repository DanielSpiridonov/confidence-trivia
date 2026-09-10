"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logServerError = logServerError;
function logServerError(context, error) {
    if (process.env.NODE_ENV !== "production") {
        console.error(context, error);
        return;
    }
    const safe = typeof error === "object" && error
        ? {
            name: "name" in error && typeof error.name === "string" ? error.name : "Error",
            code: "code" in error && typeof error.code === "string" ? error.code : undefined,
        }
        : { name: "Error" };
    console.error(context, safe);
}
