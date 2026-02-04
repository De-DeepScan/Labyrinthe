import { io, Socket } from "socket.io-client";

// ✅ 1. CONFIRMING IP ADDRESS (Must be your Master PC IP)
const BACKOFFICE_URL = "http://192.168.10.1:3000";

// =====================
// Game Types
// =====================

interface GameAction {
  id: string;
  label: string;
  params?: string[];
}

interface RegisterData {
  gameId: string;
  name: string;
  availableActions: GameAction[];
  role?: string;
}

interface Command {
  type: "command";
  action: string;
  payload: Record<string, unknown>;
}

// =====================
// Audio Types
// =====================

interface AudioConfig {
  enabled: boolean;
  autoUnlock: boolean;
  debug: boolean;
}

interface PlayAmbientPayload {
  soundId: string;
  file: string;
  volume?: number;
  audioBase64: string;
  mimeType?: string;
}

interface StopAmbientPayload {
  soundId: string;
}

interface VolumeAmbientPayload {
  soundId: string;
  volume: number;
}

interface PlayPresetPayload {
  presetIdx: number;
  file: string;
  audioBase64: string;
  mimeType?: string;
}

interface PausePresetPayload {
  presetIdx: number;
}

interface SeekPresetPayload {
  presetIdx: number;
  time: number;
}

interface StopPresetPayload {
  presetIdx: number;
}

interface PlayTTSPayload {
  audioBase64: string;
  mimeType?: string;
}

interface VolumePayload {
  volume: number;
}

interface AudioStatus {
  unlocked: boolean;
  enabled: boolean;
  masterVolume: number;
  iaVolume: number;
  activeAmbients: string[];
  activePresets: number[];
}

// =====================
// 🔌 SOCKET 1: MAIN GAME CONNECTION
// =====================

const socket: Socket = io(BACKOFFICE_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  autoConnect: true,
});

// =====================
// Game State
// =====================

let registeredData: RegisterData | null = null;
let lastKnownState: Record<string, unknown> = {};

// =====================
// Audio State
// =====================

let audioConfig: AudioConfig = {
  enabled: true,
  autoUnlock: true,
  debug: false,
};

let audioUnlocked = false;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterVolume = 1;
let iaVolume = 1;

const ambientAudios: Map<string, HTMLAudioElement> = new Map();
const presetAudios: Map<number, HTMLAudioElement> = new Map();
let ttsAudio: HTMLAudioElement | null = null;
let progressInterval: number | null = null;

// =====================
// 📷 CAMERA STATE (Parallel System)
// =====================

// We use a SEPARATE socket for the camera so we don't disconnect the game
let cameraSocket: Socket | null = null; 
let cameraStream: MediaStream | null = null;
let cameraInterval: number | null = null;
let isRebooting = false;
let hiddenVideo: HTMLVideoElement | null = null;

// =====================
// Audio Helpers
// =====================

function audioLog(msg: string, ...args: unknown[]): void {
  if (audioConfig.debug) {
    console.log(`[gamemaster:audio] ${msg}`, ...args);
  }
}

