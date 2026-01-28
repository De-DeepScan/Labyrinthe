import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";
import type { PlayerRole } from "../types/interfaces";

export default class RoleSelect extends Scene {
    private networkManager!: NetworkManager;
    private waitingText?: Phaser.GameObjects.Text;
    private selectedRole: PlayerRole = null;

    constructor() {
        super("RoleSelect");
    }

    create(): void {
        this.networkManager = NetworkManager.getInstance();

        const centerX = GameConfig.SCREEN_WIDTH / 2;

        // Title
        this.add
            .text(centerX, 80, "NEURAL INFILTRATION", {
                fontFamily: "Arial Black",
                fontSize: "48px",
                color: "#ffffff",
                stroke: "#1a1a2e",
                strokeThickness: 8,
            })
            .setOrigin(0.5);

        // Subtitle
        this.add
            .text(centerX, 140, "Choisissez votre rôle", {
                fontFamily: "Arial",
                fontSize: "28px",
                color: "#aaaaaa",
            })
            .setOrigin(0.5);

        // Explorer button (left)
        this.createRoleButton(
            centerX - 200,
            350,
            "EXPLORATEUR",
            "#4299e1",
            [
                "Navigue dans le réseau neuronal",
                "Résout des puzzles pour avancer",
                "Doit atteindre le core central",
                "",
                "Clic pour interagir",
            ],
            "explorer"
        );

        // Protector button (right)
        this.createRoleButton(
            centerX + 200,
            350,
            "PROTECTEUR",
            "#ed8936",
            [
                "Voit tout le réseau + l'IA",
                "Joue au Firewall pour les ressources",
                "Bloque les chemins de l'IA",
                "",
                "Clic pour bloquer",
            ],
            "protector"
        );

        // Instructions
        this.add
            .text(
                centerX,
                620,
                "Ouvrez 2 onglets : un pour chaque joueur",
                {
                    fontFamily: "Arial",
                    fontSize: "18px",
                    color: "#888888",
                }
            )
            .setOrigin(0.5);

        // Setup network events
        this.setupNetworkEvents();

        EventBus.emit("current-scene-ready", this);
    }

    private createRoleButton(
        x: number,
        y: number,
        title: string,
        color: string,
        descriptions: string[],
        role: "explorer" | "protector"
    ): void {
        // Container background
        const bg = this.add.rectangle(x, y, 320, 350, 0x2a2a3a);
        bg.setStrokeStyle(3, parseInt(color.replace("#", ""), 16));

        // Title
        this.add
            .text(x, y - 130, title, {
                fontFamily: "Arial Black",
                fontSize: "28px",
                color: color,
            })
            .setOrigin(0.5);

        // Descriptions
        descriptions.forEach((desc, index) => {
            this.add
                .text(x, y - 70 + index * 30, desc, {
                    fontFamily: "Arial",
                    fontSize: "16px",
                    color: "#cccccc",
                })
                .setOrigin(0.5);
        });

        // Button
        const button = this.add.rectangle(x, y + 120, 200, 50, parseInt(color.replace("#", ""), 16));
        button.setStrokeStyle(2, 0xffffff);

        const buttonText = this.add
            .text(x, y + 120, "CHOISIR", {
                fontFamily: "Arial Black",
                fontSize: "20px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        button.setInteractive({ useHandCursor: true });

        button.on("pointerover", () => {
            button.setScale(1.05);
            buttonText.setScale(1.05);
        });

        button.on("pointerout", () => {
            button.setScale(1);
            buttonText.setScale(1);
        });

        button.on("pointerdown", () => {
            this.selectRole(role);
        });
    }

    private selectRole(role: "explorer" | "protector"): void {
        this.selectedRole = role;
        this.networkManager.setRole(role);

        // Show waiting message
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Dim the background
        const overlay = this.add.rectangle(
            centerX,
            centerY,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            0x000000,
            0.7
        );
        overlay.setDepth(100);

        const roleText = role === "explorer" ? "EXPLORATEUR" : "PROTECTEUR";
        const color = role === "explorer" ? "#4299e1" : "#ed8936";

        this.add
            .text(centerX, centerY - 50, `Vous êtes: ${roleText}`, {
                fontFamily: "Arial Black",
                fontSize: "36px",
                color: color,
            })
            .setOrigin(0.5)
            .setDepth(101);

        this.waitingText = this.add
            .text(centerX, centerY + 20, "En attente de l'autre joueur...", {
                fontFamily: "Arial",
                fontSize: "24px",
                color: "#ffffff",
            })
            .setOrigin(0.5)
            .setDepth(101);

        // Animate waiting text
        this.tweens.add({
            targets: this.waitingText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // Check if partner is already connected
        if (this.networkManager.isPartnerConnected()) {
            this.startGame();
        }
    }

    private setupNetworkEvents(): void {
        EventBus.on("partner-connected", () => {
            if (this.selectedRole) {
                this.startGame();
            }
        });
    }

    private startGame(): void {
        if (this.waitingText) {
            this.waitingText.setText("Partenaire connecté! Démarrage...");
        }

        this.time.delayedCall(500, () => {
            EventBus.off("partner-connected");

            if (this.selectedRole === "explorer") {
                this.scene.start("ExplorerGame");
            } else {
                this.scene.start("ProtectorGame");
            }
        });
    }
}
