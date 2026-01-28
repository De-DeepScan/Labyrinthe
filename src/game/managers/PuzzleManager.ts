import { Scene } from "phaser";
import type { PuzzleState, PuzzleCircle } from "../types/interfaces";
import { CircleState, LogicGate } from "../types/interfaces";
import { PUZZLE_CONFIG } from "../config/NeuralNetworkConfig";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

interface CircleSprite {
    circle: Phaser.GameObjects.Arc;
    text: Phaser.GameObjects.Text;
}

/**
 * Manages the Signal Propagation puzzle mini-game (simplified version)
 * Goal: Connect all circles so they all light up green
 */
export class PuzzleManager {
    private scene: Scene;
    private currentPuzzle: PuzzleState | null = null;

    private container?: Phaser.GameObjects.Container;
    private circleSprites: Map<number, CircleSprite> = new Map();
    private connectionGraphics?: Phaser.GameObjects.Graphics;
    private selectedCircle: number | null = null;

    private titleText?: Phaser.GameObjects.Text;
    private hintText?: Phaser.GameObjects.Text;

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
        this.currentPuzzle = this.generatePuzzle(synapseId, difficulty);
        this.showPuzzleUI();
        return this.currentPuzzle;
    }

    /**
     * Generate a simplified puzzle
     */
    private generatePuzzle(synapseId: string, difficulty: number): PuzzleState {
        const circles = this.createSimpleCircleLayout(difficulty);

        return {
            circles,
            activeConnections: [],
            solution: circles.map(() => 1 as 0 | 1), // All should be ON
            difficulty,
            synapseId,
            isComplete: false,
        };
    }

    /**
     * Create a 7-circle layout with increased difficulty
     * Layout:
     *        [0]
     *       /   \
     *     [1]   [2]
     *    / | \ / | \
     *  [3] | X | [4]
     *      |/ \|
     *     [5] [6]
     *
     * Each circle needs 2+ connections to be correct
     */
    private createSimpleCircleLayout(difficulty: number): PuzzleCircle[] {
        // Connections based on difficulty
        // Easy: more connection options
        // Hard: fewer connection options, must think strategically
        const connectionMaps: Record<number, number[][]> = {
            1: [ // Easy - many connections
                [1, 2],             // 0 connects to 1, 2
                [0, 2, 3, 5],       // 1 connects to 0, 2, 3, 5
                [0, 1, 4, 6],       // 2 connects to 0, 1, 4, 6
                [1, 5],             // 3 connects to 1, 5
                [2, 6],             // 4 connects to 2, 6
                [1, 3, 6],          // 5 connects to 1, 3, 6
                [2, 4, 5],          // 6 connects to 2, 4, 5
            ],
            2: [ // Medium - balanced
                [1, 2],             // 0
                [0, 3, 5],          // 1
                [0, 4, 6],          // 2
                [1, 5],             // 3
                [2, 6],             // 4
                [1, 3, 6],          // 5
                [2, 4, 5],          // 6
            ],
            3: [ // Hard - limited options, must plan carefully
                [1, 2],             // 0
                [0, 5],             // 1
                [0, 6],             // 2
                [5],                // 3
                [6],                // 4
                [1, 3, 6],          // 5
                [2, 4, 5],          // 6
            ],
        };

        const positions = [
            { x: 0, y: -120 },     // 0 top
            { x: -80, y: -40 },    // 1 upper-left
            { x: 80, y: -40 },     // 2 upper-right
            { x: -130, y: 50 },    // 3 middle-left
            { x: 130, y: 50 },     // 4 middle-right
            { x: -50, y: 120 },    // 5 bottom-left
            { x: 50, y: 120 },     // 6 bottom-right
        ];

        const connectionMap = connectionMaps[difficulty] || connectionMaps[1];
        const circles: PuzzleCircle[] = [];

        for (let i = 0; i < 7; i++) {
            circles.push({
                id: i,
                state: CircleState.OFF,
                targetState: 1,
                x: positions[i].x,
                y: positions[i].y,
                connections: connectionMap[i],
                gateType: LogicGate.OR,
            });
        }

        return circles;
    }

    /**
     * Show the puzzle UI
     */
    private showPuzzleUI(): void {
        if (!this.currentPuzzle) return;

        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(DEPTH.PUZZLE_BG);

        // Background overlay
        const overlay = this.scene.add.rectangle(
            0, 0,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000, 0.7
        );
        overlay.setInteractive();
        this.container.add(overlay);

        // Main panel
        const panel = this.scene.add.rectangle(0, 0, 500, 450, 0x1a1a2e);
        panel.setStrokeStyle(3, 0x4299e1);
        this.container.add(panel);

        // Title
        this.titleText = this.scene.add.text(0, -180, "CONNEXION NEURONALE", {
            fontFamily: "Arial Black",
            fontSize: "28px",
            color: "#4299e1",
        }).setOrigin(0.5);
        this.container.add(this.titleText);

        // Difficulty stars
        const stars = "★".repeat(this.currentPuzzle.difficulty) + "☆".repeat(3 - this.currentPuzzle.difficulty);
        const diffText = this.scene.add.text(0, -145, `Difficulté: ${stars}`, {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#a0aec0",
        }).setOrigin(0.5);
        this.container.add(diffText);

        // Hint text
        this.hintText = this.scene.add.text(0, -115, "Chaque cercle doit avoir 2 connexions minimum !", {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#718096",
        }).setOrigin(0.5);
        this.container.add(this.hintText);

        // Connection graphics
        this.connectionGraphics = this.scene.add.graphics();
        this.container.add(this.connectionGraphics);

        // Create circles
        this.createCircleSprites();

        // Draw possible connections
        this.drawConnections();

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

            const circleSprite = this.scene.add.circle(
                circle.x,
                circle.y + 20,
                PUZZLE_CONFIG.CIRCLE_RADIUS,
                color
            );
            circleSprite.setStrokeStyle(3, 0xffffff, 0.5);
            circleSprite.setInteractive({ useHandCursor: true });

            // Circle number
            const text = this.scene.add.text(
                circle.x,
                circle.y + 20,
                `${circle.id + 1}`,
                {
                    fontFamily: "Arial Black",
                    fontSize: "20px",
                    color: "#ffffff",
                }
            ).setOrigin(0.5);

            this.container.add([circleSprite, text]);
            this.circleSprites.set(circle.id, { circle: circleSprite, text });

            // Interactions
            circleSprite.on("pointerover", () => {
                circleSprite.setScale(1.1);
            });

            circleSprite.on("pointerout", () => {
                if (this.selectedCircle !== circle.id) {
                    circleSprite.setScale(1);
                }
            });

            circleSprite.on("pointerdown", () => {
                this.handleCircleClick(circle.id);
            });
        }
    }

    /**
     * Draw connection lines
     */
    private drawConnections(): void {
        if (!this.currentPuzzle || !this.connectionGraphics) return;

        const graphics = this.connectionGraphics;
        graphics.clear();

        const drawn = new Set<string>();

        // Draw possible connections (light gray)
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

        // Draw active connections (bright blue)
        for (const conn of this.currentPuzzle.activeConnections) {
            const from = this.currentPuzzle.circles[conn.from];
            const to = this.currentPuzzle.circles[conn.to];

            graphics.lineStyle(5, 0x4299e1, 1);
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
            this.updateHint("Cliquez sur un autre cercle pour le connecter");
        } else if (this.selectedCircle === circleId) {
            // Deselect
            this.highlightCircle(circleId, false);
            this.selectedCircle = null;
            this.updateHint("Chaque cercle doit avoir 2 connexions minimum !");
        } else {
            // Try to connect
            const canConnect = this.currentPuzzle.circles[this.selectedCircle].connections.includes(circleId);

            if (canConnect) {
                this.toggleConnection(this.selectedCircle, circleId);
            } else {
                this.updateHint("Ces cercles ne peuvent pas être connectés !");
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
     * Toggle connection between two circles
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
            connections.splice(existingIndex, 1);
        } else {
            connections.push({ from: fromId, to: toId });
        }

        this.updateCircleStates();
        this.drawConnections();
        this.checkCompletion();
    }

    /**
     * Update circle states based on connections
     */
    private updateCircleStates(): void {
        if (!this.currentPuzzle) return;

        // Count connections for each circle
        const connectionCount = new Map<number, number>();
        for (let i = 0; i < this.currentPuzzle.circles.length; i++) {
            connectionCount.set(i, 0);
        }

        for (const conn of this.currentPuzzle.activeConnections) {
            connectionCount.set(conn.from, (connectionCount.get(conn.from) || 0) + 1);
            connectionCount.set(conn.to, (connectionCount.get(conn.to) || 0) + 1);
        }

        // Update states - circle is CORRECT if it has at least 2 connections
        for (const circle of this.currentPuzzle.circles) {
            const count = connectionCount.get(circle.id) || 0;
            circle.state = count >= 2 ? CircleState.CORRECT : CircleState.OFF;

            const sprite = this.circleSprites.get(circle.id);
            if (sprite) {
                sprite.circle.setFillStyle(this.getCircleColor(circle.state));
            }
        }
    }

    /**
     * Update hint text
     */
    private updateHint(text: string): void {
        if (this.hintText) {
            this.hintText.setText(text);
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

        const allConnected = this.currentPuzzle.circles.every(
            (c) => c.state === CircleState.CORRECT
        );

        if (allConnected) {
            this.currentPuzzle.isComplete = true;
            this.onPuzzleComplete();
        }
    }

    /**
     * Handle puzzle completion
     */
    private onPuzzleComplete(): void {
        if (!this.currentPuzzle) return;

        this.scene.tweens.add({
            targets: this.container,
            scale: 1.05,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                if (this.titleText) {
                    this.titleText.setText("CONNEXION RÉUSSIE !");
                    this.titleText.setColor("#48bb78");
                }

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
     * Create close button
     */
    private createCloseButton(): void {
        if (!this.container) return;

        const closeBtn = this.scene.add.container(220, -190);

        const bg = this.scene.add.circle(0, 0, 20, 0xe53e3e);
        const text = this.scene.add.text(0, 0, "X", {
            fontFamily: "Arial Black",
            fontSize: "20px",
            color: "#ffffff",
        }).setOrigin(0.5);

        closeBtn.add([bg, text]);
        this.container.add(closeBtn);

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

    getCurrentPuzzle(): PuzzleState | null {
        return this.currentPuzzle;
    }

    isPuzzleActive(): boolean {
        return this.currentPuzzle !== null;
    }

    onComplete(callback: (synapseId: string) => void): void {
        this.onCompleteCallback = callback;
    }

    onFail(callback: (synapseId: string) => void): void {
        this.onFailCallback = callback;
    }

    onClose(callback: () => void): void {
        this.onCloseCallback = callback;
    }

    destroy(): void {
        this.cleanup();
    }
}
