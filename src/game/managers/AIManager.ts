import { Scene } from "phaser";
import type { NeuralNetworkData, AIState, Neuron } from "../types/interfaces";
import { NeuronType } from "../types/interfaces";
import { NEURAL_NETWORK_CONFIG } from "../config/NeuralNetworkConfig";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

/**
 * Manages AI behavior and pursuit of the explorer
 */
export class AIManager {
    private scene: Scene;
    private networkData: NeuralNetworkData;
    private state: AIState;
    private blockedSynapses: Set<string> = new Set();
    private destroyedNeurons: Set<string> = new Set();

    private explorerPath: string[] = [];
    private isPaused: boolean = false;
    private gameStartTime: number = 0;

    // Hacking state (when AI is blocked by destroyed neurons)
    private isHacking: boolean = false;
    private hackingNeuronId: string | null = null;
    private hackingProgress: number = 0;
    private hackingDuration: number = NEURAL_NETWORK_CONFIG.AI_HACK_TIME;

    // Visual elements
    private aiSprite?: Phaser.GameObjects.Arc;
    private pathGraphics?: Phaser.GameObjects.Graphics;
    private hackingBar?: Phaser.GameObjects.Graphics;
    private hackingText?: Phaser.GameObjects.Text;

    // Offset for rendering (same as NeuralNetworkManager)
    private offsetX: number = 0;
    private offsetY: number = 0;

    // Callbacks
    private onCatchExplorerCallback?: () => void;
    private onPositionChangedCallback?: (neuronId: string) => void;
    private onNeuronHackedCallback?: (neuronId: string) => void;

    constructor(
        scene: Scene,
        networkData: NeuralNetworkData,
        offsetX: number = 0,
        offsetY: number = 0
    ) {
        this.scene = scene;
        this.networkData = networkData;
        this.offsetX = offsetX;
        this.offsetY = offsetY;

        // Initialize AI state
        this.state = this.createInitialState();

        // Create visuals
        this.createVisuals();

        this.gameStartTime = Date.now();
    }

    /**
     * Create initial AI state - spawn opposite to entry
     */
    private createInitialState(): AIState {
        const entryNeuron = this.networkData.neurons[this.networkData.entryNeuronId];

        // Find neuron furthest from entry to spawn AI
        let maxDist = 0;
        let spawnId = this.networkData.coreNeuronId;

        for (const neuron of Object.values(this.networkData.neurons)) {
            // Don't spawn on entry or core
            if (neuron.type === NeuronType.ENTRY || neuron.type === NeuronType.CORE) {
                continue;
            }

            const dist = this.distance(neuron, entryNeuron);
            if (dist > maxDist) {
                maxDist = dist;
                spawnId = neuron.id;
            }
        }

        return {
            currentNeuronId: spawnId,
            targetPath: [],
            speed: NEURAL_NETWORK_CONFIG.AI_BASE_SPEED,
            baseSpeed: NEURAL_NETWORK_CONFIG.AI_BASE_SPEED,
            speedMultiplier: 1.0,
            isConnected: false,
            moveProgress: 0,
        };
    }

