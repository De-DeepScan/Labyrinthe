import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";

export default class Victory extends Scene {
    private networkManager!: NetworkManager;

    constructor() {
        super("Victory");
    }

    create(): void {
        this.networkManager = NetworkManager.getInstance();

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Victory text
        this.add
            .text(centerX, centerY - 100, "INFILTRATION COMPLETE!", {
                fontFamily: "Arial Black",
                fontSize: "56px",
                color: "#48bb78",
                stroke: "#1a1a2e",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        // Subtitle
        this.add
            .text(centerX, centerY, "The Explorer reached the Core!", {
                fontFamily: "Arial",
                fontSize: "28px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        // Play again button
        this.createButton(centerX - 120, centerY + 100, "RETRY", "#4299e1", () => {
            this.restartGame();
        });

        // Menu button
        this.createButton(centerX + 120, centerY + 100, "MENU", "#718096", () => {
            this.goToMenu();
        });

        // Celebration particles
        this.createParticles();

        // Listen for partner restart
        EventBus.on("network-game-restart", this.restartGame, this);

        EventBus.emit("current-scene-ready", this);
    }

    private createButton(
        x: number,
        y: number,
        text: string,
        color: string,
        onClick: () => void
    ): void {
        const buttonBg = this.add.rectangle(x, y, 180, 50, parseInt(color.replace("#", ""), 16));
        buttonBg.setStrokeStyle(3, 0xffffff);

        const buttonText = this.add
            .text(x, y, text, {
                fontFamily: "Arial Black",
                fontSize: "20px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        buttonBg.setInteractive({ useHandCursor: true });

        buttonBg.on("pointerover", () => {
            buttonBg.setScale(1.05);
            buttonText.setScale(1.05);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setScale(1);
            buttonText.setScale(1);
        });

        buttonBg.on("pointerdown", onClick);
    }

    private restartGame(): void {
        this.networkManager.sendGameRestart();
        this.networkManager.reset();
        this.scene.start("RoleSelect");
    }

    private goToMenu(): void {
        this.networkManager.reset();
        this.scene.start("RoleSelect");
    }

    private createParticles(): void {
        const colors = [0x48bb78, 0x4299e1, 0xed8936, 0xecc94b];

        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, GameConfig.SCREEN_WIDTH);
            const y = Phaser.Math.Between(-50, -10);
            const color = Phaser.Math.RND.pick(colors);
            const size = Phaser.Math.Between(5, 15);

            const particle = this.add.rectangle(x, y, size, size, color);

            this.tweens.add({
                targets: particle,
                y: GameConfig.SCREEN_HEIGHT + 50,
                x: x + Phaser.Math.Between(-100, 100),
                rotation: Phaser.Math.Between(0, 10),
                duration: Phaser.Math.Between(2000, 4000),
                ease: "Sine.easeIn",
                delay: Phaser.Math.Between(0, 2000),
                repeat: -1,
                onRepeat: () => {
                    particle.y = Phaser.Math.Between(-50, -10);
                    particle.x = Phaser.Math.Between(0, GameConfig.SCREEN_WIDTH);
                },
            });
        }
    }

    shutdown(): void {
        EventBus.off("network-game-restart", this.restartGame, this);
    }
}
