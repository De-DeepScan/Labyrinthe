import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { NetworkManager } from "../services/NetworkManager";
import { EventBus } from "../EventBus";
import { CyberUI, CYBER_COLORS } from "../config/CyberStyles";
import type { PlayerRole } from "../types/interfaces";

export default class RoleSelect extends Scene {
    private networkManager!: NetworkManager;
    private cyberUI!: CyberUI;
    private waitingText?: Phaser.GameObjects.Text;
    private selectedRole: PlayerRole = null;
    private waitingContainer?: Phaser.GameObjects.Container;

    constructor() {
        super("RoleSelect");
    }

    create(): void {
        this.networkManager = NetworkManager.getInstance();
        this.cyberUI = new CyberUI(this);

        // Dark background
        this.cameras.main.setBackgroundColor("#000408");

        // Cyber grid
        this.cyberUI.createCyberGrid(0.05);

        // Scan line effect
        this.cyberUI.createScanLine();

        // Data streams
        this.cyberUI.createDataStreams(undefined, 8);

        const centerX = GameConfig.SCREEN_WIDTH / 2;

        // Title with cyber style
        this.cyberUI.createTitle(centerX, 70, "NEURAL INFILTRATION", CYBER_COLORS.TEXT_CYAN);

        // Subtitle
        this.add
            .text(centerX, 130, "[ SÉLECTION DE RÔLE ]", {
                fontFamily: "Courier New, monospace",
                fontSize: "20px",
                color: CYBER_COLORS.TEXT_GRAY,
            })
            .setOrigin(0.5);

        // Role selection cards
        this.createRoleCard(
            centerX - 320,
            380,
            "EXPLORATEUR",
            CYBER_COLORS.CYAN,
            [
                "Navigue dans le réseau neuronal",
                "Résout des puzzles pour avancer",
                "Doit atteindre le core central",
                "",
                "Contrôle: Clic pour interagir",
            ],
            "explorer"
        );

        this.createRoleCard(
            centerX,
            380,
            "PROTECTEUR",
            CYBER_COLORS.ORANGE,
            [
                "Voit tout le réseau + l'IA",
                "Joue au Terminal pour ressources",
                "Bloque les chemins de l'IA",
                "",
                "Contrôle: Clic pour bloquer",
            ],
            "protector"
        );

        this.createRoleCard(
            centerX + 320,
            380,
            "DILEMME",
            CYBER_COLORS.RED,
            [
                "Écran dédié aux dilemmes",
                "Affiche les choix éthiques",
                "Décide du sort des joueurs",
                "",
                "Contrôle: Clic pour choisir",
            ],
            "dilemma"
        );

        // Instructions
        this.add
            .text(
                centerX,
                620,
                "[ OUVREZ 3 ONGLETS : EXPLORATEUR, PROTECTEUR ET DILEMME ]",
                {
                    fontFamily: "Courier New, monospace",
                    fontSize: "14px",
                    color: CYBER_COLORS.TEXT_GRAY,
                }
            )
            .setOrigin(0.5);

        // Alert bar at bottom
        this.cyberUI.createAlertBar("BIENVENUE DANS LE SYSTÈME NEURAL  ▓▓▓  SÉLECTIONNEZ VOTRE RÔLE POUR COMMENCER");

        // Setup network events
        this.setupNetworkEvents();

        EventBus.emit("current-scene-ready", this);
    }

