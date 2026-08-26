import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import bg from "./bg.json";

// Question CONTENT is localized server-side (see packages/server/src/content) —
// this i18n instance only covers UI strings, per the project's separation
// of "UI localization" vs "question content localization".
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bg: { translation: bg },
  },
  lng: "en", // default; HomeScreen settings can call i18n.changeLanguage()
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
