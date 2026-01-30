import { Scene } from "phaser";
import { GameConfig } from "./GameConfig";

/**
 * Cyberpunk color palette used across all screens
 */
export const CYBER_COLORS = {
    // Hex values for Phaser graphics
    CYAN: 0x00d4aa,
    CYAN_DARK: 0x008b72,
    RED: 0xff3366,
    RED_DARK: 0xcc0033,
    ORANGE: 0xff9933,
    PURPLE: 0x9933ff,
    GREEN: 0x00ff88,
    YELLOW: 0xffcc00,
    BG_PANEL: 0x0a1628,
    BG_DARK: 0x000408,
    GRID: 0x00d4aa,

    // String values for text
    TEXT_CYAN: "#00d4aa",
    TEXT_RED: "#ff3366",
    TEXT_ORANGE: "#ff9933",
    TEXT_GREEN: "#00ff88",
    TEXT_YELLOW: "#ffcc00",
    TEXT_WHITE: "#ffffff",
    TEXT_GRAY: "#666688",
    TEXT_DARK_GRAY: "#444466",
};

/**
 * Common text styles
 */
export const CYBER_TEXT_STYLES = {
    title: {
        fontFamily: "Courier New, monospace",
        fontSize: "48px",
        color: CYBER_COLORS.TEXT_CYAN,
    },
    subtitle: {
        fontFamily: "Courier New, monospace",
        fontSize: "24px",
        color: CYBER_COLORS.TEXT_WHITE,
    },
    button: {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: CYBER_COLORS.TEXT_WHITE,
    },
    label: {
        fontFamily: "Courier New, monospace",
        fontSize: "14px",
        color: CYBER_COLORS.TEXT_GRAY,
    },
    small: {
        fontFamily: "Courier New, monospace",
        fontSize: "12px",
        color: CYBER_COLORS.TEXT_CYAN,
    },
};

/**
 * Utility class for creating cyberpunk-style UI elements
 */