    private createRoleCard(
        x: number,
        y: number,
        title: string,
        color: number,
        descriptions: string[],
        role: "explorer" | "protector" | "dilemma"
    ): void {
        const width = 280;
        const height = 380;
        const container = this.add.container(x, y);

        // Glow effect
        const glow = this.add.graphics();
        glow.fillStyle(color, 0.08);
        glow.fillRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
        container.add(glow);

        // Panel background
        const panel = this.add.graphics();
        panel.fillStyle(CYBER_COLORS.BG_PANEL, 0.95);
        panel.fillRect(-width / 2, -height / 2, width, height);
        panel.lineStyle(2, color, 0.8);
        panel.strokeRect(-width / 2, -height / 2, width, height);

        // Corner decorations
        const cornerSize = 20;
        panel.lineStyle(3, color, 1);
        panel.moveTo(-width / 2, -height / 2 + cornerSize);
        panel.lineTo(-width / 2, -height / 2);
        panel.lineTo(-width / 2 + cornerSize, -height / 2);
        panel.moveTo(width / 2 - cornerSize, -height / 2);
        panel.lineTo(width / 2, -height / 2);
        panel.lineTo(width / 2, -height / 2 + cornerSize);
        panel.moveTo(-width / 2, height / 2 - cornerSize);
        panel.lineTo(-width / 2, height / 2);
        panel.lineTo(-width / 2 + cornerSize, height / 2);
        panel.moveTo(width / 2 - cornerSize, height / 2);
        panel.lineTo(width / 2, height / 2);
        panel.lineTo(width / 2, height / 2 - cornerSize);
        panel.strokePath();
        container.add(panel);

        // Header background
        const headerBg = this.add.graphics();
        headerBg.fillStyle(color, 0.2);
        headerBg.fillRect(-width / 2 + 10, -height / 2 + 10, width - 20, 50);
        headerBg.lineStyle(1, color, 0.5);
        headerBg.strokeRect(-width / 2 + 10, -height / 2 + 10, width - 20, 50);
        container.add(headerBg);

        // Title
        const textColor = color === CYBER_COLORS.RED ? CYBER_COLORS.TEXT_RED :
                         color === CYBER_COLORS.ORANGE ? CYBER_COLORS.TEXT_ORANGE :
                         CYBER_COLORS.TEXT_CYAN;

        const titleText = this.add
            .text(0, -height / 2 + 35, title, {
                fontFamily: "Courier New, monospace",
                fontSize: "20px",
                color: textColor,
            })
            .setOrigin(0.5);
        container.add(titleText);

        // Descriptions
        descriptions.forEach((desc, index) => {
            const descText = this.add
                .text(0, -height / 2 + 90 + index * 28, desc, {
                    fontFamily: "Courier New, monospace",
                    fontSize: "13px",
                    color: desc.startsWith("Contrôle") ? CYBER_COLORS.TEXT_GRAY : CYBER_COLORS.TEXT_WHITE,
                })
                .setOrigin(0.5);
            container.add(descText);
        });

        // Button
        const buttonY = height / 2 - 50;
        const buttonWidth = 180;
        const buttonHeight = 45;

        const buttonBg = this.add.graphics();
        buttonBg.fillStyle(CYBER_COLORS.BG_PANEL, 1);
        buttonBg.fillRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        buttonBg.lineStyle(2, color, 1);
        buttonBg.strokeRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
        container.add(buttonBg);

        const buttonText = this.add
            .text(0, buttonY, "[ CHOISIR ]", {
                fontFamily: "Courier New, monospace",
                fontSize: "16px",
                color: textColor,
            })
            .setOrigin(0.5);
        container.add(buttonText);

        // Hit area for button
        const hitArea = this.add.rectangle(0, buttonY, buttonWidth, buttonHeight, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        container.add(hitArea);

        // Hover effects
        hitArea.on("pointerover", () => {
            this.tweens.add({
                targets: container,
                scale: 1.03,
                duration: 150,
                ease: "Power2",
            });
            this.tweens.add({
                targets: glow,
                alpha: 0.2,
                duration: 150,
            });
            buttonText.setColor(CYBER_COLORS.TEXT_WHITE);
        });

        hitArea.on("pointerout", () => {
            this.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: "Power2",
            });
            this.tweens.add({
                targets: glow,
                alpha: 0.08,
                duration: 150,
            });
            buttonText.setColor(textColor);
        });

        hitArea.on("pointerdown", () => {
            // Flash effect
            const flash = this.add.graphics();
            flash.fillStyle(color, 0.4);
            flash.fillRect(-buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight);
            container.add(flash);

            this.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 200,
                onComplete: () => flash.destroy(),
            });

