const HIGH_CONFIDENCE_FRAGMENTS = [
  "fuck", "motherfuck", "nigger", "nigga", "faggot",
  "курв", "путк", "хуй", "педер", "шибан", "лайно", "копеле",
];

const BLOCKED_WORDS = new Set([
  "shit", "bitch", "cunt", "dick", "cock", "whore", "slut", "retard",
  "asshole", "bastard", "еба", "еби", "ебал", "ебан", "педал", "задник",
]);

function normalizeForModeration(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[013457@$!|]/g, (character) => ({
      "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
      "@": "a", "$": "s", "!": "i", "|": "i",
    })[character] ?? character);
}

export function isOffensivePlayerName(name: string): boolean {
  const normalized = normalizeForModeration(name);
  const words = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.some((word) => BLOCKED_WORDS.has(word))) return true;

  const compact = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  return HIGH_CONFIDENCE_FRAGMENTS.some((fragment) => compact.includes(fragment));
}
