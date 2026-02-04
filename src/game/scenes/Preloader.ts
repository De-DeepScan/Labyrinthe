import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { CYBER_COLORS } from "../config/CyberStyles";

export default class Preloader extends Scene {
    private progressBar!: Phaser.GameObjects.Graphics;
    private progressText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;

    constructor() {
        super("Preloader");
    }

    init(): void {
        // Dark background
        this.cameras.main.setBackgroundColor("#000408");

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Cyber grid background
        this.createCyberGrid();

        // Title
        this.add.text(centerX, centerY - 120, "NEURAL INFILTRATION", {
            fontFamily: "Courier New, monospace",
            fontSize: "36px",
            color: CYBER_COLORS.TEXT_CYAN,
        }).setOrigin(0.5);

        // Loading text
        this.add.text(centerX, centerY - 60, "[ INITIALISATION DU SYSTÈME ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: CYBER_COLORS.TEXT_GRAY,
        }).setOrigin(0.5);

        // Progress bar background
        const barBg = this.add.graphics();
        barBg.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        barBg.fillRect(centerX - 250, centerY - 15, 500, 30);
        barBg.lineStyle(2, CYBER_COLORS.CYAN, 0.5);
        barBg.strokeRect(centerX - 250, centerY - 15, 500, 30);

        // Corner decorations
        barBg.lineStyle(3, CYBER_COLORS.CYAN, 1);
        barBg.moveTo(centerX - 250, centerY - 5);
        barBg.lineTo(centerX - 250, centerY - 15);
        barBg.lineTo(centerX - 240, centerY - 15);
        barBg.moveTo(centerX + 240, centerY - 15);
        barBg.lineTo(centerX + 250, centerY - 15);
        barBg.lineTo(centerX + 250, centerY - 5);
        barBg.moveTo(centerX - 250, centerY + 5);
        barBg.lineTo(centerX - 250, centerY + 15);
        barBg.lineTo(centerX - 240, centerY + 15);
        barBg.moveTo(centerX + 240, centerY + 15);
        barBg.lineTo(centerX + 250, centerY + 15);
        barBg.lineTo(centerX + 250, centerY + 5);
        barBg.strokePath();

        // Progress bar fill
        this.progressBar = this.add.graphics();

        // Progress percentage text
        this.progressText = this.add.text(centerX, centerY, "0%", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_CYAN,
        }).setOrigin(0.5);

        // Status text
        this.statusText = this.add.text(centerX, centerY + 50, "Chargement des modules...", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: CYBER_COLORS.TEXT_GRAY,
        }).setOrigin(0.5);

        // Animated status dots
        const dotsContainer = this.add.container(centerX, centerY + 80);
        for (let i = 0; i < 3; i++) {
            const dot = this.add.circle(i * 15 - 15, 0, 3, CYBER_COLORS.CYAN, 0.3);
            dotsContainer.add(dot);

            this.tweens.add({
                targets: dot,
                alpha: { from: 0.3, to: 1 },
                scale: { from: 1, to: 1.5 },
                duration: 400,
                delay: i * 150,
                yoyo: true,
                repeat: -1,
            });
        }

        // Scan line effect
        const scanLine = this.add.graphics();
        scanLine.fillStyle(CYBER_COLORS.CYAN, 0.08);
        scanLine.fillRect(0, 0, GameConfig.SCREEN_WIDTH, 3);

        this.tweens.add({
            targets: scanLine,
            y: { from: 0, to: GameConfig.SCREEN_HEIGHT },
            duration: 2000,
            repeat: -1,
            ease: "Linear",
        });

        // Update progress bar
        this.load.on("progress", (progress: number) => {
            this.updateProgress(progress, centerX, centerY);
        });
    }

    private createCyberGrid(): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, CYBER_COLORS.CYAN, 0.03);

        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }

        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }

        graphics.strokePath();
    }

    private updateProgress(progress: number, centerX: number, centerY: number): void {
        this.progressBar.clear();
        this.progressBar.fillStyle(CYBER_COLORS.CYAN, 1);
        this.progressBar.fillRect(centerX - 248, centerY - 13, 496 * progress, 26);

        const percentage = Math.round(progress * 100);
        this.progressText.setText(`${percentage}%`);

        // Update status text based on progress
        if (percentage < 30) {
            this.statusText.setText("Initialisation du réseau neural...");
        } else if (percentage < 60) {
            this.statusText.setText("Chargement des protocoles de sécurité...");
        } else if (percentage < 90) {
            this.statusText.setText("Calibration des systèmes...");
        } else {
            this.statusText.setText("Finalisation...");
        }
    }

    preload(): void {
        // Simulate loading
        for (let i = 0; i < 10; i++) {
            this.load.image(`placeholder_${i}`, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
        }
    }

    create(): void {
        // Final status
        this.statusText.setText("SYSTÈME PRÊT");
        this.statusText.setColor(CYBER_COLORS.TEXT_GREEN);

        // Flash and transition
        const flash = this.add.rectangle(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT / 2,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            CYBER_COLORS.CYAN,
            0.2
        );

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.scene.start("RoleSelect");
            },
        });
    }
}
