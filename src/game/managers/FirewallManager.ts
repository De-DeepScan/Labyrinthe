import { Scene } from "phaser";
import type { FirewallState, FirewallSequence } from "../types/interfaces";
import { FirewallColor } from "../types/interfaces";
import { FIREWALL_CONFIG, RESOURCE_CONFIG } from "../config/NeuralNetworkConfig";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

interface ButtonSprite {
    bg: Phaser.GameObjects.Arc;
    color: FirewallColor;
}

type GamePhase = "idle" | "showing" | "input" | "success" | "fail";

/**
 * Manages the Firewall mini-game (Simon-style)
 */
export class FirewallManager {
    private scene: Scene;
    private state: FirewallState | null = null;
    private phase: GamePhase = "idle";

    private container?: Phaser.GameObjects.Container;
    private buttons: Map<FirewallColor, ButtonSprite> = new Map();
    private roundText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;
    private resourceText?: Phaser.GameObjects.Text;
    private startButton?: Phaser.GameObjects.Container;

    private currentSequenceIndex: number = 0;
    private showingTimer?: Phaser.Time.TimerEvent;

    // Callbacks
    private onCompleteCallback?: (resourcesEarned: number) => void;
    private onFailCallback?: () => void;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Start the Firewall mini-game
     */
    startGame(): void {
        this.state = {
            isActive: true,
            sequence: this.generateSequence(1),
            resourceReward: RESOURCE_CONFIG.FIREWALL_BASE_REWARD,
        };

        this.phase = "idle";
        this.showUI();
    }

