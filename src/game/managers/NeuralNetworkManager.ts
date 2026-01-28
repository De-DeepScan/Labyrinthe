import { Scene } from "phaser";
import type { NeuralNetworkData, Neuron, Synapse } from "../types/interfaces";
import { NeuronType, SynapseState } from "../types/interfaces";
import { NEURAL_NETWORK_CONFIG } from "../config/NeuralNetworkConfig";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

export interface NeuralNetworkManagerOptions {
    showAIPath: boolean;
    showAllSynapses: boolean;
    enableFog: boolean;
}

interface NeuronSprite {
    circle: Phaser.GameObjects.Arc;
    glow?: Phaser.GameObjects.Arc;
}

interface SynapseGraphics {
    line: Phaser.GameObjects.Graphics;
}

/**
 * Manages rendering and visual state of the neural network
 */
export class NeuralNetworkManager {
    private scene: Scene;
    private networkData: NeuralNetworkData;
    private options: NeuralNetworkManagerOptions;

    private neuronSprites: Map<string, NeuronSprite> = new Map();
    private synapseGraphics: Map<string, SynapseGraphics> = new Map();
    private visibleNeurons: Set<string> = new Set();

    private explorerSprite?: Phaser.GameObjects.Arc;
    private explorerCurrentNeuron?: string;

    private fogGraphics?: Phaser.GameObjects.Graphics;

    private offsetX: number = 0;
    private offsetY: number = 0;

