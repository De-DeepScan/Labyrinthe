import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { TILE_IDS, DEPTH } from "../config/Constants";
import { NetworkManager } from "../services/NetworkManager";
import type { MazeData, Door, Lever } from "../types/interfaces";
import { GridUtils } from "../utils/GridUtils";
import { EventBus } from "../EventBus";

export default class GuideGame extends Scene {
    private mazeData: MazeData | null = null;
    private networkManager!: NetworkManager;
    private nodeSprites: Map<string, Phaser.GameObjects.Shape> = new Map();
    private linkGraphics?: Phaser.GameObjects.Graphics;
    private leverSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
    private doors: Map<number, Door> = new Map();
    private levers: Map<number, Lever> = new Map();
    private doorStates: Map<string, boolean> = new Map();
    private cursor?: Phaser.GameObjects.Rectangle;
    private cursorX: number = 1;
    private cursorY: number = 1;
    private controls!: {
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
        action: Phaser.Input.Keyboard.Key;
    };
    private waitingText?: Phaser.GameObjects.Text;
    private isGameOver: boolean = false;

    constructor() {
        super("GuideGame");
    }

    create(): void {
        this.isGameOver = false;
        this.networkManager = NetworkManager.getInstance();

        // Setup controls
        this.setupControls();

        // Show waiting message
        this.showWaitingMessage();

        // Setup network events
        this.setupNetworkEvents();

        EventBus.emit("current-scene-ready", this);
    }

    private setupControls(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) return;

