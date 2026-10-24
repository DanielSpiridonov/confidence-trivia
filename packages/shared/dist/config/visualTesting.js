"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISUAL_TEST_CATEGORIES = exports.ALLOW_SOLO_CUSTOM_TESTING = void 0;
// Temporary Custom-mode filters. Remove after visual-question playtesting.
exports.ALLOW_SOLO_CUSTOM_TESTING = true;
exports.VISUAL_TEST_CATEGORIES = [
    { id: "test_map_shapes", label: "Map Shapes (test)", format: "map_shapes" },
    { id: "test_image_reveal", label: "Image Reveal (test)", format: "image_reveal" },
    { id: "test_image_animals", label: "Photo animals (test)", format: "image_reveal", category: "animals" },
    { id: "test_image_landmarks", label: "Photo landmarks (test)", format: "image_reveal", category: "landmarks" },
    { id: "test_image_objects", label: "Photo objects (test)", format: "image_reveal", category: "objects" },
];