    constructor(
        scene: Scene,
        networkData: NeuralNetworkData,
        options: NeuralNetworkManagerOptions
    ) {
        this.scene = scene;
        this.networkData = networkData;
        this.options = options;

        // Calculate offset to center the network
        this.calculateOffset();

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Calculate offset to center network in screen
     */
    private calculateOffset(): void {
        const screenWidth = this.scene.cameras.main.width;
        const screenHeight = this.scene.cameras.main.height;

        this.offsetX = (screenWidth - this.networkData.width) / 2;
        this.offsetY = (screenHeight - this.networkData.height) / 2;
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        EventBus.on("synapse-state-changed", this.onSynapseStateChanged, this);
        EventBus.on("neuron-activated", this.onNeuronActivated, this);
        EventBus.on("explorer-moved", this.onExplorerMoved, this);
    }

    /**
     * Render the complete neural network
     */
    render(): void {
        // First render all synapses (behind neurons)
        this.renderAllSynapses();

        // Then render all neurons
        this.renderAllNeurons();

        // Create explorer sprite
        this.createExplorerSprite();

        // Initialize fog if enabled
        if (this.options.enableFog) {
            this.initializeFog();
        }

        // Make synapses and neurons interactive
        this.setupInteraction();
    }

    /**
     * Render all synapses
     */
    private renderAllSynapses(): void {
        const synapses = Object.values(this.networkData.synapses);

        for (const synapse of synapses) {
            this.renderSynapse(synapse);
        }
    }

    /**
     * Render a single synapse
     */
    private renderSynapse(synapse: Synapse): void {
        const fromNeuron = this.networkData.neurons[synapse.fromNeuronId];
        const toNeuron = this.networkData.neurons[synapse.toNeuronId];

        if (!fromNeuron || !toNeuron) return;

        const graphics = this.scene.add.graphics();
        graphics.setDepth(DEPTH.SYNAPSE);

        this.drawSynapseLine(graphics, synapse, fromNeuron, toNeuron);

        this.synapseGraphics.set(synapse.id, { line: graphics });
    }

    /**
     * Draw synapse line with appropriate style
     */
    private drawSynapseLine(
        graphics: Phaser.GameObjects.Graphics,
        synapse: Synapse,
        from: Neuron,
        to: Neuron
    ): void {
        graphics.clear();

        const { color, width, alpha } = this.getSynapseStyle(synapse.state);

        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.moveTo(from.x + this.offsetX, from.y + this.offsetY);
        graphics.lineTo(to.x + this.offsetX, to.y + this.offsetY);
        graphics.strokePath();
    }

    /**
     * Get synapse visual style based on state
     */
    private getSynapseStyle(state: SynapseState): {
        color: number;
        width: number;
        alpha: number;
    } {
        const colors = NEURAL_NETWORK_CONFIG.COLORS;

        switch (state) {
            case SynapseState.ACTIVE:
                return {
                    color: colors.SYNAPSE_ACTIVE,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH_ACTIVE,
                    alpha: 1,
                };
            case SynapseState.SOLVING:
                return {
                    color: colors.SYNAPSE_SOLVING,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH_ACTIVE,
                    alpha: 1,
                };
            case SynapseState.BLOCKED:
                return {
                    color: colors.SYNAPSE_BLOCKED,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH,
                    alpha: 0.8,
                };
            case SynapseState.AI_PATH:
                return {
                    color: colors.SYNAPSE_AI_PATH,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH_ACTIVE,
                    alpha: 0.7,
                };
            case SynapseState.FAILED:
                return {
                    color: colors.SYNAPSE_BLOCKED,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH,
                    alpha: 0.5,
                };
            default:
                return {
                    color: colors.SYNAPSE_DORMANT,
                    width: NEURAL_NETWORK_CONFIG.SYNAPSE_WIDTH,
                    alpha: this.options.showAllSynapses ? 0.4 : 0.2,
                };
        }
    }

    /**
     * Render all neurons
     */
    private renderAllNeurons(): void {
        const neurons = Object.values(this.networkData.neurons);

        for (const neuron of neurons) {
            this.renderNeuron(neuron);
        }
    }

    /**
     * Render a single neuron
     */
    private renderNeuron(neuron: Neuron): void {
        const x = neuron.x + this.offsetX;
        const y = neuron.y + this.offsetY;
        const radius = this.getNeuronRadius(neuron);
        const color = this.getNeuronColor(neuron);

        // Create glow for special neurons
        let glow: Phaser.GameObjects.Arc | undefined;
        if (neuron.type === NeuronType.CORE || neuron.type === NeuronType.ENTRY) {
            glow = this.scene.add.circle(x, y, radius + 10, color, 0.3);
            glow.setDepth(DEPTH.NEURON - 1);

            // Pulse animation
            this.scene.tweens.add({
                targets: glow,
                scale: { from: 1, to: 1.3 },
                alpha: { from: 0.3, to: 0.1 },
                duration: 1000,
                yoyo: true,
                repeat: -1,
            });
        }

        // Main circle
        const circle = this.scene.add.circle(x, y, radius, color);
        circle.setDepth(DEPTH.NEURON);
        circle.setStrokeStyle(2, 0xffffff, 0.5);

        // Store reference
        this.neuronSprites.set(neuron.id, { circle, glow });

        // Initially visible
        this.visibleNeurons.add(neuron.id);
    }

    /**
     * Get neuron radius based on type
     */
    private getNeuronRadius(neuron: Neuron): number {
        switch (neuron.type) {
            case NeuronType.CORE:
                return NEURAL_NETWORK_CONFIG.NEURON_RADIUS_CORE;
            case NeuronType.ENTRY:
                return NEURAL_NETWORK_CONFIG.NEURON_RADIUS_ENTRY;
            default:
                return NEURAL_NETWORK_CONFIG.NEURON_RADIUS;
        }
    }

    /**
     * Get neuron color based on type and state
     */
    private getNeuronColor(neuron: Neuron): number {
        const colors = NEURAL_NETWORK_CONFIG.COLORS;

        if (neuron.isBlocked) {
            return colors.NEURON_BLOCKED;
        }

        switch (neuron.type) {
            case NeuronType.CORE:
                return colors.NEURON_CORE;
            case NeuronType.ENTRY:
                return colors.NEURON_ENTRY;
            default:
                return neuron.isActivated
                    ? colors.NEURON_ACTIVATED
                    : colors.NEURON_NORMAL;
        }
    }

    /**
     * Create explorer sprite
     */
    private createExplorerSprite(): void {
        const entryNeuron = this.networkData.neurons[this.networkData.entryNeuronId];
        if (!entryNeuron) return;

        const x = entryNeuron.x + this.offsetX;
        const y = entryNeuron.y + this.offsetY;

        this.explorerSprite = this.scene.add.circle(
            x,
            y,
            12,
            NEURAL_NETWORK_CONFIG.COLORS.EXPLORER
        );
        this.explorerSprite.setDepth(DEPTH.EXPLORER);
        this.explorerSprite.setStrokeStyle(3, 0xffffff);

        this.explorerCurrentNeuron = this.networkData.entryNeuronId;

        // Pulse animation
        this.scene.tweens.add({
            targets: this.explorerSprite,
            scale: { from: 1, to: 1.15 },
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    /**
     * Initialize fog of war
     */
    private initializeFog(): void {
        // Calculate visibility from explorer position
        this.updateFogVisibility();
    }

    /**
     * Update fog visibility based on explorer position
     */
    updateFogVisibility(): void {
        if (!this.options.enableFog || !this.explorerCurrentNeuron) return;

        const visibleIds = this.calculateVisibleNeurons(
            this.explorerCurrentNeuron,
            NEURAL_NETWORK_CONFIG.EXPLORER_VISION_RADIUS
        );

        // Update visibility of neurons
        for (const [neuronId, sprite] of this.neuronSprites) {
            const isVisible = visibleIds.has(neuronId);
            sprite.circle.setAlpha(isVisible ? 1 : 0.15);
            if (sprite.glow) {
                sprite.glow.setAlpha(isVisible ? 0.3 : 0.05);
            }
        }

        // Update visibility of synapses
        for (const [synapseId, graphics] of this.synapseGraphics) {
            const synapse = this.networkData.synapses[synapseId];
            const fromVisible = visibleIds.has(synapse.fromNeuronId);
            const toVisible = visibleIds.has(synapse.toNeuronId);
            graphics.line.setAlpha(fromVisible && toVisible ? 1 : 0.1);
        }

        this.visibleNeurons = visibleIds;
    }

    /**
     * Calculate visible neurons from a starting point
     */
    private calculateVisibleNeurons(startId: string, radius: number): Set<string> {
        const visible = new Set<string>();
        const queue: { id: string; dist: number }[] = [{ id: startId, dist: 0 }];

        while (queue.length > 0) {
            const { id, dist } = queue.shift()!;

            if (visible.has(id)) continue;
            if (dist > radius) continue;

            visible.add(id);

            const neuron = this.networkData.neurons[id];
            if (!neuron) continue;

            // Only expand through activated synapses or from entry
            for (const neighborId of neuron.connections) {
                if (visible.has(neighborId)) continue;

                // Check if synapse is activated or we're at the entry
                const synapse = this.findSynapseBetween(id, neighborId);
                const canPass =
                    neuron.type === NeuronType.ENTRY ||
                    neuron.isActivated ||
                    (synapse && synapse.state === SynapseState.ACTIVE);

                if (canPass || dist === 0) {
                    queue.push({ id: neighborId, dist: dist + 1 });
                }
            }
        }

        return visible;
    }

    /**
     * Find synapse between two neurons
     */
    private findSynapseBetween(neuronAId: string, neuronBId: string): Synapse | undefined {
        return Object.values(this.networkData.synapses).find(
            (s) =>
                (s.fromNeuronId === neuronAId && s.toNeuronId === neuronBId) ||
                (s.fromNeuronId === neuronBId && s.toNeuronId === neuronAId)
        );
    }

    /**
     * Setup interaction handlers
     */
    private setupInteraction(): void {
        // Make neurons interactive
        for (const [neuronId, sprite] of this.neuronSprites) {
            sprite.circle.setInteractive({ useHandCursor: true });

            sprite.circle.on("pointerover", () => {
                sprite.circle.setScale(1.2);
            });

            sprite.circle.on("pointerout", () => {
                sprite.circle.setScale(1);
            });

            sprite.circle.on("pointerdown", () => {
                EventBus.emit("neuron-clicked", neuronId);
            });
        }
    }

    /**
     * Move explorer to a new neuron with animation
     */
    moveExplorerTo(neuronId: string, duration: number = 300): Promise<void> {
        return new Promise((resolve) => {
            const neuron = this.networkData.neurons[neuronId];
            if (!neuron || !this.explorerSprite) {
                resolve();
                return;
            }

            const x = neuron.x + this.offsetX;
            const y = neuron.y + this.offsetY;

            this.scene.tweens.add({
                targets: this.explorerSprite,
                x,
                y,
                duration,
                ease: "Power2",
                onComplete: () => {
                    this.explorerCurrentNeuron = neuronId;
                    if (this.options.enableFog) {
                        this.updateFogVisibility();
                    }
                    resolve();
                },
            });
        });
    }

    /**
     * Update synapse visual state
     */
    updateSynapseState(synapseId: string, state: SynapseState): void {
        const synapse = this.networkData.synapses[synapseId];
        if (!synapse) return;

        synapse.state = state;

        const graphics = this.synapseGraphics.get(synapseId);
        if (!graphics) return;

        const fromNeuron = this.networkData.neurons[synapse.fromNeuronId];
        const toNeuron = this.networkData.neurons[synapse.toNeuronId];

        this.drawSynapseLine(graphics.line, synapse, fromNeuron, toNeuron);

        // Update depth for active synapses
        if (state === SynapseState.ACTIVE) {
            graphics.line.setDepth(DEPTH.SYNAPSE_ACTIVE);
        }
    }

    /**
     * Update neuron visual state
     */
    updateNeuronState(neuronId: string): void {
        const neuron = this.networkData.neurons[neuronId];
        if (!neuron) return;

        const sprite = this.neuronSprites.get(neuronId);
        if (!sprite) return;

        const color = this.getNeuronColor(neuron);
        sprite.circle.setFillStyle(color);

        // Flash animation on activation
        if (neuron.isActivated) {
            this.scene.tweens.add({
                targets: sprite.circle,
                scale: { from: 1.5, to: 1 },
                duration: 300,
                ease: "Back.easeOut",
            });
        }
    }

    /**
     * Show AI path (Protector only)
     */
    showAIPath(path: string[]): void {
        if (!this.options.showAIPath) return;

        // Mark synapses along the path
        for (let i = 0; i < path.length - 1; i++) {
            const synapse = this.findSynapseBetween(path[i], path[i + 1]);
            if (synapse && synapse.state === SynapseState.DORMANT) {
                this.updateSynapseState(synapse.id, SynapseState.AI_PATH);
            }
        }
    }

    /**
     * Clear AI path visualization
     */
    clearAIPath(): void {
        for (const synapse of Object.values(this.networkData.synapses)) {
            if (synapse.state === SynapseState.AI_PATH) {
                this.updateSynapseState(synapse.id, SynapseState.DORMANT);
            }
        }
    }

    /**
     * Get neuron at screen position
     */
    getNeuronAtPosition(x: number, y: number): Neuron | null {
        for (const neuron of Object.values(this.networkData.neurons)) {
            const nx = neuron.x + this.offsetX;
            const ny = neuron.y + this.offsetY;
            const radius = this.getNeuronRadius(neuron);

            const dx = x - nx;
            const dy = y - ny;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                return neuron;
            }
        }
        return null;
    }

    /**
     * Get current explorer neuron ID
     */
    getExplorerNeuronId(): string | undefined {
        return this.explorerCurrentNeuron;
    }

    /**
     * Check if a neuron is visible (for fog of war)
     */
    isNeuronVisible(neuronId: string): boolean {
        return this.visibleNeurons.has(neuronId);
    }

    /**
     * Event handler: synapse state changed
     */
    private onSynapseStateChanged(data: { synapseId: string; state: SynapseState }): void {
        this.updateSynapseState(data.synapseId, data.state);
    }

    /**
     * Event handler: neuron activated
     */
    private onNeuronActivated(neuronId: string): void {
        const neuron = this.networkData.neurons[neuronId];
        if (neuron) {
            neuron.isActivated = true;
            this.updateNeuronState(neuronId);
        }
    }

    /**
     * Event handler: explorer moved
     */
    private onExplorerMoved(data: { neuronId: string }): void {
        this.moveExplorerTo(data.neuronId);
    }

    /**
     * Cleanup
     */
    destroy(): void {
        EventBus.off("synapse-state-changed", this.onSynapseStateChanged, this);
        EventBus.off("neuron-activated", this.onNeuronActivated, this);
        EventBus.off("explorer-moved", this.onExplorerMoved, this);

        this.neuronSprites.forEach((sprite) => {
            sprite.circle.destroy();
            sprite.glow?.destroy();
        });

        this.synapseGraphics.forEach((graphics) => {
            graphics.line.destroy();
        });

        this.explorerSprite?.destroy();
        this.fogGraphics?.destroy();

        this.neuronSprites.clear();
        this.synapseGraphics.clear();
    }
}
