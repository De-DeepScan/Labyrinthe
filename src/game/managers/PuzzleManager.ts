import { Scene } from "phaser";
import type { PuzzleState, PuzzleCircle } from "../types/interfaces";
import { CircleState } from "../types/interfaces";
import { LogicGateUtils } from "../utils/LogicGateUtils";
import { PUZZLE_CONFIG } from "../config/NeuralNetworkConfig";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

interface CircleSprite {
    circle: Phaser.GameObjects.Arc;
    text: Phaser.GameObjects.Text;
    gateText: Phaser.GameObjects.Text;
}

/**
 * Manages the Signal Propagation puzzle mini-game
 */
export class PuzzleManager {
    private scene: Scene;
    private currentPuzzle: PuzzleState | null = null;

    private container?: Phaser.GameObjects.Container;
    private background?: Phaser.GameObjects.Rectangle;
    private circleSprites: Map<number, CircleSprite> = new Map();
    private connectionGraphics?: Phaser.GameObjects.Graphics;
    private selectedCircle: number | null = null;

    private titleText?: Phaser.GameObjects.Text;
    private hintText?: Phaser.GameObjects.Text;
    private closeButton?: Phaser.GameObjects.Container;

    // Callbacks
    private onCompleteCallback?: (synapseId: string) => void;
    private onFailCallback?: (synapseId: string) => void;
    private onCloseCallback?: () => void;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Start a new puzzle for a synapse
     */
    startPuzzle(synapseId: string, difficulty: number): PuzzleState {
        // Generate puzzle
        this.currentPuzzle = this.generatePuzzle(synapseId, difficulty);

        // Show UI
        this.showPuzzleUI();

        return this.currentPuzzle;
    }

    /**
     * Generate a new puzzle
     */
    private generatePuzzle(synapseId: string, difficulty: number): PuzzleState {
        const circles = this.createCircleLayout(difficulty);
        const solution = this.generateSolution(circles);

        return {
            circles,
            activeConnections: [],
            solution,
            difficulty,
            synapseId,
            isComplete: false,
        };
    }

    /**
     * Create the 8-circle layout with connections
     */
    private createCircleLayout(difficulty: number): PuzzleCircle[] {
        // Layout pattern:
        //    [0]----[1]
        //   / |  \   |
        //  /  |   \  |
        // [2]-+--[3]-[4]
        //  \  |   /  |
        //   \ |  /   |
        //    [5]----[6]
        //         \
        //          [7]

        const connectionMap: number[][] = [
            [1, 2, 3, 5], // 0
            [0, 3, 4],    // 1
            [0, 3, 5],    // 2
            [0, 1, 2, 4, 5, 6], // 3 (hub)
            [1, 3, 6],    // 4
            [0, 2, 3, 6, 7], // 5
            [3, 4, 5],    // 6
            [5],          // 7
        ];

        const positions = [
            { x: -100, y: -120 }, // 0
            { x: 100, y: -120 },  // 1
            { x: -180, y: 0 },    // 2
            { x: 0, y: 0 },       // 3
            { x: 180, y: 0 },     // 4
            { x: -100, y: 120 },  // 5
            { x: 100, y: 120 },   // 6
            { x: 0, y: 220 },     // 7
        ];

        const circles: PuzzleCircle[] = [];

        for (let i = 0; i < 8; i++) {
            circles.push({
                id: i,
                state: CircleState.OFF,
                targetState: 0, // Will be set by solution generator
                x: positions[i].x,
                y: positions[i].y,
                connections: connectionMap[i],
                gateType: LogicGateUtils.getRandomGate(difficulty),
            });
        }

        return circles;
    }

    /**
     * Generate a solvable solution pattern
     */
    private generateSolution(circles: PuzzleCircle[]): (0 | 1)[] {
        // Generate a random but solvable pattern
        const solution: (0 | 1)[] = [];

        // Start with a random pattern
        for (let i = 0; i < 8; i++) {
            solution.push(Math.random() > 0.5 ? 1 : 0);
        }

        // Ensure at least half are 1s for better gameplay
        const oneCount = solution.filter((v) => v === 1).length;
        if (oneCount < 4) {
            for (let i = 0; oneCount + i < 4 && i < 8; i++) {
                if (solution[i] === 0) solution[i] = 1;
            }
        }

        // Set target states
        for (let i = 0; i < circles.length; i++) {
            circles[i].targetState = solution[i];
        }

        return solution;
    }

