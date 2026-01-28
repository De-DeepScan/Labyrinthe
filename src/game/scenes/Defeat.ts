import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";

/**
 * Defeat scene - shown when AI catches explorer too many times
 */
export default class Defeat extends Scene {
    constructor() {
        super("Defeat");
    }

    create(): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Background effect
        this.createBackgroundEffect();

        // Title
        this.add.text(centerX, centerY - 100, "INFILTRATION FAILED", {
            fontFamily: "Arial Black",
            fontSize: "56px",
            color: "#e53e3e",
            stroke: "#000000",
            strokeThickness: 6,
        }).setOrigin(0.5);

        // Subtitle
        this.add.text(centerX, centerY - 20, "The AI has compromised the network", {
            fontFamily: "Arial",
            fontSize: "24px",
            color: "#fc8181",
        }).setOrigin(0.5);

        // Buttons
        this.createButton(centerX - 120, centerY + 80, "RETRY", "#4299e1", () => {
            this.restartGame();
        });

        this.createButton(centerX + 120, centerY + 80, "MENU", "#718096", () => {
            this.goToMenu();
        });

        // Listen for partner restart
        EventBus.on("network-game-restart", this.restartGame, this);

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Create background particle effect
     */
    private createBackgroundEffect(): void {
        // Falling red particles
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * GameConfig.SCREEN_WIDTH;
            const y = Math.random() * GameConfig.SCREEN_HEIGHT;
            const size = 2 + Math.random() * 4;

            const particle = this.add.circle(x, y, size, 0xe53e3e, 0.6);

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

    /**
     * Create a button
     */
    private createButton(
        x: number,
        y: number,
        text: string,
        color: string,
        onClick: () => void
    ): void {
        const bg = this.add.rectangle(x, y, 180, 50, parseInt(color.replace("#", ""), 16));
        bg.setStrokeStyle(3, 0xffffff);

        const buttonText = this.add.text(x, y, text, {
            fontFamily: "Arial Black",
            fontSize: "20px",
            color: "#ffffff",
        }).setOrigin(0.5);

        bg.setInteractive({ useHandCursor: true });

        bg.on("pointerover", () => {
            bg.setScale(1.05);
            buttonText.setScale(1.05);
        });

        bg.on("pointerout", () => {
            bg.setScale(1);
            buttonText.setScale(1);
        });

        bg.on("pointerdown", onClick);
    }

    /**
     * Restart the game
     */
    private restartGame(): void {
        NetworkManager.getInstance().sendGameRestart();
        NetworkManager.getInstance().reset();
        this.scene.start("RoleSelect");
    }

    /**
     * Go to menu
     */
    private goToMenu(): void {
        NetworkManager.getInstance().reset();
        this.scene.start("RoleSelect");
    }

    /**
     * Cleanup
     */
    shutdown(): void {
        EventBus.off("network-game-restart", this.restartGame, this);
    }
}
