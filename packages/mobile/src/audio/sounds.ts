import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

export type SoundEffect = "button" | "confidence" | "roomCountdown" | "gameCountdown" | "answerLocked";

const sources: Record<SoundEffect, number> = {
  button: require("../../assets/sounds/buttons_click.mp3"),
  confidence: require("../../assets/sounds/confidence_choosing.mp3"),
  roomCountdown: require("../../assets/sounds/room_countdown.mp3"),
  gameCountdown: require("../../assets/sounds/timer_countdown_gameroom.mp3"),
  answerLocked: require("../../assets/sounds/virtual_vibes-light-bubble-pop-383738.mp3"),
};

const players = Object.fromEntries(
  Object.entries(sources).map(([name, source]) => [name, createAudioPlayer(source)]),
) as Record<SoundEffect, ReturnType<typeof createAudioPlayer>>;
const allPlayers = Object.values(players);
const playGenerations: Record<SoundEffect, number> = {
  button: 0,
  confidence: 0,
  roomCountdown: 0,
  gameCountdown: 0,
  answerLocked: 0,
};

allPlayers.forEach((player) => {
  player.loop = false;
});

let soundEffectsVolume = 1;

export function setSoundEffectsVolume(volume: number) {
  soundEffectsVolume = Math.min(1, Math.max(0, volume));
  allPlayers.forEach((player) => {
    player.volume = soundEffectsVolume;
  });
}

// Rewind completed clips ahead of the next interaction. This lets the common
// button path call play() immediately instead of waiting for an async seek.
allPlayers.forEach((player) => {
  player.addListener("playbackStatusUpdate", (status) => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0).catch(() => undefined);
  });
});

const audioModeReady = setAudioModeAsync({
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  interruptionMode: "mixWithOthers",
}).catch(() => undefined);

export async function prepareSoundEffects() {
  await audioModeReady;
  await Promise.all(allPlayers.map((player) => {
    if (player.isLoaded) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let settled = false;
      let subscription: { remove: () => void } | undefined;

      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        subscription?.remove();
        resolve();
      }

      const timeout = setTimeout(finish, 3_000);
      subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.isLoaded) finish();
      });
    });
  }));
}

export function playSound(effect: SoundEffect) {
  if (soundEffectsVolume <= 0) return;
  const player = players[effect];
  const generation = ++playGenerations[effect];
  player.pause();
  void player.seekTo(0).then(() => {
    if (playGenerations[effect] === generation) player.play();
  }).catch(() => undefined);
}

export function stopAllSoundEffects() {
  (Object.keys(playGenerations) as SoundEffect[]).forEach((effect) => {
    playGenerations[effect] += 1;
  });
  allPlayers.forEach((player) => {
    player.pause();
    void player.seekTo(0).catch(() => undefined);
  });
}
