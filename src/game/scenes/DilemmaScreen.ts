import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { EventBus } from "../EventBus";
import { NetworkManager } from "../services/NetworkManager";
import dilemmas from "../dilemme.json";

interface DilemmaChoice {
    id: string;
    description: string;
}

interface Dilemma {
    id: string;
    description: string;
    choices: DilemmaChoice[];
}

// Cyberpunk color palette
const COLORS = {
    CYAN: 0x00d4aa,
    CYAN_DARK: 0x008b72,
    RED: 0xff3366,
    RED_DARK: 0xcc0033,
    ORANGE: 0xff9933,
    PURPLE: 0x9933ff,
    BG_PANEL: 0x0a1628,
    BG_DARK: 0x000000,
    TEXT_CYAN: "#00d4aa",
    TEXT_RED: "#ff3366",
    TEXT_ORANGE: "#ff9933",
    TEXT_WHITE: "#ffffff",
    TEXT_GRAY: "#666688",
};

/**
 * Dedicated screen for displaying ethical dilemmas
 * This screen is black and waits for dilemma events
 * Style: Cyberpunk/Outbreak theme
 */
export default class DilemmaScreen extends Scene {
    private networkService!: NetworkManager;
    private container?: Phaser.GameObjects.Container;
    private waitingText?: Phaser.GameObjects.Text;
    private currentDilemma?: Dilemma;
    private isShowingDilemma: boolean = false;
    private statusPanel?: Phaser.GameObjects.Container;
    private alertBar?: Phaser.GameObjects.Container;
    private tickerText?: Phaser.GameObjects.Text;
    private timeRemaining: number = 30;
    private timerEvent?: Phaser.Time.TimerEvent;

    constructor() {
        super("DilemmaScreen");
    }

    create(): void {
        this.networkService = NetworkManager.getInstance();

        // Black background
        this.cameras.main.setBackgroundColor("#000408");

        // Create cyber grid background
        this.createCyberGrid();

        // Create status panel (top left)
        this.createStatusPanel();

        // Create alert bar (bottom)
        this.createAlertBar();

        // Create waiting UI
        this.createWaitingUI();

        // Listen for dilemma events (from network - triggered by protector)
        EventBus.on("network-dilemma-triggered", this.onDilemmaTriggered, this);

        // Also listen for local dilemma events (if this is on the same machine as protector)
        EventBus.on("ai-caught-explorer-dilemma", this.onLocalDilemmaTriggered, this);

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Create cyber grid background effect
     */
    private createCyberGrid(): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, COLORS.CYAN, 0.05);

