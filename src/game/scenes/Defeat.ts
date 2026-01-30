import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";
import { CyberUI, CYBER_COLORS } from "../config/CyberStyles";

/**
 * Defeat scene - shown when AI catches explorer too many times
 */
export default class Defeat extends Scene {
    private cyberUI!: CyberUI;

    constructor() {
        super("Defeat");
    }

    create(): void {
        this.cyberUI = new CyberUI(this);

        // Dark background
        this.cameras.main.setBackgroundColor("#000408");

        // Cyber grid with red tint
        this.createRedGrid();

        // Glitch data streams
        this.createGlitchStreams();

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Warning hexagon
        const hexContainer = this.cyberUI.createHexagonFrame(centerX, centerY - 150, 70);
        // Override color to red
        hexContainer.each((child: Phaser.GameObjects.GameObject) => {
            if (child instanceof Phaser.GameObjects.Graphics) {
                child.clear();
                child.lineStyle(2, CYBER_COLORS.RED, 0.6);
                const size = 70;
                child.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 2;
                    const px = size * Math.cos(angle);
                    const py = size * Math.sin(angle);
                    if (i === 0) {
                        child.moveTo(px, py);
                    } else {
                        child.lineTo(px, py);
                    }
                }
                child.closePath();
                child.strokePath();
            }
        });

        // X mark in center
        const xMark = this.add.graphics();
        xMark.lineStyle(4, CYBER_COLORS.RED, 1);
        xMark.moveTo(centerX - 20, centerY - 170);
        xMark.lineTo(centerX + 20, centerY - 130);
        xMark.moveTo(centerX + 20, centerY - 170);
        xMark.lineTo(centerX - 20, centerY - 130);
        xMark.strokePath();

        // Flicker on X mark
        this.tweens.add({
            targets: xMark,
            alpha: { from: 1, to: 0.5 },
            duration: 100,
            yoyo: true,
            repeat: -1,
        });

        // Defeat title
        this.cyberUI.createTitle(centerX, centerY - 50, "INFILTRATION ÉCHOUÉE", CYBER_COLORS.TEXT_RED);

        // Subtitle
        this.add
            .text(centerX, centerY + 20, "[ L'IA A COMPROMIS LE RÉSEAU ]", {
                fontFamily: "Courier New, monospace",
                fontSize: "18px",
                color: CYBER_COLORS.TEXT_WHITE,
            })
            .setOrigin(0.5);

        // Status panel
        this.createStatusPanel(centerX, centerY + 80);

        // Buttons
        this.cyberUI.createButton(centerX - 120, centerY + 180, 180, 50, "REJOUER", CYBER_COLORS.CYAN, () => {
            this.restartGame();
        });

        this.cyberUI.createButton(centerX + 120, centerY + 180, 180, 50, "MENU", CYBER_COLORS.ORANGE, () => {
            this.goToMenu();
        });

        // Alert bar
        this.cyberUI.createAlertBar("ALERTE CRITIQUE  ▓▓▓  SYSTÈME COMPROMIS  ▓▓▓  CONNEXION PERDUE");

        // Falling particles
        this.createDefeatParticles();

        // Glitch overlay effect
        this.createGlitchOverlay();

        // Listen for partner restart
        EventBus.on("network-game-restart", this.restartGame, this);

        EventBus.emit("current-scene-ready", this);

        // Initial flash
        this.cyberUI.flashScreen(CYBER_COLORS.RED, 0.25);
    }

    private createRedGrid(): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, CYBER_COLORS.RED, 0.03);

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

    private createGlitchStreams(): void {
        for (let i = 0; i < 8; i++) {
            const x = 80 + i * Math.floor(GameConfig.SCREEN_WIDTH / 8);
            const streamGraphics = this.add.graphics();
            streamGraphics.fillStyle(CYBER_COLORS.RED, 0.08);

            for (let j = 0; j < 15; j++) {
                const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                const height = 10 + Math.random() * 25;
                streamGraphics.fillRect(x, y, 2, height);
            }

            // Glitchy animation
            this.tweens.add({
                targets: streamGraphics,
                y: { from: 0, to: Phaser.Math.Between(-50, 50) },
                x: { from: 0, to: Phaser.Math.Between(-20, 20) },
                alpha: { from: 0.3, to: 0.05 },
                duration: 500 + Math.random() * 500,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    private createStatusPanel(x: number, y: number): void {
        const panel = this.add.graphics();
        panel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        panel.fillRect(x - 200, y - 25, 400, 50);
        panel.lineStyle(2, CYBER_COLORS.RED, 0.8);
        panel.strokeRect(x - 200, y - 25, 400, 50);

        this.add.text(x - 180, y, "STATUS:", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_GRAY,
        }).setOrigin(0, 0.5);

        const statusText = this.add.text(x + 180, y, "ÉCHEC CRITIQUE", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_RED,
        }).setOrigin(1, 0.5);

        // Blink status
        this.tweens.add({
            targets: statusText,
            alpha: { from: 1, to: 0.3 },
            duration: 500,
            yoyo: true,
            repeat: -1,
        });
    }

    private createDefeatParticles(): void {
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * GameConfig.SCREEN_WIDTH;
            const y = Math.random() * GameConfig.SCREEN_HEIGHT;
            const size = 2 + Math.random() * 4;

            const particle = this.add.circle(x, y, size, CYBER_COLORS.RED, 0.6);

            this.tweens.add({
                targets: particle,
                y: GameConfig.SCREEN_HEIGHT + 50,
                x: x + (Math.random() - 0.5) * 100,
                alpha: 0,
                duration: 3000 + Math.random() * 2000,
                delay: Math.random() * 2000,
                repeat: -1,
                onRepeat: () => {
                    particle.setPosition(
                        Math.random() * GameConfig.SCREEN_WIDTH,
                        -20
                    );
                    particle.setAlpha(0.6);
                },
            });
        }
    }

    private createGlitchOverlay(): void {
        const glitchGraphics = this.add.graphics();

        this.time.addEvent({
            delay: 2000,
            callback: () => {
                glitchGraphics.clear();

                // Random glitch lines
                for (let i = 0; i < 5; i++) {
                    const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                    const width = 50 + Math.random() * 200;
                    const x = Math.random() * GameConfig.SCREEN_WIDTH;

                    glitchGraphics.fillStyle(CYBER_COLORS.RED, 0.1 + Math.random() * 0.1);
                    glitchGraphics.fillRect(x, y, width, 2);
                }

                // Fade out
                this.tweens.add({
                    targets: glitchGraphics,
                    alpha: { from: 1, to: 0 },
                    duration: 500,
                });
            },
            loop: true,
        });
    }

    private restartGame(): void {
        this.cyberUI.flashScreen(CYBER_COLORS.CYAN);
        this.time.delayedCall(300, () => {
            NetworkManager.getInstance().sendGameRestart();
            NetworkManager.getInstance().reset();
            this.scene.start("RoleSelect");
        });
    }

    private goToMenu(): void {
        this.cyberUI.flashScreen(CYBER_COLORS.ORANGE);
        this.time.delayedCall(300, () => {
            NetworkManager.getInstance().reset();
            this.scene.start("RoleSelect");
        });
    }

    shutdown(): void {
        EventBus.off("network-game-restart", this.restartGame, this);
    }
}