    /**
     * Create AI visual elements
     */
    private createVisuals(): void {
        const neuron = this.networkData.neurons[this.state.currentNeuronId];
        if (!neuron) return;

        const x = neuron.x + this.offsetX;
        const y = neuron.y + this.offsetY;

        // AI sprite - menacing red pulsing circle
        this.aiSprite = this.scene.add.circle(x, y, 18, NEURAL_NETWORK_CONFIG.COLORS.AI_ENTITY, 0.9);
        this.aiSprite.setDepth(DEPTH.AI_ENTITY);
        this.aiSprite.setStrokeStyle(3, 0xffffff, 0.7);

        // Pulse animation
        this.scene.tweens.add({
            targets: this.aiSprite,
            scale: { from: 0.9, to: 1.2 },
            alpha: { from: 0.7, to: 1 },
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Path visualization graphics
        this.pathGraphics = this.scene.add.graphics();
        this.pathGraphics.setDepth(DEPTH.AI_PATH);
    }

    /**
     * Update explorer's activated path (called when explorer moves)
     */
    updateExplorerPath(path: string[]): void {
        this.explorerPath = path;

        // Recalculate target path
        this.recalculatePath();
    }

    /**
     * Add a blocked synapse
     */
    addBlockedSynapse(synapseId: string): void {
        this.blockedSynapses.add(synapseId);

        // Recalculate path if it used this synapse
        this.recalculatePath();
    }

    /**
     * Add a destroyed neuron
     */
    addDestroyedNeuron(neuronId: string): void {
        this.destroyedNeurons.add(neuronId);

        // Recalculate path
        this.recalculatePath();
    }

    /**
     * Recalculate path to explorer
     */
    private recalculatePath(): void {
        if (this.explorerPath.length === 0) {
            this.state.targetPath = [];
            return;
        }

        // Find shortest path to any neuron in explorer's path
        const path = this.findPathToTargets(
            this.state.currentNeuronId,
            this.explorerPath
        );

        this.state.targetPath = path;
        this.drawPath();
    }

    /**
     * Find shortest path to any of the target neurons using BFS
     */
    private findPathToTargets(fromId: string, targetIds: string[]): string[] {
        const targetSet = new Set(targetIds);
        const visited = new Set<string>();
        const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (visited.has(id)) continue;
            visited.add(id);

            // Goal check
            if (targetSet.has(id)) {
                return path;
            }

            const neuron = this.networkData.neurons[id];
            if (!neuron) continue;

            // Expand to neighbors
            for (const neighborId of neuron.connections) {
                if (visited.has(neighborId)) continue;

                // Check if neighbor neuron is destroyed
                if (this.destroyedNeurons.has(neighborId)) {
                    continue;
                }

                // Check if synapse is blocked
                const synapse = this.findSynapseBetween(id, neighborId);
                if (synapse && this.blockedSynapses.has(synapse.id)) {
                    continue;
                }

                queue.push({ id: neighborId, path: [...path, neighborId] });
            }
        }

        return []; // No path found
    }

    /**
     * Find synapse between two neurons
     */
    private findSynapseBetween(aId: string, bId: string): { id: string } | undefined {
        return Object.values(this.networkData.synapses).find(
            (s) =>
                (s.fromNeuronId === aId && s.toNeuronId === bId) ||
                (s.fromNeuronId === bId && s.toNeuronId === aId)
        );
    }

    /**
     * Draw the AI's planned path
     */
    private drawPath(): void {
        if (!this.pathGraphics) return;

        this.pathGraphics.clear();

        if (this.state.targetPath.length < 2) return;

        // Draw dashed red line
        this.pathGraphics.lineStyle(3, NEURAL_NETWORK_CONFIG.COLORS.AI_PATH, 0.6);

        for (let i = 0; i < this.state.targetPath.length - 1; i++) {
            const from = this.networkData.neurons[this.state.targetPath[i]];
            const to = this.networkData.neurons[this.state.targetPath[i + 1]];

            if (!from || !to) continue;

            // Draw dashed line segments
            this.drawDashedLine(
                from.x + this.offsetX,
                from.y + this.offsetY,
                to.x + this.offsetX,
                to.y + this.offsetY
            );
        }
    }

    /**
     * Draw a dashed line
     */
    private drawDashedLine(x1: number, y1: number, x2: number, y2: number): void {
        if (!this.pathGraphics) return;

        const dashLength = 10;
        const gapLength = 8;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dashCount = Math.floor(distance / (dashLength + gapLength));

        const unitX = dx / distance;
        const unitY = dy / distance;

        for (let i = 0; i < dashCount; i++) {
            const startX = x1 + unitX * i * (dashLength + gapLength);
            const startY = y1 + unitY * i * (dashLength + gapLength);
            const endX = startX + unitX * dashLength;
            const endY = startY + unitY * dashLength;

            this.pathGraphics.beginPath();
            this.pathGraphics.moveTo(startX, startY);
            this.pathGraphics.lineTo(endX, endY);
            this.pathGraphics.strokePath();
        }
    }

    /**
     * Main update loop - call every frame
     */
    update(delta: number): void {
        if (this.isPaused || this.state.isConnected) return;

        // Increase speed over time
        const elapsedSeconds = (Date.now() - this.gameStartTime) / 1000;
        this.state.speedMultiplier = 1 + elapsedSeconds * NEURAL_NETWORK_CONFIG.AI_SPEED_INCREASE;
        this.state.speed = Math.min(
            this.state.baseSpeed * this.state.speedMultiplier,
            NEURAL_NETWORK_CONFIG.AI_MAX_SPEED
        );

        // If hacking, update hacking progress
        if (this.isHacking) {
            this.updateHacking(delta);
            return;
        }

        // If no path and explorer exists, try to hack a neuron
        if (this.state.targetPath.length <= 1 && this.explorerPath.length > 0) {
            const neuronToHack = this.findNeuronToHack();
            if (neuronToHack) {
                this.startHacking(neuronToHack);
                return;
            }
        }

        // Move along path
        if (this.state.targetPath.length > 1) {
            this.state.moveProgress += this.state.speed * (delta / 1000);

            if (this.state.moveProgress >= 1) {
                // Arrived at next neuron
                this.state.currentNeuronId = this.state.targetPath[1];
                this.state.targetPath.shift();
                this.state.moveProgress = 0;

                // Update visual position
                this.updateVisualPosition();

                // Emit position change
                EventBus.emit("ai-position-changed", {
                    neuronId: this.state.currentNeuronId,
                    path: this.state.targetPath,
                });
                this.onPositionChangedCallback?.(this.state.currentNeuronId);

                // Check if caught explorer
                if (this.explorerPath.includes(this.state.currentNeuronId)) {
                    this.handleCatchExplorer();
                }

                // Redraw path
                this.drawPath();
            } else {
                // Interpolate visual position
                this.interpolateVisualPosition();
            }
        }
    }

    /**
     * Find a destroyed neuron to hack that would give us a path to the explorer
     */
    private findNeuronToHack(): string | null {
        if (this.destroyedNeurons.size === 0) return null;

        const currentNeuron = this.networkData.neurons[this.state.currentNeuronId];
        if (!currentNeuron) return null;

        // Find destroyed neurons adjacent to current position
        for (const neighborId of currentNeuron.connections) {
            if (this.destroyedNeurons.has(neighborId)) {
                // Check if hacking this neuron would give us a path
                const testPath = this.findPathWithoutNeuronBlocked(
                    this.state.currentNeuronId,
                    this.explorerPath,
                    neighborId
                );
                if (testPath.length > 0) {
                    return neighborId;
                }
            }
        }

        // If no adjacent destroyed neurons, find the nearest one
        let nearestDist = Infinity;
        let nearestNeuronId: string | null = null;

        for (const destroyedId of this.destroyedNeurons) {
            const destroyedNeuron = this.networkData.neurons[destroyedId];
            if (!destroyedNeuron) continue;

            const dist = this.distance(currentNeuron, destroyedNeuron);
            if (dist < nearestDist) {
                // Check if this neuron is reachable (adjacent to a non-destroyed neuron we can reach)
                for (const neighborId of destroyedNeuron.connections) {
                    if (!this.destroyedNeurons.has(neighborId)) {
                        const pathToNeighbor = this.findPathToTargets(
                            this.state.currentNeuronId,
                            [neighborId]
                        );
                        if (pathToNeighbor.length > 0) {
                            nearestDist = dist;
                            nearestNeuronId = destroyedId;
                            break;
                        }
                    }
                }
            }
        }

        return nearestNeuronId;
    }

    /**
     * Find path assuming a specific neuron is not blocked
     */
    private findPathWithoutNeuronBlocked(fromId: string, targetIds: string[], unblockNeuronId: string): string[] {
        const targetSet = new Set(targetIds);
        const visited = new Set<string>();
        const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];

        while (queue.length > 0) {
            const { id, path } = queue.shift()!;

            if (visited.has(id)) continue;
            visited.add(id);

            if (targetSet.has(id)) {
                return path;
            }

            const neuron = this.networkData.neurons[id];
            if (!neuron) continue;

            for (const neighborId of neuron.connections) {
                if (visited.has(neighborId)) continue;

                // Skip destroyed neurons EXCEPT the one we're testing
                if (this.destroyedNeurons.has(neighborId) && neighborId !== unblockNeuronId) {
                    continue;
                }

                const synapse = this.findSynapseBetween(id, neighborId);
                if (synapse && this.blockedSynapses.has(synapse.id)) {
                    continue;
                }

                queue.push({ id: neighborId, path: [...path, neighborId] });
            }
        }

        return [];
    }

