import type { NeuralNetworkData, PlayerRole, NetworkMessage, NetworkMessageType } from "../types/interfaces";
import { EventBus } from "../EventBus";
import { gamemaster } from "../../gamemaster-client";

/**
 * Manages communication between players using Socket.IO via the gamemaster server.
 * This allows players on different computers to play together over the network.
 */
export class NetworkManager {
    private static instance: NetworkManager;
    private role: PlayerRole = null;
    private isConnected: boolean = false;
    private partnerConnected: boolean = false;

    private constructor() {
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
        this.send("player-connected", { role });

        // Send periodic pings to detect partner
        this.startPinging();
    }

    private pingInterval?: ReturnType<typeof setInterval>;

    /**
     * Start sending periodic pings to detect partner
     */
    private startPinging(): void {
        // Send initial ping
        this.send("ping", { role: this.role });

        // Send ping every 2 seconds until partner is detected
        this.pingInterval = setInterval(() => {
            if (!this.partnerConnected) {
                this.send("ping", { role: this.role });
            } else {
                // Stop pinging once partner is connected
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = undefined;
                }
            }
        }, 2000);
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
     * Setup message listeners via Socket.IO
     */
    private setupListeners(): void {
        gamemaster.socket.on("game-message", (message: NetworkMessage) => {
            // Don't process our own messages
            if (message.from === this.role) return;

            this.handleMessage(message);
        });
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: NetworkMessage): void {
        // Any message from the other player means they're connected
        if (!this.partnerConnected && message.from) {
            this.partnerConnected = true;
            EventBus.emit("partner-connected", { role: message.from });
        }

        switch (message.type) {
            case "player-connected":
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                if (this.role) {
                    this.send("player-connected-ack", { role: this.role });
                }
                break;

            case "player-connected-ack":
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                break;

            case "ping":
                // Respond to ping with pong
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                this.send("pong", { role: this.role });
                break;

            case "pong":
                // Partner responded to our ping
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                break;

            case "request-game-state":
                // Explorer receives this: send full game state back
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                EventBus.emit("request-game-state", message.data);
                break;

            case "game-state-response":
                // Protector receives this: apply full game state
                this.partnerConnected = true;
                EventBus.emit("partner-connected", { role: "explorer" });
                EventBus.emit("game-state-received", message.data);
                break;

            case "network-generated":
                // Mark explorer as connected when we receive network data
                this.partnerConnected = true;
                EventBus.emit("partner-connected", { role: "explorer" });
                EventBus.emit("network-data-received", message.data as NeuralNetworkData);
                break;

            case "explorer-moved":
                EventBus.emit("network-explorer-moved", message.data);
                break;

            case "synapse-activated":
                EventBus.emit("network-synapse-activated", message.data);
                break;

            case "synapse-deactivated":
                EventBus.emit("network-synapse-deactivated", message.data);
                break;

            case "synapse-blocked":
                EventBus.emit("network-synapse-blocked", message.data);
                break;

            case "synapse-unlocked":
                EventBus.emit("network-synapse-unlocked", message.data);
                break;

            case "synapse-unlock-failed":
                EventBus.emit("network-synapse-unlock-failed", message.data);
                break;

            case "explorer-position-update":
                EventBus.emit("network-explorer-position-update", message.data);
                break;

            case "neuron-destroyed":
                EventBus.emit("network-neuron-destroyed", message.data);
                break;

            case "neuron-hacked":
                EventBus.emit("network-neuron-hacked", message.data);
                break;

            case "ai-position":
                EventBus.emit("network-ai-position", message.data);
                break;

            case "ai-connected":
                EventBus.emit("network-ai-connected", message.data);
                break;

            case "puzzle-started":
                EventBus.emit("network-puzzle-started", message.data);
                break;

            case "puzzle-completed":
                EventBus.emit("network-puzzle-completed", message.data);
                break;

            case "puzzle-failed":
                EventBus.emit("network-puzzle-failed", message.data);
                break;

            case "game-won":
                EventBus.emit("network-game-won", message.data);
                break;

            case "game-lost":
                EventBus.emit("network-game-lost", message.data);
                break;

            case "game-restart":
                EventBus.emit("network-game-restart", message.data);
                break;

            case "level-transition":
                EventBus.emit("network-level-transition", message.data);
                break;

            case "dilemma-triggered":
                EventBus.emit("network-dilemma-triggered", message.data);
                break;

            case "dilemma-choice":
                EventBus.emit("network-dilemma-choice", message.data);
                break;

            default:
                console.log("Unknown message type:", message.type);
        }
    }

