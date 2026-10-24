import { DIFFICULTY_REWARDS, type QuestionRecord } from "@confidence-trivia/shared";
import { STORAGE_IMAGE_QUESTIONS } from "./storageImageQuestions";
// One authoring record per prompt. Presentation and answer validation are independent.
function question(id: string, type: "multiple_choice" | "word" | "estimate", difficulty: QuestionRecord["difficulty"], text: string, answer: unknown, assetId: string, format: "map_shapes" | "image_reveal", options?: string[], note?: string): QuestionRecord {
  return { id, type, difficulty, category: format === "map_shapes" ? "geography" : "visual trivia", correctAnswer: answer, basePoints: DIFFICULTY_REWARDS[difficulty], presentation: { format, assetId, ...(format === "map_shapes" ? { geography: { kind: assetId.includes("continent") ? "continent" as const : "country" as const, id: assetId.split("_").slice(-1)[0] } } : {}) }, difficultyNote: note ?? "Curated editorial rating; not calibrated against player performance.", translations: { en: { text, options }, bg: { text, options } } };
}
export const VISUAL_QUESTIONS: QuestionRecord[] = [
  ...STORAGE_IMAGE_QUESTIONS,
  question("map_it_choice", "multiple_choice", "easy", "Which country is shown?", 1, "geo_country_IT", "map_shapes", ["Greece", "Italy", "Spain", "Portugal"], "Distinctive boot outline; recognition with choices."),
  question("map_au_choice", "multiple_choice", "easy", "Identify this country from its outline.", 2, "geo_country_AU", "map_shapes", ["Greenland", "Iceland", "Australia", "Madagascar"]),
  question("map_jp_word", "word", "hard", "Name the country shown by these islands.", ["Japan", "Nippon", "Nihon"], "geo_country_JP", "map_shapes", undefined, "Island geometry and unaided written recall."),
  question("map_cl_word", "word", "hard", "Which country has this long, narrow outline?", ["Chile", "Republic of Chile"], "geo_country_CL", "map_shapes"),
  question("map_mg_choice", "multiple_choice", "medium", "Which island country is shown?", 3, "geo_country_MG", "map_shapes", ["Sri Lanka", "Iceland", "Cuba", "Madagascar"]),
  question("map_nz_word", "word", "medium", "Identify the country formed by these islands.", ["New Zealand", "Aotearoa"], "geo_country_NZ", "map_shapes"),
  question("map_af_continent", "multiple_choice", "easy", "Which continent is shown?", 0, "geo_continent_AF", "map_shapes", ["Africa", "South America", "Asia", "Europe"]),
  question("map_sa_continent", "word", "medium", "Name this continent.", ["South America"], "geo_continent_SA", "map_shapes"),
  question("reveal_pyramids", "multiple_choice", "easy", "In which country are the pyramids at Giza?", 0, "scene_01", "image_reveal", ["Egypt", "Mexico", "Peru", "Greece"]),
  question("reveal_owl_word", "word", "medium", "Which bird is shown?", ["Owl", "An owl"], "scene_02", "image_reveal"),
  question("reveal_count_red", "estimate", "hard", "How many red apples are shown?", 4, "scene_03", "image_reveal", undefined, "Exact count of four red apples among six colored apples; late visibility makes early counting harder."),
];

