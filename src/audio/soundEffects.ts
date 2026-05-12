import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

export type SoundName = "draw" | "gameEnd" | "lose" | "music" | "pick" | "play" | "turn" | "win";

const soundSources: Record<SoundName, number> = {
  draw: require("../../resources/sounds/draw-card.mp3"),
  gameEnd: require("../../resources/sounds/game-end.wav"),
  lose: require("../../resources/sounds/player-loses.wav"),
  music: require("../../resources/sounds/music.wav"),
  pick: require("../../resources/sounds/pick-card.wav"),
  play: require("../../resources/sounds/play-card.mp3"),
  turn: require("../../resources/sounds/turn-change.wav"),
  win: require("../../resources/sounds/win.wav"),
};

const volumes: Record<SoundName, number> = {
  draw: 0.7,
  gameEnd: 0.85,
  lose: 0.85,
  music: 0.24,
  pick: 0.45,
  play: 0.72,
  turn: 0.38,
  win: 0.88,
};

let configured = false;
const players = new Map<SoundName, AudioPlayer>();

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
      updateInterval: 1000,
    });
    player.volume = volumes[name];
    player.loop = name === "music";
    players.set(name, player);
  }

  return player;
}

export async function playSound(name: SoundName) {
  await configureAudio();

  const player = getPlayer(name);
  try {
    await player.seekTo(0);
    player.play();
  } catch {
    // Audio should never block gameplay. A later tap/event can try again.
  }
}

export async function startMusic() {
  await playSound("music");
}

export function stopMusic() {
  const player = players.get("music");
  if (player?.playing) {
    player.pause();
  }
}