    /**
     * Start hacking a destroyed neuron
     */
    private startHacking(neuronId: string): void {
        this.isHacking = true;
        this.hackingNeuronId = neuronId;
        this.hackingProgress = 0;

        // Create hacking visual
        this.createHackingVisual();

        // Emit hacking started event
        EventBus.emit("ai-hacking-started", { neuronId });
    }

    /**
     * Create hacking progress visual
     */
    private createHackingVisual(): void {
        if (!this.hackingNeuronId) return;

        const neuron = this.networkData.neurons[this.hackingNeuronId];
        if (!neuron) return;

        const x = neuron.x + this.offsetX;
        const y = neuron.y + this.offsetY;

        // Hacking progress bar background
        this.hackingBar = this.scene.add.graphics();
        this.hackingBar.setDepth(DEPTH.AI_ENTITY + 1);

        // Hacking text
        this.hackingText = this.scene.add.text(x, y - 40, "RÉTABLISSEMENT...", {
            fontFamily: "Arial Black",
            fontSize: "12px",
            color: "#e53e3e",
        }).setOrigin(0.5);
        this.hackingText.setDepth(DEPTH.AI_ENTITY + 1);

        // Pulsing effect on target neuron
        this.scene.tweens.add({
            targets: this.hackingText,
            alpha: { from: 1, to: 0.3 },
            duration: 300,
            yoyo: true,
            repeat: -1,
        });
    }

