import { io, Socket } from "socket.io-client";

const BACKOFFICE_URL = "http://192.168.10.1:3000";

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

// Socket with explicit reconnection options for local network
const socket: Socket = io(BACKOFFICE_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  autoConnect: true,
});

// Store registration data for auto re-register
let registeredData: RegisterData | null = null;

// Store last known state for restoration after reconnect
let lastKnownState: Record<string, unknown> = {};

// Auto re-register on connect/reconnect
socket.on("connect", () => {
  console.log("[gamemaster] Connected to backoffice");
  if (registeredData) {
    socket.emit("register", registeredData);
    // Re-send state after brief delay to ensure registration completes
    if (Object.keys(lastKnownState).length > 0) {
      setTimeout(() => {
        socket.emit("state_update", { state: lastKnownState });
      }, 100);
    }
  }
});

socket.on("disconnect", (reason: string) => {
  console.log(`[gamemaster] Disconnected: ${reason}`);
});

// Reconnection event logging
socket.io.on("reconnect_attempt", (attempt: number) => {
  console.log(`[gamemaster] Reconnection attempt ${attempt}`);
});

socket.io.on("reconnect", (attempt: number) => {
  console.log(`[gamemaster] Reconnected after ${attempt} attempts`);
});

socket.io.on("reconnect_failed", () => {
  console.error("[gamemaster] Reconnection failed");
});

export const gamemaster = {
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
    // Merge with existing state to preserve all fields
    lastKnownState = { ...lastKnownState, ...state };
    socket.emit("state_update", { state: lastKnownState });
  },

  // Reset state (useful when game restarts)
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

  // Expose connection state
  get isConnected(): boolean {
    return socket.connected;
  },

  socket,
};

// Expose on window for global access (used by GamemasterContext pattern)
declare global {
  interface Window {
    gamemaster: typeof gamemaster;
  }
}
window.gamemaster = gamemaster;