import { Scene } from "phaser";
import type { NeuralNetworkData, Synapse } from "../types/interfaces";
import { SynapseState, NeuronType } from "../types/interfaces";
import { NeuralNetworkGenerator } from "../generators/NeuralNetworkGenerator";
import { NeuralNetworkManager } from "../managers/NeuralNetworkManager";
import { PuzzleManager } from "../managers/PuzzleManager";
import { DilemmaManager } from "../managers/DilemmaManager";
import { NetworkManager } from "../services/NetworkManager";
import { GameConfig } from "../config/GameConfig";
import { EventBus } from "../EventBus";
import { CYBER_COLORS } from "../config/CyberStyles";

/**
 * Explorer's game scene - navigate the neural network by solving puzzles
 */
export default class ExplorerGame extends Scene {
    private networkData!: NeuralNetworkData;
    private networkManager!: NeuralNetworkManager;
    private puzzleManager!: PuzzleManager;
    private dilemmaManager!: DilemmaManager;
    private networkService!: NetworkManager;

    private currentNeuronId!: string;
    private activatedPath: string[] = [];
    private isPuzzleSolving: boolean = false;


    constructor() {
        super("ExplorerGame");
    }

    create(): void {
        this.networkService = NetworkManager.getInstance();

        // Generate the neural network
        this.networkData = NeuralNetworkGenerator.generate();

        // Send to Protector
        this.networkService.sendNetworkData(this.networkData);

        // Initialize starting position
        this.currentNeuronId = this.networkData.entryNeuronId;
        this.activatedPath = [this.currentNeuronId];

        // Mark entry as activated
        this.networkData.neurons[this.currentNeuronId].isActivated = true;

        // Create network manager with fog of war
        this.networkManager = new NeuralNetworkManager(this, this.networkData, {
            showAIPath: false,
            showAllSynapses: false,
            enableFog: true,
        });
        this.networkManager.render();

        // Setup camera to follow explorer
        this.setupCamera();

        // Create puzzle manager
        this.puzzleManager = new PuzzleManager(this);
        this.setupPuzzleCallbacks();

        // Create dilemma manager (read-only mode - choice is made on DilemmaScreen)
        this.dilemmaManager = new DilemmaManager(this, true);

        // Create UI (fixed to camera)
        this.createUI();

        // Setup event listeners
        this.setupEventListeners();

        // Send initial position
        this.networkService.sendExplorerMoved({
            neuronId: this.currentNeuronId,
            activatedPath: this.activatedPath,
        });

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Setup camera to follow explorer
     */
    private setupCamera(): void {
        const explorerContainer = this.networkManager.getExplorerContainer();
        if (!explorerContainer) return;

        // Get world bounds from network
        const bounds = this.networkManager.getWorldBounds();
        const worldWidth = bounds.maxX - bounds.minX;
        const worldHeight = bounds.maxY - bounds.minY;

        // Set camera bounds
        this.cameras.main.setBounds(
            bounds.minX,
            bounds.minY,
            worldWidth,
            worldHeight
        );

        // Follow the explorer with smooth lerp
        this.cameras.main.startFollow(explorerContainer, true, 0.1, 0.1);

        // Zoom slightly for better view
        this.cameras.main.setZoom(1.2);
    }

    /**
     * Create UI elements (fixed to camera)
     */
    private createUI(): void {
        // Create cyber panel for title
        const titlePanel = this.add.graphics();
        titlePanel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        titlePanel.fillRect(10, 10, 320, 75);
        titlePanel.lineStyle(2, CYBER_COLORS.CYAN, 0.8);
        titlePanel.strokeRect(10, 10, 320, 75);
        // Corner decorations
        titlePanel.lineStyle(3, CYBER_COLORS.CYAN, 1);
        titlePanel.moveTo(10, 25);
        titlePanel.lineTo(10, 10);
        titlePanel.lineTo(25, 10);
        titlePanel.moveTo(315, 10);
        titlePanel.lineTo(330, 10);
        titlePanel.lineTo(330, 25);
        titlePanel.strokePath();
        titlePanel.setScrollFactor(0);

        // Status text
        const title = this.add.text(20, 20, "EXPLORATEUR", {
            fontFamily: "Courier New, monospace",
            fontSize: "24px",
            color: CYBER_COLORS.TEXT_CYAN,
        });
        title.setScrollFactor(0);

        // Instructions
        const instructions = this.add.text(
            20,
            55,
            "Cliquez sur les neurones adjacents pour avancer",
            {
                fontFamily: "Courier New, monospace",
                fontSize: "13px",
                color: CYBER_COLORS.TEXT_WHITE,
            }
        );
        instructions.setScrollFactor(0);

        // Objective panel at bottom
        const objectivePanel = this.add.graphics();
        objectivePanel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        objectivePanel.fillRect(10, GameConfig.SCREEN_HEIGHT - 50, 300, 40);
        objectivePanel.lineStyle(2, CYBER_COLORS.ORANGE, 0.8);
        objectivePanel.strokeRect(10, GameConfig.SCREEN_HEIGHT - 50, 300, 40);
        objectivePanel.setScrollFactor(0);

        // Objective indicator
        const objective = this.add.text(20, GameConfig.SCREEN_HEIGHT - 38, "OBJECTIF: Atteindre le CORE", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_ORANGE,
        });
        objective.setScrollFactor(0);
    }