            this.selectRole(role);
        });

        // Scanning line effect inside card
        const scanLine = this.add.graphics();
        scanLine.fillStyle(color, 0.05);
        scanLine.fillRect(-width / 2 + 5, 0, width - 10, 2);
        container.add(scanLine);

        this.tweens.add({
            targets: scanLine,
            y: { from: -height / 2 + 10, to: height / 2 - 10 },
            duration: 2500,
            repeat: -1,
            ease: "Linear",
        });

        // Subtle glow pulse
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.08, to: 0.12 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
        });
    }

    private selectRole(role: "explorer" | "protector" | "dilemma"): void {
        // Dilemma screen starts immediately
        if (role === "dilemma") {
            this.cyberUI.flashScreen(CYBER_COLORS.RED);
            this.time.delayedCall(300, () => {
                this.scene.start("DilemmaScreen");
            });
            return;
        }

        this.selectedRole = role;
        this.networkManager.setRole(role);

        // Show waiting overlay
        this.showWaitingOverlay(role);

        // Check if partner is already connected
        if (this.networkManager.isPartnerConnected()) {
            this.startGame();
        }
    }

    private showWaitingOverlay(role: "explorer" | "protector"): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        this.waitingContainer = this.add.container(0, 0);
        this.waitingContainer.setDepth(100);

        // Dim overlay
        const overlay = this.add.rectangle(
            centerX,
            centerY,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            0x000408,
            0.9
        );
        this.waitingContainer.add(overlay);

        // Cyber grid on overlay
        const gridGraphics = this.add.graphics();
        gridGraphics.lineStyle(1, CYBER_COLORS.CYAN, 0.03);
        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            gridGraphics.moveTo(x, 0);
            gridGraphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }
        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            gridGraphics.moveTo(0, y);
            gridGraphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }
        gridGraphics.strokePath();
        this.waitingContainer.add(gridGraphics);

        // Hexagon frame
        const hexContainer = this.cyberUI.createHexagonFrame(centerX, centerY - 80, 60);
        this.waitingContainer.add(hexContainer);

        const roleText = role === "explorer" ? "EXPLORATEUR" : "PROTECTEUR";
        const color = role === "explorer" ? CYBER_COLORS.TEXT_CYAN : CYBER_COLORS.TEXT_ORANGE;

        // Role text
        const roleTitle = this.add
            .text(centerX, centerY + 20, `RÔLE: ${roleText}`, {
                fontFamily: "Courier New, monospace",
                fontSize: "28px",
                color: color,
            })
            .setOrigin(0.5);
        this.waitingContainer.add(roleTitle);

        // Waiting text
        this.waitingText = this.add
            .text(centerX, centerY + 70, "EN ATTENTE DE L'AUTRE JOUEUR", {
                fontFamily: "Courier New, monospace",
                fontSize: "16px",
                color: CYBER_COLORS.TEXT_GRAY,
            })
            .setOrigin(0.5);
        this.waitingContainer.add(this.waitingText);

        // Animated dots
        const dotsContainer = this.add.container(centerX, centerY + 100);
        for (let i = 0; i < 3; i++) {
            const dot = this.add.circle(i * 20 - 20, 0, 4, role === "explorer" ? CYBER_COLORS.CYAN : CYBER_COLORS.ORANGE, 0.3);
            dotsContainer.add(dot);

            this.tweens.add({
                targets: dot,
                alpha: { from: 0.3, to: 1 },
                scale: { from: 1, to: 1.5 },
                duration: 600,
                delay: i * 200,
                yoyo: true,
                repeat: -1,
            });
        }
        this.waitingContainer.add(dotsContainer);

        // Entry animation
        this.waitingContainer.setAlpha(0);
        this.tweens.add({
            targets: this.waitingContainer,
            alpha: 1,
            duration: 300,
            ease: "Power2",
        });
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
            this.waitingText.setText("CONNEXION ÉTABLIE!");
            this.waitingText.setColor(CYBER_COLORS.TEXT_GREEN);
        }

        this.cyberUI.flashScreen(CYBER_COLORS.GREEN, 0.15);

        this.time.delayedCall(800, () => {
            EventBus.off("partner-connected");

            if (this.selectedRole === "explorer") {
                this.scene.start("ExplorerGame");
            } else {
                this.scene.start("ProtectorGame");
            }
        });
    }
}
