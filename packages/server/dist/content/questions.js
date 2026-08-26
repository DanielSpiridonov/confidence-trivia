"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionSet = getQuestionSet;
exports.localize = localize;
exports.localizeAnswer = localizeAnswer;
exports.localizeAnswerItems = localizeAnswerItems;
exports.getLocalizedCorrectAnswer = getLocalizedCorrectAnswer;
const shared_1 = require("@confidence-trivia/shared");
const generatedQuestions_1 = require("./generatedQuestions");
const ENABLED_TEST_TYPES = new Set([
    "multiple_choice",
    "true_false",
    "estimate",
    "closest_answer",
    "ordering",
    "word",
]);
/**
 * Phase 1 seed content: a small hardcoded question bank so the game loop
 * can be built and playtested without blocking on the Postgres content
 * pipeline. Phase 2 replaces `getQuestionSet` with a real repository
 * (Prisma) querying by category/difficulty/type/locale/previously-used —
 * everything that CALLS this function should not need to change.
 */
const SEED_QUESTIONS = [
    {
        id: "q1",
        type: "multiple_choice",
        category: "science",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 1,
        translations: {
            en: { text: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Earth", "Mars"] },
            bg: { text: "Коя планета е най-близо до Слънцето?", options: ["Венера", "Меркурий", "Земята", "Марс"] },
        },
    },
    {
        id: "q2",
        type: "true_false",
        category: "science",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "Bananas are technically berries.", options: ["true", "false"] },
            bg: { text: "Бананите технически са ягодоплодни.", options: ["вярно", "невярно"] },
        },
    },
    {
        id: "q3",
        type: "multiple_choice",
        category: "geography",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "Which country has the longest coastline in the world?", options: ["Canada", "Russia", "Indonesia", "Australia"] },
            bg: { text: "Коя държава има най-дългата брегова линия в света?", options: ["Канада", "Русия", "Индонезия", "Австралия"] },
        },
    },
    {
        id: "q4",
        type: "multiple_choice",
        category: "history",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 1,
        translations: {
            en: { text: "In what year did humans first land on the Moon?", options: ["1965", "1969", "1972", "1958"] },
            bg: { text: "В коя година хората за първи път кацнаха на Луната?", options: ["1965", "1969", "1972", "1958"] },
        },
    },
    {
        id: "q5",
        type: "multiple_choice",
        category: "movies",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 1,
        translations: {
            en: { text: "Which film won the Academy Award for Best Picture in 1973?", options: ["Chinatown", "The Godfather", "Jaws", "Rocky"] },
            bg: { text: "Кой филм спечели Оскар за най-добър филм през 1973 г.?", options: ["Чайнатаун", "Кръстникът", "Челюсти", "Роки"] },
        },
    },
    {
        id: "q6",
        type: "true_false",
        category: "animals",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 1,
        translations: {
            en: { text: "A group of lions is called a herd.", options: ["true", "false"] },
            bg: { text: "Група лъвове се нарича стадо.", options: ["вярно", "невярно"] },
        },
    },
    {
        id: "q7",
        type: "multiple_choice",
        category: "sports",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 1,
        translations: {
            en: { text: "Which country has won the most FIFA World Cups?", options: ["Germany", "Brazil", "Italy", "Argentina"] },
            bg: { text: "Коя държава е печелила най-много световни първенства по футбол?", options: ["Германия", "Бразилия", "Италия", "Аржентина"] },
        },
    },
    {
        id: "q8",
        type: "multiple_choice",
        category: "technology",
        difficulty: "hard",
        basePoints: 2,
        correctAnswer: 0,
        translations: {
            en: { text: "In what year was ARPANET, the precursor to the internet, first connected?", options: ["1969", "1975", "1983", "1991"] },
            bg: { text: "В коя година е свързана за пръв път ARPANET, предшественикът на интернет?", options: ["1969", "1975", "1983", "1991"] },
        },
    },
    {
        id: "q9",
        type: "multiple_choice",
        category: "food",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "Which country is the origin of pizza margherita?", options: ["Italy", "Greece", "Spain", "France"] },
            bg: { text: "Коя държава е родината на пица маргарита?", options: ["Италия", "Гърция", "Испания", "Франция"] },
        },
    },
    {
        id: "q10",
        type: "multiple_choice",
        category: "music",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "Which band recorded the song \"Bohemian Rhapsody\"?", options: ["Queen", "The Beatles", "Led Zeppelin", "Pink Floyd"] },
            bg: { text: "Коя група записва песента \"Bohemian Rhapsody\"?", options: ["Queen", "The Beatles", "Led Zeppelin", "Pink Floyd"] },
        },
    },
    {
        id: "q11",
        type: "estimate",
        category: "science",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 206,
        translations: {
            en: { text: "How many bones are in the adult human body?" },
            bg: { text: "Колко кости има в тялото на възрастен човек?" },
        },
    },
    {
        id: "q12",
        type: "word",
        category: "words",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: "penguin",
        translations: {
            en: { text: "Complete the word: P _ N G U _ N" },
            bg: { text: "Попълни думата: П _ Н Г В И Н", correctAnswer: "пингвин" },
        },
    },
    {
        id: "q13",
        type: "estimate",
        category: "math",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 180,
        translations: {
            en: { text: "How many minutes are there in 3 hours?" },
            bg: { text: "Колко минути има в 3 часа?" },
        },
    },
    {
        id: "q14",
        type: "word",
        category: "geography",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: "tokyo",
        translations: {
            en: { text: "What is the capital city of Japan?" },
            bg: { text: "Коя е столицата на Япония?", correctAnswer: "токио" },
        },
    },
    {
        id: "q15",
        type: "closest_answer",
        category: "geography",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: 8848,
        translations: {
            en: { text: "How many meters tall is Mount Everest? Closest answer wins." },
            bg: { text: "Колко метра е висок Еверест? Най-близкият отговор печели." },
        },
    },
    {
        id: "q16",
        type: "closest_answer",
        category: "science",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 149600000,
        translations: {
            en: { text: "About how many kilometers is the Earth from the Sun? Closest answer wins." },
            bg: { text: "На колко километра приблизително е Земята от Слънцето? Най-близкият отговор печели." },
        },
    },
    {
        id: "q17",
        type: "ordering",
        category: "history",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: [1, 3, 2, 0],
        translations: {
            en: {
                text: "Put these inventions in order from oldest to newest.",
                options: ["Telephone", "Wheel", "Printing press", "Compass"],
            },
            bg: {
                text: "Подреди тези изобретения от най-старо към най-ново.",
                options: ["Телефон", "Колело", "Печатна преса", "Компас"],
            },
        },
    },
    {
        id: "q18",
        type: "ordering",
        category: "science",
        difficulty: "easy",
        basePoints: 1,
        correctAnswer: [0, 2, 3, 1],
        translations: {
            en: {
                text: "Order these planets from closest to farthest from the Sun.",
                options: ["Mercury", "Neptune", "Venus", "Earth"],
            },
            bg: {
                text: "Подреди тези планети от най-близо до най-далеч от Слънцето.",
                options: ["Меркурий", "Нептун", "Венера", "Земята"],
            },
        },
    },
    {
        id: "q19",
        type: "closest_answer",
        category: "space",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 384400,
        translations: {
            en: { text: "About how many kilometers away is the Moon from Earth? Closest answer wins." },
            bg: { text: "На приблизително колко километра е Луната от Земята? Най-близкият отговор печели." },
        },
    },
    {
        id: "q20",
        type: "closest_answer",
        category: "geography",
        difficulty: "medium",
        basePoints: 1,
        correctAnswer: 21196,
        translations: {
            en: { text: "Approximately how many kilometers long is the Great Wall of China? Closest answer wins." },
            bg: { text: "Приблизително колко километра е дълга Великата китайска стена? Най-близкият отговор печели." },
        },
    },
    {
        id: "q21",
        type: "closest_answer",
        category: "science",
        difficulty: "hard",
        basePoints: 1,
        correctAnswer: 10935,
        translations: {
            en: { text: "Approximately how many meters deep is the deepest known point in the ocean? Closest answer wins." },
            bg: { text: "Приблизително на колко метра дълбочина е най-дълбоката известна точка в океана? Най-близкият отговор печели." },
        },
    },
    {
        id: "q22", type: "multiple_choice", category: "geography", difficulty: "easy", basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "What is the capital of Australia?", options: ["Canberra", "Sydney", "Melbourne", "Perth"] },
            bg: { text: "Коя е столицата на Австралия?", options: ["Канбера", "Сидни", "Мелбърн", "Пърт"] },
        },
    },
    {
        id: "q23", type: "multiple_choice", category: "science", difficulty: "medium", basePoints: 2,
        correctAnswer: 2,
        translations: {
            en: { text: "What is the chemical symbol for gold?", options: ["Ag", "Fe", "Au", "Gd"] },
            bg: { text: "Какъв е химичният символ на златото?", options: ["Ag", "Fe", "Au", "Gd"] },
        },
    },
    {
        id: "q24", type: "multiple_choice", category: "history", difficulty: "hard", basePoints: 3,
        correctAnswer: 1,
        translations: {
            en: { text: "In which year was the Treaty of Versailles signed?", options: ["1918", "1919", "1921", "1923"] },
            bg: { text: "През коя година е подписан Версайският договор?", options: ["1918", "1919", "1921", "1923"] },
        },
    },
    {
        id: "q25", type: "true_false", category: "animals", difficulty: "easy", basePoints: 1,
        correctAnswer: 0,
        translations: {
            en: { text: "An octopus has three hearts.", options: ["true", "false"] },
            bg: { text: "Октоподът има три сърца.", options: ["вярно", "невярно"] },
        },
    },
    {
        id: "q26", type: "true_false", category: "science", difficulty: "medium", basePoints: 2,
        correctAnswer: 0,
        translations: {
            en: { text: "Sound travels faster through water than through air.", options: ["true", "false"] },
            bg: { text: "Звукът се движи по-бързо във вода, отколкото във въздух.", options: ["вярно", "невярно"] },
        },
    },
    {
        id: "q27", type: "true_false", category: "space", difficulty: "hard", basePoints: 3,
        correctAnswer: 0,
        translations: {
            en: { text: "A day on Venus is longer than a year on Venus.", options: ["true", "false"] },
            bg: { text: "Един ден на Венера е по-дълъг от една година на Венера.", options: ["вярно", "невярно"] },
        },
    },
    {
        id: "q28", type: "estimate", category: "general", difficulty: "easy", basePoints: 1,
        correctAnswer: 366,
        translations: {
            en: { text: "How many days are in a leap year?" },
            bg: { text: "Колко дни има във високосна година?" },
        },
    },
    {
        id: "q29", type: "estimate", category: "music", difficulty: "medium", basePoints: 2,
        correctAnswer: 88,
        translations: {
            en: { text: "How many keys does a standard piano have?" },
            bg: { text: "Колко клавиша има стандартното пиано?" },
        },
    },
    {
        id: "q30", type: "estimate", category: "science", difficulty: "hard", basePoints: 3,
        correctAnswer: 118,
        translations: {
            en: { text: "How many confirmed chemical elements are in the periodic table?" },
            bg: { text: "Колко потвърдени химични елемента има в периодичната таблица?" },
        },
    },
    {
        id: "q31", type: "word", category: "geography", difficulty: "easy", basePoints: 1,
        correctAnswer: ["pacific", "pacific ocean"],
        translations: {
            en: { text: "Name the largest ocean on Earth." },
            bg: { text: "Назовете най-големия океан на Земята.", correctAnswer: ["тихи", "тихият океан", "тих океан"] },
        },
    },
    {
        id: "q32", type: "word", category: "literature", difficulty: "medium", basePoints: 2,
        correctAnswer: "orwell",
        translations: {
            en: { text: "Which author's surname completes the name: George ___, author of 1984?" },
            bg: { text: "Коя фамилия допълва името: Джордж ___, авторът на „1984“?", correctAnswer: "оруел" },
        },
    },
    {
        id: "q33", type: "word", category: "geography", difficulty: "hard", basePoints: 3,
        correctAnswer: "iran",
        translations: {
            en: { text: "Which modern country was historically known as Persia?" },
            bg: { text: "Коя съвременна държава е била исторически известна като Персия?", correctAnswer: "иран" },
        },
    },
    {
        id: "q34", type: "ordering", category: "space", difficulty: "easy", basePoints: 1,
        correctAnswer: [2, 0, 3, 1],
        translations: {
            en: { text: "Order these planets from closest to farthest from the Sun.", options: ["Earth", "Neptune", "Mercury", "Jupiter"] },
            bg: { text: "Подредете планетите от най-близката до най-далечната от Слънцето.", options: ["Земя", "Нептун", "Меркурий", "Юпитер"] },
        },
    },
    {
        id: "q35", type: "ordering", category: "geography", difficulty: "medium", basePoints: 2,
        correctAnswer: [1, 3, 0, 2],
        translations: {
            en: { text: "Order these oceans from largest to smallest.", options: ["Indian", "Pacific", "Arctic", "Atlantic"] },
            bg: { text: "Подредете океаните от най-големия към най-малкия.", options: ["Индийски", "Тихи", "Северен ледовит", "Атлантически"] },
        },
    },
    {
        id: "q36", type: "ordering", category: "history", difficulty: "hard", basePoints: 3,
        correctAnswer: [3, 1, 0, 2],
        translations: {
            en: { text: "Order these events from earliest to latest.", options: ["French Revolution", "Columbus reaches the Americas", "World War I begins", "Magna Carta is sealed"] },
            bg: { text: "Подредете събитията от най-ранното към най-късното.", options: ["Френската революция", "Колумб достига Америка", "Началото на Първата световна война", "Подписването на Магна харта"] },
        },
    },
    {
        id: "q37", type: "closest_answer", category: "science", difficulty: "easy", basePoints: 1,
        correctAnswer: 37,
        translations: {
            en: { text: "Approximately what is normal human body temperature in degrees Celsius? Closest answer wins." },
            bg: { text: "Приблизително колко градуса по Целзий е нормалната човешка телесна температура? Най-близкият отговор печели." },
        },
    },
    {
        id: "q38", type: "closest_answer", category: "geography", difficulty: "medium", basePoints: 2,
        correctAnswer: 40075,
        translations: {
            en: { text: "About how many kilometers is Earth's circumference? Closest answer wins." },
            bg: { text: "Приблизително колко километра е обиколката на Земята? Най-близкият отговор печели." },
        },
    },
    {
        id: "q39", type: "closest_answer", category: "science", difficulty: "hard", basePoints: 3,
        correctAnswer: 299792,
        translations: {
            en: { text: "About how many kilometers per second is the speed of light? Closest answer wins." },
            bg: { text: "Приблизително колко километра в секунда е скоростта на светлината? Най-близкият отговор печели." },
        },
    },
];
const QUESTIONS = [...SEED_QUESTIONS, ...generatedQuestions_1.GENERATED_QUESTIONS];
/**
 * Selects `count` non-repeating questions for a room. `excludeIds` lets a
 * long-running server (multiple concurrent rooms) avoid immediate repeats
 * within one room's own game — it does not need to be global.
 */
