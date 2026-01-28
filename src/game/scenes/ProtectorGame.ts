import { Scene } from "phaser";
import type { NeuralNetworkData } from "../types/interfaces";
import { SynapseState, NeuronType } from "../types/interfaces";
import { NeuralNetworkManager } from "../managers/NeuralNetworkManager";
import { AIManager } from "../managers/AIManager";
import { FirewallManager } from "../managers/FirewallManager";
import { ResourceManager } from "../managers/ResourceManager";
import { NetworkManager } from "../services/NetworkManager";
import { GameConfig } from "../config/GameConfig";
import { RESOURCE_CONFIG } from "../config/NeuralNetworkConfig";
import { EventBus } from "../EventBus";

/**
 * Protector's game scene - defend explorer from AI
 */
export default class ProtectorGame extends Scene {
    private networkData?: NeuralNetworkData;
    private networkManager?: NeuralNetworkManager;
    private aiManager?: AIManager;
    private firewallManager!: FirewallManager;
    private resourceManager!: ResourceManager;
    private networkService!: NetworkManager;

    private explorerPath: string[] = [];

    // UI Elements
    private resourceText?: Phaser.GameObjects.Text;
    private resourceBar?: Phaser.GameObjects.Graphics;
    private firewallButton?: Phaser.GameObjects.Container;
    private waitingText?: Phaser.GameObjects.Text;

    constructor() {
        super("ProtectorGame");
    }

    create(): void {
        this.networkService = NetworkManager.getInstance();

        // Initialize resource manager
        this.resourceManager = new ResourceManager();
        this.resourceManager.onResourcesChanged((current, max) => {
            this.updateResourceUI(current, max);
        });

        // Initialize firewall manager
        this.firewallManager = new FirewallManager(this);
        this.firewallManager.onComplete((reward) => {
            this.resourceManager.addResources(reward);
            // Repousser l'IA à son point de départ
            this.aiManager?.resetToSpawn();
            this.showMessage("IA repoussée !");
        });

        // Create waiting UI
        this.createWaitingUI();

        // Setup network listeners
        this.setupNetworkListeners();

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Create waiting UI while waiting for network data
     */
    private createWaitingUI(): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        this.waitingText = this.add.text(centerX, centerY, "En attente de l'Explorateur...", {
            fontFamily: "Arial",
            fontSize: "32px",
            color: "#ffffff",
        }).setOrigin(0.5);

        // Pulsing animation
        this.tweens.add({
            targets: this.waitingText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });
    }

    /**
     * Setup network event listeners
     */
    private setupNetworkListeners(): void {
        // Receive network data from explorer
        EventBus.on("network-data-received", this.onNetworkReceived, this);

        // Explorer moved
        EventBus.on("network-explorer-moved", this.onExplorerMoved, this);

        // Synapse activated
        EventBus.on("network-synapse-activated", this.onSynapseActivated, this);

        // Game won
        EventBus.on("network-game-won", this.onGameWon, this);
    }

    /**
     * Handle receiving network data
     */
    private onNetworkReceived(data: NeuralNetworkData): void {
        this.networkData = data;

        // Remove waiting UI
        this.waitingText?.destroy();

        // Initialize game
        this.initializeGame();
    }

    /**
     * Initialize the game after receiving network data
     */
    private initializeGame(): void {
        if (!this.networkData) return;

        // Create network manager with full visibility
        this.networkManager = new NeuralNetworkManager(this, this.networkData, {
            showAIPath: true,
            showAllSynapses: true,
            enableFog: false,
        });

        // Calculate offset (same as NeuralNetworkManager)
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const offsetX = (screenWidth - this.networkData.width) / 2;
        const offsetY = (screenHeight - this.networkData.height) / 2;

        // Create AI manager
        this.aiManager = new AIManager(this, this.networkData, offsetX, offsetY);
        this.aiManager.onCatchExplorer(() => {
            this.onAICaughtExplorer();
        });
        this.aiManager.onNeuronHacked((neuronId) => {
            this.onNeuronHacked(neuronId);
        });

        // Render network
        this.networkManager.render();

        // Create UI
        this.createUI();

        // Setup neuron click handler for destruction
        this.setupNeuronClickHandler();
    }

    /**
     * Create UI elements
     */
    private createUI(): void {
        // Title
        this.add.text(20, 20, "PROTECTEUR", {
            fontFamily: "Arial Black",
            fontSize: "24px",
            color: "#ed8936",
        });

        // Instructions
        this.add.text(20, 60, "Détruisez les neurones pour bloquer le chemin de l'IA", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#a0aec0",
        });

        // Resource display
        this.createResourceUI();

