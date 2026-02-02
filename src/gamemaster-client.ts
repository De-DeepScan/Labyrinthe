import { io, Socket } from "socket.io-client";

const BACKOFFICE_URL = "http://192.168.10.1:3000";

interface GameAction {
  id: string;
  label: string;
  params?: string[];
}

interface Command {
  type: "command";
  action: string;
  payload: Record<string, unknown>;
}

const socket: Socket = io(BACKOFFICE_URL);

export const gamemaster = {
  register(gameId: string, name: string, availableActions: GameAction[] = []) {
    socket.emit("register", { gameId, name, availableActions });
  },

  onCommand(callback: (cmd: { action: string; payload: Record<string, unknown> }) => void) {
    socket.on("command", (data: Command) => {
      callback({ action: data.action, payload: data.payload });
    });
  },

  updateState(state: Record<string, unknown>) {
    socket.emit("state_update", { state });
  },

  sendEvent(name: string, data: Record<string, unknown> = {}) {
    socket.emit("event", { name, data });
  },

  onConnect(callback: () => void) {
    socket.on("connect", callback);
  },

  onDisconnect(callback: () => void) {
    socket.on("disconnect", callback);
  },

  socket,
};