    /**
     * Setup puzzle callbacks
     */
    private setupPuzzleCallbacks(): void {
        this.puzzleManager.onComplete((synapseId) => {
            this.onPuzzleComplete(synapseId);
        });

        this.puzzleManager.onClose(() => {
            this.isPuzzleSolving = false;
        });
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        // Neuron click handler
        EventBus.on("neuron-clicked", this.onNeuronClicked, this);

        // AI caught explorer
        EventBus.on("network-ai-connected", this.onAICaught, this);

        // Synapse blocked by protector
        EventBus.on("network-synapse-blocked", this.onSynapseBlocked, this);

        // Neuron destroyed by protector
        EventBus.on("network-neuron-destroyed", this.onNeuronDestroyed, this);

        // Neuron hacked (unblocked) by AI
        EventBus.on("network-neuron-hacked", this.onNeuronHacked, this);

        // Dilemma triggered - show waiting message
        EventBus.on("network-dilemma-triggered", this.onDilemmaTriggered, this);

        // Dilemma choice made from DilemmaScreen
        EventBus.on("network-dilemma-choice", this.onDilemmaChoiceMade, this);
        EventBus.on("dilemma-choice-made", this.onDilemmaChoiceMade, this);
    }

    /**
     * Handle neuron click
     */
    private onNeuronClicked(neuronId: string): void {
        if (this.isPuzzleSolving) return;

        const targetNeuron = this.networkData.neurons[neuronId];
        const currentNeuron = this.networkData.neurons[this.currentNeuronId];

        if (!targetNeuron || !currentNeuron) return;

        // Check if it's an adjacent neuron
        if (!currentNeuron.connections.includes(neuronId)) {
            this.showMessage("Ce neurone n'est pas connecté !");
            return;
        }

        // Check if already activated (can move freely on activated path)
        if (targetNeuron.isActivated) {
            this.moveToNeuron(neuronId);
            return;
        }

        // Find the synapse between current and target
        const synapse = this.findSynapse(this.currentNeuronId, neuronId);
        if (!synapse) {
            this.showMessage("Aucune connexion trouvée !");
            return;
        }

        // Check if synapse is blocked
        if (synapse.state === SynapseState.BLOCKED) {
            this.showMessage("Cette connexion est bloquée !");
            return;
        }

        // Start puzzle to create connection
        this.startPuzzle(synapse);
    }

    /**
     * Find synapse between two neurons
     */
    private findSynapse(aId: string, bId: string): Synapse | undefined {
        return Object.values(this.networkData.synapses).find(
            (s) =>
                (s.fromNeuronId === aId && s.toNeuronId === bId) ||
                (s.fromNeuronId === bId && s.toNeuronId === aId)
        );
    }

