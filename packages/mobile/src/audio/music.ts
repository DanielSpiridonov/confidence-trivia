import { createAudioPlayer } from "expo-audio";

const musicPlayer = createAudioPlayer(require("../../assets/sounds/game_music.mp3"));
musicPlayer.loop = true;
musicPlayer.volume = 0;

let configuredVolume = 0.5;
let menuMusicWanted = false;
let fadeGeneration = 0;

function fadeTo(target: number, durationMs: number, pauseWhenDone = false) {
  const generation = ++fadeGeneration;
  const startVolume = musicPlayer.volume;
  const steps = Math.max(1, Math.round(durationMs / 50));
  let step = 0;

  const interval = setInterval(() => {
    if (generation !== fadeGeneration) {
      clearInterval(interval);
      return;
    }

    step += 1;
    const progress = Math.min(1, step / steps);
    musicPlayer.volume = startVolume + (target - startVolume) * progress;

    if (progress >= 1) {
      clearInterval(interval);
      if (pauseWhenDone && !menuMusicWanted) musicPlayer.pause();
    }
  }, 50);
}

export async function prepareMusic() {
  if (musicPlayer.isLoaded) return;

  await new Promise<void>((resolve) => {
    let settled = false;
    let subscription: { remove: () => void } | undefined;

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      resolve();
    }

    const timeout = setTimeout(finish, 5_000);
    subscription = musicPlayer.addListener("playbackStatusUpdate", (status) => {
      if (status.isLoaded) finish();
    });
  });
}

export function setMusicVolume(volume: number) {
  configuredVolume = Math.min(1, Math.max(0, volume));
  if (menuMusicWanted && musicPlayer.playing) fadeTo(configuredVolume, 150);
}

export function startMenuMusic() {
  menuMusicWanted = true;
  if (!musicPlayer.playing) {
    musicPlayer.volume = 0;
    musicPlayer.play();
  }
  fadeTo(configuredVolume, 900);
}

export function stopMenuMusic() {
  if (!menuMusicWanted && !musicPlayer.playing) return;
  menuMusicWanted = false;
  fadeTo(0, 650, true);
}

export function pauseMusicForBackground() {
  ++fadeGeneration;
  musicPlayer.pause();
}
