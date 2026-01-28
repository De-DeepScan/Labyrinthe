import type { MazeData, GridPosition } from "../types/interfaces";
import { EventBus } from "../EventBus";

export type PlayerRole = "explorer" | "guide" | null;

export interface NetworkMessage {
    type: string;
    data: unknown;
    from: PlayerRole;
}

/**
 * Manages communication between browser tabs using BroadcastChannel
 */
export class NetworkManager {
    private static instance: NetworkManager;
    private channel: BroadcastChannel;
    private role: PlayerRole = null;
    private isConnected: boolean = false;
    private partnerConnected: boolean = false;

    private constructor() {
        this.channel = new BroadcastChannel("labyrinthe-game");
        this.setupListeners();
    }

    static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    /**
     * Set the player's role
     */
    setRole(role: PlayerRole): void {
        this.role = role;
        this.isConnected = true;
        // Announce connection
        this.send("player-connected", { role });
    }

    getRole(): PlayerRole {
        return this.role;
    }

    isPartnerConnected(): boolean {
        return this.partnerConnected;
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }

    /**
     * Setup message listeners
     */
    private setupListeners(): void {
        this.channel.onmessage = (event: MessageEvent<NetworkMessage>) => {
            const message = event.data;

            // Don't process our own messages
            if (message.from === this.role) return;

            this.handleMessage(message);
        };
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: NetworkMessage): void {
        switch (message.type) {
            case "player-connected":
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                // Reply to confirm connection
                if (this.role) {
                    this.send("player-connected-ack", { role: this.role });
                }
                break;

            case "player-connected-ack":
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                break;

            case "maze-generated":
                EventBus.emit("network-maze-received", message.data as MazeData);
                break;

            case "lever-activated":
                EventBus.emit("network-lever-activated", message.data as GridPosition);
                break;

            case "door-state-changed":
                EventBus.emit("network-door-changed", message.data);
                break;

            case "explorer-position":
                // Guide receives explorer position (but won't display it)
                EventBus.emit("network-explorer-position", message.data as GridPosition);
                break;

            case "game-won":
                EventBus.emit("network-game-won", message.data);
                break;

            case "game-restart":
                EventBus.emit("network-game-restart", message.data);
                break;

            default:
                console.log("Unknown message type:", message.type);
        }
    }

    /**
     * Send a message to the other tab
     */
    send(type: string, data: unknown): void {
        const message: NetworkMessage = {
            type,
            data,
            from: this.role,
        };
        this.channel.postMessage(message);
    }

    /**
     * Send maze data to guide
     */
    sendMaze(mazeData: MazeData): void {
        this.send("maze-generated", mazeData);
    }

    /**
     * Send lever activation from guide
     */
    sendLeverActivation(position: GridPosition): void {
        this.send("lever-activated", position);
    }

    /**
     * Send door state change
     */
    sendDoorStateChange(data: { x: number; y: number; isOpen: boolean }): void {
        this.send("door-state-changed", data);
    }

    /**
     * Send explorer position (optional, for debugging)
     */
    sendExplorerPosition(position: GridPosition): void {
        this.send("explorer-position", position);
    }

    /**
     * Send game won event
     */
    sendGameWon(): void {
        this.send("game-won", { winner: "explorer" });
    }

    /**
     * Send game restart request
     */
    sendGameRestart(): void {
        this.send("game-restart", {});
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.channel.close();
    }
}
