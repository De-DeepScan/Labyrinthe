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
    shape: Phaser.GameObjects.Graphics;
    glow?: Phaser.GameObjects.Graphics;
}

// Isometric constants
const ISO_ANGLE = Math.PI / 6; // 30 degrees
const ISO_SCALE_Y = 0.5; // Vertical compression for isometric

interface SynapseGraphics {
    line: Phaser.GameObjects.Graphics;
}

interface ExplorerSprite {
    container: Phaser.GameObjects.Container;
    faces: Phaser.GameObjects.Graphics[];
    rotation: number;
}

/**
 * Manages rendering and visual state of the neural network
 * Now with isometric view, octagon neurons, and 3D rolling decagon explorer
 */
export class NeuralNetworkManager {
    private scene: Scene;
    private networkData: NeuralNetworkData;
    private options: NeuralNetworkManagerOptions;

    private neuronSprites: Map<string, NeuronSprite> = new Map();
    private synapseGraphics: Map<string, SynapseGraphics> = new Map();
    private visibleNeurons: Set<string> = new Set();

    private explorerSprite?: ExplorerSprite;
    private explorerCurrentNeuron?: string;
    private explorerRollTween?: Phaser.Tweens.Tween;
    private explorerFloatTween?: Phaser.Tweens.Tween;

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