    /**
     * Generate a new sequence for a round
     */
    private generateSequence(round: number): FirewallSequence {
        const length = FIREWALL_CONFIG.BASE_SEQUENCE_LENGTH + (round - 1) * FIREWALL_CONFIG.SEQUENCE_INCREMENT;
        const colors: FirewallColor[] = [];
        const availableColors = Object.values(FirewallColor);

        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * availableColors.length);
            colors.push(availableColors[randomIndex]);
        }

        const speed = Math.max(
            FIREWALL_CONFIG.MIN_SPEED,
            FIREWALL_CONFIG.BASE_SPEED - (round - 1) * FIREWALL_CONFIG.SPEED_DECREASE
        );

        return {
            colors,
            currentIndex: 0,
            playerSequence: [],
            speed,
            round,
        };
    }

    /**
     * Show the Firewall UI
     */
    private showUI(): void {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        // Create container
        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(DEPTH.FIREWALL_BG);

        // Background overlay
        const overlay = this.scene.add.rectangle(
            0,
            0,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000,
            0.7
        );
        overlay.setInteractive();
        this.container.add(overlay);

        // Main panel
        const panel = this.scene.add.rectangle(0, 0, 450, 500, 0x1a1a2e);
        panel.setStrokeStyle(3, 0xed8936);
        this.container.add(panel);

        // Title
        const title = this.scene.add.text(0, -210, "FIREWALL", {
            fontFamily: "Arial Black",
            fontSize: "32px",
            color: "#ed8936",
        }).setOrigin(0.5);
        this.container.add(title);

        // Round indicator
        this.roundText = this.scene.add.text(0, -170, "Round: 1", {
            fontFamily: "Arial",
            fontSize: "20px",
            color: "#ffffff",
        }).setOrigin(0.5);
        this.container.add(this.roundText);

        // Status text
        this.statusText = this.scene.add.text(0, -140, "Press START to begin", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#a0aec0",
        }).setOrigin(0.5);
        this.container.add(this.statusText);

        // Create buttons
        this.createButtons();

        // Resource reward text
        this.resourceText = this.scene.add.text(0, 170, `Reward: +${this.state?.resourceReward || 0}`, {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#48bb78",
        }).setOrigin(0.5);
        this.container.add(this.resourceText);

        // Start button
        this.createStartButton();

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
     * Create the 4 color buttons
     */
    private createButtons(): void {
        if (!this.container) return;

        const buttonSize = FIREWALL_CONFIG.BUTTON_SIZE;
        const spacing = FIREWALL_CONFIG.BUTTON_SPACING;
        const startX = -(buttonSize + spacing / 2);
        const startY = -30;

        const positions = [
            { color: FirewallColor.RED, x: startX, y: startY },
            { color: FirewallColor.BLUE, x: startX + buttonSize + spacing, y: startY },
            { color: FirewallColor.GREEN, x: startX, y: startY + buttonSize + spacing },
            { color: FirewallColor.YELLOW, x: startX + buttonSize + spacing, y: startY + buttonSize + spacing },
        ];

        for (const pos of positions) {
            const buttonColors = FIREWALL_CONFIG.BUTTON_COLORS[pos.color];

            const bg = this.scene.add.arc(
                pos.x + buttonSize / 2,
                pos.y + buttonSize / 2,
                buttonSize / 2,
                0,
                360,
                false,
                buttonColors.normal
            );
            bg.setStrokeStyle(3, 0xffffff, 0.3);
            bg.setInteractive({ useHandCursor: true });

            this.container.add(bg);
            this.buttons.set(pos.color, { bg, color: pos.color });

            // Button interactions
            bg.on("pointerover", () => {
                if (this.phase === "input") {
                    bg.setScale(1.05);
                }
            });

            bg.on("pointerout", () => {
                bg.setScale(1);
            });

            bg.on("pointerdown", () => {
                if (this.phase === "input") {
                    this.handleButtonPress(pos.color);
                }
            });
        }
    }

    /**
     * Create start button
     */
    private createStartButton(): void {
        if (!this.container) return;

        this.startButton = this.scene.add.container(0, 210);

        const bg = this.scene.add.rectangle(0, 0, 150, 45, 0x48bb78);
        bg.setStrokeStyle(2, 0xffffff);
        const text = this.scene.add.text(0, 0, "START", {
            fontFamily: "Arial Black",
            fontSize: "20px",
            color: "#ffffff",
        }).setOrigin(0.5);

        this.startButton.add([bg, text]);
        this.container.add(this.startButton);

        bg.setInteractive({ useHandCursor: true });

        bg.on("pointerover", () => bg.setScale(1.05));
        bg.on("pointerout", () => bg.setScale(1));
        bg.on("pointerdown", () => this.startRound());
    }

    /**
     * Create close button
     */
    private createCloseButton(): void {
        if (!this.container) return;

        const closeBtn = this.scene.add.container(195, -215);

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
        bg.on("pointerdown", () => this.hideUI());
    }

    /**
     * Start showing the sequence
     */
    private startRound(): void {
        if (!this.state || this.phase !== "idle") return;

        this.phase = "showing";
        this.currentSequenceIndex = 0;

        if (this.statusText) {
            this.statusText.setText("Watch the sequence...");
        }

        // Hide start button
        if (this.startButton) {
            this.startButton.setVisible(false);
        }

        // Start showing sequence after a brief delay
        this.scene.time.delayedCall(500, () => {
            this.showNextInSequence();
        });
    }

    /**
     * Show next color in sequence
     */
    private showNextInSequence(): void {
        if (!this.state) return;

        const sequence = this.state.sequence;

        if (this.currentSequenceIndex >= sequence.colors.length) {
            // Done showing, switch to input mode
            this.phase = "input";
            this.state.sequence.currentIndex = 0;
            this.state.sequence.playerSequence = [];

            if (this.statusText) {
                this.statusText.setText("Your turn! Repeat the sequence");
            }
            return;
        }

        const color = sequence.colors[this.currentSequenceIndex];
        this.flashButton(color, FIREWALL_CONFIG.FLASH_DURATION);

        this.currentSequenceIndex++;

        // Schedule next flash
        this.showingTimer = this.scene.time.delayedCall(
            sequence.speed + FIREWALL_CONFIG.GAP_DURATION,
            () => this.showNextInSequence()
        );
    }

    /**
     * Flash a button
     */
    private flashButton(color: FirewallColor, duration: number): void {
        const button = this.buttons.get(color);
        if (!button) return;

        const buttonColors = FIREWALL_CONFIG.BUTTON_COLORS[color];

        // Flash bright
        button.bg.setFillStyle(buttonColors.flash);
        button.bg.setScale(1.1);

        // Return to normal
        this.scene.time.delayedCall(duration, () => {
            button.bg.setFillStyle(buttonColors.normal);
            button.bg.setScale(1);
        });
    }

    /**
     * Handle button press during input phase
     */
    private handleButtonPress(color: FirewallColor): void {
        if (!this.state || this.phase !== "input") return;

        const sequence = this.state.sequence;
        const expectedColor = sequence.colors[sequence.currentIndex];

        // Flash the pressed button
        this.flashButton(color, 200);

        // Check if correct
        if (color !== expectedColor) {
            this.onFail();
            return;
        }

        // Correct!
        sequence.playerSequence.push(color);
        sequence.currentIndex++;

        // Check if round complete
        if (sequence.currentIndex >= sequence.colors.length) {
            this.onRoundComplete();
        }
    }

    /**
     * Handle round completion
     */
    private onRoundComplete(): void {
        if (!this.state) return;

        this.phase = "success";
        const round = this.state.sequence.round;
        const reward = this.calculateReward(round);

        if (this.statusText) {
            this.statusText.setText(`Round ${round} complete! +${reward}`);
            this.statusText.setColor("#48bb78");
        }

        // Emit completion event
        EventBus.emit("firewall-round-complete", { round, reward });
        this.onCompleteCallback?.(reward);

        // Prepare next round
        this.scene.time.delayedCall(1500, () => {
            if (!this.state) return;

            const nextRound = round + 1;
            this.state.sequence = this.generateSequence(nextRound);
            this.state.resourceReward = this.calculateReward(nextRound);

            if (this.roundText) {
                this.roundText.setText(`Round: ${nextRound}`);
            }
            if (this.resourceText) {
                this.resourceText.setText(`Reward: +${this.state.resourceReward}`);
            }
            if (this.statusText) {
                this.statusText.setText("Press START for next round");
                this.statusText.setColor("#a0aec0");
            }
            if (this.startButton) {
                this.startButton.setVisible(true);
            }

            this.phase = "idle";
        });
    }

    /**
     * Handle failure
     */
    private onFail(): void {
        if (!this.state) return;

        this.phase = "fail";

        if (this.statusText) {
            this.statusText.setText("Wrong! Try again from Round 1");
            this.statusText.setColor("#e53e3e");
        }

        // Flash all buttons red
        for (const button of this.buttons.values()) {
            button.bg.setFillStyle(0xe53e3e);
        }

        EventBus.emit("firewall-failed");
        this.onFailCallback?.();

        // Reset after delay
        this.scene.time.delayedCall(1500, () => {
            if (!this.state) return;

            // Reset colors
            for (const [color, button] of this.buttons) {
                const buttonColors = FIREWALL_CONFIG.BUTTON_COLORS[color];
                button.bg.setFillStyle(buttonColors.normal);
            }

            // Reset to round 1
            this.state.sequence = this.generateSequence(1);
            this.state.resourceReward = RESOURCE_CONFIG.FIREWALL_BASE_REWARD;

            if (this.roundText) {
                this.roundText.setText("Round: 1");
            }
            if (this.resourceText) {
                this.resourceText.setText(`Reward: +${this.state.resourceReward}`);
            }
            if (this.statusText) {
                this.statusText.setText("Press START to try again");
                this.statusText.setColor("#a0aec0");
            }
            if (this.startButton) {
                this.startButton.setVisible(true);
            }

            this.phase = "idle";
        });
    }

    /**
     * Calculate reward for a round
     */
    private calculateReward(round: number): number {
        return RESOURCE_CONFIG.FIREWALL_BASE_REWARD * round * RESOURCE_CONFIG.FIREWALL_ROUND_MULTIPLIER;
    }

    /**
     * Hide the UI
     */
    hideUI(): void {
        // Cancel any pending timers
        this.showingTimer?.destroy();

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
     * Cleanup resources
     */
    private cleanup(): void {
        this.buttons.clear();
        this.container?.destroy();
        this.container = undefined;
        this.state = null;
        this.phase = "idle";
    }

    /**
     * Check if game is active
     */
    isActive(): boolean {
        return this.state?.isActive || false;
    }

    /**
     * Get current round
     */
    getCurrentRound(): number {
        return this.state?.sequence.round || 0;
    }

    /**
     * Set callbacks
     */
    onComplete(callback: (resourcesEarned: number) => void): void {
        this.onCompleteCallback = callback;
    }

    onGameFail(callback: () => void): void {
        this.onFailCallback = callback;
    }

    /**
     * Destroy the manager
     */
    destroy(): void {
        this.showingTimer?.destroy();
        this.cleanup();
    }
}