function getQuestionSet(count, excludeIds = []) {
    const enabledQuestions = QUESTIONS.filter((q) => ENABLED_TEST_TYPES.has(q.type));
    const questionSet = [];
    const excluded = new Set(excludeIds);
    const usedIds = new Set();
    const typeCounts = new Map();
    const difficultyPattern = ["easy", "medium", "easy", "medium", "hard"];
    while (questionSet.length < count && enabledQuestions.length > 0) {
        if (usedIds.size >= enabledQuestions.length)
            usedIds.clear();
        const unused = enabledQuestions.filter((question) => !usedIds.has(question.id));
        const fresh = unused.filter((question) => !excluded.has(question.id));
        const candidatePool = fresh.length > 0 ? fresh : unused;
        const desiredDifficulty = difficultyPattern[questionSet.length % difficultyPattern.length];
        const difficultyMatches = candidatePool.filter((question) => question.difficulty === desiredDifficulty);
        const candidates = difficultyMatches.length > 0 ? difficultyMatches : candidatePool;
        const lowestTypeCount = Math.min(...candidates.map((question) => typeCounts.get(question.type) ?? 0));
        const leastUsedTypes = candidates.filter((question) => (typeCounts.get(question.type) ?? 0) === lowestTypeCount);
        const selected = leastUsedTypes[Math.floor(Math.random() * leastUsedTypes.length)];
        questionSet.push(selected);
        usedIds.add(selected.id);
        excluded.delete(selected.id);
        typeCounts.set(selected.type, (typeCounts.get(selected.type) ?? 0) + 1);
    }
    return questionSet;
}
function localize(record, locale) {
    const t = record.translations[locale] ?? record.translations.en;
    return {
        id: record.id,
        type: record.type,
        category: record.category,
        difficulty: record.difficulty,
        locale,
        text: t.text,
        options: t.options,
        basePoints: shared_1.DIFFICULTY_REWARDS[record.difficulty],
    };
}
function localizeAnswer(record, locale, answer) {
    const t = record.translations[locale] ?? record.translations.en;
    if (Array.isArray(answer)) {
        return localizeAnswerItems(record, locale, answer).join(" -> ");
    }
    if (typeof answer === "number" && t.options?.[answer] !== undefined) {
        return t.options[answer];
    }
    return String(answer ?? "");
}
function localizeAnswerItems(record, locale, answer) {
    const t = record.translations[locale] ?? record.translations.en;
    if (!Array.isArray(answer))
        return [String(answer ?? "")];
    return answer.map((item) => {
        const optionIndex = Number(item);
        if (Number.isInteger(optionIndex) && t.options?.[optionIndex] !== undefined) {
            return t.options[optionIndex];
        }
        return String(item ?? "");
    });
}
function getLocalizedCorrectAnswer(record, locale) {
    return record.translations[locale]?.correctAnswer ?? record.translations.en.correctAnswer ?? record.correctAnswer;
}
