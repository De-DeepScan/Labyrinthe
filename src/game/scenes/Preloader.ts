import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";

export default class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    init(): void {
        // Create loading bar
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Background bar
        this.add.rectangle(centerX, centerY, 468, 32).setStrokeStyle(2, 0xffffff);

        // Progress bar
        const bar = this.add.rectangle(
            centerX - 230,
            centerY,
            4,
            28,
            0x4a9eff
        );

        // Loading text
        this.add
            .text(centerX, centerY - 50, "Chargement...", {
                fontFamily: "Arial",
                fontSize: "24px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        // Update progress bar
        this.load.on("progress", (progress: number) => {
            bar.width = 4 + 460 * progress;
        });
    }

    preload(): void {
        // No external assets needed for this game
        // We use simple Phaser graphics

        // Simulate a small loading time for the progress bar
        for (let i = 0; i < 10; i++) {
            this.load.image(`placeholder_${i}`, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
        }
    }

    create(): void {
        this.scene.start("RoleSelect");
    }
}
