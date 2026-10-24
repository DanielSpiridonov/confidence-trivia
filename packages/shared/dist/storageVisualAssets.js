"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMAGE_CREDITS = exports.STORAGE_VISUAL_ASSETS = void 0;
exports.triviaImageUrl = triviaImageUrl;
// Generated from inspected, rights-reviewed records. No answer keys here.
exports.STORAGE_VISUAL_ASSETS = {
    "photo_a26472150a004118": {
        "kind": "raster",
        "width": 4596,
        "height": 3064,
        "storagePath": "animals/chameleon.jpg"
    },
    "photo_4d39a2b8c3506d1d": {
        "kind": "raster",
        "width": 3281,
        "height": 4922,
        "storagePath": "animals/eagle.jpg"
    },
    "photo_260d56059b2b68bb": {
        "kind": "raster",
        "width": 5102,
        "height": 3583,
        "storagePath": "animals/giraffe.jpg"
    },
    "photo_d0183d926fe70793": {
        "kind": "raster",
        "width": 4000,
        "height": 6001,
        "storagePath": "animals/lynx.jpg"
    },
    "photo_9d0471efdf5c6908": {
        "kind": "raster",
        "width": 3061,
        "height": 4016,
        "storagePath": "animals/squirrel.jpg"
    },
    "photo_10085de35e0612fc": {
        "kind": "raster",
        "width": 7148,
        "height": 4772,
        "storagePath": "animals/stag.jpg"
    },
    "photo_a57a79462e7045e3": {
        "kind": "raster",
        "width": 3024,
        "height": 4032,
        "storagePath": "landmarks/big-ben.jpg"
    },
    "photo_c699c4e18a16df57": {
        "kind": "raster",
        "width": 7526,
        "height": 5018,
        "storagePath": "landmarks/hulki-okan.jpg"
    },
    "photo_118a51fd88db41f4": {
        "kind": "raster",
        "width": 4160,
        "height": 6240,
        "storagePath": "landmarks/iffel-tower.jpg"
    },
    "photo_ff7224fc7c079f1d": {
        "kind": "raster",
        "width": 4715,
        "height": 3734,
        "storagePath": "landmarks/louvar.jpg"
    },
    "photo_d6c10140ad1bb0ef": {
        "kind": "raster",
        "width": 3355,
        "height": 5032,
        "storagePath": "landmarks/statue-of-liberty.jpg"
    },
    "photo_32c4ef9fea6dc3b0": {
        "kind": "raster",
        "width": 6000,
        "height": 4000,
        "storagePath": "objects/car.jpg"
    },
    "photo_25bf9129dba26171": {
        "kind": "raster",
        "width": 6000,
        "height": 4000,
        "storagePath": "objects/clock.jpg"
    },
    "photo_190fb8505e30542f": {
        "kind": "raster",
        "width": 3000,
        "height": 3000,
        "storagePath": "objects/crossaint.jpg"
    },
    "photo_2dd3c7416a9e09ae": {
        "kind": "raster",
        "width": 3008,
        "height": 2000,
        "storagePath": "objects/dice.jpg"
    },
    "photo_94fbc706e8cf5960": {
        "kind": "raster",
        "width": 3121,
        "height": 4480,
        "storagePath": "objects/hourglass.jpg"
    },
    "photo_935b0fe4c4b678d8": {
        "kind": "raster",
        "width": 2848,
        "height": 4272,
        "storagePath": "objects/microphone.jpg"
    },
    "photo_529cb7eed89cf6d7": {
        "kind": "raster",
        "width": 6120,
        "height": 8160,
        "storagePath": "objects/pine.jpg"
    }
};
exports.IMAGE_CREDITS = [
    {
        "assetId": "photo_a26472150a004118",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_4d39a2b8c3506d1d",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_260d56059b2b68bb",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_d0183d926fe70793",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_9d0471efdf5c6908",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_10085de35e0612fc",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_a57a79462e7045e3",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_c699c4e18a16df57",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_118a51fd88db41f4",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_ff7224fc7c079f1d",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_d6c10140ad1bb0ef",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_32c4ef9fea6dc3b0",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_25bf9129dba26171",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_190fb8505e30542f",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_2dd3c7416a9e09ae",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_94fbc706e8cf5960",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_935b0fe4c4b678d8",
        "license": "owner-reviewed"
    },
    {
        "assetId": "photo_529cb7eed89cf6d7",
        "license": "owner-reviewed"
    }
];
function triviaImageUrl(baseUrl, path) {
    if (!baseUrl || !/^(animals|landmarks|objects)\/[A-Za-z0-9_ .()/-]+\.(webp|jpe?g|png)$/i.test(path)
        || path.split("/").some((part) => !part || part === "." || part === ".."))
        return undefined;
    try {
        const url = new URL(baseUrl);
        if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
            return undefined;
        return `${url.origin}/storage/v1/object/public/trivia-images/${path.split("/").map(encodeURIComponent).join("/")}`;
    }
    catch {
        return undefined;
    }
}