        this.controls = {
            up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            action: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
        };
    }

    private showWaitingMessage(): void {
        const centerX = GameConfig.SCREEN_WIDTH / 2;
        const centerY = GameConfig.SCREEN_HEIGHT / 2;

        this.add
            .text(centerX, centerY - 30, "GUIDE", {
                fontFamily: "Arial Black",
                fontSize: "48px",
                color: "#ffcc00",
            })
            .setOrigin(0.5);

        this.waitingText = this.add
            .text(centerX, centerY + 30, "En attente du labyrinthe...", {
                fontFamily: "Arial",
                fontSize: "24px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        this.tweens.add({
            targets: this.waitingText,
            alpha: 0.3,
            duration: 800,
            yoyo: true,
            repeat: -1,
        });
    }

    private setupNetworkEvents(): void {
        // Receive maze from explorer
        EventBus.on("network-maze-received", (mazeData: MazeData) => {
            this.mazeData = mazeData;
            this.initializeGame();
        });

        // Game won
        EventBus.on("network-game-won", () => {
            this.handleVictory();
        });

        // Game restart
        EventBus.on("network-game-restart", () => {
            this.restartGame();
        });
    }

    private initializeGame(): void {
        if (!this.mazeData) return;

        // Clear waiting message
        this.children.removeAll();

        // Initialize doors and levers from maze data
        this.mazeData.doors.forEach((door) => {
            this.doors.set(door.id, { ...door, isOpen: false });
            const key = GridUtils.positionKey({ x: door.x, y: door.y });
            this.doorStates.set(key, false);
        });

        this.mazeData.levers.forEach((lever) => {
            this.levers.set(lever.id, { ...lever, isActive: false });
        });

        // Render the maze as network/graph
        this.renderMaze();

        // Setup camera
        this.setupCamera();

        // Create cursor at first node position
        this.createCursor();
    }

    /**
     * Check if a position is a node (odd coordinates)
     */
    private isNodePosition(x: number, y: number): boolean {
        return x % 2 === 1 && y % 2 === 1;
    }

    /**
     * Check if there's a passage between two adjacent nodes
     */
    private hasPassageBetween(x1: number, y1: number, x2: number, y2: number): boolean {
        if (!this.mazeData) return false;
        const { grid, width, height } = this.mazeData;

        // Check bounds
        if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) {
            return false;
        }

        // Calculate passage position
        const passageX = (x1 + x2) / 2;
        const passageY = (y1 + y2) / 2;

        const tile = grid[passageY]?.[passageX];

        // If it's a door, check door state
        if (tile === TILE_IDS.DOOR) {
            const key = GridUtils.positionKey({ x: passageX, y: passageY });
            return this.doorStates.get(key) ?? false;
        }

        // Wall = no passage
        return tile !== undefined && tile !== TILE_IDS.WALL;
    }

    private renderMaze(): void {
        if (!this.mazeData) return;

        // Draw links first (behind nodes)
        this.drawAllLinks();

        // Then render nodes
        this.renderAllNodes();

        // Render exit glow
        this.renderExit();
    }

    /**
     * Draw all links between connected nodes
     */
    private drawAllLinks(): void {
        this.linkGraphics?.destroy();
        this.linkGraphics = this.add.graphics();
        this.linkGraphics.setDepth(DEPTH.FLOOR - 1);

        if (!this.mazeData) return;
        const { grid, width, height } = this.mazeData;

        // Iterate through all node positions (odd coordinates)
        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const tile = grid[y][x];
                if (tile === TILE_IDS.WALL) continue;

                // Check link to the right node (x+2, y)
                if (x + 2 < width && this.hasPassageBetween(x, y, x + 2, y)) {
                    this.drawLink(x, y, x + 2, y);
                }

                // Check link to the bottom node (x, y+2)
                if (y + 2 < height && this.hasPassageBetween(x, y, x, y + 2)) {
                    this.drawLink(x, y, x, y + 2);
                }
            }
        }
    }

    /**
     * Draw a link between two nodes
     */
    private drawLink(x1: number, y1: number, x2: number, y2: number): void {
        if (!this.linkGraphics) return;

        const p1 = GridUtils.gridToScreen(x1, y1);
        const p2 = GridUtils.gridToScreen(x2, y2);

        this.linkGraphics.lineStyle(
            GameConfig.LINK_STYLE.WIDTH,
            GameConfig.LINK_STYLE.COLOR,
            GameConfig.LINK_STYLE.ALPHA
        );

        this.linkGraphics.beginPath();
        this.linkGraphics.moveTo(p1.x, p1.y);
        this.linkGraphics.lineTo(p2.x, p2.y);
        this.linkGraphics.strokePath();

        // Draw small circles at connection points
        this.linkGraphics.fillStyle(
            GameConfig.LINK_STYLE.NODE_COLOR,
            GameConfig.LINK_STYLE.NODE_ALPHA
        );
        this.linkGraphics.fillCircle(p1.x, p1.y, GameConfig.LINK_STYLE.NODE_RADIUS);
        this.linkGraphics.fillCircle(p2.x, p2.y, GameConfig.LINK_STYLE.NODE_RADIUS);
    }

    /**
     * Render all nodes (cells at odd coordinates)
     */
    private renderAllNodes(): void {
        if (!this.mazeData) return;
        const { grid, width, height } = this.mazeData;

        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const tileType = grid[y][x];
                if (tileType === TILE_IDS.WALL) continue;

                this.renderNode(x, y, tileType);
            }
        }
    }

    /**
     * Render a single node
     */
    private renderNode(x: number, y: number, tileType: number): void {
        const screenPos = GridUtils.gridToScreen(x, y);
        const key = GridUtils.positionKey({ x, y });

        let color: number = GameConfig.COLORS.FLOOR;

        switch (tileType) {
            case TILE_IDS.EXIT:
                color = GameConfig.COLORS.EXIT;
                break;
            case TILE_IDS.LEVER:
                color = GameConfig.COLORS.FLOOR;
                break;
            default:
                color = GameConfig.COLORS.FLOOR;
        }

        const nodeSize = GameConfig.TILE_SIZE * 0.8;

        const node = this.add.rectangle(
            screenPos.x,
            screenPos.y,
            nodeSize,
            nodeSize,
            color
        );
        node.setDepth(DEPTH.FLOOR);
        node.setStrokeStyle(2, 0x4a6fa5);

        this.nodeSprites.set(key, node);

        // Add lever indicator if needed
        if (tileType === TILE_IDS.LEVER) {
            const indicator = this.add.circle(
                screenPos.x,
                screenPos.y,
                nodeSize * 0.25,
                GameConfig.COLORS.LEVER_OFF
            );
            indicator.setDepth(DEPTH.LEVER);
            this.leverSprites.set(key, indicator);
        }
    }

    private renderExit(): void {
        if (!this.mazeData) return;

        const { exitPosition } = this.mazeData;
        const screenPos = GridUtils.gridToScreen(exitPosition.x, exitPosition.y);

        const glow = this.add.circle(
            screenPos.x,
            screenPos.y,
            GameConfig.TILE_SIZE * 0.6,
            GameConfig.COLORS.EXIT,
            0.3
        );
        glow.setDepth(DEPTH.EXIT - 1);

        this.tweens.add({
            targets: glow,
            scale: 1.3,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    private setupCamera(): void {
        if (!this.mazeData) return;

        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;
        const mapWidth = this.mazeData.width * step;
        const mapHeight = this.mazeData.height * step;

        // Calculate zoom to fit entire maze with some padding
        const zoomX = GameConfig.SCREEN_WIDTH / mapWidth;
        const zoomY = GameConfig.SCREEN_HEIGHT / mapHeight;
        const zoom = Math.min(zoomX, zoomY) * 0.95;

        this.cameras.main.setZoom(zoom);
        this.cameras.main.setBounds(-step, -step, mapWidth + step * 2, mapHeight + step * 2);

        // Center on the middle of the maze
        const centerX = (this.mazeData.width - 1) * step / 2;
        const centerY = (this.mazeData.height - 1) * step / 2;
        this.cameras.main.centerOn(centerX, centerY);
        this.cameras.main.setBackgroundColor(0x0f0f1a);
    }

    private createCursor(): void {
        if (!this.mazeData) return;

        // Start at center node (ensure odd coordinates)
        this.cursorX = Math.floor(this.mazeData.width / 2);
        if (this.cursorX % 2 === 0) this.cursorX++;
        this.cursorY = Math.floor(this.mazeData.height / 2);
        if (this.cursorY % 2 === 0) this.cursorY++;

        const screenPos = GridUtils.gridToScreen(this.cursorX, this.cursorY);
        const nodeSize = GameConfig.TILE_SIZE * 0.9;

        this.cursor = this.add.rectangle(
            screenPos.x,
            screenPos.y,
            nodeSize,
            nodeSize
        );
        this.cursor.setStrokeStyle(3, GameConfig.COLORS.GUIDE_CURSOR);
        this.cursor.setFillStyle(GameConfig.COLORS.GUIDE_CURSOR, 0.2);
        this.cursor.setDepth(DEPTH.GUIDE_CURSOR);

        // Pulsing animation
        this.tweens.add({
            targets: this.cursor,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    update(_time: number, _delta: number): void {
        if (!this.mazeData || this.isGameOver) return;

        this.handleCursorMovement();
        this.handleAction();
    }

    private handleCursorMovement(): void {
        if (!this.mazeData) return;

        let dx = 0;
        let dy = 0;

        // Move by 2 cells (node to node)
        if (Phaser.Input.Keyboard.JustDown(this.controls.up)) dy = -2;
        else if (Phaser.Input.Keyboard.JustDown(this.controls.down)) dy = 2;
        else if (Phaser.Input.Keyboard.JustDown(this.controls.left)) dx = -2;
        else if (Phaser.Input.Keyboard.JustDown(this.controls.right)) dx = 2;

        if (dx !== 0 || dy !== 0) {
            const targetX = this.cursorX + dx;
            const targetY = this.cursorY + dy;

            // Check bounds (must be valid node position)
            if (
                targetX >= 1 &&
                targetX < this.mazeData.width &&
                targetY >= 1 &&
                targetY < this.mazeData.height &&
                this.isNodePosition(targetX, targetY)
            ) {
                this.cursorX = targetX;
                this.cursorY = targetY;
                this.updateCursorPosition();
            }
        }
    }

    private updateCursorPosition(): void {
        const screenPos = GridUtils.gridToScreen(this.cursorX, this.cursorY);

        if (this.cursor) {
            this.tweens.add({
                targets: this.cursor,
                x: screenPos.x,
                y: screenPos.y,
                duration: 80,
                ease: "Power2",
            });
        }
    }

    private handleAction(): void {
        if (Phaser.Input.Keyboard.JustDown(this.controls.action)) {
            this.activateLeverAt(this.cursorX, this.cursorY);
        }
    }

    private activateLeverAt(x: number, y: number): void {
        if (!this.mazeData) return;

        // Find lever at position
        for (const lever of this.levers.values()) {
            if (lever.x === x && lever.y === y) {
                this.toggleLever(lever);
                // Send to explorer
                this.networkManager.sendLeverActivation({ x, y });
                break;
            }
        }
    }

    private toggleLever(lever: Lever): void {
        lever.isActive = !lever.isActive;

        // Update visual
        const key = GridUtils.positionKey({ x: lever.x, y: lever.y });
        const indicator = this.leverSprites.get(key);
        if (indicator) {
            indicator.setFillStyle(
                lever.isActive ? GameConfig.COLORS.LEVER_ON : GameConfig.COLORS.LEVER_OFF
            );
        }

        // Visual feedback
        this.createActivationEffect(lever.x, lever.y);

        // Toggle linked doors
        lever.linkedDoorIds.forEach((doorId) => {
            this.toggleDoor(doorId);
        });
    }

    private toggleDoor(doorId: number): void {
        const door = this.doors.get(doorId);
        if (!door) return;

        door.isOpen = !door.isOpen;

        // Update door state
        const key = GridUtils.positionKey({ x: door.x, y: door.y });
        this.doorStates.set(key, door.isOpen);

        // Send door state to explorer
        this.networkManager.sendDoorStateChange({
            x: door.x,
            y: door.y,
            isOpen: door.isOpen,
        });

        // Redraw links to reflect new door state
        this.drawAllLinks();

        // Visual feedback
        this.createDoorEffect(door.x, door.y, door.isOpen);
    }

    private createActivationEffect(x: number, y: number): void {
        const screenPos = GridUtils.gridToScreen(x, y);

        const circle = this.add.circle(screenPos.x, screenPos.y, 10, 0x00ff00, 1);

        this.tweens.add({
            targets: circle,
            scale: 3,
            alpha: 0,
            duration: 300,
            ease: "Power2",
            onComplete: () => circle.destroy(),
        });
    }

    private createDoorEffect(x: number, y: number, isOpen: boolean): void {
        const screenPos = GridUtils.gridToScreen(x, y);
        const color = isOpen ? 0x00ff00 : 0xff0000;

        const rect = this.add.rectangle(screenPos.x, screenPos.y, 32, 32, color, 0.5);

        this.tweens.add({
            targets: rect,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            ease: "Power2",
            onComplete: () => rect.destroy(),
        });
    }

    private handleVictory(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.time.delayedCall(500, () => {
            this.cleanup();
            this.scene.start("Victory");
        });
    }

    private restartGame(): void {
        this.cleanup();
        this.scene.start("GuideGame");
    }

    private cleanup(): void {
        EventBus.off("network-maze-received");
        EventBus.off("network-game-won");
        EventBus.off("network-game-restart");
        this.nodeSprites.forEach((s) => s.destroy());
        this.leverSprites.forEach((s) => s.destroy());
        this.nodeSprites.clear();
        this.leverSprites.clear();
        this.doors.clear();
        this.levers.clear();
        this.doorStates.clear();
        this.linkGraphics?.destroy();
    }
}
