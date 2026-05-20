import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

export type SoundName = "button" | "draw" | "gameEnd" | "lose" | "matchIntro" | "pick" | "play" | "turn" | "win";
export type MusicScene = "game" | "gameFinal" | "gameIntense" | "menu" | "queue" | "rooms";

const soundSources: Record<SoundName, number> = {
  button: require("../../resources/sounds/pick-card.wav"),
  draw: require("../../resources/sounds/draw-card.mp3"),
  gameEnd: require("../../resources/sounds/game-end.wav"),
  lose: require("../../resources/sounds/player-loses.wav"),
  matchIntro: require("../../resources/sounds/game-end.wav"),
  pick: require("../../resources/sounds/pick-card.wav"),
  play: require("../../resources/sounds/play-card.mp3"),
  turn: require("../../resources/sounds/turn-change.wav"),
  win: require("../../resources/sounds/win.wav"),
};

const musicSources: Record<MusicScene, number> = {
  game: require("../../resources/sounds/music.wav"),
  gameFinal: require("../../resources/sounds/music.wav"),
  gameIntense: require("../../resources/sounds/music.wav"),
  menu: require("../../resources/sounds/music.wav"),
  queue: require("../../resources/sounds/music.wav"),
  rooms: require("../../resources/sounds/music.wav"),
};

const volumes: Record<SoundName, number> = {
  button: 0.34,
  draw: 0.7,
  gameEnd: 0.85,
  lose: 0.85,
  matchIntro: 0.76,
  pick: 0.45,
  play: 0.72,
  turn: 0.38,
  win: 0.88,
};

const musicVolumes: Record<MusicScene, number> = {
  game: 0.2,
  gameFinal: 0.28,
  gameIntense: 0.24,
  menu: 0.22,
  queue: 0.2,
  rooms: 0.18,
};

let configured = false;
const players = new Map<SoundName, AudioPlayer>();
const musicPlayers = new Map<MusicScene, AudioPlayer>();
let musicMuted = false;
let currentMusicScene: MusicScene | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

async function configureAudio() {
  if (configured) {
    return;
  }

  configured = true;
  try {
    await setAudioModeAsync({
      interruptionMode: "mixWithOthers",
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
  } catch {
    configured = false;
  }
}

function getPlayer(name: SoundName) {
  let player = players.get(name);
  if (!player) {
    player = createAudioPlayer(soundSources[name], {
      downloadFirst: true,
      updateInterval: 100,
    });
    player.volume = volumes[name];
    player.loop = false;
    players.set(name, player);
  }

  return player;
}

function getMusicPlayer(scene: MusicScene) {
  let player = musicPlayers.get(scene);
  if (!player) {
    player = createAudioPlayer(musicSources[scene], {
      downloadFirst: true,
      updateInterval: 250,
    });
    player.volume = musicVolumes[scene];
    player.loop = true;
    musicPlayers.set(scene, player);
  }

  return player;
}

export async function warmSoundEffects() {
  await configureAudio();
  (Object.keys(soundSources) as SoundName[]).forEach((name) => {
    getPlayer(name);
  });
  (Object.keys(musicSources) as MusicScene[]).forEach((scene) => {
    getMusicPlayer(scene);
  });
}

export async function playSound(name: SoundName) {
  await configureAudio();

  const player = getPlayer(name);
  try {
    player.pause();
    await player.seekTo(0);
    player.play();
  } catch {
    // Audio should never block gameplay. A later tap/event can try again.
  }
}

export async function startMusic() {
  await setMusicScene("menu");
}

export function stopMusic() {
  musicPlayers.forEach((player) => player.pause());
  currentMusicScene = null;
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

export function setMusicMuted(muted: boolean) {
  musicMuted = muted;
  if (muted) {
    stopMusic();
    return;
  }

  void setMusicScene(currentMusicScene ?? "menu");
}

export async function setMusicScene(scene: MusicScene) {
  await configureAudio();
  if (musicMuted || currentMusicScene === scene) {
    return;
  }

  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }

  const previousScene = currentMusicScene;
  const previous = previousScene ? getMusicPlayer(previousScene) : null;
  const next = getMusicPlayer(scene);
  currentMusicScene = scene;

  try {
    next.volume = 0;
    void next.seekTo(0);
    next.play();

    let step = 0;
    fadeTimer = setInterval(() => {
      step += 1;
      const progress = Math.min(1, step / 12);
      next.volume = musicVolumes[scene] * progress;
      if (previous) {
        previous.volume = musicVolumes[previousScene as MusicScene] * (1 - progress);
      }
      if (progress >= 1) {
        if (previous) {
          previous.pause();
          previous.volume = musicVolumes[previousScene as MusicScene];
        }
        if (fadeTimer) {
          clearInterval(fadeTimer);
          fadeTimer = null;
        }
      }
    }, 45);
  } catch {
    // Music transitions should never block the UI.
  }
}