    /**
     * Update hacking progress bar
     */
    private updateHackingVisual(): void {
        if (!this.hackingBar || !this.hackingNeuronId) return;

        const neuron = this.networkData.neurons[this.hackingNeuronId];
        if (!neuron) return;

        const x = neuron.x + this.offsetX;
        const y = neuron.y + this.offsetY;

        this.hackingBar.clear();

        // Background bar
        this.hackingBar.fillStyle(0x1a202c, 0.8);
        this.hackingBar.fillRect(x - 30, y - 55, 60, 8);

        // Progress bar
        const progress = this.hackingProgress / this.hackingDuration;
        this.hackingBar.fillStyle(0xe53e3e, 1);
        this.hackingBar.fillRect(x - 30, y - 55, 60 * progress, 8);
    }

    /**
     * Update hacking state
     */
    private updateHacking(delta: number): void {
        this.hackingProgress += delta;
        this.updateHackingVisual();

        if (this.hackingProgress >= this.hackingDuration) {
            this.completeHacking();
        }
    }

    /**
     * Complete hacking and unblock the neuron
     */
    private completeHacking(): void {
        if (!this.hackingNeuronId) return;

        const neuronId = this.hackingNeuronId;

        // Remove from destroyed set
        this.destroyedNeurons.delete(neuronId);

        // Update the network data
        const neuron = this.networkData.neurons[neuronId];
        if (neuron) {
            neuron.isBlocked = false;
        }

        // Clean up hacking visuals
        this.cleanupHackingVisual();

        // Reset hacking state
        this.isHacking = false;
        this.hackingNeuronId = null;
        this.hackingProgress = 0;

        // Emit event
        EventBus.emit("ai-hacking-complete", { neuronId });
        this.onNeuronHackedCallback?.(neuronId);

        // Recalculate path
        this.recalculatePath();
    }

    /**
     * Clean up hacking visual elements
     */
    private cleanupHackingVisual(): void {
        this.hackingBar?.destroy();
        this.hackingBar = undefined;

        this.hackingText?.destroy();
        this.hackingText = undefined;
    }

    /**
     * Update AI sprite to current neuron position
     */
    private updateVisualPosition(): void {
        const neuron = this.networkData.neurons[this.state.currentNeuronId];
        if (!neuron || !this.aiSprite) return;

        this.aiSprite.setPosition(neuron.x + this.offsetX, neuron.y + this.offsetY);
    }