        // For isometric, we need more vertical space
        this.offsetX = screenWidth / 2;
        this.offsetY = screenHeight / 2 - 50;
    }

    /**
     * Convert cartesian coordinates to isometric
     */
    private toIsometric(x: number, y: number): { x: number; y: number } {
        // Center the coordinates first
        const centerX = this.networkData.width / 2;
        const centerY = this.networkData.height / 2;
        const dx = x - centerX;
        const dy = y - centerY;

        // Apply isometric transformation
        const isoX = (dx - dy) * Math.cos(ISO_ANGLE);
        const isoY = (dx + dy) * ISO_SCALE_Y;

        return {
            x: isoX + this.offsetX,
            y: isoY + this.offsetY,
        };
    }

    /**
     * Draw an octagon at the given position
     */
    private drawOctagon(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        radius: number,
        fillColor: number,
        fillAlpha: number = 1,
        strokeColor: number = 0xffffff,
        strokeAlpha: number = 0.5,
        strokeWidth: number = 2
    ): void {
        const points: { x: number; y: number }[] = [];
        const sides = 8;

        // Create octagon points with isometric distortion
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 8;
            const px = x + radius * Math.cos(angle);
            // Apply vertical compression for isometric feel
            const py = y + radius * Math.sin(angle) * ISO_SCALE_Y;
            points.push({ x: px, y: py });
        }

        // Draw filled octagon
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.fillPath();

        // Draw stroke
        graphics.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.strokePath();
    }

    /**
     * Create a 3D ball with 10 visible faces for the explorer (icosahedron-like)
     */
    private createDecagon3D(x: number, y: number): ExplorerSprite {
        const container = this.scene.add.container(x, y);
        container.setDepth(DEPTH.EXPLORER);

        const faces: Phaser.GameObjects.Graphics[] = [];
        const radius = 16;
        const baseColor = NEURAL_NETWORK_CONFIG.COLORS.EXPLORER;

        // Draw the 3D ball with faceted faces
        const ballGraphics = this.scene.add.graphics();
        this.drawFacetedBall(ballGraphics, 0, 0, radius, baseColor);
        faces.push(ballGraphics);
        container.add(ballGraphics);

        // Add specular highlight
        const highlight = this.scene.add.graphics();
        highlight.fillStyle(0xffffff, 0.5);
        highlight.fillEllipse(-radius * 0.3, -radius * 0.3, radius * 0.4, radius * 0.25);
        container.add(highlight);

        return {
            container,
            faces,
            rotation: 0,
        };
    }

    /**
     * Draw a 3D faceted ball (sphere with 10 visible faces)
     */
    private drawFacetedBall(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        radius: number,
        baseColor: number
    ): void {
        // Define faces as triangular sections on a sphere
        // We'll draw 10 visible faces arranged like a pentagonal antiprism

        // Draw outer sphere shadow/depth
        graphics.fillStyle(this.darkenColor(baseColor, 0.3), 1);
        graphics.fillEllipse(x + 2, y + 3, radius * 2, radius * 1.4);

        // Draw the main ball outline (darker base)
        graphics.fillStyle(this.darkenColor(baseColor, 0.5), 1);
        graphics.fillEllipse(x, y, radius * 2, radius * 1.4);

        // Draw faceted faces as triangular wedges from center
        // Upper row of faces (5 faces)
        for (let i = 0; i < 5; i++) {
            const angle1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const angle2 = ((i + 1) * 2 * Math.PI) / 5 - Math.PI / 2;

            // Shade based on angle (light from top-left)
            const lightAngle = -Math.PI / 4; // Light coming from top-left
            const angleDiff = Math.cos(angle1 - lightAngle);
            const shade = 0.6 + 0.4 * angleDiff;
            const faceColor = this.lerpColor(this.darkenColor(baseColor, 0.4), baseColor, shade);

            // Calculate face vertices
            const topY = y - radius * 0.3;
            const midY = y + radius * 0.1;

            const x1 = x + radius * 0.85 * Math.cos(angle1);
            const y1 = midY + radius * 0.35 * Math.sin(angle1) * ISO_SCALE_Y;

            const x2 = x + radius * 0.85 * Math.cos(angle2);
            const y2 = midY + radius * 0.35 * Math.sin(angle2) * ISO_SCALE_Y;

            const xTop = x + radius * 0.3 * Math.cos((angle1 + angle2) / 2);
            const yTop = topY + radius * 0.15 * Math.sin((angle1 + angle2) / 2) * ISO_SCALE_Y;

            // Draw triangular face
            graphics.fillStyle(faceColor, 1);
            graphics.beginPath();
            graphics.moveTo(xTop, yTop);
            graphics.lineTo(x1, y1);
            graphics.lineTo(x2, y2);
            graphics.closePath();
            graphics.fillPath();

            // Draw face edges
            graphics.lineStyle(1, 0xffffff, 0.4);
            graphics.beginPath();
            graphics.moveTo(xTop, yTop);
            graphics.lineTo(x1, y1);
            graphics.lineTo(x2, y2);
            graphics.closePath();
            graphics.strokePath();
        }

        // Lower row of faces (5 faces, offset)
        for (let i = 0; i < 5; i++) {
            const angle1 = ((i + 0.5) * 2 * Math.PI) / 5 - Math.PI / 2;
            const angle2 = ((i + 1.5) * 2 * Math.PI) / 5 - Math.PI / 2;

            // Shade based on angle (darker for lower faces)
            const lightAngle = -Math.PI / 4;
            const angleDiff = Math.cos(angle1 - lightAngle);
            const shade = 0.3 + 0.35 * angleDiff;
            const faceColor = this.lerpColor(this.darkenColor(baseColor, 0.3), this.darkenColor(baseColor, 0.7), shade);

            // Calculate face vertices
            const midY = y + radius * 0.1;
            const botY = y + radius * 0.5;

            const x1 = x + radius * 0.85 * Math.cos(angle1);
            const y1 = midY + radius * 0.35 * Math.sin(angle1) * ISO_SCALE_Y;

            const x2 = x + radius * 0.85 * Math.cos(angle2);
            const y2 = midY + radius * 0.35 * Math.sin(angle2) * ISO_SCALE_Y;

            const xBot = x + radius * 0.4 * Math.cos((angle1 + angle2) / 2);
            const yBot = botY + radius * 0.2 * Math.sin((angle1 + angle2) / 2) * ISO_SCALE_Y;

            // Draw triangular face
            graphics.fillStyle(faceColor, 1);
            graphics.beginPath();
            graphics.moveTo(x1, y1);
            graphics.lineTo(xBot, yBot);
            graphics.lineTo(x2, y2);
            graphics.closePath();
            graphics.fillPath();

            // Draw face edges
            graphics.lineStyle(1, 0xffffff, 0.25);
            graphics.beginPath();
            graphics.moveTo(x1, y1);
            graphics.lineTo(xBot, yBot);
            graphics.lineTo(x2, y2);
            graphics.closePath();
            graphics.strokePath();
        }

        // Draw ball outline
        graphics.lineStyle(2, 0xffffff, 0.6);
        graphics.strokeEllipse(x, y, radius * 2, radius * 1.4);
    }

    /**
     * Darken a color by a factor
     */
    private darkenColor(color: number, factor: number): number {
        const r = Math.floor(((color >> 16) & 0xff) * factor);
        const g = Math.floor(((color >> 8) & 0xff) * factor);
        const b = Math.floor((color & 0xff) * factor);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Linearly interpolate between two colors
     */
    private lerpColor(color1: number, color2: number, t: number): number {
        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;

        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;

        const r = Math.floor(r1 + (r2 - r1) * t);
        const g = Math.floor(g1 + (g2 - g1) * t);
        const b = Math.floor(b1 + (b2 - b1) * t);

        return (r << 16) | (g << 8) | b;
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
     * Draw synapse line with appropriate style (isometric)
     */
    private drawSynapseLine(
        graphics: Phaser.GameObjects.Graphics,
        synapse: Synapse,
        from: Neuron,
        to: Neuron
    ): void {
        graphics.clear();

        const { color, width, alpha } = this.getSynapseStyle(synapse.state);
        const fromIso = this.toIsometric(from.x, from.y);
        const toIso = this.toIsometric(to.x, to.y);

        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.moveTo(fromIso.x, fromIso.y);
        graphics.lineTo(toIso.x, toIso.y);
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
     * Render a single neuron as an octagon (isometric)
     */
    private renderNeuron(neuron: Neuron): void {
        const isoPos = this.toIsometric(neuron.x, neuron.y);
        const radius = this.getNeuronRadius(neuron);
        const color = this.getNeuronColor(neuron);

        // Create static glow for special neurons (no animation)
        let glow: Phaser.GameObjects.Graphics | undefined;
        if (neuron.type === NeuronType.CORE || neuron.type === NeuronType.ENTRY) {
            glow = this.scene.add.graphics();
            glow.setDepth(DEPTH.NEURON - 1);
            this.drawOctagon(glow, isoPos.x, isoPos.y, radius + 12, color, 0.3, color, 0, 0);
        }

        // Main octagon shape
        const shape = this.scene.add.graphics();
        shape.setDepth(DEPTH.NEURON);

        // Draw octagon with 3D effect (darker bottom edge)
        this.drawOctagon3D(shape, isoPos.x, isoPos.y, radius, color);

        // Store reference
        this.neuronSprites.set(neuron.id, { shape, glow });

        // Initially visible
        this.visibleNeurons.add(neuron.id);
    }

    /**
     * Draw an octagon with 3D isometric effect
     */
    private drawOctagon3D(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        radius: number,
        color: number
    ): void {
        const height = 6; // 3D depth
        const sides = 8;

        // Draw shadow/bottom
        const bottomColor = this.darkenColor(color, 0.4);
        const points: { x: number; y: number }[] = [];

        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI) / sides - Math.PI / 8;
            const px = x + radius * Math.cos(angle);
            const py = y + height + radius * Math.sin(angle) * ISO_SCALE_Y;
            points.push({ x: px, y: py });
        }

        graphics.fillStyle(bottomColor, 1);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.closePath();
        graphics.fillPath();

        // Draw top face
        this.drawOctagon(graphics, x, y, radius, color, 1, 0xffffff, 0.6, 2);
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
     * Create explorer sprite as a 3D rolling decagon
     */
    private createExplorerSprite(): void {
        const entryNeuron = this.networkData.neurons[this.networkData.entryNeuronId];
        if (!entryNeuron) return;

        const isoPos = this.toIsometric(entryNeuron.x, entryNeuron.y);

        this.explorerSprite = this.createDecagon3D(isoPos.x, isoPos.y);
        this.explorerCurrentNeuron = this.networkData.entryNeuronId;

        // Start idle floating animation
        this.startFloatAnimation(isoPos.y);
    }

    /**
     * Start or restart the floating animation at a given base Y position
     */
    private startFloatAnimation(baseY: number): void {
        if (!this.explorerSprite) return;

        // Stop existing float tween
        if (this.explorerFloatTween) {
            this.explorerFloatTween.stop();
        }

        // Create new floating animation centered on the new position
        this.explorerFloatTween = this.scene.tweens.add({
            targets: this.explorerSprite.container,
            y: { from: baseY, to: baseY - 3 },
            duration: 800,
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
            sprite.shape.setAlpha(isVisible ? 1 : 0.15);
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
        // Make neurons interactive - need to create hit areas for graphics
        for (const [neuronId] of this.neuronSprites) {
            const neuron = this.networkData.neurons[neuronId];
            const isoPos = this.toIsometric(neuron.x, neuron.y);
            const radius = this.getNeuronRadius(neuron);

            // Create an invisible hit area (above explorer so it's always clickable)
            const hitArea = this.scene.add.circle(isoPos.x, isoPos.y, radius, 0x000000, 0);
            hitArea.setDepth(DEPTH.EXPLORER + 10);
            hitArea.setInteractive({ useHandCursor: true });

            // Click handler only - no hover scaling to prevent visual movement
            hitArea.on("pointerdown", () => {
                EventBus.emit("neuron-clicked", neuronId);
            });
        }
    }

    /**
     * Move explorer to a new neuron with rolling animation
     */
    moveExplorerTo(neuronId: string, duration: number = 400): Promise<void> {
        return new Promise((resolve) => {
            const neuron = this.networkData.neurons[neuronId];
            if (!neuron || !this.explorerSprite) {
                resolve();
                return;
            }

            const isoPos = this.toIsometric(neuron.x, neuron.y);
            const container = this.explorerSprite.container;

            // Calculate direction for roll rotation
            const dx = isoPos.x - container.x;
            const dy = isoPos.y - container.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Stop any existing tweens
            if (this.explorerRollTween) {
                this.explorerRollTween.stop();
            }
            if (this.explorerFloatTween) {
                this.explorerFloatTween.stop();
            }

            // Create rolling effect by animating the faces
            const rollAngle = (distance / 14) * Math.PI; // Roll based on distance
            const startRotation = this.explorerSprite.rotation;

            // Movement tween
            this.scene.tweens.add({
                targets: container,
                x: isoPos.x,
                y: isoPos.y,
                duration,
                ease: "Power2",
                onComplete: () => {
                    this.explorerCurrentNeuron = neuronId;
                    this.explorerSprite!.rotation = startRotation + rollAngle;
                    if (this.options.enableFog) {
                        this.updateFogVisibility();
                    }
                    // Restart floating animation at new position
                    this.startFloatAnimation(isoPos.y);
                    resolve();
                },
            });

            // Rolling visual effect - scale oscillation to simulate 3D roll
            this.explorerRollTween = this.scene.tweens.add({
                targets: container,
                scaleX: { from: 1, to: 0.85 },
                duration: duration / 4,
                yoyo: true,
                repeat: 1,
                ease: "Sine.easeInOut",
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

        // Redraw the octagon with new color
        const isoPos = this.toIsometric(neuron.x, neuron.y);
        const radius = this.getNeuronRadius(neuron);
        const color = this.getNeuronColor(neuron);

        sprite.shape.clear();
        this.drawOctagon3D(sprite.shape, isoPos.x, isoPos.y, radius, color);

        // Flash animation on activation
        if (neuron.isActivated) {
            this.scene.tweens.add({
                targets: sprite.shape,
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
     * Get neuron at screen position (isometric)
     */
    getNeuronAtPosition(x: number, y: number): Neuron | null {
        for (const neuron of Object.values(this.networkData.neurons)) {
            const isoPos = this.toIsometric(neuron.x, neuron.y);
            const radius = this.getNeuronRadius(neuron);

            const dx = x - isoPos.x;
            const dy = y - isoPos.y;
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
     * Get the explorer container for camera following
     */
    getExplorerContainer(): Phaser.GameObjects.Container | undefined {
        return this.explorerSprite?.container;
    }

    /**
     * Get the world bounds for the isometric network
     */
    getWorldBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const neuron of Object.values(this.networkData.neurons)) {
            const isoPos = this.toIsometric(neuron.x, neuron.y);
            minX = Math.min(minX, isoPos.x);
            minY = Math.min(minY, isoPos.y);
            maxX = Math.max(maxX, isoPos.x);
            maxY = Math.max(maxY, isoPos.y);
        }

        // Add padding
        const padding = 150;
        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding,
        };
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
            sprite.shape.destroy();
            sprite.glow?.destroy();
        });

        this.synapseGraphics.forEach((graphics) => {
            graphics.line.destroy();
        });

        this.explorerSprite?.container.destroy();
        this.explorerRollTween?.stop();
        this.explorerFloatTween?.stop();
        this.fogGraphics?.destroy();

        this.neuronSprites.clear();
        this.synapseGraphics.clear();
    }
}
