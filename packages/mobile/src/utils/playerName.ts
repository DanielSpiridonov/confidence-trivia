const PLAYER_NAME_PATTERN = /^[\p{L}\p{N} ]+$/u;

export function isValidPlayerName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 && PLAYER_NAME_PATTERN.test(trimmed);
}
