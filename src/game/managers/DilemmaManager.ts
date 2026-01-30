import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { EventBus } from "../EventBus";
import dilemmas from "../dilemme.json";

export interface DilemmaChoice {
    id: string;
    description: string;
}

export interface Dilemma {
    id: string;
    description: string;
    choices: DilemmaChoice[];
}

// Cyberpunk color palette
const COLORS = {
    CYAN: 0x00d4aa,
    CYAN_DARK: 0x008b72,
    RED: 0xff3366,
    RED_DARK: 0xcc0033,
    ORANGE: 0xff9933,
    PURPLE: 0x9933ff,
    BG_PANEL: 0x0a1628,
    BG_DARK: 0x000000,
    TEXT_CYAN: "#00d4aa",
    TEXT_RED: "#ff3366",
    TEXT_ORANGE: "#ff9933",
    TEXT_WHITE: "#ffffff",
    TEXT_GRAY: "#666688",
};

/**
 * Manages dilemma display when AI catches the explorer
 * Shows a cyberpunk-style UI with two choices
 */
export class DilemmaManager {
    private scene: Scene;
    private container?: Phaser.GameObjects.Container;
    private isActive: boolean = false;
    private currentDilemma?: Dilemma;
    private onChoiceCallback?: (choiceId: string) => void;
    private readOnly: boolean = false;

    constructor(scene: Scene, readOnly: boolean = false) {
        this.scene = scene;
        this.readOnly = readOnly;
    }

    /**
     * Get a random dilemma from the list
     */
    getRandomDilemma(): Dilemma {
        const index = Math.floor(Math.random() * dilemmas.length);
        return dilemmas[index] as Dilemma;
    }

    /**
     * Get a specific dilemma by ID
     */
    getDilemmaById(id: string): Dilemma | undefined {
        return (dilemmas as Dilemma[]).find(d => d.id === id);
    }