    /**
     * Send a message to the other player via Socket.IO
     */
    send(type: NetworkMessageType, data: unknown): void {
        const message: NetworkMessage & { gameId: string } = {
            type,
            data,
            from: this.role,
            timestamp: Date.now(),
            gameId: "labyrinthe",
        };
        gamemaster.socket.emit("game-message", message);
    }

    // ============= Explorer methods =============

    /**
     * Send neural network data to protector
     */
    sendNetworkData(networkData: NeuralNetworkData): void {
        this.send("network-generated", networkData);
    }

    /**
     * Send explorer position update
     */
    sendExplorerMoved(data: { neuronId: string; activatedPath: string[] }): void {
        this.send("explorer-moved", data);
    }

    /**
     * Send synapse activation
     */
    sendSynapseActivated(synapseId: string): void {
        this.send("synapse-activated", { synapseId });
    }

    /**
     * Send synapse deactivation (when AI catches explorer)
     */
    sendSynapseDeactivated(synapseId: string): void {
        this.send("synapse-deactivated", { synapseId });
    }

    /**
     * Send puzzle started
     */
    sendPuzzleStarted(synapseId: string): void {
        this.send("puzzle-started", { synapseId });
    }

    /**
     * Send puzzle completed
     */
    sendPuzzleCompleted(synapseId: string): void {
        this.send("puzzle-completed", { synapseId });
    }

    /**
     * Send puzzle failed
     */
    sendPuzzleFailed(synapseId: string): void {
        this.send("puzzle-failed", { synapseId });
    }

    /**
     * Send game won
     */
    sendGameWon(): void {
        this.send("game-won", { winner: "explorer" });
    }

    // ============= Protector methods =============

    /**
     * Send synapse blocked
     */
    sendSynapseBlocked(synapseId: string, resourcesRemaining: number): void {
        this.send("synapse-blocked", { synapseId, resourcesRemaining });
    }

    /**
     * Send neuron destroyed
     */
    sendNeuronDestroyed(neuronId: string, resourcesRemaining: number): void {
        this.send("neuron-destroyed", { neuronId, resourcesRemaining });
    }

    /**
     * Send neuron hacked (unblocked by AI)
     */
    sendNeuronHacked(neuronId: string): void {
        this.send("neuron-hacked", { neuronId });
    }

    /**
     * Send AI position update
     */
    sendAIPosition(data: { neuronId: string; path: string[] }): void {
        this.send("ai-position", data);
    }

    /**
     * Send AI connected (caught explorer)
     */
    sendAIConnected(data: { neuronId: string; explorerPushedTo: string }): void {
        this.send("ai-connected", data);
    }

    /**
     * Send game lost
     */
    sendGameLost(): void {
        this.send("game-lost", { winner: "ai" });
    }

    // ============= Common methods =============

    /**
     * Send game restart request
     */
    sendGameRestart(): void {
        this.send("game-restart", {});
    }

    /**
     * Send dilemma triggered (when AI catches explorer)
     */
    sendDilemmaTriggered(data: { title: string; description: string; choices: { id: string; description: string }[] }): void {
        this.send("dilemma-triggered", data);
    }

    /**
     * Send dilemma choice made
     */
    sendDilemmaChoice(data: { dilemmaId: string; choiceId: string }): void {
        this.send("dilemma-choice", data);
    }

    /**
     * Request full game state from explorer (called by protector on reconnection)
     */
    requestGameState(): void {
        this.send("request-game-state", { role: this.role });
    }

    /**
     * Send full game state response (called by explorer)
     */
    sendGameStateResponse(data: {
        networkData: NeuralNetworkData;
        explorerPosition: string;
        explorerPath: string[];
        aiState: { currentNeuronId: string; path: string[] } | null;
        blockedNeurons: string[];
    }): void {
        this.send("game-state-response", data);
    }

    /**
     * Reset connection state
     */
    reset(): void {
        this.partnerConnected = false;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        gamemaster.socket.off("game-message");
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = undefined;
        }
    }
}
