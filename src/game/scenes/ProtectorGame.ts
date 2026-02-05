import { Scene } from "phaser";
import type { NeuralNetworkData } from "../types/interfaces";
import { SynapseState, NeuronType } from "../types/interfaces";
import { NeuralNetworkManager } from "../managers/NeuralNetworkManager";
import { AIManager } from "../managers/AIManager";
import { TerminalManager } from "../managers/TerminalManager";
import { ResourceManager } from "../managers/ResourceManager";
import { DilemmaManager } from "../managers/DilemmaManager";
import type { Dilemma } from "../managers/DilemmaManager";
import { NetworkManager } from "../services/NetworkManager";
import { GameConfig } from "../config/GameConfig";
import { RESOURCE_CONFIG } from "../config/NeuralNetworkConfig";
import { EventBus } from "../EventBus";
import { CYBER_COLORS } from "../config/CyberStyles";

/**
 * Protector's game scene - defend explorer from AI
 */
export default class ProtectorGame extends Scene {
    private networkData?: NeuralNetworkData;
    private networkManager?: NeuralNetworkManager;
    private aiManager?: AIManager;
    private terminalManager!: TerminalManager;
    private resourceManager!: ResourceManager;
    private dilemmaManager!: DilemmaManager;
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

        // Initialize terminal manager
        this.terminalManager = new TerminalManager(this);
        this.terminalManager.onComplete((reward) => {
            this.resourceManager.addResources(reward);
            // Ralentir l'IA de 25% pendant 3 secondes
            this.aiManager?.applySlowdown();
            this.showMessage("IA ralentie !");
        });

        // Create dilemma manager (read-only mode - choice is made on DilemmaScreen)
        this.dilemmaManager = new DilemmaManager(this, true);

        // Create waiting UI
        this.createWaitingUI();

        // Setup network listeners
        this.setupNetworkListeners();