function base64ToBlobUrl(audioBase64: string, mimeType: string): string {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

function initAudioContext(): void {
  if (audioCtx) return;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  audioCtx = new AudioContextClass();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(audioCtx.destination);
  audioLog("AudioContext initialized");
}

function routeThroughMaster(audio: HTMLAudioElement): void {
  if (!audioCtx || !masterGain) return;
  try {
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(masterGain);
  } catch {
    // Already routed
  }
}

function doUnlockAudio(): void {
  if (audioUnlocked || !audioConfig.enabled) return;

  initAudioContext();

  if (audioCtx) {
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
  }

  audioUnlocked = true;
  audioLog("Audio unlocked via user interaction");

  socket.emit("register-audio-player", {});
  startProgressReporting();
  removeUnlockListeners();
}

const unlockEvents = ["click", "touchstart", "keydown"] as const;

function addUnlockListeners(): void {
  if (typeof window === "undefined") return;
  for (const event of unlockEvents) {
    window.addEventListener(event, doUnlockAudio, { once: true, passive: true });
  }
  audioLog("User interaction listeners added");
}

function removeUnlockListeners(): void {
  if (typeof window === "undefined") return;
  for (const event of unlockEvents) {
    window.removeEventListener(event, doUnlockAudio);
  }
}

function startProgressReporting(): void {
  if (progressInterval !== null) return;

  progressInterval = window.setInterval(() => {
    for (const [idx, audio] of presetAudios) {
      if (!audio.paused && audio.duration) {
        socket.emit("audio:preset-progress", {
          presetIdx: idx,
          currentTime: audio.currentTime,
          duration: audio.duration,
        });
      }
    }
  }, 250);
}

function stopProgressReporting(): void {
  if (progressInterval !== null) {
    window.clearInterval(progressInterval);
    progressInterval = null;
  }
}

function stopAllAudio(): void {
  for (const [, audio] of ambientAudios) {
    audio.pause();
    audio.src = "";
  }
  ambientAudios.clear();

  for (const [, audio] of presetAudios) {
    audio.pause();
    audio.src = "";
  }
  presetAudios.clear();

  if (ttsAudio) {
    ttsAudio.pause();
    ttsAudio.src = "";
    ttsAudio = null;
  }

  audioLog("All audio stopped");
}

// =====================
// Camera Helpers
// =====================

// Helper to show debug status on screen
function showCameraStatus(msg: string, color: string = '#0f0') {
    let el = document.getElementById('camera-debug-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'camera-debug-status';
        el.style.cssText = "position:fixed; bottom:10px; left:10px; background:rgba(0,0,0,0.7); color:#fff; padding:5px; font-family:monospace; font-size:12px; z-index:9999; pointer-events:none;";
        document.body.appendChild(el);
    }
    el.innerHTML = `<span style="color:${color}">●</span> ${msg}`;
}

function cleanupCamera(): void {
  if (cameraInterval) {
    clearInterval(cameraInterval);
    cameraInterval = null;
  }
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  if (hiddenVideo) {
    hiddenVideo.pause();
    hiddenVideo.srcObject = null;
    hiddenVideo.remove(); // Remove from DOM
    hiddenVideo = null;
  }
  if (cameraSocket) {
    cameraSocket.disconnect();
    cameraSocket = null;
  }
  const statusEl = document.getElementById('camera-debug-status');
  if (statusEl) statusEl.remove();
}

// =====================
// Audio Event Listeners
// =====================

function setupAudioEventListeners(): void {
  // Ambient sounds
  socket.on("audio:play-ambient", (data: PlayAmbientPayload) => {
    if (!audioUnlocked || !audioConfig.enabled) return;
    const { soundId, audioBase64, mimeType, volume } = data;
    audioLog("Play ambient:", soundId);

    const existing = ambientAudios.get(soundId);
    if (existing) {
      existing.pause();
      existing.src = "";
    }

    const url = base64ToBlobUrl(audioBase64, mimeType || "audio/mpeg");
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume ?? 0.5;
    routeThroughMaster(audio);
    audio.play().catch((e) => audioLog("Play ambient error:", e.message));
    ambientAudios.set(soundId, audio);
  });

  socket.on("audio:stop-ambient", (data: StopAmbientPayload) => {
    const { soundId } = data;
    audioLog("Stop ambient:", soundId);
    const audio = ambientAudios.get(soundId);
    if (audio) {
      audio.pause();
      audio.src = "";
      ambientAudios.delete(soundId);
    }
  });

  socket.on("audio:volume-ambient", (data: VolumeAmbientPayload) => {
    const { soundId, volume } = data;
    const audio = ambientAudios.get(soundId);
    if (audio) {
      audio.volume = volume;
      audioLog("Ambient volume:", soundId, volume);
    }
  });

  // Presets
  socket.on("audio:play-preset", (data: PlayPresetPayload) => {
    if (!audioUnlocked || !audioConfig.enabled) return;
    const { presetIdx, audioBase64, mimeType } = data;

    const existing = presetAudios.get(presetIdx);
    if (existing && existing.src) {
      audioLog("Resume preset:", presetIdx);
      existing.volume = iaVolume;
      existing.play().catch((e) => audioLog("Resume preset error:", e.message));
      return;
    }

    audioLog("Play preset:", presetIdx);
    const url = base64ToBlobUrl(audioBase64, mimeType || "audio/mpeg");
    const audio = new Audio(url);
    audio.volume = iaVolume;
    routeThroughMaster(audio);

    audio.onended = () => {
      socket.emit("audio:preset-progress", {
        presetIdx,
        currentTime: audio.duration,
        duration: audio.duration,
        ended: true,
      });
      presetAudios.delete(presetIdx);
      URL.revokeObjectURL(url);
    };

    audio.play().catch((e) => audioLog("Play preset error:", e.message));
    presetAudios.set(presetIdx, audio);
  });

  socket.on("audio:pause-preset", (data: PausePresetPayload) => {
    const { presetIdx } = data;
    audioLog("Pause preset:", presetIdx);
    const audio = presetAudios.get(presetIdx);
    if (audio) audio.pause();
  });

  socket.on("audio:seek-preset", (data: SeekPresetPayload) => {
    const { presetIdx, time } = data;
    audioLog("Seek preset:", presetIdx, "to", time);
    const audio = presetAudios.get(presetIdx);
    if (audio) audio.currentTime = time;
  });

  socket.on("audio:stop-preset", (data: StopPresetPayload) => {
    const { presetIdx } = data;
    audioLog("Stop preset:", presetIdx);
    const audio = presetAudios.get(presetIdx);
    if (audio) {
      audio.pause();
      audio.src = "";
      presetAudios.delete(presetIdx);
    }
  });

  // TTS
  socket.on("audio:play-tts", (data: PlayTTSPayload) => {
    if (!audioUnlocked || !audioConfig.enabled) return;
    const { audioBase64, mimeType } = data;
    audioLog("Play TTS");

    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.src = "";
    }

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType || "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    ttsAudio = new Audio(url);
    ttsAudio.volume = iaVolume;
    routeThroughMaster(ttsAudio);
    ttsAudio.onended = () => {
      URL.revokeObjectURL(url);
      ttsAudio = null;
    };
    ttsAudio.play().catch((e) => audioLog("TTS play error:", e.message));
  });

  // Volume controls
  socket.on("audio:volume-ia", (data: VolumePayload) => {
    iaVolume = data.volume;
    audioLog("IA volume:", Math.round(iaVolume * 100) + "%");
    for (const audio of presetAudios.values()) {
      audio.volume = iaVolume;
    }
    if (ttsAudio) ttsAudio.volume = iaVolume;
  });

  socket.on("audio:master-volume", (data: VolumePayload) => {
    masterVolume = data.volume;
    audioLog("Master volume:", Math.round(masterVolume * 100) + "%");
    if (masterGain) masterGain.gain.value = masterVolume;
  });

  // Stop all
  socket.on("audio:stop-all", () => {
    audioLog("Stop all audio");
    stopAllAudio();
  });
}

