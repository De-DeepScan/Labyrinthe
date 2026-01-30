import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";
import { CyberUI, CYBER_COLORS } from "../config/CyberStyles";

export default class Victory extends Scene {
    private networkManager!: NetworkManager;
    private cyberUI!: CyberUI;

    constructor() {
        super("Victory");
    }

    create(): void {
        this.networkManager = NetworkManager.getInstance();
        this.cyberUI = new CyberUI(this);

        // Dark background
        this.cameras.main.setBackgroundColor("#000408");

        // Cyber grid
        this.cyberUI.createCyberGrid(0.05);

        // Data streams with green tint
        this.createVictoryDataStreams();

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Success hexagon
        this.cyberUI.createHexagonFrame(centerX, centerY - 150, 70);

        // Success icon in center
        const checkmark = this.add.graphics();
        checkmark.lineStyle(4, CYBER_COLORS.GREEN, 1);
        checkmark.moveTo(centerX - 20, centerY - 150);
        checkmark.lineTo(centerX - 5, centerY - 135);
        checkmark.lineTo(centerX + 25, centerY - 170);
        checkmark.strokePath();

        // Victory title
        this.cyberUI.createTitle(centerX, centerY - 50, "INFILTRATION RÉUSSIE", CYBER_COLORS.TEXT_GREEN);

        // Subtitle
        this.add
            .text(centerX, centerY + 20, "[ L'EXPLORATEUR A ATTEINT LE NOYAU ]", {
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
        this.cyberUI.createAlertBar("MISSION ACCOMPLIE  ▓▓▓  SYSTÈME NEURAL INFILTRÉ AVEC SUCCÈS  ▓▓▓  FÉLICITATIONS");

        // Celebration particles
        this.createCyberParticles();

        // Listen for partner restart
        EventBus.on("network-game-restart", this.restartGame, this);

        EventBus.emit("current-scene-ready", this);

        // Initial flash
        this.cyberUI.flashScreen(CYBER_COLORS.GREEN, 0.15);
    }

    private createStatusPanel(x: number, y: number): void {
        const panel = this.add.graphics();
        panel.fillStyle(CYBER_COLORS.BG_PANEL, 0.9);
        panel.fillRect(x - 200, y - 25, 400, 50);
        panel.lineStyle(2, CYBER_COLORS.GREEN, 0.8);
        panel.strokeRect(x - 200, y - 25, 400, 50);

        this.add.text(x - 180, y, "STATUS:", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_GRAY,
        }).setOrigin(0, 0.5);

        this.add.text(x + 180, y, "MISSION RÉUSSIE", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: CYBER_COLORS.TEXT_GREEN,
        }).setOrigin(1, 0.5);
    }

    private createVictoryDataStreams(): void {
        for (let i = 0; i < 8; i++) {
            const x = 80 + i * Math.floor(GameConfig.SCREEN_WIDTH / 8);
            const streamGraphics = this.add.graphics();
            streamGraphics.fillStyle(CYBER_COLORS.GREEN, 0.08);

            for (let j = 0; j < 15; j++) {
                const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                const height = 10 + Math.random() * 25;
                streamGraphics.fillRect(x, y, 2, height);
            }

            this.tweens.add({
                targets: streamGraphics,
                y: -100,
                alpha: { from: 0.2, to: 0.05 },
                duration: 2000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    private createCyberParticles(): void {
        const colors = [CYBER_COLORS.GREEN, CYBER_COLORS.CYAN, CYBER_COLORS.YELLOW];

        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, GameConfig.SCREEN_WIDTH);
            const y = Phaser.Math.Between(-50, -10);
            const color = Phaser.Math.RND.pick(colors);
            const size = Phaser.Math.Between(2, 6);

            const particle = this.add.rectangle(x, y, size, size, color);
            particle.setAlpha(0.8);

            this.tweens.add({
                targets: particle,
                y: GameConfig.SCREEN_HEIGHT + 50,
                x: x + Phaser.Math.Between(-50, 50),
                alpha: 0,
                duration: Phaser.Math.Between(3000, 5000),
                ease: "Linear",
                delay: Phaser.Math.Between(0, 3000),
                repeat: -1,
                onRepeat: () => {
                    particle.y = Phaser.Math.Between(-50, -10);
                    particle.x = Phaser.Math.Between(0, GameConfig.SCREEN_WIDTH);
                    particle.setAlpha(0.8);
                },
            });
        }
    }

    private restartGame(): void {
        this.cyberUI.flashScreen(CYBER_COLORS.CYAN);
        this.time.delayedCall(300, () => {
            this.networkManager.sendGameRestart();
            this.networkManager.reset();
            this.scene.start("RoleSelect");
        });
    }

    private goToMenu(): void {
        this.cyberUI.flashScreen(CYBER_COLORS.ORANGE);
        this.time.delayedCall(300, () => {
            this.networkManager.reset();
            this.scene.start("RoleSelect");
        });
    }

    shutdown(): void {
        EventBus.off("network-game-restart", this.restartGame, this);
    }
}