    /**
     * Show the puzzle UI
     */
    private showPuzzleUI(): void {
        if (!this.currentPuzzle) return;

        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        // Create container
        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(DEPTH.PUZZLE_BG);

        // Background overlay
        const overlay = this.scene.add.rectangle(
            0,
            0,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000,
            0.7
        );
        overlay.setInteractive(); // Block clicks behind
        this.container.add(overlay);

        // Main panel
        this.background = this.scene.add.rectangle(0, 0, 600, 550, 0x1a1a2e);
        this.background.setStrokeStyle(3, 0x4299e1);
        this.container.add(this.background);

        // Title
        this.titleText = this.scene.add.text(0, -240, "SIGNAL PROPAGATION", {
            fontFamily: "Arial Black",
            fontSize: "28px",
            color: "#4299e1",
        }).setOrigin(0.5);
        this.container.add(this.titleText);

        // Difficulty indicator
        const diffText = this.scene.add.text(0, -200, `Difficulty: ${"★".repeat(this.currentPuzzle.difficulty)}${"☆".repeat(3 - this.currentPuzzle.difficulty)}`, {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#a0aec0",
        }).setOrigin(0.5);
        this.container.add(diffText);

        // Hint text
        this.hintText = this.scene.add.text(0, -170, "Connect circles to match target states", {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#718096",
        }).setOrigin(0.5);
        this.container.add(this.hintText);

        // Connection graphics (behind circles)
        this.connectionGraphics = this.scene.add.graphics();
        this.container.add(this.connectionGraphics);

        // Create circles
        this.createCircleSprites();

        // Draw possible connections
        this.drawPossibleConnections();

        // Close button
        this.createCloseButton();

        // Entrance animation
        this.container.setScale(0.8);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: "Back.easeOut",
        });
    }

    /**
     * Create circle sprites
     */
    private createCircleSprites(): void {
        if (!this.currentPuzzle || !this.container) return;

        for (const circle of this.currentPuzzle.circles) {
            const color = this.getCircleColor(circle.state);

            // Main circle
            const circleSprite = this.scene.add.circle(
                circle.x,
                circle.y + 20, // Offset for title
                PUZZLE_CONFIG.CIRCLE_RADIUS,
                color
            );
            circleSprite.setStrokeStyle(3, 0xffffff, 0.5);
            circleSprite.setInteractive({ useHandCursor: true });

            // Target state indicator
            const targetText = this.scene.add.text(
                circle.x,
                circle.y + 20,
                circle.targetState === 1 ? "1" : "0",
                {
                    fontFamily: "Arial Black",
                    fontSize: "24px",
                    color: "#ffffff",
                }
            ).setOrigin(0.5);

            // Gate type indicator
            const gateText = this.scene.add.text(
                circle.x,
                circle.y + 50,
                LogicGateUtils.getSymbol(circle.gateType),
                {
                    fontFamily: "Arial",
                    fontSize: "14px",
                    color: "#a0aec0",
                }
            ).setOrigin(0.5);

            this.container.add([circleSprite, targetText, gateText]);
            this.circleSprites.set(circle.id, {
                circle: circleSprite,
                text: targetText,
                gateText,
            });

            // Interaction handlers
            circleSprite.on("pointerover", () => {
                circleSprite.setScale(1.1);
                this.showGateHint(circle);
            });

            circleSprite.on("pointerout", () => {
                circleSprite.setScale(1);
                this.hideGateHint();
            });

            circleSprite.on("pointerdown", () => {
                this.handleCircleClick(circle.id);
            });
        }
    }

    /**
     * Draw possible connection lines
     */
    private drawPossibleConnections(): void {
        if (!this.currentPuzzle || !this.connectionGraphics) return;

        const graphics = this.connectionGraphics;
        graphics.clear();

        // Draw possible connections as dotted lines
        const drawn = new Set<string>();

        for (const circle of this.currentPuzzle.circles) {
            for (const connId of circle.connections) {
                const key = [Math.min(circle.id, connId), Math.max(circle.id, connId)].join("-");
                if (drawn.has(key)) continue;
                drawn.add(key);

                const other = this.currentPuzzle.circles[connId];

                graphics.lineStyle(2, 0x4a5568, 0.3);
                graphics.beginPath();
                graphics.moveTo(circle.x, circle.y + 20);
                graphics.lineTo(other.x, other.y + 20);
                graphics.strokePath();
            }
        }

        // Draw active connections
        for (const conn of this.currentPuzzle.activeConnections) {
            const from = this.currentPuzzle.circles[conn.from];
            const to = this.currentPuzzle.circles[conn.to];

            graphics.lineStyle(4, PUZZLE_CONFIG.COLORS.CONNECTION_ACTIVE, 1);
            graphics.beginPath();
            graphics.moveTo(from.x, from.y + 20);
            graphics.lineTo(to.x, to.y + 20);
            graphics.strokePath();
        }
    }

    /**
     * Handle circle click
     */
    private handleCircleClick(circleId: number): void {
        if (!this.currentPuzzle) return;

        if (this.selectedCircle === null) {
            // First selection
            this.selectedCircle = circleId;
            this.highlightCircle(circleId, true);
        } else if (this.selectedCircle === circleId) {
            // Deselect
            this.highlightCircle(circleId, false);
            this.selectedCircle = null;
        } else {
            // Try to connect
            const canConnect = this.currentPuzzle.circles[this.selectedCircle].connections.includes(circleId);

            if (canConnect) {
                this.toggleConnection(this.selectedCircle, circleId);
            }

            this.highlightCircle(this.selectedCircle, false);
            this.selectedCircle = null;
        }
    }

    /**
     * Highlight a circle
     */
    private highlightCircle(circleId: number, highlight: boolean): void {
        const sprite = this.circleSprites.get(circleId);
        if (!sprite) return;

        if (highlight) {
            sprite.circle.setStrokeStyle(4, 0x4299e1, 1);
            sprite.circle.setScale(1.15);
        } else {
            sprite.circle.setStrokeStyle(3, 0xffffff, 0.5);
            sprite.circle.setScale(1);
        }
    }

    /**
     * Toggle a connection between two circles
     */
    private toggleConnection(fromId: number, toId: number): void {
        if (!this.currentPuzzle) return;

        const connections = this.currentPuzzle.activeConnections;
        const existingIndex = connections.findIndex(
            (c) =>
                (c.from === fromId && c.to === toId) ||
                (c.from === toId && c.to === fromId)
        );

        if (existingIndex >= 0) {
            // Remove connection
            connections.splice(existingIndex, 1);
        } else {
            // Add connection
            connections.push({ from: fromId, to: toId });
        }

        // Recalculate states
        this.propagateSignals();

        // Redraw connections
        this.drawPossibleConnections();

        // Check completion
        this.checkCompletion();
    }

    /**
     * Propagate signals through the network
     */
    private propagateSignals(): void {
        if (!this.currentPuzzle) return;

        // Reset all states
        for (const circle of this.currentPuzzle.circles) {
            circle.state = CircleState.OFF;
        }

        // Build adjacency from active connections
        const adjacency = new Map<number, number[]>();
        for (let i = 0; i < 8; i++) {
            adjacency.set(i, []);
        }

        for (const conn of this.currentPuzzle.activeConnections) {
            adjacency.get(conn.from)?.push(conn.to);
            adjacency.get(conn.to)?.push(conn.from);
        }

        // Iterate until stable (max 10 iterations)
        let changed = true;
        let iterations = 0;

        while (changed && iterations < 10) {
            changed = false;
            iterations++;

            for (const circle of this.currentPuzzle.circles) {
                const neighbors = adjacency.get(circle.id) || [];

                if (neighbors.length === 0) {
                    // No connections - stay OFF
                    if (circle.state !== CircleState.OFF) {
                        circle.state = CircleState.OFF;
                        changed = true;
                    }
                    continue;
                }

                // Get input values from connected circles
                const inputs: (0 | 1)[] = neighbors.map((nId) => {
                    const neighbor = this.currentPuzzle!.circles[nId];
                    return neighbor.state === CircleState.CORRECT ? 1 : 0;
                });

                // Also consider self-activation for bootstrap
                // If this is the first iteration, treat connected nodes as potentially active
                if (iterations === 1) {
                    // Use the target state as a hint for the first pass
                    const result = LogicGateUtils.evaluate(circle.gateType, [1]);
                    const newState = result === circle.targetState
                        ? CircleState.CORRECT
                        : CircleState.WRONG;

                    if (circle.state !== newState) {
                        circle.state = newState;
                        changed = true;
                    }
                } else {
                    // Normal evaluation
                    const result = LogicGateUtils.evaluate(circle.gateType, inputs);
                    const newState = result === circle.targetState
                        ? CircleState.CORRECT
                        : CircleState.WRONG;

                    if (circle.state !== newState) {
                        circle.state = newState;
                        changed = true;
                    }
                }
            }
        }

        // Update visuals
        this.updateCircleVisuals();
    }

    /**
     * Update circle visual states
     */
    private updateCircleVisuals(): void {
        if (!this.currentPuzzle) return;

        for (const circle of this.currentPuzzle.circles) {
            const sprite = this.circleSprites.get(circle.id);
            if (!sprite) continue;

            const color = this.getCircleColor(circle.state);
            sprite.circle.setFillStyle(color);

            // Animation on state change
            this.scene.tweens.add({
                targets: sprite.circle,
                scale: { from: 1.2, to: 1 },
                duration: 150,
                ease: "Back.easeOut",
            });
        }
    }

    /**
     * Get color for circle state
     */
    private getCircleColor(state: CircleState): number {
        switch (state) {
            case CircleState.CORRECT:
                return PUZZLE_CONFIG.COLORS.CORRECT;
            case CircleState.WRONG:
                return PUZZLE_CONFIG.COLORS.WRONG;
            default:
                return PUZZLE_CONFIG.COLORS.OFF;
        }
    }

    /**
     * Check if puzzle is complete
     */
    private checkCompletion(): void {
        if (!this.currentPuzzle) return;

        const allCorrect = this.currentPuzzle.circles.every(
            (c) => c.state === CircleState.CORRECT
        );

        if (allCorrect) {
            this.currentPuzzle.isComplete = true;
            this.onPuzzleComplete();
        }
    }

    /**
     * Handle puzzle completion
     */
    private onPuzzleComplete(): void {
        if (!this.currentPuzzle) return;

        // Victory animation
        this.scene.tweens.add({
            targets: this.container,
            scale: 1.05,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                // Show success message
                if (this.titleText) {
                    this.titleText.setText("SUCCESS!");
                    this.titleText.setColor("#48bb78");
                }

                // Close after delay
                this.scene.time.delayedCall(800, () => {
                    const synapseId = this.currentPuzzle?.synapseId || "";
                    this.hidePuzzleUI();
                    EventBus.emit("puzzle-completed", synapseId);
                    this.onCompleteCallback?.(synapseId);
                });
            },
        });
    }

    /**
     * Show gate hint
     */
    private showGateHint(circle: PuzzleCircle): void {
        if (this.hintText) {
            this.hintText.setText(LogicGateUtils.getDescription(circle.gateType));
        }
    }

    /**
     * Hide gate hint
     */
    private hideGateHint(): void {
        if (this.hintText) {
            this.hintText.setText("Connect circles to match target states");
        }
    }

    /**
     * Create close button
     */
    private createCloseButton(): void {
        if (!this.container) return;

        this.closeButton = this.scene.add.container(260, -240);

        const bg = this.scene.add.circle(0, 0, 20, 0xe53e3e);
        const text = this.scene.add.text(0, 0, "X", {
            fontFamily: "Arial Black",
            fontSize: "20px",
            color: "#ffffff",
        }).setOrigin(0.5);

        this.closeButton.add([bg, text]);
        this.container.add(this.closeButton);

        bg.setInteractive({ useHandCursor: true });

        bg.on("pointerover", () => bg.setScale(1.1));
        bg.on("pointerout", () => bg.setScale(1));
        bg.on("pointerdown", () => {
            const synapseId = this.currentPuzzle?.synapseId || "";
            this.hidePuzzleUI();
            EventBus.emit("puzzle-cancelled", synapseId);
            this.onFailCallback?.(synapseId);
            this.onCloseCallback?.();
        });
    }

    /**
     * Hide the puzzle UI
     */
    hidePuzzleUI(): void {
        if (!this.container) return;

        this.scene.tweens.add({
            targets: this.container,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                this.cleanup();
            },
        });
    }

    /**
     * Cleanup puzzle resources
     */
    private cleanup(): void {
        this.circleSprites.clear();
        this.connectionGraphics?.destroy();
        this.container?.destroy();
        this.container = undefined;
        this.currentPuzzle = null;
        this.selectedCircle = null;
    }

    /**
     * Get current puzzle state
     */
    getCurrentPuzzle(): PuzzleState | null {
        return this.currentPuzzle;
    }

    /**
     * Check if puzzle is active
     */
    isPuzzleActive(): boolean {
        return this.currentPuzzle !== null;
    }

    /**
     * Set callbacks
     */
    onComplete(callback: (synapseId: string) => void): void {
        this.onCompleteCallback = callback;
    }

    onFail(callback: (synapseId: string) => void): void {
        this.onFailCallback = callback;
    }

    onClose(callback: () => void): void {
        this.onCloseCallback = callback;
    }

    /**
     * Destroy the puzzle manager
     */
    destroy(): void {
        this.cleanup();
    }
}