// =====================
// Game Connection Handlers
// =====================

socket.on("connect", () => {
  console.log("[gamemaster] Connected to backoffice (GAME CHANNEL)");
  if (registeredData) {
    socket.emit("register", registeredData);
    if (Object.keys(lastKnownState).length > 0) {
      setTimeout(() => {
        socket.emit("state_update", { state: lastKnownState });
      }, 100);
    }
  }
  if (audioUnlocked && audioConfig.enabled) {
    socket.emit("register-audio-player", {});
  }
});

socket.on("disconnect", (reason: string) => {
  console.log(`[gamemaster] Disconnected: ${reason}`);
});

socket.io.on("reconnect_attempt", (attempt: number) => {
  console.log(`[gamemaster] Reconnection attempt ${attempt}`);
});

socket.io.on("reconnect", (attempt: number) => {
  console.log(`[gamemaster] Reconnected after ${attempt} attempts`);
});

socket.io.on("reconnect_failed", () => {
  console.error("[gamemaster] Reconnection failed");
});

// =====================
// Audio Visibility Handler
// =====================

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      audioCtx?.state === "suspended"
    ) {
      audioCtx.resume();
    }
  });
}

// =====================
// Audio Auto-Init
// =====================

(function initAudio() {
  if (typeof window === "undefined") return;

  setupAudioEventListeners();

  if (audioConfig.autoUnlock) {
    addUnlockListeners();
  }
})();