    /**
     * Start puzzle for a synapse
     */
    private startPuzzle(synapse: Synapse): void {
        this.isPuzzleSolving = true;

        // Update synapse state
        synapse.state = SynapseState.SOLVING;
        this.networkManager.updateSynapseState(synapse.id, SynapseState.SOLVING);

        // Notify protector
        this.networkService.sendPuzzleStarted(synapse.id);

        // Start the puzzle
        this.puzzleManager.startPuzzle(synapse.id, synapse.difficulty);
    }

    /**
     * Handle puzzle completion
     */
    private onPuzzleComplete(synapseId: string): void {
        this.isPuzzleSolving = false;

        const synapse = this.networkData.synapses[synapseId];
        if (!synapse) return;

        // Activate the synapse
        synapse.state = SynapseState.ACTIVE;
        this.networkManager.updateSynapseState(synapseId, SynapseState.ACTIVE);

        // Determine target neuron
        const targetId = synapse.fromNeuronId === this.currentNeuronId
            ? synapse.toNeuronId
            : synapse.fromNeuronId;

        // Activate target neuron
        const targetNeuron = this.networkData.neurons[targetId];
        targetNeuron.isActivated = true;
        this.networkManager.updateNeuronState(targetId);

        // Notify protector
        this.networkService.sendSynapseActivated(synapseId);
        this.networkService.sendPuzzleCompleted(synapseId);

        // Move to the new neuron
        this.moveToNeuron(targetId);
    }

    /**
     * Move explorer to a neuron
     */
    private async moveToNeuron(neuronId: string): Promise<void> {
        this.currentNeuronId = neuronId;

        // Update path if not already included
        if (!this.activatedPath.includes(neuronId)) {
            this.activatedPath.push(neuronId);
        }

        // Animate movement
        await this.networkManager.moveExplorerTo(neuronId);

        // Send position update
        this.networkService.sendExplorerMoved({
            neuronId: this.currentNeuronId,
            activatedPath: this.activatedPath,
        });

        // Check for victory
        this.checkVictory();
    }

    /**
     * Check if explorer reached the core
     */
    private checkVictory(): void {
        const neuron = this.networkData.neurons[this.currentNeuronId];

        if (neuron.type === NeuronType.CORE) {
            this.onVictory();
        }
    }

    /**
     * Handle victory
     */
    private onVictory(): void {
        this.networkService.sendGameWon();
        this.scene.start("Victory");
    }

    /**
     * Handle AI catching explorer (called after dilemma is resolved)
     */
    private onAICaught(_data: { neuronId: string; explorerPushedTo: string }): void {
        // Move explorer back after dilemma is resolved
        this.moveBackOnPath();
    }

    /**
     * Handle dilemma triggered by protector
     */
    private onDilemmaTriggered(data: { dilemmaId: string; neuronId: string }): void {
        // Close the puzzle if it's open
        if (this.isPuzzleSolving && this.puzzleManager.isPuzzleActive()) {
            this.puzzleManager.hidePuzzleUI();
            this.isPuzzleSolving = false;
        }

        // Show dilemma in read-only mode
        const dilemma = this.dilemmaManager.getDilemmaById(data.dilemmaId);
        if (dilemma) {
            this.dilemmaManager.showDilemma(dilemma);
        }
    }

    /**
     * Handle when a dilemma choice is made from DilemmaScreen
     */
    private onDilemmaChoiceMade(): void {
        // Hide the dilemma display
        this.dilemmaManager.hideDilemma();
        this.showMessage("Repoussé ! Connexion perdue !");
    }

