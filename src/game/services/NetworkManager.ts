import type { NeuralNetworkData, PlayerRole, NetworkMessage, NetworkMessageType } from "../types/interfaces";
import { EventBus } from "../EventBus";

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
        this.channel = new BroadcastChannel("neural-network-game");
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
                if (this.role) {
                    this.send("player-connected-ack", { role: this.role });
                }
                break;

            case "player-connected-ack":
                this.partnerConnected = true;
                EventBus.emit("partner-connected", message.data);
                break;

            case "network-generated":
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
     * Send a message to the other tab
     */
    send(type: NetworkMessageType, data: unknown): void {
        const message: NetworkMessage = {
            type,
            data,
            from: this.role,
            timestamp: Date.now(),
        };
        this.channel.postMessage(message);
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
     * Reset connection state
     */
    reset(): void {
        this.partnerConnected = false;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.channel.close();
    }
}
