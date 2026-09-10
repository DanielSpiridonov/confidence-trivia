"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GENERATED_QUESTIONS = void 0;
const shared_1 = require("@confidence-trivia/shared");
const difficultyFor = (index) => (index < 7 ? "easy" : index < 13 ? "medium" : "hard");
function numericOptions(answer, index) {
    const spread = Math.max(2, Math.ceil(Math.abs(answer) * 0.12));
    const values = [answer, answer + spread, answer - spread, answer + spread * 2];
    const correctIndex = index % values.length;
    const ordered = [...values];
    [ordered[0], ordered[correctIndex]] = [ordered[correctIndex], ordered[0]];
    return { options: ordered.map(String), correctIndex };
}
const multipleChoiceQuestions = Array.from({ length: 20 }, (_, index) => {
    const difficulty = difficultyFor(index);
    const left = difficulty === "easy" ? index + 4 : difficulty === "medium" ? index + 13 : index * 3 + 17;
    const right = difficulty === "easy" ? index % 5 + 2 : difficulty === "medium" ? index % 7 + 6 : index % 9 + 11;
    const operation = index % 3;
    const answer = operation === 0 ? left + right : operation === 1 ? left * right : left * right - right;
    const expression = operation === 0 ? `${left} + ${right}` : operation === 1 ? `${left} × ${right}` : `${left} × ${right} − ${right}`;
    const { options, correctIndex } = numericOptions(answer, index);
    return {
        id: `generated_mc_${index + 1}`,
        type: "multiple_choice",
        category: "math",
        difficulty,
        basePoints: shared_1.DIFFICULTY_REWARDS[difficulty],
        correctAnswer: correctIndex,
        translations: {
            en: { text: `What is ${expression}?`, options },
            bg: { text: `Колко е ${expression}?`, options },
        },
    };
});
const trueFalseQuestions = Array.from({ length: 20 }, (_, index) => {
    const difficulty = difficultyFor(index);
    const divisor = index % 7 + 2;
    const quotient = index + (difficulty === "easy" ? 3 : difficulty === "medium" ? 11 : 24);
    const product = divisor * quotient;
    const isTrue = index % 2 === 0;
    const shownResult = product + (isTrue ? 0 : index % 3 + 1);
    return {
        id: `generated_tf_${index + 1}`,
        type: "true_false",
        category: "math",
        difficulty,
        basePoints: shared_1.DIFFICULTY_REWARDS[difficulty],
        correctAnswer: isTrue ? 0 : 1,
        translations: {
            en: { text: `${divisor} × ${quotient} equals ${shownResult}.`, options: ["true", "false"] },
            bg: { text: `${divisor} × ${quotient} е равно на ${shownResult}.`, options: ["вярно", "невярно"] },
        },
    };
});
const estimateQuestions = Array.from({ length: 20 }, (_, index) => {
    const difficulty = difficultyFor(index);
    const amount = difficulty === "easy" ? index + 2 : difficulty === "medium" ? (index + 2) * 3 : (index + 5) * 7;
    const unitMode = index % 3;
    const answer = unitMode === 0 ? amount * 60 : unitMode === 1 ? amount * 24 : amount * 1000;
    const enText = unitMode === 0
        ? `How many seconds are in ${amount} minutes?`
        : unitMode === 1
            ? `How many hours are in ${amount} days?`
            : `How many meters are in ${amount} kilometers?`;
    const bgText = unitMode === 0
        ? `Колко секунди има в ${amount} минути?`
        : unitMode === 1
            ? `Колко часа има в ${amount} дни?`
            : `Колко метра има в ${amount} километра?`;
    return {
        id: `generated_estimate_${index + 1}`,
        type: "estimate",
        category: unitMode === 2 ? "geography" : "general",
        difficulty,
        basePoints: shared_1.DIFFICULTY_REWARDS[difficulty],
        correctAnswer: answer,
        translations: { en: { text: enText }, bg: { text: bgText } },
    };
});
const closestFacts = [
    [828, "Approximately how tall is the Burj Khalifa in meters?", "Приблизително колко метра е висок Бурж Халифа?", "geography"],
    [510, "Approximately how many million square kilometers is Earth's total surface area?", "Приблизително колко милиона квадратни километра е общата площ на Земята?", "science"],
    [195, "How many countries are widely recognized in the world, including the two UN observer states?", "Колко държави са широко признати в света, включително двете държави наблюдатели в ООН?", "geography"],
    [3474, "Approximately how many kilometers is the Moon's diameter?", "Приблизително колко километра е диаметърът на Луната?", "space"],
    [109, "Approximately how many times wider is the Sun than Earth?", "Приблизително колко пъти Слънцето е по-широко от Земята?", "space"],
    [4500, "Approximately how many years old is the Great Pyramid of Giza?", "На приблизително колко години е Хеопсовата пирамида?", "history"],
    [1930, "In what year was the first FIFA World Cup held?", "През коя година се провежда първото световно първенство на ФИФА?", "sports"],
    [776, "In what year BC are the first ancient Olympic Games traditionally dated?", "Коя година пр.н.е. традиционно се приема за начало на древните олимпийски игри?", "history"],
    [1519, "In what year did Leonardo da Vinci die?", "През коя година умира Леонардо да Винчи?", "history"],
    [2850, "Approximately how many kilometers long is the Danube River?", "Приблизително колко километра е дълга река Дунав?", "geography"],
    [6371, "Approximately how many kilometers is Earth's average radius?", "Приблизително колко километра е средният радиус на Земята?", "science"],
    [90, "Approximately how many minutes does the International Space Station take to orbit Earth?", "Приблизително колко минути са нужни на Международната космическа станция да обиколи Земята?", "space"],
    [117, "Approximately how many kilometers long is the Suez Canal?", "Приблизително колко километра е дълъг Суецкият канал?", "geography"],
    [1789, "In what year did the French Revolution begin?", "През коя година започва Френската революция?", "history"],
    [1869, "In what year did Mendeleev publish his first periodic table?", "През коя година Менделеев публикува първата си периодична таблица?", "science"],
    [343, "Approximately how many meters per second does sound travel through air at room temperature?", "Приблизително колко метра в секунда изминава звукът във въздуха при стайна температура?", "science"],
    [12742, "Approximately how many kilometers is Earth's average diameter?", "Приблизително колко километра е средният диаметър на Земята?", "science"],
    [225000000, "Approximately how many kilometers is the average distance between Earth and Mars?", "Приблизително колко километра е средното разстояние между Земята и Марс?", "space"],
    [695700, "Approximately how many kilometers is the Sun's radius?", "Приблизително колко километра е радиусът на Слънцето?", "space"],
    [1642, "How many meters deep is Lake Baikal at its deepest point?", "Колко метра е дълбоко езерото Байкал в най-дълбоката си точка?", "geography"],
];
const closestAnswerQuestions = closestFacts.map(([answer, enText, bgText, category], index) => ({
    id: `generated_closest_${index + 1}`,
    type: "closest_answer",
    category,
    difficulty: difficultyFor(index),
    basePoints: shared_1.DIFFICULTY_REWARDS[difficultyFor(index)],
    correctAnswer: answer,
    translations: {
        en: { text: `${enText} Closest answer wins.` },
        bg: { text: `${bgText} Най-близкият отговор печели.` },
    },
}));
function toRoman(value) {
    const numerals = [
        [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"],
        [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
    ];
    let remaining = value;
    let result = "";
    for (const [amount, numeral] of numerals) {
        while (remaining >= amount) {
            result += numeral;
            remaining -= amount;
        }
    }
    return result;
}
const orderingQuestions = Array.from({ length: 20 }, (_, index) => {
    const difficulty = difficultyFor(index);
    const values = [index * 3 + 14, index * 2 + 5, index * 4 + 21, index + 2];
    const displayOrder = [values[2], values[0], values[3], values[1]];
    const correctAnswer = displayOrder
        .map((value, optionIndex) => ({ value, optionIndex }))
        .sort((a, b) => a.value - b.value)
        .map(({ optionIndex }) => optionIndex);
    const options = displayOrder.map(toRoman);
    return {
        id: `generated_ordering_${index + 1}`,
        type: "ordering",
        category: "math",
        difficulty,
        basePoints: shared_1.DIFFICULTY_REWARDS[difficulty],
        correctAnswer,
        translations: {
            en: { text: "Order these Roman numerals from smallest to largest.", options },
            bg: { text: "Подреди римските числа от най-малкото към най-голямото.", options },
        },
    };
});
const wordFacts = [
    ["paris", "What is the capital of France?", "париж", "Коя е столицата на Франция?"],
    ["rome", "What is the capital of Italy?", "рим", "Коя е столицата на Италия?"],
    ["madrid", "What is the capital of Spain?", "мадрид", "Коя е столицата на Испания?"],
    ["ottawa", "What is the capital of Canada?", "отава", "Коя е столицата на Канада?"],
    ["cairo", "What is the capital of Egypt?", "кайро", "Коя е столицата на Египет?"],
    ["athens", "What is the capital of Greece?", "атина", "Коя е столицата на Гърция?"],
    ["lisbon", "What is the capital of Portugal?", "лисабон", "Коя е столицата на Португалия?"],
    ["oslo", "What is the capital of Norway?", "осло", "Коя е столицата на Норвегия?"],
    ["helsinki", "What is the capital of Finland?", "хелзинки", "Коя е столицата на Финландия?"],
    ["vienna", "What is the capital of Austria?", "виена", "Коя е столицата на Австрия?"],
    [["bern", "berne"], "What is the capital of Switzerland?", ["берн"], "Коя е столицата на Швейцария?"],
    ["reykjavik", "What is the capital of Iceland?", "рейкявик", "Коя е столицата на Исландия?"],
    ["wellington", "What is the capital of New Zealand?", "уелингтън", "Коя е столицата на Нова Зеландия?"],
    ["ankara", "What is the capital of Türkiye?", "анкара", "Коя е столицата на Турция?"],
    ["hanoi", "What is the capital of Vietnam?", "ханой", "Коя е столицата на Виетнам?"],
    ["nairobi", "What is the capital of Kenya?", "найроби", "Коя е столицата на Кения?"],
    ["canberra", "What is the capital of Australia?", "канбера", "Коя е столицата на Австралия?"],
    [["ulaanbaatar", "ulan bator", "ulanbaatar"], "What is the capital of Mongolia?", ["улан батор", "уланбатор"], "Коя е столицата на Монголия?"],
    ["astana", "What is the capital of Kazakhstan?", "астана", "Коя е столицата на Казахстан?"],
    ["windhoek", "What is the capital of Namibia?", "виндхук", "Коя е столицата на Намибия?"],
];
const wordQuestions = wordFacts.map(([answer, enText, bgAnswer, bgText], index) => ({
    id: `generated_word_${index + 1}`,
    type: "word",
    category: "geography",
    difficulty: difficultyFor(index),
    basePoints: shared_1.DIFFICULTY_REWARDS[difficultyFor(index)],
    correctAnswer: answer,
    translations: {
        en: { text: enText },
        bg: { text: bgText, correctAnswer: bgAnswer },
    },
}));
exports.GENERATED_QUESTIONS = [
    ...multipleChoiceQuestions,
    ...trueFalseQuestions,
    ...estimateQuestions,
    ...closestAnswerQuestions,
    ...orderingQuestions,
    ...wordQuestions,
];