    /**
     * Interpolate AI sprite position between neurons
     */
    private interpolateVisualPosition(): void {
        if (this.state.targetPath.length < 2 || !this.aiSprite) return;

        const from = this.networkData.neurons[this.state.targetPath[0]];
        const to = this.networkData.neurons[this.state.targetPath[1]];

        if (!from || !to) return;

        const x = from.x + (to.x - from.x) * this.state.moveProgress;
        const y = from.y + (to.y - from.y) * this.state.moveProgress;

        this.aiSprite.setPosition(x + this.offsetX, y + this.offsetY);
    }

    /**
     * Handle catching the explorer
     */
    private handleCatchExplorer(): void {
        this.state.isConnected = true;

        // Flash effect
        if (this.aiSprite) {
            this.scene.tweens.add({
                targets: this.aiSprite,
                scale: 2,
                alpha: 0.5,
                duration: 300,
                yoyo: true,
                repeat: 2,
            });
        }

        EventBus.emit("ai-caught-explorer", {
            neuronId: this.state.currentNeuronId,
        });

        this.onCatchExplorerCallback?.();
    }

    /**
     * Pause AI movement
     */
    pause(): void {
        this.isPaused = true;
    }

    /**
     * Resume AI movement
     */
    resume(): void {
        this.isPaused = false;
    }

    /**
     * Reset AI after catching explorer (push back)
     */
    resetAfterCatch(): void {
        // Push AI back a few neurons
        const pushBackAmount = 3;
        let currentId = this.state.currentNeuronId;

        for (let i = 0; i < pushBackAmount; i++) {
            const neuron = this.networkData.neurons[currentId];
            if (!neuron || neuron.connections.length === 0) break;

            // Move to a random connected neuron away from explorer
            const candidates = neuron.connections.filter(
                (id) => !this.explorerPath.includes(id)
            );

            if (candidates.length > 0) {
                currentId = candidates[Math.floor(Math.random() * candidates.length)];
            } else {
                break;
            }
        }

        this.state.currentNeuronId = currentId;
        this.state.isConnected = false;
        this.state.moveProgress = 0;

        this.updateVisualPosition();
        this.recalculatePath();
    }

    /**
     * Reset AI to spawn point (called when Firewall succeeds)
     */
    resetToSpawn(): void {
        // Recreate initial state to get spawn position
        const initialState = this.createInitialState();

        this.state.currentNeuronId = initialState.currentNeuronId;
        this.state.targetPath = [];
        this.state.moveProgress = 0;
        this.state.isConnected = false;

        // Reset speed multiplier partially (keep some progress)
        this.state.speedMultiplier = Math.max(1.0, this.state.speedMultiplier * 0.5);
        this.state.speed = this.state.baseSpeed * this.state.speedMultiplier;

        this.updateVisualPosition();
        this.recalculatePath();

        // Flash animation
        if (this.aiSprite) {
            this.scene.tweens.add({
                targets: this.aiSprite,
                alpha: { from: 0, to: 1 },
                scale: { from: 0.5, to: 1 },
                duration: 500,
                ease: "Back.easeOut",
            });
        }
    }

    /**
     * Get current AI state
     */
    getState(): AIState {
        return { ...this.state };
    }

    /**
     * Get current position
     */
    getCurrentNeuronId(): string {
        return this.state.currentNeuronId;
    }

    /**
     * Get current speed
     */
    getSpeed(): number {
        return this.state.speed;
    }

    /**
     * Check if AI has caught explorer
     */
    hasCaughtExplorer(): boolean {
        return this.state.isConnected;
    }

    /**
     * Calculate distance between two neurons
     */
    private distance(a: Neuron, b: Neuron): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Set callbacks
     */
    onCatchExplorer(callback: () => void): void {
        this.onCatchExplorerCallback = callback;
    }

    onPositionChanged(callback: (neuronId: string) => void): void {
        this.onPositionChangedCallback = callback;
    }

    onNeuronHacked(callback: (neuronId: string) => void): void {
        this.onNeuronHackedCallback = callback;
    }

    /**
     * Check if AI is currently hacking
     */
    isCurrentlyHacking(): boolean {
        return this.isHacking;
    }

    /**
     * Get hacking progress (0-1)
     */
    getHackingProgress(): number {
        return this.hackingProgress / this.hackingDuration;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.aiSprite?.destroy();
        this.pathGraphics?.destroy();
        this.cleanupHackingVisual();
    }
}
