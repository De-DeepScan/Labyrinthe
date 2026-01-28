import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { EventBus } from "../EventBus";

export default class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create(): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Title
        this.add
            .text(centerX, 120, "LABYRINTHE", {
                fontFamily: "Arial Black",
                fontSize: "64px",
                color: "#ffffff",
                stroke: "#1a1a2e",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        // Subtitle
        this.add
            .text(centerX, 190, "Jeu coopératif à 2 joueurs", {
                fontFamily: "Arial",
                fontSize: "24px",
                color: "#aaaaaa",
            })
            .setOrigin(0.5);

        // Instructions
        const instructions = [
            "EXPLORATEUR (Joueur 1)",
            "Touches: Z Q S D pour se déplacer",
            "Vision limitée - Trouvez la sortie!",
            "",
            "GUIDE (Joueur 2)",
            "Touches: Flèches pour déplacer le curseur",
            "Entrée pour activer les leviers",
            "Voit toute la carte - Aidez l'explorateur!",
        ];

        instructions.forEach((text, index) => {
            const isTitle = index === 0 || index === 4;
            this.add
                .text(centerX, 280 + index * 30, text, {
                    fontFamily: "Arial",
                    fontSize: isTitle ? "20px" : "16px",
                    color: isTitle ? "#4a9eff" : "#cccccc",
                })
                .setOrigin(0.5);
        });

        // Play button
        this.createPlayButton(centerX, centerY + 200);

        EventBus.emit("current-scene-ready", this);
    }

    private createPlayButton(x: number, y: number): void {
        const buttonBg = this.add.rectangle(x, y, 200, 60, 0x4a9eff);
        buttonBg.setStrokeStyle(3, 0xffffff);

        const buttonText = this.add
            .text(x, y, "JOUER", {
                fontFamily: "Arial Black",
                fontSize: "28px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        buttonBg.setInteractive({ useHandCursor: true });

        buttonBg.on("pointerover", () => {
            buttonBg.setFillStyle(0x6ab8ff);
            this.tweens.add({
                targets: [buttonBg, buttonText],
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
            });
        });

        buttonBg.on("pointerout", () => {
            buttonBg.setFillStyle(0x4a9eff);
            this.tweens.add({
                targets: [buttonBg, buttonText],
                scaleX: 1,
                scaleY: 1,
                duration: 100,
            });
        });

        buttonBg.on("pointerdown", () => {
            this.tweens.add({
                targets: [buttonBg, buttonText],
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 50,
                yoyo: true,
                onComplete: () => {
                    this.scene.start("Game");
                },
            });
        });

        // Pulsing animation
        this.tweens.add({
            targets: [buttonBg, buttonText],
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 1000,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });
    }
}