export class CyberUI {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Create cyber grid background
     */
    createCyberGrid(alpha: number = 0.05): Phaser.GameObjects.Graphics {
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(1, CYBER_COLORS.GRID, alpha);

        for (let x = 0; x < GameConfig.SCREEN_WIDTH; x += 50) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, GameConfig.SCREEN_HEIGHT);
        }

        for (let y = 0; y < GameConfig.SCREEN_HEIGHT; y += 50) {
            graphics.moveTo(0, y);
            graphics.lineTo(GameConfig.SCREEN_WIDTH, y);
        }

        graphics.strokePath();
        return graphics;
    }

    /**
     * Create scanning line effect
     */
    createScanLine(): Phaser.GameObjects.Graphics {
        const scanLine = this.scene.add.graphics();
        scanLine.fillStyle(CYBER_COLORS.CYAN, 0.1);
        scanLine.fillRect(0, 0, GameConfig.SCREEN_WIDTH, 3);

        this.scene.tweens.add({
            targets: scanLine,
            y: { from: 0, to: GameConfig.SCREEN_HEIGHT },
            duration: 3000,
            repeat: -1,
            ease: "Linear",
        });

        return scanLine;
    }

    /**
     * Create data stream effect
     */
    createDataStreams(container?: Phaser.GameObjects.Container, count: number = 6): void {
        for (let i = 0; i < count; i++) {
            const x = 80 + i * Math.floor(GameConfig.SCREEN_WIDTH / count);
            const streamGraphics = this.scene.add.graphics();
            streamGraphics.fillStyle(CYBER_COLORS.CYAN, 0.08);

            for (let j = 0; j < 15; j++) {
                const y = Math.random() * GameConfig.SCREEN_HEIGHT;
                const height = 10 + Math.random() * 25;
                streamGraphics.fillRect(x, y, 2, height);
            }

            if (container) {
                container.add(streamGraphics);
            }

            this.scene.tweens.add({
                targets: streamGraphics,
                y: 80,
                alpha: { from: 0.2, to: 0.05 },
                duration: 2000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    /**
     * Create a cyber-styled panel
     */
    createPanel(
        x: number,
        y: number,
        width: number,
        height: number,
        borderColor: number = CYBER_COLORS.CYAN
    ): Phaser.GameObjects.Graphics {
        const panel = this.scene.add.graphics();

        // Background
        panel.fillStyle(CYBER_COLORS.BG_PANEL, 0.95);
        panel.fillRect(x, y, width, height);

        // Border
        panel.lineStyle(2, borderColor, 0.8);
        panel.strokeRect(x, y, width, height);

        // Corner accents
        const cornerSize = 15;
        panel.lineStyle(3, borderColor, 1);

        // Top left
        panel.moveTo(x, y + cornerSize);
        panel.lineTo(x, y);
        panel.lineTo(x + cornerSize, y);

        // Top right
        panel.moveTo(x + width - cornerSize, y);
        panel.lineTo(x + width, y);
        panel.lineTo(x + width, y + cornerSize);

        // Bottom left
        panel.moveTo(x, y + height - cornerSize);
        panel.lineTo(x, y + height);
        panel.lineTo(x + cornerSize, y + height);

        // Bottom right
        panel.moveTo(x + width - cornerSize, y + height);
        panel.lineTo(x + width, y + height);
        panel.lineTo(x + width, y + height - cornerSize);

        panel.strokePath();

        return panel;
    }

    /**
     * Create a cyber-styled button
     */
    createButton(
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        color: number = CYBER_COLORS.CYAN,
        onClick: () => void
    ): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics } {
        const container = this.scene.add.container(x, y);

        // Glow effect
        const glow = this.scene.add.graphics();
        glow.fillStyle(color, 0.1);
        glow.fillRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8);
        container.add(glow);

        // Button background
        const bg = this.scene.add.graphics();
        bg.fillStyle(CYBER_COLORS.BG_PANEL, 0.95);
        bg.fillRect(-width / 2, -height / 2, width, height);
        bg.lineStyle(2, color, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);

        // Corner decorations
        const cornerSize = 10;
        bg.lineStyle(3, color, 1);
        bg.moveTo(-width / 2, -height / 2 + cornerSize);
        bg.lineTo(-width / 2, -height / 2);
        bg.lineTo(-width / 2 + cornerSize, -height / 2);
        bg.moveTo(width / 2 - cornerSize, -height / 2);
        bg.lineTo(width / 2, -height / 2);
        bg.lineTo(width / 2, -height / 2 + cornerSize);
        bg.moveTo(-width / 2, height / 2 - cornerSize);
        bg.lineTo(-width / 2, height / 2);
        bg.lineTo(-width / 2 + cornerSize, height / 2);
        bg.moveTo(width / 2 - cornerSize, height / 2);
        bg.lineTo(width / 2, height / 2);
        bg.lineTo(width / 2, height / 2 - cornerSize);
        bg.strokePath();
        container.add(bg);

        // Button text
        const textColor = color === CYBER_COLORS.RED ? CYBER_COLORS.TEXT_RED :
                         color === CYBER_COLORS.ORANGE ? CYBER_COLORS.TEXT_ORANGE :
                         color === CYBER_COLORS.GREEN ? CYBER_COLORS.TEXT_GREEN :
                         CYBER_COLORS.TEXT_CYAN;

        const buttonText = this.scene.add.text(0, 0, text, {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: textColor,
        }).setOrigin(0.5);
        container.add(buttonText);

        // Action indicator
        const actionText = this.scene.add.text(0, height / 2 - 12, "[ SÉLECTIONNER ]", {
            fontFamily: "Courier New, monospace",
            fontSize: "10px",
            color: textColor,
        }).setOrigin(0.5);
        actionText.setAlpha(0);
        container.add(actionText);

        // Hit area
        const hitArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        container.add(hitArea);

        // Hover effects
        hitArea.on("pointerover", () => {
            this.scene.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 150,
                ease: "Power2",
            });
            this.scene.tweens.add({
                targets: glow,
                alpha: 0.3,
                duration: 150,
            });
            actionText.setAlpha(0.7);
        });

        hitArea.on("pointerout", () => {
            this.scene.tweens.add({
                targets: container,
                scale: 1,
                duration: 150,
                ease: "Power2",
            });
            this.scene.tweens.add({
                targets: glow,
                alpha: 0.1,
                duration: 150,
            });
            actionText.setAlpha(0);
        });

        hitArea.on("pointerdown", () => {
            // Flash effect
            const flash = this.scene.add.graphics();
            flash.fillStyle(color, 0.5);
            flash.fillRect(-width / 2, -height / 2, width, height);
            container.add(flash);

            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 200,
                onComplete: () => flash.destroy(),
            });

            onClick();
        });

        // Subtle pulse on glow
        this.scene.tweens.add({
            targets: glow,
            alpha: { from: 0.1, to: 0.15 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });

        return { container, bg };
    }

    /**
     * Create alert bar at bottom of screen
     */
    createAlertBar(tickerText: string = "SYSTÈME INITIALISÉ"): Phaser.GameObjects.Container {
        const alertBar = this.scene.add.container(0, GameConfig.SCREEN_HEIGHT - 35);

        // Bar background
        const barBg = this.scene.add.graphics();
        barBg.fillStyle(0x0a0a14, 0.95);
        barBg.fillRect(0, 0, GameConfig.SCREEN_WIDTH, 35);
        barBg.lineStyle(1, CYBER_COLORS.CYAN, 0.3);
        barBg.moveTo(0, 0);
        barBg.lineTo(GameConfig.SCREEN_WIDTH, 0);
        barBg.strokePath();
        alertBar.add(barBg);

        // Alert button
        const alertBtnBg = this.scene.add.graphics();
        alertBtnBg.fillStyle(CYBER_COLORS.RED_DARK, 1);
        alertBtnBg.fillRect(10, 5, 80, 25);
        alertBtnBg.lineStyle(2, CYBER_COLORS.RED, 1);
        alertBtnBg.strokeRect(10, 5, 80, 25);
        alertBar.add(alertBtnBg);

        // Play icon
        const playIcon = this.scene.add.graphics();
        playIcon.fillStyle(CYBER_COLORS.RED, 1);
        playIcon.fillTriangle(20, 12, 20, 24, 32, 18);
        alertBar.add(playIcon);

        const alertText = this.scene.add.text(38, 17, "ALERT", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: CYBER_COLORS.TEXT_RED,
        }).setOrigin(0, 0.5);
        alertBar.add(alertText);

        // Pulsing alert
        this.scene.tweens.add({
            targets: [alertBtnBg, playIcon],
            alpha: { from: 1, to: 0.6 },
            duration: 500,
            yoyo: true,
            repeat: -1,
        });

        // Separator
        const tickerSep = this.scene.add.graphics();
        tickerSep.fillStyle(CYBER_COLORS.CYAN, 0.5);
        tickerSep.fillRect(100, 8, 2, 20);
        alertBar.add(tickerSep);

        // Ticker text
        const ticker = this.scene.add.text(120, 17, tickerText + "  ▓▓▓  " + tickerText + "  ▓▓▓  ", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: CYBER_COLORS.TEXT_CYAN,
        }).setOrigin(0, 0.5);
        alertBar.add(ticker);

        // Animate ticker
        const animateTicker = () => {
            const tickerWidth = ticker.width;
            this.scene.tweens.add({
                targets: ticker,
                x: -tickerWidth / 2,
                duration: 15000,
                ease: "Linear",
                onComplete: () => {
                    ticker.x = GameConfig.SCREEN_WIDTH;
                    animateTicker();
                },
            });
        };
        animateTicker();

        // LIVE indicator
        const liveBg = this.scene.add.graphics();
        liveBg.fillStyle(CYBER_COLORS.RED, 1);
        liveBg.fillCircle(GameConfig.SCREEN_WIDTH - 50, 17, 5);
        alertBar.add(liveBg);

        const liveText = this.scene.add.text(GameConfig.SCREEN_WIDTH - 40, 17, "LIVE", {
            fontFamily: "Courier New, monospace",
            fontSize: "11px",
            color: CYBER_COLORS.TEXT_RED,
        }).setOrigin(0, 0.5);
        alertBar.add(liveText);

        this.scene.tweens.add({
            targets: liveBg,
            alpha: { from: 1, to: 0.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
        });

        return alertBar;
    }

    /**
     * Create title with cyber styling
     */
    createTitle(x: number, y: number, text: string, color: string = CYBER_COLORS.TEXT_CYAN): Phaser.GameObjects.Container {
        const container = this.scene.add.container(x, y);

        const bracket1 = this.scene.add.text(-text.length * 12, 0, "<<", {
            fontFamily: "Courier New, monospace",
            fontSize: "36px",
            color: color,
        }).setOrigin(0.5);
        container.add(bracket1);

        const title = this.scene.add.text(0, 0, text, {
            fontFamily: "Courier New, monospace",
            fontSize: "42px",
            color: color,
        }).setOrigin(0.5);
        container.add(title);

        const bracket2 = this.scene.add.text(text.length * 12, 0, ">>", {
            fontFamily: "Courier New, monospace",
            fontSize: "36px",
            color: color,
        }).setOrigin(0.5);
        container.add(bracket2);

        // Flicker animation
        this.scene.tweens.add({
            targets: [title, bracket1, bracket2],
            alpha: { from: 1, to: 0.7 },
            duration: 150,
            yoyo: true,
            repeat: -1,
        });

        return container;
    }

    /**
     * Create flash screen effect
     */
    flashScreen(color: number = CYBER_COLORS.RED, alpha: number = 0.2): void {
        const flash = this.scene.add.rectangle(
            GameConfig.SCREEN_WIDTH / 2,
            GameConfig.SCREEN_HEIGHT / 2,
            GameConfig.SCREEN_WIDTH,
            GameConfig.SCREEN_HEIGHT,
            color,
            alpha
        );
        flash.setDepth(9999);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 150,
            repeat: 2,
            yoyo: true,
            onComplete: () => flash.destroy(),
        });
    }

    /**
     * Create hexagon frame decoration
     */
    createHexagonFrame(x: number, y: number, size: number = 80): Phaser.GameObjects.Container {
        const container = this.scene.add.container(x, y);

        const graphics = this.scene.add.graphics();

        // Outer hexagon
        graphics.lineStyle(2, CYBER_COLORS.CYAN, 0.6);
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const px = size * Math.cos(angle);
            const py = size * Math.sin(angle);
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.strokePath();

        // Inner hexagon
        graphics.lineStyle(1, CYBER_COLORS.CYAN, 0.3);
        graphics.beginPath();
        const innerSize = size * 0.75;
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 2;
            const px = innerSize * Math.cos(angle);
            const py = innerSize * Math.sin(angle);
            if (i === 0) {
                graphics.moveTo(px, py);
            } else {
                graphics.lineTo(px, py);
            }
        }
        graphics.closePath();
        graphics.strokePath();

        container.add(graphics);

        // Rotating arc
        const rotatingGraphics = this.scene.add.graphics();
        rotatingGraphics.lineStyle(3, CYBER_COLORS.CYAN, 0.8);
        rotatingGraphics.arc(0, 0, size + 10, 0, Math.PI / 2);
        rotatingGraphics.strokePath();
        container.add(rotatingGraphics);

        this.scene.tweens.add({
            targets: rotatingGraphics,
            angle: 360,
            duration: 4000,
            repeat: -1,
            ease: "Linear",
        });

        return container;
    }
}