        // Setup dilemma listeners
        EventBus.on("ai-caught-explorer-dilemma", this.onAICaughtExplorerDilemma, this);
        EventBus.on("dilemma-choice-made", this.onDilemmaChoiceMade, this);
        EventBus.on("network-dilemma-choice", this.onDilemmaChoiceMade, this);

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Create waiting UI while waiting for network data
     */
    private createWaitingUI(): void {
        // Dark background
        this.cameras.main.setBackgroundColor("#000408");

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Cyber grid
        const gridGraphics = this.add.graphics();
        gridGraphics.lineStyle(1, CYBER_COLORS.ORANGE, 0.03);
        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            gridGraphics.moveTo(x, 0);
            gridGraphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }
        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            gridGraphics.moveTo(0, y);
            gridGraphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }
        gridGraphics.strokePath();

        this.waitingText = this.add.text(centerX, centerY, "[ EN ATTENTE DE L'EXPLORATEUR ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "28px",
            color: CYBER_COLORS.TEXT_ORANGE,
        }).setOrigin(0.5);

        // Pulsing animation
        this.tweens.add({
            targets: this.waitingText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // Animated dots
        const dotsContainer = this.add.container(centerX, centerY + 50);
        for (let i = 0; i < 3; i++) {
            const dot = this.add.circle(i * 20 - 20, 0, 4, CYBER_COLORS.ORANGE, 0.3);
            dotsContainer.add(dot);

            this.tweens.add({
                targets: dot,
                alpha: { from: 0.3, to: 1 },
                scale: { from: 1, to: 1.5 },
                duration: 600,
                delay: i * 200,
                yoyo: true,
                repeat: -1,
            });
        }
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

        // Synapse deactivated (when AI catches explorer)
        EventBus.on("network-synapse-deactivated", this.onSynapseDeactivated, this);

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

    // Camera controls
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys?: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    private isDragging: boolean = false;
    private dragStartX: number = 0;
    private dragStartY: number = 0;
    private cameraStartX: number = 0;
    private cameraStartY: number = 0;
    private isTerminalOpen: boolean = false;
    private isDilemmaActive: boolean = false;

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

        // Setup camera controls
        this.setupCameraControls();

        // Create UI (fixed to camera)
        this.createUI();

        // Setup neuron click handler for destruction
        this.setupNeuronClickHandler();
    }

    /**
     * Setup camera panning controls
     */
    private setupCameraControls(): void {
        if (!this.networkManager) return;

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

        // Center camera initially
        this.cameras.main.centerOn(
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2
        );

        // Setup keyboard controls
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasdKeys = {
                W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
        }

        // Setup drag to pan (middle or right click only, NOT left click)
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            // Don't allow dragging when terminal is open
            if (this.isTerminalOpen) return;

            // pointer.button: 0 = left, 1 = middle, 2 = right
            // Only allow drag with middle (1) or right (2) button
            if (pointer.button === 1 || pointer.button === 2) {
                this.isDragging = true;
                this.dragStartX = pointer.x;
                this.dragStartY = pointer.y;
                this.cameraStartX = this.cameras.main.scrollX;
                this.cameraStartY = this.cameras.main.scrollY;
            }
        });

        this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
            if (this.isDragging && !this.isTerminalOpen) {
                const dragX = pointer.x - this.dragStartX;
                const dragY = pointer.y - this.dragStartY;
                this.cameras.main.scrollX = this.cameraStartX - dragX;
                this.cameras.main.scrollY = this.cameraStartY - dragY;
            }
        });

        this.input.on("pointerup", () => {
            this.isDragging = false;
        });

        // Prevent context menu on right click
        this.input.mouse?.disableContextMenu();
    }

    /**
     * Create UI elements (fixed to camera)
     */
    private createUI(): void {
        // Create cyber panel for title
        const titlePanel = this.add.graphics();
        titlePanel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        titlePanel.fillRect(10, 10, 280, 90);
        titlePanel.lineStyle(2, CYBER_COLORS.ORANGE, 0.8);
        titlePanel.strokeRect(10, 10, 280, 90);
        // Corner decorations
        titlePanel.lineStyle(3, CYBER_COLORS.ORANGE, 1);
        titlePanel.moveTo(10, 25);
        titlePanel.lineTo(10, 10);
        titlePanel.lineTo(25, 10);
        titlePanel.moveTo(275, 10);
        titlePanel.lineTo(290, 10);
        titlePanel.lineTo(290, 25);
        titlePanel.strokePath();
        titlePanel.setScrollFactor(0);

        // Title
        const title = this.add.text(20, 20, "PROTECTEUR", {
            fontFamily: "Courier New, monospace",
            fontSize: "24px",
            color: CYBER_COLORS.TEXT_ORANGE,
        });
        title.setScrollFactor(0);

        // Instructions
        const instructions = this.add.text(20, 55, "Détruisez les neurones pour bloquer l'IA", {
            fontFamily: "Courier New, monospace",
            fontSize: "13px",
            color: CYBER_COLORS.TEXT_WHITE,
        });
        instructions.setScrollFactor(0);

        // Camera controls hint
        const hint = this.add.text(20, 78, "Clic droit + glisser / WASD pour la vue", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: CYBER_COLORS.TEXT_GRAY,
        });
        hint.setScrollFactor(0);

        // Resource display
        this.createResourceUI();

        // Terminal button
        this.createTerminalButton();
    }

    /**
     * Create resource UI (fixed to camera)
     */
    private createResourceUI(): void {
        const x = GameConfig.SCREEN_WIDTH - 230;
        const y = 20;

        // Cyber panel background
        const panel = this.add.graphics();
        panel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        panel.fillRect(x - 10, y - 5, 220, 60);
        panel.lineStyle(2, CYBER_COLORS.CYAN, 0.8);
        panel.strokeRect(x - 10, y - 5, 220, 60);
        // Corner decorations
        panel.lineStyle(3, CYBER_COLORS.CYAN, 1);
        panel.moveTo(x + 195, y - 5);
        panel.lineTo(x + 210, y - 5);
        panel.lineTo(x + 210, y + 10);
        panel.moveTo(x + 210, y + 40);
        panel.lineTo(x + 210, y + 55);
        panel.lineTo(x + 195, y + 55);
        panel.strokePath();
        panel.setScrollFactor(0);

        // Label
        const label = this.add.text(x, y, "RESSOURCES", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_CYAN,
        });
        label.setScrollFactor(0);

        // Resource bar background
        const barBg = this.add.graphics();
        barBg.fillStyle(0x0a1628, 1);
        barBg.fillRect(x, y + 22, 190, 20);
        barBg.lineStyle(1, CYBER_COLORS.CYAN, 0.5);
        barBg.strokeRect(x, y + 22, 190, 20);
        barBg.setScrollFactor(0);

        // Resource bar fill
        this.resourceBar = this.add.graphics();
        this.resourceBar.setScrollFactor(0);
        this.updateResourceBar(this.resourceManager.getPercentage());

        // Resource text
        this.resourceText = this.add.text(x + 95, y + 32, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: CYBER_COLORS.TEXT_WHITE,
        }).setOrigin(0.5);
        this.resourceText.setScrollFactor(0);

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

        // Cyberpunk colors: cyan to orange to red based on resources
        const color = percentage > 0.5 ? CYBER_COLORS.CYAN : percentage > 0.25 ? CYBER_COLORS.ORANGE : CYBER_COLORS.RED;

        const x = GameConfig.SCREEN_WIDTH - 230;
        const y = 20;
        const width = 186 * percentage;

        this.resourceBar.fillStyle(color);
        this.resourceBar.fillRect(x + 2, y + 24, width, 16);
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
     * Create terminal button (fixed to camera)
     */
    private createTerminalButton(): void {
        const x = GameConfig.SCREEN_WIDTH - 120;
        const y = 110;

        this.firewallButton = this.add.container(x, y);
        this.firewallButton.setScrollFactor(0);
        this.firewallButton.setDepth(100); // Ensure button is on top

        // Cyber button background
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(CYBER_COLORS.BG_PANEL, 1);
        bgGraphics.fillRect(-90, -25, 180, 50);
        bgGraphics.lineStyle(2, CYBER_COLORS.GREEN, 1);
        bgGraphics.strokeRect(-90, -25, 180, 50);
        // Corner decorations
        bgGraphics.lineStyle(3, CYBER_COLORS.GREEN, 1);
        bgGraphics.moveTo(-90, -15);
        bgGraphics.lineTo(-90, -25);
        bgGraphics.lineTo(-80, -25);
        bgGraphics.moveTo(80, -25);
        bgGraphics.lineTo(90, -25);
        bgGraphics.lineTo(90, -15);
        bgGraphics.moveTo(-90, 15);
        bgGraphics.lineTo(-90, 25);
        bgGraphics.lineTo(-80, 25);
        bgGraphics.moveTo(80, 25);
        bgGraphics.lineTo(90, 25);
        bgGraphics.lineTo(90, 15);
        bgGraphics.strokePath();

        const text = this.add.text(0, 0, "[ TERMINAL ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: CYBER_COLORS.TEXT_GREEN,
        }).setOrigin(0.5);

        // Hit area for interaction
        const hitArea = this.add.rectangle(0, 0, 180, 50, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });

        this.firewallButton.add([bgGraphics, text, hitArea]);

        hitArea.on("pointerover", () => {
            text.setColor(CYBER_COLORS.TEXT_WHITE);
            bgGraphics.clear();
            bgGraphics.fillStyle(CYBER_COLORS.GREEN, 0.2);
            bgGraphics.fillRect(-90, -25, 180, 50);
            bgGraphics.lineStyle(2, CYBER_COLORS.GREEN, 1);
            bgGraphics.strokeRect(-90, -25, 180, 50);
            bgGraphics.lineStyle(3, CYBER_COLORS.GREEN, 1);
            bgGraphics.moveTo(-90, -15);
            bgGraphics.lineTo(-90, -25);
            bgGraphics.lineTo(-80, -25);
            bgGraphics.moveTo(80, -25);
            bgGraphics.lineTo(90, -25);
            bgGraphics.lineTo(90, -15);
            bgGraphics.moveTo(-90, 15);
            bgGraphics.lineTo(-90, 25);
            bgGraphics.lineTo(-80, 25);
            bgGraphics.moveTo(80, 25);
            bgGraphics.lineTo(90, 25);
            bgGraphics.lineTo(90, 15);
            bgGraphics.strokePath();
        });
        hitArea.on("pointerout", () => {
            text.setColor(CYBER_COLORS.TEXT_GREEN);
            bgGraphics.clear();
            bgGraphics.fillStyle(CYBER_COLORS.BG_PANEL, 1);
            bgGraphics.fillRect(-90, -25, 180, 50);
            bgGraphics.lineStyle(2, CYBER_COLORS.GREEN, 1);
            bgGraphics.strokeRect(-90, -25, 180, 50);
            bgGraphics.lineStyle(3, CYBER_COLORS.GREEN, 1);
            bgGraphics.moveTo(-90, -15);
            bgGraphics.lineTo(-90, -25);
            bgGraphics.lineTo(-80, -25);
            bgGraphics.moveTo(80, -25);
            bgGraphics.lineTo(90, -25);
            bgGraphics.lineTo(90, -15);
            bgGraphics.moveTo(-90, 15);
            bgGraphics.lineTo(-90, 25);
            bgGraphics.lineTo(-80, 25);
            bgGraphics.moveTo(80, 25);
            bgGraphics.lineTo(90, 25);
            bgGraphics.lineTo(90, 15);
            bgGraphics.strokePath();
        });
        hitArea.on("pointerdown", () => {
            // Block terminal during dilemma
            if (this.isDilemmaActive) {
                this.showMessage("Faites votre choix");
                return;
            }
            this.aiManager?.pause();
            this.terminalManager.startGame();
        });

        // Resume AI when terminal closes
        EventBus.on("terminal-success", () => {
            this.aiManager?.resume();
        });

        // Handle terminal open/close for disabling movements
        EventBus.on("terminal-opened", () => {
            this.isTerminalOpen = true;
        });
        EventBus.on("terminal-closed", () => {
            this.isTerminalOpen = false;
            // Only resume AI if no dilemma is currently active
            if (!this.isDilemmaActive) {
                this.aiManager?.resume();
            }
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
        // Block actions during dilemma
        if (this.isDilemmaActive) {
            this.showMessage("Faites votre choix");
            return;
        }

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
     * Handle synapse deactivated (when AI catches explorer)
     */
    private onSynapseDeactivated(data: { synapseId: string }): void {
        if (!this.networkData || !this.networkManager) return;

        const synapse = this.networkData.synapses[data.synapseId];
        if (synapse) {
            synapse.state = SynapseState.DORMANT;
            this.networkManager.updateSynapseState(data.synapseId, SynapseState.DORMANT);

            // Also deactivate the neurons connected by this synapse (except entry/core)
            const fromNeuron = this.networkData.neurons[synapse.fromNeuronId];
            const toNeuron = this.networkData.neurons[synapse.toNeuronId];

            if (fromNeuron && fromNeuron.type !== NeuronType.ENTRY && fromNeuron.type !== NeuronType.CORE) {
                // Check if this neuron has any other active connections
                const hasOtherActiveConnections = Object.values(this.networkData.synapses).some(
                    s => s.id !== synapse.id &&
                         s.state === SynapseState.ACTIVE &&
                         (s.fromNeuronId === synapse.fromNeuronId || s.toNeuronId === synapse.fromNeuronId)
                );
                if (!hasOtherActiveConnections) {
                    fromNeuron.isActivated = false;
                    this.networkManager.updateNeuronState(synapse.fromNeuronId);
                }
            }

            if (toNeuron && toNeuron.type !== NeuronType.ENTRY && toNeuron.type !== NeuronType.CORE) {
                // Check if this neuron has any other active connections
                const hasOtherActiveConnections = Object.values(this.networkData.synapses).some(
                    s => s.id !== synapse.id &&
                         s.state === SynapseState.ACTIVE &&
                         (s.fromNeuronId === synapse.toNeuronId || s.toNeuronId === synapse.toNeuronId)
                );
                if (!hasOtherActiveConnections) {
                    toNeuron.isActivated = false;
                    this.networkManager.updateNeuronState(synapse.toNeuronId);
                }
            }
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
     * Handle AI catching explorer - now triggers dilemma
     */
    private onAICaughtExplorer(): void {
        // This is now handled by onAICaughtExplorerDilemma
    }

    /**
     * Handle AI catching explorer with dilemma
     */
    private onAICaughtExplorerDilemma(data: { neuronId: string; dilemma: Dilemma }): void {
        // Close the terminal if it's open
        if (this.terminalManager.isActive()) {
            this.terminalManager.hideUI();
        }

        // Mark dilemma as active
        this.isDilemmaActive = true;

        // Explicitly pause the AI (important: do this AFTER closing terminal
        // to override any resume from terminal-closed event)
        this.aiManager?.pause();

        // Send dilemma to all screens via network (DilemmaScreen and ExplorerGame)
        this.networkService.sendDilemmaTriggered({
            title: `Dilemme éthique`,
            description: data.dilemma.description,
            choices: data.dilemma.choices,
        });

        // Show dilemma in read-only mode
        this.dilemmaManager.showDilemma(data.dilemma);
    }

    /**
     * Handle when a dilemma choice is made
     */
    private onDilemmaChoiceMade(): void {
        // Mark dilemma as no longer active
        this.isDilemmaActive = false;

        // Hide the dilemma display
        this.dilemmaManager.hideDilemma();

        // Resume the game
        this.aiManager?.resumeAfterDilemma();

        // Notify explorer that dilemma is resolved
        const currentNeuronId = this.aiManager?.getCurrentNeuronId() || "";
        this.networkService.sendAIConnected({
            neuronId: currentNeuronId,
            explorerPushedTo: this.explorerPath[this.explorerPath.length - 2] || this.explorerPath[0],
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

        // Handle keyboard camera controls
        this.updateCameraControls(delta);
    }

    /**
     * Update camera with keyboard controls
     */
    private updateCameraControls(delta: number): void {
        // Don't process camera controls if terminal is open
        if (this.isTerminalOpen) return;

        const speed = 0.5 * delta; // Pixels per ms

        // Arrow keys
        if (this.cursors) {
            if (this.cursors.left.isDown) {
                this.cameras.main.scrollX -= speed;
            }
            if (this.cursors.right.isDown) {
                this.cameras.main.scrollX += speed;
            }
            if (this.cursors.up.isDown) {
                this.cameras.main.scrollY -= speed;
            }
            if (this.cursors.down.isDown) {
                this.cameras.main.scrollY += speed;
            }
        }

        // WASD keys
        if (this.wasdKeys) {
            if (this.wasdKeys.A.isDown) {
                this.cameras.main.scrollX -= speed;
            }
            if (this.wasdKeys.D.isDown) {
                this.cameras.main.scrollX += speed;
            }
            if (this.wasdKeys.W.isDown) {
                this.cameras.main.scrollY -= speed;
            }
            if (this.wasdKeys.S.isDown) {
                this.cameras.main.scrollY += speed;
            }
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
        bgGraphics.lineStyle(2, CYBER_COLORS.ORANGE, 0.8);
        bgGraphics.strokeRect(-textWidth / 2, -20, textWidth, 40);

        const msg = this.add.text(0, 0, text, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: CYBER_COLORS.TEXT_ORANGE,
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
     * Cleanup
     */
    shutdown(): void {
        EventBus.off("network-data-received", this.onNetworkReceived, this);
        EventBus.off("network-explorer-moved", this.onExplorerMoved, this);
        EventBus.off("network-synapse-activated", this.onSynapseActivated, this);
        EventBus.off("network-synapse-deactivated", this.onSynapseDeactivated, this);
        EventBus.off("network-game-won", this.onGameWon, this);
        EventBus.off("ai-caught-explorer-dilemma", this.onAICaughtExplorerDilemma, this);
        EventBus.off("dilemma-choice-made", this.onDilemmaChoiceMade, this);
        EventBus.off("network-dilemma-choice", this.onDilemmaChoiceMade, this);
        EventBus.off("terminal-success");
        EventBus.off("terminal-opened");
        EventBus.off("terminal-closed");

        this.networkManager?.destroy();
        this.aiManager?.destroy();
        this.terminalManager?.destroy();
        this.dilemmaManager?.destroy();
    }
}