    /**
     * Show a dilemma on screen
     */
    showDilemma(dilemma: Dilemma): void {
        if (this.isActive) return;

        this.isActive = true;
        this.currentDilemma = dilemma;

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(2000);

        // Dark overlay with cyber grid
        const overlay = this.scene.add.rectangle(
            centerX,
            centerY,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            0x000408,
            0.92
        );
        this.container.add(overlay);

        // Cyber grid effect
        this.createCyberGrid();

        // Data stream effect
        this.createDataStreamEffect();

        // Warning title with cyber style
        const warningBracket1 = this.scene.add.text(centerX - 180, 70, "<<", {
            fontFamily: "Courier New, monospace",
            fontSize: "28px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(warningBracket1);

        const title = this.scene.add.text(centerX, 70, "DILEMME ÉTHIQUE DÉTECTÉ", {
            fontFamily: "Courier New, monospace",
            fontSize: "24px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(title);

        const warningBracket2 = this.scene.add.text(centerX + 180, 70, ">>", {
            fontFamily: "Courier New, monospace",
            fontSize: "28px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(warningBracket2);

        // Flicker animation on title
        this.scene.tweens.add({
            targets: [title, warningBracket1, warningBracket2],
            alpha: { from: 1, to: 0.7 },
            duration: 150,
            yoyo: true,
            repeat: -1,
        });

        // Description box with cyber frame
        const descBg = this.scene.add.graphics();
        descBg.fillStyle(COLORS.BG_PANEL, 0.95);
        descBg.fillRect(centerX - 400, 120, 800, 90);
        descBg.lineStyle(2, COLORS.CYAN, 0.8);
        descBg.strokeRect(centerX - 400, 120, 800, 90);
        // Corner accents
        descBg.lineStyle(3, COLORS.RED, 1);
        descBg.moveTo(centerX - 400, 120);
        descBg.lineTo(centerX - 370, 120);
        descBg.moveTo(centerX - 400, 120);
        descBg.lineTo(centerX - 400, 150);
        descBg.moveTo(centerX + 400, 210);
        descBg.lineTo(centerX + 370, 210);
        descBg.moveTo(centerX + 400, 210);
        descBg.lineTo(centerX + 400, 180);
        descBg.strokePath();
        this.container.add(descBg);

        const descText = this.scene.add.text(centerX, 165, dilemma.description, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: COLORS.TEXT_WHITE,
            align: "center",
            wordWrap: { width: 760 },
        }).setOrigin(0.5);
        this.container.add(descText);

        // Create cyber choice buttons
        const leftX = centerX - 220;
        const rightX = centerX + 220;
        const choiceY = centerY + 80;

        this.createCyberChoice(leftX, choiceY, dilemma.choices[0], 0);
        this.createCyberChoice(rightX, choiceY, dilemma.choices[1], 1);

        // Instructions
        const instructionText = this.readOnly
            ? "[ EN ATTENTE DU CHOIX SUR L'ÉCRAN DILEMME... ]"
            : "[ CLIQUEZ POUR SÉLECTIONNER VOTRE CHOIX ]";
        const instruction = this.scene.add.text(centerX, GameConfig.SCREEN_HEIGHT - 60, instructionText, {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: this.readOnly ? COLORS.TEXT_ORANGE : COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        this.container.add(instruction);

        // Animate instruction
        this.scene.tweens.add({
            targets: instruction,
            alpha: { from: 1, to: 0.4 },
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // Entry animation
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 300,
            ease: "Power2",
        });

        // Flash effect
        this.flashScreen();
    }

    /**
     * Flash screen effect
     */
    private flashScreen(): void {
        const flash = this.scene.add.rectangle(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT / 2,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            COLORS.RED,
            0.2
        );
        flash.setScrollFactor(0);
        flash.setDepth(2001);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 150,
            repeat: 2,
            yoyo: true,
            onComplete: () => flash.destroy(),
        });
    }

    /**
     * Create cyber grid background effect
     */
    private createCyberGrid(): void {
        if (!this.container) return;

        const graphics = this.scene.add.graphics();
        graphics.lineStyle(1, COLORS.CYAN, 0.05);

        // Vertical lines
        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }

        // Horizontal lines
        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }

        graphics.strokePath();
        this.container.add(graphics);
    }

    /**
     * Create data stream effect in background
     */
    private createDataStreamEffect(): void {
        if (!this.container) return;

        // Vertical data streams
        for (let i = 0; i < 6; i++) {
            const x = 80 + i * 180;
            const streamGraphics = this.scene.add.graphics();
            streamGraphics.fillStyle(COLORS.CYAN, 0.08);

            for (let j = 0; j < 15; j++) {
                const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                const height = 10 + Math.random() * 25;
                streamGraphics.fillRect(x, y, 2, height);
            }

            this.container.add(streamGraphics);

            // Animate stream
            this.scene.tweens.add({
                targets: streamGraphics,
                y: 80,
                alpha: { from: 0.2, to: 0.05 },
                duration: 2000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    /**
     * Create a cyber-styled choice button
     */
    private createCyberChoice(x: number, y: number, choice: DilemmaChoice, index: number): void {
        if (!this.container) return;

        const choiceContainer = this.scene.add.container(x, y);
        this.container.add(choiceContainer);

        const width = 340;
        const height = 180;
        const color = index === 0 ? COLORS.RED : COLORS.CYAN;
        const colorDark = index === 0 ? COLORS.RED_DARK : COLORS.CYAN_DARK;

        // Main panel background
        const panelBg = this.scene.add.graphics();
        panelBg.fillStyle(COLORS.BG_PANEL, 0.95);
        panelBg.fillRect(-width / 2, -height / 2, width, height);

        // Border with glow effect
        panelBg.lineStyle(2, color, 1);
        panelBg.strokeRect(-width / 2, -height / 2, width, height);

        // Corner decorations
        const cornerSize = 15;
        panelBg.lineStyle(3, color, 1);
        // Top left
        panelBg.moveTo(-width / 2, -height / 2 + cornerSize);
        panelBg.lineTo(-width / 2, -height / 2);
        panelBg.lineTo(-width / 2 + cornerSize, -height / 2);
        // Top right
        panelBg.moveTo(width / 2 - cornerSize, -height / 2);
        panelBg.lineTo(width / 2, -height / 2);
        panelBg.lineTo(width / 2, -height / 2 + cornerSize);
        // Bottom left
        panelBg.moveTo(-width / 2, height / 2 - cornerSize);
        panelBg.lineTo(-width / 2, height / 2);
        panelBg.lineTo(-width / 2 + cornerSize, height / 2);
        // Bottom right
        panelBg.moveTo(width / 2 - cornerSize, height / 2);
        panelBg.lineTo(width / 2, height / 2);
        panelBg.lineTo(width / 2, height / 2 - cornerSize);
        panelBg.strokePath();

        choiceContainer.add(panelBg);

        // Glow effect behind panel
        const glow = this.scene.add.graphics();
        glow.fillStyle(color, 0.1);
        glow.fillRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
        choiceContainer.addAt(glow, 0);

        // Choice number header
        const headerBg = this.scene.add.graphics();
        headerBg.fillStyle(colorDark, 0.8);
        headerBg.fillRect(-width / 2 + 8, -height / 2 + 8, 100, 26);
        headerBg.lineStyle(1, color, 1);
        headerBg.strokeRect(-width / 2 + 8, -height / 2 + 8, 100, 26);
        choiceContainer.add(headerBg);

        const choiceNum = this.scene.add.text(-width / 2 + 58, -height / 2 + 21, `OPTION ${index + 1}`, {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: index === 0 ? COLORS.TEXT_RED : COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        choiceContainer.add(choiceNum);

        // Choice text
        const choiceText = this.scene.add.text(0, 15, choice.description, {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: COLORS.TEXT_WHITE,
            align: "center",
            wordWrap: { width: width - 30 },
        }).setOrigin(0.5);
        choiceContainer.add(choiceText);

        // Action indicator at bottom
        const actionText = this.scene.add.text(0, height / 2 - 20, "[ SÉLECTIONNER ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: index === 0 ? COLORS.TEXT_RED : COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        actionText.setAlpha(0.7);
        choiceContainer.add(actionText);

        // Interactive hit area (only if not readOnly)
        if (!this.readOnly) {
            const hitArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0);
            hitArea.setInteractive({ useHandCursor: true });
            choiceContainer.add(hitArea);

            // Hover effects
            hitArea.on("pointerover", () => {
                this.scene.tweens.add({
                    targets: choiceContainer,
                    scale: 1.05,
                    duration: 150,
                    ease: "Power2",
                });
                this.scene.tweens.add({
                    targets: glow,
                    alpha: 0.3,
                    duration: 150,
                });
                actionText.setAlpha(1);
            });

            hitArea.on("pointerout", () => {
                this.scene.tweens.add({
                    targets: choiceContainer,
                    scale: 1,
                    duration: 150,
                    ease: "Power2",
                });
                this.scene.tweens.add({
                    targets: glow,
                    alpha: 0.1,
                    duration: 150,
                });
                actionText.setAlpha(0.7);
            });

            hitArea.on("pointerdown", () => {
                // Click flash effect
                const flash = this.scene.add.graphics();
                flash.fillStyle(color, 0.5);
                flash.fillRect(-width / 2, -height / 2, width, height);
                choiceContainer.add(flash);

                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => flash.destroy(),
                });

                this.selectChoice(choice.id);
            });
        }

        // Subtle pulse animation on glow
        this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0.1, to: 0.2 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });

        // Scanning line effect inside panel
        const scanLine = this.scene.add.graphics();
        scanLine.fillStyle(color, 0.1);
        scanLine.fillRect(-width / 2 + 5, 0, width - 10, 2);
        choiceContainer.add(scanLine);

        this.scene.tweens.add({
            targets: scanLine,
            y: { from: -height / 2 + 10, to: height / 2 - 10 },
            duration: 2000,
            repeat: -1,
            ease: "Linear",
        });
    }

    /**
     * Handle choice selection
     */
    private selectChoice(choiceId: string): void {
        if (!this.isActive || !this.currentDilemma) return;

        // Emit event with choice
        EventBus.emit("dilemma-choice-made", {
            dilemmaId: this.currentDilemma.id,
            choiceId: choiceId,
        });

        // Call callback if set
        this.onChoiceCallback?.(choiceId);

        // Hide dilemma
        this.hideDilemma();
    }

    /**
     * Hide the dilemma UI
     */
    hideDilemma(): void {
        if (!this.container || !this.isActive) return;

        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 300,
            ease: "Power2",
            onComplete: () => {
                this.container?.destroy();
                this.container = undefined;
                this.isActive = false;
                this.currentDilemma = undefined;
            },
        });
    }

    /**
     * Check if dilemma is currently active
     */
    isActiveState(): boolean {
        return this.isActive;
    }

    /**
     * Set callback for when a choice is made
     */
    onChoice(callback: (choiceId: string) => void): void {
        this.onChoiceCallback = callback;
    }

    /**
     * Get current dilemma
     */
    getCurrentDilemma(): Dilemma | undefined {
        return this.currentDilemma;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.container?.destroy();
        this.container = undefined;
    }
}