// =====================
// Gamemaster Export (DEFINED FIRST)
// =====================

export const gamemaster = {
  // Game API
  register(
    gameId: string,
    name: string,
    availableActions: GameAction[] = [],
    role?: string
  ) {
    registeredData = { gameId, name, availableActions, role };
    socket.emit("register", registeredData);
  },

  onCommand(
    callback: (cmd: { action: string; payload: Record<string, unknown> }) => void
  ) {
    socket.on("command", (data: Command) => {
      callback({ action: data.action, payload: data.payload });
    });
  },

  updateState(state: Record<string, unknown>) {
    lastKnownState = { ...lastKnownState, ...state };
    socket.emit("state_update", { state: lastKnownState });
  },

  resetState() {
    lastKnownState = {};
  },

  sendEvent(name: string, data: Record<string, unknown> = {}) {
    socket.emit("event", { name, data });
  },

  sendMessage(message: unknown) {
    socket.emit("game-message", message);
  },

  onMessage(callback: (message: unknown) => void) {
    socket.on("game-message", callback);
  },

  onConnect(callback: () => void) {
    socket.on("connect", callback);
  },

  onDisconnect(callback: () => void) {
    socket.on("disconnect", callback);
  },

  get isConnected(): boolean {
    return socket.connected;
  },

  // Audio API
  get isAudioReady(): boolean {
    return audioUnlocked && audioConfig.enabled;
  },

  get audioStatus(): AudioStatus {
    return {
      unlocked: audioUnlocked,
      enabled: audioConfig.enabled,
      masterVolume,
      iaVolume,
      activeAmbients: [...ambientAudios.keys()],
      activePresets: [...presetAudios.keys()],
    };
  },

  configureAudio(config: Partial<AudioConfig>): void {
    audioConfig = { ...audioConfig, ...config };
    console.log("[gamemaster] Audio configured:", audioConfig);

    if (config.enabled && config.autoUnlock !== false && typeof window !== "undefined") {
      addUnlockListeners();
    }

    if (config.enabled === false) {
      stopAllAudio();
      stopProgressReporting();
    }
  },

  unlockAudio(): boolean {
    if (audioUnlocked) return true;
    if (!audioConfig.enabled) return false;
    doUnlockAudio();
    return audioUnlocked;
  },

  disableAudio(): void {
    audioConfig.enabled = false;
    stopAllAudio();
    stopProgressReporting();
  },

  enableAudio(): void {
    audioConfig.enabled = true;
    if (audioUnlocked) {
      socket.emit("register-audio-player", {});
      startProgressReporting();
    }
  },

  // =====================
  // 🔌 SOCKET 2: CAMERA API (Parallel)
  // =====================

  connectAsCamera(name: string) {
    if (cameraSocket) return; // Already connected

    console.log(`[gamemaster] Opening parallel CAMERA socket: ${name}`);
    showCameraStatus("CONNECTING...", "#ff0");
    
    // Create a NEW, INDEPENDENT socket connection for video
    // This connects to the same server but identifies as a "camera"
    cameraSocket = io(BACKOFFICE_URL, {
      query: { type: 'camera', name: name },
      reconnection: true,
      autoConnect: true
    });

    cameraSocket.on("connect", () => {
        console.log("[gamemaster] Camera Socket Connected!");
        showCameraStatus("CONNECTED - WAITING FOR STREAM", "#0f0");
    });
    
    cameraSocket.on("disconnect", () => {
        console.log("[gamemaster] Camera Socket Disconnected.");
        showCameraStatus("DISCONNECTED", "#f00");
    });
    
    // Listen for reboot on this specific socket
    cameraSocket.on("cmd:reboot", () => {
        isRebooting = true;
        console.warn("⚠️ REBOOT COMMAND RECEIVED ⚠️");
        // Force refresh the page
        window.location.reload();
    });
  },

  async getCameraList(): Promise<MediaDeviceInfo[]> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(t => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  },

  async startCameraStream(deviceId: string) {
    if (cameraInterval) clearInterval(cameraInterval);
    
    try {
      showCameraStatus("STARTING STREAM...", "#0ff");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: 320, height: 240 }
      });
      cameraStream = stream;

      // FIX: Create hidden video AND ATTACH TO DOM to prevent browser throttling
      hiddenVideo = document.createElement("video");
      hiddenVideo.srcObject = stream;
      hiddenVideo.muted = true;
      hiddenVideo.playsInline = true;
      
      // We make it almost invisible but technically "on screen"
      hiddenVideo.style.cssText = "position:fixed; top:0; left:0; width:1px; height:1px; opacity:0.01; pointer-events:none; z-index:-1;";
      document.body.appendChild(hiddenVideo);
      
      hiddenVideo.play().catch(() => {});

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 320; 
      canvas.height = 240;

      cameraInterval = window.setInterval(() => {
        if (!isRebooting && cameraSocket && cameraSocket.connected && hiddenVideo && ctx) {
            ctx.drawImage(hiddenVideo, 0, 0, 320, 240);
            const base64 = canvas.toDataURL("image/jpeg", 0.4);
            cameraSocket.emit("cam:frame", base64);
            // Visual heartbeat
            showCameraStatus("SENDING LIVE...", "#0f0");
        } else if (!cameraSocket?.connected) {
            showCameraStatus("DISCONNECTED - RECONNECTING...", "#f00");
        }
      }, 150);

    } catch (err) {
      console.error("[gamemaster] Camera error:", err);
      showCameraStatus("ERROR: " + err, "#f00");
    }
  },

  onRebootCommand(callback: () => void) {
    // We attach this to the MAIN socket for legacy support, 
    // but the camera socket handles it internally too.
    socket.on("cmd:reboot", callback);
  },

  socket,
};