    /**
     * Move explorer back on the path and disconnect the last synapse
     */
    private moveBackOnPath(): void {
        if (this.activatedPath.length <= 1) return;

        // Get the last neuron (current position) and the one before
        const lastNeuronId = this.activatedPath[this.activatedPath.length - 1];
        const previousNeuronId = this.activatedPath[this.activatedPath.length - 2];

        // Find and disconnect the synapse between them
        const synapse = this.findSynapse(lastNeuronId, previousNeuronId);
        if (synapse && synapse.state === SynapseState.ACTIVE) {
            // Deactivate the synapse
            synapse.state = SynapseState.DORMANT;
            this.networkManager.updateSynapseState(synapse.id, SynapseState.DORMANT);

            // Notify protector of synapse disconnection
            this.networkService.sendSynapseDeactivated(synapse.id);
        }

        // Deactivate the last neuron (unless it's entry or core)
        const lastNeuron = this.networkData.neurons[lastNeuronId];
        if (lastNeuron && lastNeuron.type !== NeuronType.ENTRY && lastNeuron.type !== NeuronType.CORE) {
            lastNeuron.isActivated = false;
            this.networkManager.updateNeuronState(lastNeuronId);
        }

        // Remove last neuron from path
        this.activatedPath.pop();
        const newPosition = this.activatedPath[this.activatedPath.length - 1];

        // Move to previous position
        this.moveToNeuron(newPosition);

        this.showMessage("Repoussé ! Connexion perdue !");
    }

    /**
     * Handle synapse blocked
     */
    private onSynapseBlocked({ synapseId }: { synapseId: string }): void {
        const synapse = this.networkData.synapses[synapseId];
        if (synapse) {
            synapse.state = SynapseState.BLOCKED;
            this.networkManager.updateSynapseState(synapseId, SynapseState.BLOCKED);
        }
    }

    /**
     * Handle neuron destroyed by protector
     */
    private onNeuronDestroyed({ neuronId }: { neuronId: string }): void {
        const neuron = this.networkData.neurons[neuronId];
        if (neuron) {
            neuron.isBlocked = true;
            this.networkManager.updateNeuronState(neuronId);

            // Block all synapses connected to this neuron
            for (const synapse of Object.values(this.networkData.synapses)) {
                if (synapse.fromNeuronId === neuronId || synapse.toNeuronId === neuronId) {
                    synapse.state = SynapseState.BLOCKED;
                    this.networkManager.updateSynapseState(synapse.id, SynapseState.BLOCKED);
                }
            }
        }
    }

    /**
     * Handle neuron hacked (unblocked) by AI
     */
    private onNeuronHacked({ neuronId }: { neuronId: string }): void {
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

            this.showMessage("L'IA a rétabli un neurone !");
        }
    }

    /**
     * Show a temporary message (fixed to camera)
     */
    private showMessage(text: string): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const y = GameConfig.SCREEN_HEIGHT - 100;

        // Create container for message
        const container = this.add.container(centerX, y);
        container.setScrollFactor(0);

        // Background panel
        const bgGraphics = this.add.graphics();
        const textWidth = text.length * 10 + 40;
        bgGraphics.fillStyle(CYBER_COLORS.BG_PANEL, 0.95);
        bgGraphics.fillRect(-textWidth / 2, -20, textWidth, 40);
        bgGraphics.lineStyle(2, CYBER_COLORS.CYAN, 0.8);
        bgGraphics.strokeRect(-textWidth / 2, -20, textWidth, 40);

        const msg = this.add.text(0, 0, text, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: CYBER_COLORS.TEXT_CYAN,
        }).setOrigin(0.5);

        container.add([bgGraphics, msg]);

        const startY = container.y;
        this.tweens.add({
            targets: container,
            alpha: 0,
            y: startY - 50,
            duration: 2000,
            onComplete: () => container.destroy(),
        });
    }

    /**
     * Show pause popup (fixed to camera)
     */
    private showPausePopup(title: string, message: string): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        const container = this.add.container(centerX, centerY);
        container.setScrollFactor(0);

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
        EventBus.off("neuron-clicked", this.onNeuronClicked, this);
        EventBus.off("network-ai-connected", this.onAICaught, this);
        EventBus.off("network-synapse-blocked", this.onSynapseBlocked, this);
        EventBus.off("network-neuron-destroyed", this.onNeuronDestroyed, this);
        EventBus.off("network-neuron-hacked", this.onNeuronHacked, this);
        EventBus.off("network-dilemma-triggered", this.onDilemmaTriggered, this);
        EventBus.off("network-dilemma-choice", this.onDilemmaChoiceMade, this);
        EventBus.off("dilemma-choice-made", this.onDilemmaChoiceMade, this);

        this.networkManager?.destroy();
        this.puzzleManager?.destroy();
        this.dilemmaManager?.destroy();
    }
}
