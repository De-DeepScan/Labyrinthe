import { io, Socket } from "socket.io-client";
import { GamemasterAudio } from "./gamemaster-audio";
import { GamemasterWebcam } from "./gamemaster-webcam";

// const BACKOFFICE_URL = "http://10.14.73.40:3000";
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
// Socket Connection
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
// Audio
// =====================

const audio = new GamemasterAudio(socket, BACKOFFICE_URL);

// =====================
// Game Connection Handlers
// =====================

socket.on("connect", () => {
  console.log("[gamemaster] Connected to backoffice");
  if (registeredData) {
    socket.emit("register", registeredData);
    if (Object.keys(lastKnownState).length > 0) {
      setTimeout(() => {
        socket.emit("state_update", { state: lastKnownState });
      }, 100);
    }
  }
  audio.register();
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
// Webcam
// =====================

const webcam = new GamemasterWebcam(socket, "labyrinthe");

// =====================
// Gamemaster Export
// =====================

export const gamemaster = {
  // Game API
  register(
    gameId: string,
    name: string,
    availableActions: GameAction[] = [],
    role?: string,
  ) {
    registeredData = { gameId, name, availableActions, role };
    socket.emit("register", registeredData);
  },

  onCommand(
    callback: (cmd: {
      action: string;
      payload: Record<string, unknown>;
    }) => void,
  ) {
    // Remove previous listener to prevent duplicates (React StrictMode calls useEffect twice)
    socket.off("command");
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

  // Audio API (delegated)
  audio,

  get isAudioReady(): boolean {
    return audio.enabled;
  },

  get audioStatus() {
    return audio.status;
  },

  configureAudio(config: Parameters<typeof audio.configure>[0]): void {
    audio.configure(config);
  },

  disableAudio(): void {
    audio.disable();
  },

  enableAudio(): void {
    audio.enable();
  },

  // Webcam API (delegated)
  webcam,

  socket,
};

// =====================
// Global Window Export
// =====================

declare global {
  interface Window {
    gamemaster: typeof gamemaster;
  }
}
window.gamemaster = gamemaster;