        // Vertical lines
        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }

        // Horizontal lines
        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }

        graphics.strokePath();
    }

    /**
     * Create status panel in top left corner
     */
    private createStatusPanel(): void {
        this.statusPanel = this.add.container(20, 20);

        // Panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(COLORS.BG_PANEL, 0.9);
        panelBg.fillRect(0, 0, 240, 180);
        panelBg.lineStyle(2, COLORS.CYAN, 0.8);
        panelBg.strokeRect(0, 0, 240, 180);
        this.statusPanel.add(panelBg);

        // Title
        const title = this.add.text(15, 12, "# DILEMMA STATUS", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: COLORS.TEXT_RED,
        });
        this.statusPanel.add(title);

        // Separator line
        const sepLine = this.add.graphics();
        sepLine.lineStyle(1, COLORS.CYAN, 0.3);
        sepLine.moveTo(15, 35);
        sepLine.lineTo(225, 35);
        sepLine.strokePath();
        this.statusPanel.add(sepLine);

        // Time remaining label
        const timeLabel = this.add.text(15, 45, "TIME REMAINING", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: COLORS.TEXT_GRAY,
        });
        this.statusPanel.add(timeLabel);

        // Time value
        const timeValue = this.add.text(200, 45, "00:30", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: COLORS.TEXT_CYAN,
        }).setOrigin(1, 0);
        timeValue.setName("timeValue");
        this.statusPanel.add(timeValue);

        // Status label
        const statusLabel = this.add.text(15, 70, "STATUS", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: COLORS.TEXT_GRAY,
        });
        this.statusPanel.add(statusLabel);

        // Status value
        const statusValue = this.add.text(200, 70, "EN ATTENTE", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: COLORS.TEXT_ORANGE,
        }).setOrigin(1, 0);
        statusValue.setName("statusValue");
        this.statusPanel.add(statusValue);

        // Progress bar background
        const progressBg = this.add.graphics();
        progressBg.fillStyle(0x1a1a2e, 1);
        progressBg.fillRect(15, 100, 210, 18);
        progressBg.lineStyle(1, COLORS.CYAN, 0.5);
        progressBg.strokeRect(15, 100, 210, 18);
        this.statusPanel.add(progressBg);

        // Progress bar fill
        const progressFill = this.add.graphics();
        progressFill.fillStyle(COLORS.ORANGE, 1);
        progressFill.fillRect(17, 102, 0, 14);
        progressFill.setName("progressFill");
        this.statusPanel.add(progressFill);

        // Bottom stats
        const choicesLabel = this.add.text(15, 135, "CHOIX", {
            fontFamily: "Courier New, monospace",
            fontSize: "10px",
            color: COLORS.TEXT_ORANGE,
        });
        this.statusPanel.add(choicesLabel);

        const choicesValue = this.add.text(15, 150, "2", {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: COLORS.TEXT_ORANGE,
        });
        this.statusPanel.add(choicesValue);

        const optionsLabel = this.add.text(130, 135, "OPTIONS", {
            fontFamily: "Courier New, monospace",
            fontSize: "10px",
            color: COLORS.TEXT_CYAN,
        });
        this.statusPanel.add(optionsLabel);

        const optionsValue = this.add.text(130, 150, "DISPONIBLES", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: COLORS.TEXT_CYAN,
        });
        this.statusPanel.add(optionsValue);
    }

    /**
     * Create alert bar at bottom of screen
     */
    private createAlertBar(): void {
        this.alertBar = this.add.container(0, GameConfig.SCREEN_HEIGHT - 35);

        // Bar background
        const barBg = this.add.graphics();
        barBg.fillStyle(0x0a0a14, 0.95);
        barBg.fillRect(0, 0, GameConfig.SCREEN_WIDTH, 35);
        barBg.lineStyle(1, COLORS.CYAN, 0.3);
        barBg.moveTo(0, 0);
        barBg.lineTo(GameConfig.SCREEN_WIDTH, 0);
        barBg.strokePath();
        this.alertBar.add(barBg);

        // Alert button
        const alertBtnBg = this.add.graphics();
        alertBtnBg.fillStyle(COLORS.RED_DARK, 1);
        alertBtnBg.fillRect(10, 5, 80, 25);
        alertBtnBg.lineStyle(2, COLORS.RED, 1);
        alertBtnBg.strokeRect(10, 5, 80, 25);
        this.alertBar.add(alertBtnBg);

        // Play icon (triangle)
        const playIcon = this.add.graphics();
        playIcon.fillStyle(COLORS.RED, 1);
        playIcon.fillTriangle(20, 12, 20, 24, 32, 18);
        this.alertBar.add(playIcon);

        const alertText = this.add.text(38, 17, "ALERT", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0, 0.5);
        this.alertBar.add(alertText);

        // Pulsing alert button
        this.tweens.add({
            targets: [alertBtnBg, playIcon],
            alpha: { from: 1, to: 0.6 },
            duration: 500,
            yoyo: true,
            repeat: -1,
        });

        // Ticker separator
        const tickerSep = this.add.graphics();
        tickerSep.fillStyle(COLORS.CYAN, 0.5);
        tickerSep.fillRect(100, 8, 2, 20);
        this.alertBar.add(tickerSep);

        // News ticker text
        this.tickerText = this.add.text(120, 17, "SYSTÈME DE DILEMME ÉTHIQUE ACTIVÉ  ▓▓▓  EN ATTENTE DE DÉCISION  ▓▓▓  CHOISISSEZ AVEC SAGESSE  ▓▓▓  ", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: COLORS.TEXT_CYAN,
        }).setOrigin(0, 0.5);
        this.alertBar.add(this.tickerText);

        // LIVE indicator
        const liveBg = this.add.graphics();
        liveBg.fillStyle(COLORS.RED, 1);
        liveBg.fillCircle(GameConfig.SCREEN_WIDTH - 50, 17, 5);
        this.alertBar.add(liveBg);

        const liveText = this.add.text(GameConfig.SCREEN_WIDTH - 40, 17, "LIVE", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0, 0.5);
        this.alertBar.add(liveText);

        // Pulsing live indicator
        this.tweens.add({
            targets: liveBg,
            alpha: { from: 1, to: 0.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // Animate ticker
        this.animateTicker();
    }

    /**
     * Animate the news ticker
     */
    private animateTicker(): void {
        if (!this.tickerText) return;

        const tickerWidth = this.tickerText.width;
        const screenWidth = GameConfig.SCREEN_WIDTH;

        this.tweens.add({
            targets: this.tickerText,
            x: -tickerWidth,
            duration: 20000,
            ease: "Linear",
            onComplete: () => {
                if (this.tickerText) {
                    this.tickerText.x = screenWidth;
                    this.animateTicker();
                }
            },
        });
    }

    /**
     * Create waiting UI
     */
    private createWaitingUI(): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        // Central hexagon frame
        this.createHexagonFrame(centerX, centerY - 50);

        // Title with cyber style
        const title = this.add.text(centerX, centerY - 150, "[ SYSTÈME DE DILEMME ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "28px",
            color: COLORS.TEXT_CYAN,
        }).setOrigin(0.5);

        // Subtle pulse animation
        this.tweens.add({
            targets: title,
            alpha: { from: 1, to: 0.6 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });

        // Waiting message
        this.waitingText = this.add.text(centerX, centerY + 80, "EN ATTENTE D'UN DILEMME", {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: COLORS.TEXT_GRAY,
        }).setOrigin(0.5);

        // Animated dots indicator
        const dotsContainer = this.add.container(centerX, centerY + 110);
        for (let i = 0; i < 3; i++) {
            const dot = this.add.circle(i * 20 - 20, 0, 4, COLORS.CYAN, 0.3);
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

        // Add scanning line effect
        this.createScanLineEffect();
    }

    /**
     * Create hexagon frame decoration
     */
    private createHexagonFrame(x: number, y: number): void {
        const graphics = this.add.graphics();
        const size = 80;

        // Draw hexagon outline
        graphics.lineStyle(2, COLORS.CYAN, 0.6);
        graphics.beginPath();

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.strokePath();

        // Inner hexagon
        graphics.lineStyle(1, COLORS.CYAN, 0.3);
        graphics.beginPath();
        const innerSize = 60;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const px = x + innerSize * Math.cos(angle);
            const py = y + innerSize * Math.sin(angle);
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.strokePath();

        // Rotating animation element
        const rotatingGraphics = this.add.graphics();
        rotatingGraphics.lineStyle(3, COLORS.CYAN, 0.8);
        rotatingGraphics.arc(0, 0, size + 10, 0, Math.PI / 2);
        rotatingGraphics.strokePath();
        rotatingGraphics.setPosition(x, y);

        this.tweens.add({
            targets: rotatingGraphics,
            angle: 360,
            duration: 4000,
            repeat: -1,
            ease: "Linear",
        });
    }

    /**
     * Create scanning line effect
     */
    private createScanLineEffect(): void {
        const scanLine = this.add.graphics();
        scanLine.fillStyle(COLORS.CYAN, 0.1);
        scanLine.fillRect(0, 0, GameConfig.SCREEN_WIDTH, 3);

        this.tweens.add({
            targets: scanLine,
            y: { from: 0, to: GameConfig.SCREEN_HEIGHT },
            duration: 3000,
            repeat: -1,
            ease: "Linear",
        });
    }


    /**
     * Handle dilemma triggered via network
     */
    private onDilemmaTriggered(data: { dilemmaId: string; neuronId: string }): void {
        const dilemma = (dilemmas as Dilemma[]).find(d => d.id === data.dilemmaId);
        if (dilemma) {
            this.showDilemma(dilemma);
        }
    }

    /**
     * Handle local dilemma triggered (same machine as protector)
     */
    private onLocalDilemmaTriggered(data: { neuronId: string; dilemma: Dilemma }): void {
        this.showDilemma(data.dilemma);
    }

    /**
     * Show the dilemma on screen
     */
    private showDilemma(dilemma: Dilemma): void {
        if (this.isShowingDilemma) return;

        this.isShowingDilemma = true;
        this.currentDilemma = dilemma;
        this.timeRemaining = 30;

        // Update status panel
        this.updateStatusPanel("ACTIF", COLORS.TEXT_RED);

        // Start timer
        this.startTimer();

        // Hide waiting text
        if (this.waitingText) {
            this.waitingText.setVisible(false);
        }

        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        this.container = this.add.container(0, 0);
        this.container.setDepth(100);

        // Data stream effect in background
        this.createDataStreamEffect();

        // Warning title with cyber style
        const warningBracket1 = this.add.text(centerX - 220, 80, "<<", {
            fontFamily: "Courier New, monospace",
            fontSize: "36px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(warningBracket1);

        const warningTitle = this.add.text(centerX, 80, "DILEMME ÉTHIQUE DÉTECTÉ", {
            fontFamily: "Courier New, monospace",
            fontSize: "32px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(warningTitle);

        const warningBracket2 = this.add.text(centerX + 220, 80, ">>", {
            fontFamily: "Courier New, monospace",
            fontSize: "36px",
            color: COLORS.TEXT_RED,
        }).setOrigin(0.5);
        this.container.add(warningBracket2);

        // Flicker animation on title
        this.tweens.add({
            targets: [warningTitle, warningBracket1, warningBracket2],
            alpha: { from: 1, to: 0.7 },
            duration: 150,
            yoyo: true,
            repeat: -1,
        });

        // Description box with cyber frame
        const descBg = this.add.graphics();
        descBg.fillStyle(COLORS.BG_PANEL, 0.95);
        descBg.fillRect(centerX - 450, 130, 900, 100);
        descBg.lineStyle(2, COLORS.CYAN, 0.8);
        descBg.strokeRect(centerX - 450, 130, 900, 100);
        // Corner accents
        descBg.lineStyle(3, COLORS.RED, 1);
        descBg.moveTo(centerX - 450, 130);
        descBg.lineTo(centerX - 420, 130);
        descBg.moveTo(centerX - 450, 130);
        descBg.lineTo(centerX - 450, 160);
        descBg.moveTo(centerX + 450, 230);
        descBg.lineTo(centerX + 420, 230);
        descBg.moveTo(centerX + 450, 230);
        descBg.lineTo(centerX + 450, 200);
        descBg.strokePath();
        this.container.add(descBg);

        const descText = this.add.text(centerX, 180, dilemma.description, {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: COLORS.TEXT_WHITE,
            align: "center",
            wordWrap: { width: 850 },
        }).setOrigin(0.5);
        this.container.add(descText);

        // Create cyber choice buttons
        const leftX = centerX - 280;
        const rightX = centerX + 280;
        const choiceY = centerY + 100;

        this.createCyberChoice(leftX, choiceY, dilemma.choices[0], 0);
        this.createCyberChoice(rightX, choiceY, dilemma.choices[1], 1);

        // Instructions at bottom (above alert bar)
        const instruction = this.add.text(centerX, GameConfig.SCREEN_HEIGHT - 80, "[ CLIQUEZ POUR SÉLECTIONNER VOTRE CHOIX ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        this.container.add(instruction);

        // Pulsing instruction
        this.tweens.add({
            targets: instruction,
            alpha: { from: 1, to: 0.4 },
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        // Entry animation
        this.container.setAlpha(0);
        this.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 400,
            ease: "Power2",
        });

        // Alert flash effect
        this.flashScreen();
    }

    /**
     * Update status panel values
     */
    private updateStatusPanel(status: string, color: string): void {
        if (!this.statusPanel) return;

        const statusValue = this.statusPanel.getByName("statusValue") as Phaser.GameObjects.Text;
        if (statusValue) {
            statusValue.setText(status);
            statusValue.setColor(color);
        }
    }

    /**
     * Start countdown timer
     */
    private startTimer(): void {
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.timeRemaining--;
                this.updateTimerDisplay();

                if (this.timeRemaining <= 0) {
                    // Auto-select random choice if time runs out
                    if (this.currentDilemma) {
                        const randomChoice = this.currentDilemma.choices[Math.floor(Math.random() * 2)];
                        this.selectChoice(randomChoice.id);
                    }
                }
            },
            repeat: 29,
        });
    }

    /**
     * Update timer display
     */
    private updateTimerDisplay(): void {
        if (!this.statusPanel) return;

        const timeValue = this.statusPanel.getByName("timeValue") as Phaser.GameObjects.Text;
        if (timeValue) {
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            timeValue.setText(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);

            // Change color when low
            if (this.timeRemaining <= 10) {
                timeValue.setColor(COLORS.TEXT_RED);
            }
        }

        // Update progress bar
        const progressFill = this.statusPanel.getByName("progressFill") as Phaser.GameObjects.Graphics;
        if (progressFill) {
            const progress = this.timeRemaining / 30;
            progressFill.clear();
            progressFill.fillStyle(this.timeRemaining <= 10 ? COLORS.RED : COLORS.ORANGE, 1);
            progressFill.fillRect(17, 102, 206 * progress, 14);
        }
    }

    /**
     * Create data stream effect in background
     */
    private createDataStreamEffect(): void {
        if (!this.container) return;

        const graphics = this.add.graphics();
        this.container.add(graphics);

        // Vertical data streams
        for (let i = 0; i < 8; i++) {
            const x = 100 + i * 150;
            const streamGraphics = this.add.graphics();
            streamGraphics.fillStyle(COLORS.CYAN, 0.1);

            for (let j = 0; j < 20; j++) {
                const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                const height = 10 + Math.random() * 30;
                streamGraphics.fillRect(x, y, 2, height);
            }

            this.container.add(streamGraphics);

            // Animate stream
            this.tweens.add({
                targets: streamGraphics,
                y: 100,
                alpha: { from: 0.3, to: 0.1 },
                duration: 2000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    /**
     * Flash screen effect
     */
    private flashScreen(): void {
        const flash = this.add.rectangle(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT / 2,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            0xff0000,
            0.3
        );

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 200,
            repeat: 3,
            yoyo: true,
            onComplete: () => flash.destroy(),
        });
    }

    /**
     * Create a cyber-styled choice button
     */
    private createCyberChoice(x: number, y: number, choice: DilemmaChoice, index: number): void {
        if (!this.container) return;

        const choiceContainer = this.add.container(x, y);
        this.container.add(choiceContainer);

        const width = 400;
        const height = 200;
        const color = index === 0 ? COLORS.RED : COLORS.CYAN;
        const colorDark = index === 0 ? COLORS.RED_DARK : COLORS.CYAN_DARK;

        // Main panel background
        const panelBg = this.add.graphics();
        panelBg.fillStyle(COLORS.BG_PANEL, 0.95);
        panelBg.fillRect(-width / 2, -height / 2, width, height);

        // Border with glow effect
        panelBg.lineStyle(3, color, 1);
        panelBg.strokeRect(-width / 2, -height / 2, width, height);

        // Corner decorations
        const cornerSize = 20;
        panelBg.lineStyle(4, color, 1);
        // Top left
        panelBg.moveTo(-width / 2, -height / 2 + cornerSize);
        panelBg.lineTo(-width / 2, -height / 2);
        panelBg.lineTo(-width / 2 + cornerSize, -height / 2);
        // Top right
        panelBg.moveTo(width / 2 - cornerSize, -height / 2);
        panelBg.lineTo(width / 2, -height / 2);
        panelBg.lineTo(width / 2, -height / 2 + cornerSize);
        // Bottom left
        panelBg.moveTo(-width / 2, height / 2 - cornerSize);
        panelBg.lineTo(-width / 2, height / 2);
        panelBg.lineTo(-width / 2 + cornerSize, height / 2);
        // Bottom right
        panelBg.moveTo(width / 2 - cornerSize, height / 2);
        panelBg.lineTo(width / 2, height / 2);
        panelBg.lineTo(width / 2, height / 2 - cornerSize);
        panelBg.strokePath();

        choiceContainer.add(panelBg);

        // Glow effect behind panel
        const glow = this.add.graphics();
        glow.fillStyle(color, 0.1);
        glow.fillRect(-width / 2 - 5, -height / 2 - 5, width + 10, height + 10);
        choiceContainer.addAt(glow, 0);

        // Choice number header
        const headerBg = this.add.graphics();
        headerBg.fillStyle(colorDark, 0.8);
        headerBg.fillRect(-width / 2 + 10, -height / 2 + 10, 120, 30);
        headerBg.lineStyle(1, color, 1);
        headerBg.strokeRect(-width / 2 + 10, -height / 2 + 10, 120, 30);
        choiceContainer.add(headerBg);

        const choiceNum = this.add.text(-width / 2 + 70, -height / 2 + 25, `OPTION ${index + 1}`, {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: index === 0 ? COLORS.TEXT_RED : COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        choiceContainer.add(choiceNum);

        // Choice text
        const choiceText = this.add.text(0, 20, choice.description, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: COLORS.TEXT_WHITE,
            align: "center",
            wordWrap: { width: width - 40 },
        }).setOrigin(0.5);
        choiceContainer.add(choiceText);

        // Action indicator at bottom
        const actionText = this.add.text(0, height / 2 - 25, "[ SÉLECTIONNER ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: index === 0 ? COLORS.TEXT_RED : COLORS.TEXT_CYAN,
        }).setOrigin(0.5);
        actionText.setAlpha(0.7);
        choiceContainer.add(actionText);

        // Interactive hit area
        const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        choiceContainer.add(hitArea);

        // Hover effects
        hitArea.on("pointerover", () => {
            this.tweens.add({
                targets: choiceContainer,
                scale: 1.05,
                duration: 150,
                ease: "Power2",
            });
            this.tweens.add({
                targets: glow,
                alpha: 0.3,
                duration: 150,
            });
            actionText.setAlpha(1);
            choiceText.setColor("#ffffff");
        });

        hitArea.on("pointerout", () => {
            this.tweens.add({
                targets: choiceContainer,
                scale: 1,
                duration: 150,
                ease: "Power2",
            });
            this.tweens.add({
                targets: glow,
                alpha: 0.1,
                duration: 150,
            });
            actionText.setAlpha(0.7);
        });

        hitArea.on("pointerdown", () => {
            // Click flash effect
            const flash = this.add.graphics();
            flash.fillStyle(color, 0.5);
            flash.fillRect(-width / 2, -height / 2, width, height);
            choiceContainer.add(flash);

            this.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 200,
                onComplete: () => flash.destroy(),
            });

            this.selectChoice(choice.id);
        });

        // Subtle pulse animation on glow
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.1, to: 0.2 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });

        // Scanning line effect inside panel
        const scanLine = this.add.graphics();
        scanLine.fillStyle(color, 0.1);
        scanLine.fillRect(-width / 2 + 5, 0, width - 10, 2);
        choiceContainer.add(scanLine);

        this.tweens.add({
            targets: scanLine,
            y: { from: -height / 2 + 10, to: height / 2 - 10 },
            duration: 2000,
            repeat: -1,
            ease: "Linear",
        });
    }

    /**
     * Handle choice selection
     */
    private selectChoice(choiceId: string): void {
        if (!this.currentDilemma) return;

        // Flash effect on selection
        const flash = this.add.rectangle(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT / 2,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            0xffffff,
            0.5
        );

        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy(),
        });

        // Send choice to other screens
        this.networkService.sendDilemmaChoice({
            dilemmaId: this.currentDilemma.id,
            choiceId: choiceId,
        });

        // Emit local event for same-machine scenarios
        EventBus.emit("dilemma-choice-made", {
            dilemmaId: this.currentDilemma.id,
            choiceId: choiceId,
        });

        // Hide dilemma
        this.hideDilemma();
    }

    /**
     * Hide the dilemma UI
     */
    private hideDilemma(): void {
        if (!this.container) return;

        // Stop timer
        if (this.timerEvent) {
            this.timerEvent.destroy();
            this.timerEvent = undefined;
        }

        // Reset status panel
        this.updateStatusPanel("EN ATTENTE", COLORS.TEXT_ORANGE);
        this.timeRemaining = 30;
        this.updateTimerDisplay();

        this.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 500,
            ease: "Power2",
            onComplete: () => {
                this.container?.destroy();
                this.container = undefined;
                this.isShowingDilemma = false;
                this.currentDilemma = undefined;

                // Show waiting text again
                if (this.waitingText) {
                    this.waitingText.setVisible(true);
                }
            },
        });
    }

    /**
     * Cleanup
     */
    shutdown(): void {
        EventBus.off("network-dilemma-triggered", this.onDilemmaTriggered, this);
        EventBus.off("ai-caught-explorer-dilemma", this.onLocalDilemmaTriggered, this);
        this.container?.destroy();
    }
}