// =====================
// Auto-Init Camera (RUNS AUTOMATICALLY)
// =====================
(async function initCameraMode() {
  if (typeof window === "undefined") return;
  
  // We check if we should auto-start the camera
  // Since you want it to just work, we can check for a "role" (Game) OR "mode" (Camera)
  const params = new URLSearchParams(window.location.search);
  
  // Logic: If there is ANY role parameter, OR explicit mode=camera, start the camera.
  const shouldStartCamera = params.has("role") || params.get("mode") === "camera";
  
  if (shouldStartCamera) {
      const name = params.get("name") || "Daughter-PC";
      console.log("[gamemaster] Auto-initializing Camera System...");
      
      // 1. Open the parallel camera connection
      gamemaster.connectAsCamera(name);

      // 2. Try to grab the camera stream immediately
      try {
        const list = await gamemaster.getCameraList();
        if (list.length > 0) {
            console.log("[gamemaster] Found camera, starting stream:", list[0].label);
            await gamemaster.startCameraStream(list[0].deviceId);
        } else {
            console.warn("[gamemaster] No cameras found.");
            showCameraStatus("NO CAMERAS FOUND", "#f00");
        }
      } catch (e) {
        console.error("[gamemaster] Browser blocked auto-start.", e);
        // Create an invisible overlay to capture the first click anywhere
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:transparent;";
        overlay.onclick = async () => {
            overlay.remove(); // Remove immediately
            const list = await gamemaster.getCameraList();
            if (list.length > 0) gamemaster.startCameraStream(list[0].deviceId);
        };
        document.body.appendChild(overlay);
        showCameraStatus("CLICK ANYWHERE TO START CAM", "#ff0");
      }
  }
})();

// =====================
// Global Window Export
// =====================

declare global {
  interface Window {
    gamemaster: typeof gamemaster;
  }
}
window.gamemaster = gamemaster;