        // Firewall button
        this.createFirewallButton();
    }

    /**
     * Create resource UI
     */
    private createResourceUI(): void {
        const x = GameConfig.SCREEN_WIDTH - 220;
        const y = 20;

        // Background
        this.add.rectangle(x + 100, y + 25, 200, 50, 0x2d3748).setStrokeStyle(2, 0x4a5568);

        // Label
        this.add.text(x, y, "Ressources", {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#a0aec0",
        });

        // Resource bar background
        this.add.rectangle(x + 100, y + 35, 180, 16, 0x1a202c);

        // Resource bar fill
        this.resourceBar = this.add.graphics();
        this.updateResourceBar(this.resourceManager.getPercentage());

        // Resource text
        this.resourceText = this.add.text(x + 100, y + 35, "", {
            fontFamily: "Arial",
            fontSize: "12px",
            color: "#ffffff",
        }).setOrigin(0.5);

        this.updateResourceUI(
            this.resourceManager.getResources(),
            this.resourceManager.getMaxResources()
        );
    }

    /**
     * Update resource bar
     */
    private updateResourceBar(percentage: number): void {
        if (!this.resourceBar) return;

        this.resourceBar.clear();

        // Green to red gradient based on resources
        const color = percentage > 0.5 ? 0x48bb78 : percentage > 0.25 ? 0xecc94b : 0xe53e3e;

        const x = GameConfig.SCREEN_WIDTH - 220;
        const y = 20;
        const width = 180 * percentage;

        this.resourceBar.fillStyle(color);
        this.resourceBar.fillRect(x + 10, y + 27, width, 16);
    }

    /**
     * Update resource UI
     */
    private updateResourceUI(current: number, max: number): void {
        if (this.resourceText) {
            this.resourceText.setText(`${current} / ${max}`);
        }
        this.updateResourceBar(current / max);
    }

    /**
     * Create firewall button
     */
    private createFirewallButton(): void {
        const x = GameConfig.SCREEN_WIDTH - 120;
        const y = 90;

        this.firewallButton = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 180, 45, 0x4299e1);
        bg.setStrokeStyle(2, 0xffffff);

        const text = this.add.text(0, 0, "JEU FIREWALL", {
            fontFamily: "Arial Black",
            fontSize: "16px",
            color: "#ffffff",
        }).setOrigin(0.5);

        this.firewallButton.add([bg, text]);

        bg.setInteractive({ useHandCursor: true });

        bg.on("pointerover", () => bg.setScale(1.05));
        bg.on("pointerout", () => bg.setScale(1));
        bg.on("pointerdown", () => {
            this.aiManager?.pause();
            this.firewallManager.startGame();
        });

        // Resume AI when firewall closes
        EventBus.on("firewall-round-complete", () => {
            this.aiManager?.resume();
        });
    }

    /**
     * Setup neuron click handler for destruction
     */
    private setupNeuronClickHandler(): void {
        EventBus.on("neuron-clicked", (neuronId: string) => {
            this.tryDestroyNeuron(neuronId);
        });
    }

    /**
     * Try to destroy a neuron
     */
    private tryDestroyNeuron(neuronId: string): void {
        if (!this.networkData || !this.networkManager) return;

        const neuron = this.networkData.neurons[neuronId];
        if (!neuron) return;

        // Cannot destroy entry, core, or already destroyed neurons
        if (neuron.type === NeuronType.ENTRY || neuron.type === NeuronType.CORE) {
            this.showMessage("Impossible de détruire ce neurone !");
            return;
        }

        if (neuron.isBlocked) {
            this.showMessage("Ce neurone est déjà détruit !");
            return;
        }

        // Cannot destroy neurons on the explorer's activated path
        if (this.explorerPath.includes(neuronId)) {
            this.showMessage("L'Explorateur utilise ce neurone !");
            return;
        }

        // Check resources
        if (!this.resourceManager.canDestroy()) {
            this.showMessage(`Il faut ${RESOURCE_CONFIG.DESTROY_COST} ressources !`);
            return;
        }

        // Spend resources
        this.resourceManager.tryDestroy();

        // Mark neuron as destroyed
        neuron.isBlocked = true;
        this.networkManager.updateNeuronState(neuronId);

        // Block all synapses connected to this neuron
        for (const synapse of Object.values(this.networkData.synapses)) {
            if (synapse.fromNeuronId === neuronId || synapse.toNeuronId === neuronId) {
                synapse.state = SynapseState.BLOCKED;
                this.networkManager.updateSynapseState(synapse.id, SynapseState.BLOCKED);
            }
        }

        // Notify AI to recalculate path
        this.aiManager?.addDestroyedNeuron(neuronId);

        // Notify explorer
        this.networkService.sendNeuronDestroyed(
            neuronId,
            this.resourceManager.getResources()
        );

        this.showMessage("Neurone détruit !");
    }

    /**
     * Handle explorer moved
     */
    private onExplorerMoved(data: { neuronId: string; activatedPath: string[] }): void {
        this.explorerPath = data.activatedPath;

        // Update AI target
        this.aiManager?.updateExplorerPath(this.explorerPath);

        // Update explorer position visualization
        if (this.networkManager) {
            EventBus.emit("explorer-moved", { neuronId: data.neuronId });
        }
    }

    /**
     * Handle synapse activated by explorer
     */
    private onSynapseActivated(data: { synapseId: string }): void {
        if (!this.networkData || !this.networkManager) return;

        const synapse = this.networkData.synapses[data.synapseId];
        if (synapse) {
            synapse.state = SynapseState.ACTIVE;
            this.networkManager.updateSynapseState(data.synapseId, SynapseState.ACTIVE);
        }
    }

    /**
     * Handle AI hacking a neuron (unblocking it)
     */
    private onNeuronHacked(neuronId: string): void {
        if (!this.networkData || !this.networkManager) return;

        // Update local state
        const neuron = this.networkData.neurons[neuronId];
        if (neuron) {
            neuron.isBlocked = false;
            this.networkManager.updateNeuronState(neuronId);

            // Unblock synapses connected to this neuron
            for (const synapse of Object.values(this.networkData.synapses)) {
                if (synapse.fromNeuronId === neuronId || synapse.toNeuronId === neuronId) {
                    synapse.state = SynapseState.DORMANT;
                    this.networkManager.updateSynapseState(synapse.id, SynapseState.DORMANT);
                }
            }
        }

        // Notify explorer
        this.networkService.sendNeuronHacked(neuronId);

        this.showMessage("L'IA a rétabli un neurone !");
    }

    /**
     * Handle AI catching explorer
     */
    private onAICaughtExplorer(): void {
        // Show notification
        this.showPausePopup("IA CONNECTÉE !", "L'Explorateur a été repoussé !");

        // Notify explorer
        const currentNeuronId = this.aiManager?.getCurrentNeuronId() || "";
        this.networkService.sendAIConnected({
            neuronId: currentNeuronId,
            explorerPushedTo: this.explorerPath[this.explorerPath.length - 2] || this.explorerPath[0],
        });

        // Reset AI position after delay
        this.time.delayedCall(2000, () => {
            this.aiManager?.resetAfterCatch();
        });
    }

    /**
     * Handle game won
     */
    private onGameWon(): void {
        this.scene.start("Victory");
    }

    /**
     * Update loop
     */
    update(_time: number, delta: number): void {
        this.aiManager?.update(delta);
    }

    /**
     * Show a temporary message
     */
    private showMessage(text: string): void {
        const msg = this.add.text(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT - 100,
            text,
            {
                fontFamily: "Arial",
                fontSize: "20px",
                color: "#ffffff",
                backgroundColor: "#2d3748",
                padding: { x: 20, y: 10 },
            }
        ).setOrigin(0.5);

        this.tweens.add({
            targets: msg,
            alpha: 0,
            y: msg.y - 50,
            duration: 2000,
            onComplete: () => msg.destroy(),
        });
    }

    /**
     * Show pause popup
     */
    private showPausePopup(title: string, message: string): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        const container = this.add.container(centerX, centerY);

        const bg = this.add.rectangle(0, 0, 400, 200, 0x000000, 0.9);
        bg.setStrokeStyle(3, 0xe53e3e);

        const titleText = this.add.text(0, -50, title, {
            fontFamily: "Arial Black",
            fontSize: "32px",
            color: "#e53e3e",
        }).setOrigin(0.5);

        const messageText = this.add.text(0, 10, message, {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#ffffff",
        }).setOrigin(0.5);

        container.add([bg, titleText, messageText]);
        container.setDepth(1000);

        // Fade out after delay
        this.time.delayedCall(1800, () => {
            this.tweens.add({
                targets: container,
                alpha: 0,
                duration: 200,
                onComplete: () => container.destroy(),
            });
        });
    }

    /**
     * Cleanup
     */
    shutdown(): void {
        EventBus.off("network-data-received", this.onNetworkReceived, this);
        EventBus.off("network-explorer-moved", this.onExplorerMoved, this);
        EventBus.off("network-synapse-activated", this.onSynapseActivated, this);
        EventBus.off("network-game-won", this.onGameWon, this);

        this.networkManager?.destroy();
        this.aiManager?.destroy();
        this.firewallManager?.destroy();
    }
}
