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
            .text(centerX, centerY - 100, "VICTOIRE!", {
                fontFamily: "Arial Black",
                fontSize: "72px",
                color: "#00ff88",
                stroke: "#1a1a2e",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        // Subtitle
        this.add
            .text(centerX, centerY, "L'explorateur a trouvé la sortie!", {
                fontFamily: "Arial",
                fontSize: "28px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        // Play again button
        this.createButton(centerX, centerY + 100, "REJOUER", () => {
            this.networkManager.sendGameRestart();
            const role = this.networkManager.getRole();
            if (role === "explorer") {
                this.scene.start("ExplorerGame");
            } else {
                this.scene.start("GuideGame");
            }
        });

        // Menu button
        this.createButton(centerX, centerY + 180, "CHANGER DE ROLE", () => {
            this.scene.start("RoleSelect");
        });

        // Celebration particles
        this.createParticles();

        EventBus.emit("current-scene-ready", this);
    }

    private createButton(
        x: number,
        y: number,
        text: string,
        onClick: () => void
    ): void {
        const buttonBg = this.add.rectangle(x, y, 250, 50, 0x4a9eff);
        buttonBg.setStrokeStyle(2, 0xffffff);

        this.add
            .text(x, y, text, {
                fontFamily: "Arial Black",
                fontSize: "22px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        buttonBg.setInteractive({ useHandCursor: true });

        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x6ab8ff);
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x4a9eff);
        });

        buttonBg.on("pointerdown", () => {
            onClick();
        });
    }

    private createParticles(): void {
        const colors = [0x00ff88, 0x4a9eff, 0xffcc00, 0xff6b6b];

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
}
