import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { DEPTH, TILE_IDS } from "../config/Constants";
import type { GridPosition, PlayerControls } from "../types/interfaces";
import { GridUtils } from "../utils/GridUtils";
import { EventBus } from "../EventBus";

/**
 * PlayerManager - Moves between nodes (odd grid positions) via links
 * Movement jumps 2 grid cells at a time, checking for passage between nodes
 */
export class PlayerManager {
    private scene: Scene;
    private sprite?: Phaser.GameObjects.Sprite;
    private controls!: PlayerControls;
    private gridX: number;
    private gridY: number;
    private lastDirection: { x: number; y: number } = { x: 0, y: 1 };
    private collisionGrid: number[][] = [];
    private mazeWidth: number = 0;
    private mazeHeight: number = 0;
    private exitPosition: GridPosition = { x: 0, y: 0 };
    private projection: "topdown" | "isometric";
    private isoOffset: { x: number; y: number };
    private isoOffsetProvided: boolean;
    private canMove: boolean = true;
    private moveDelay: number = 150; // ms between node-to-node movement
    private doorStates: Map<string, boolean> = new Map();

    private handleDoorToggle = (data: { x: number; y: number; isOpen: boolean }): void => {
        this.updateDoorCollision(data.x, data.y, data.isOpen);
    };

    constructor(
        scene: Scene,
        spawn: GridPosition,
        options: { projection?: "topdown" | "isometric"; isoOffset?: { x: number; y: number } } = {}
    ) {
        this.scene = scene;
        this.gridX = spawn.x;
        this.gridY = spawn.y;
        this.projection = options.projection ?? "topdown";
        this.isoOffsetProvided = !!options.isoOffset;
        this.isoOffset = options.isoOffset ?? { x: 0, y: 0 };
        this.initializeControls();
        this.createSprite();
        this.setupEventListeners();
    }

    /**
     * Set collision data from maze
     */
    setCollisionData(grid: number[][], width: number, height: number, exitPos: GridPosition): void {
        this.collisionGrid = grid;
        this.mazeWidth = width;
        this.mazeHeight = height;
        this.exitPosition = exitPos;
        if (this.projection === "isometric" && !this.isoOffsetProvided) {
            this.isoOffset = GridUtils.getIsometricOffset(width, height);
        }
    }

    /**
     * Initialize keyboard controls for explorer (ZQSD)
     */
    private initializeControls(): void {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        this.controls = {
            up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
            down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
            right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
    }

    /**
     * Create the player sprite
     */
    private createSprite(): void {
        const screenPos = this.toScreen(this.gridX, this.gridY);

        // Create sprite
        this.sprite = this.scene.add.sprite(
            screenPos.x,
            screenPos.y,
            "explorer"
        );

        // If texture doesn't exist, create a colored shape
        if (!this.scene.textures.exists("explorer")) {
            const size = GameConfig.TILE_SIZE * 0.6;
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(GameConfig.COLORS.EXPLORER, 1);
            graphics.fillRoundedRect(0, 0, size, size, 6);
            graphics.lineStyle(3, 0xffffff, 1);
            graphics.strokeRoundedRect(0, 0, size, size, 6);
            graphics.generateTexture("explorer", size, size);
            graphics.destroy();

            this.sprite.setTexture("explorer");
        }

        this.sprite.setOrigin(0.5, 0.5);
        this.sprite.setDepth(DEPTH.PLAYER);
    }

    /**
     * Update method called each frame
     */
    update(): void {
        if (!this.canMove) return;

        this.handleMovement();
        this.checkExit();

        if (this.sprite) {
            this.sprite.setDepth(this.sprite.y + DEPTH.PLAYER);
        }
    }

    /**
     * Handle node-to-node movement (jumps 2 grid positions)
     */
    private handleMovement(): void {
        let dx = 0;
        let dy = 0;

        // Check input direction
        if (Phaser.Input.Keyboard.JustDown(this.controls.up)) {
            dy = -2; // Move to node above (2 cells up)
            this.lastDirection = { x: 0, y: -1 };
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.down)) {
            dy = 2; // Move to node below (2 cells down)
            this.lastDirection = { x: 0, y: 1 };
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.left)) {
            dx = -2; // Move to node left (2 cells left)
            this.lastDirection = { x: -1, y: 0 };
        } else if (Phaser.Input.Keyboard.JustDown(this.controls.right)) {
            dx = 2; // Move to node right (2 cells right)
            this.lastDirection = { x: 1, y: 0 };
        }

        if (dx !== 0 || dy !== 0) {
            const targetX = this.gridX + dx;
            const targetY = this.gridY + dy;

            // Check if we can move to the target node
            if (this.canMoveToNode(this.gridX, this.gridY, targetX, targetY)) {
                this.moveToNode(targetX, targetY);
            }
        }
    }

    /**
     * Check if movement from current node to target node is possible
     */
    private canMoveToNode(fromX: number, fromY: number, toX: number, toY: number): boolean {
        // Check bounds
        if (toX < 0 || toX >= this.mazeWidth || toY < 0 || toY >= this.mazeHeight) {
            return false;
        }

        // Check if target is a valid node position (odd coordinates)
        if (toX % 2 !== 1 || toY % 2 !== 1) {
            return false;
        }

        // Check the passage between the two nodes
        const passageX = (fromX + toX) / 2;
        const passageY = (fromY + toY) / 2;

        return this.isPassageOpen(passageX, passageY);
    }

    /**
     * Check if a passage (between nodes) is open
     */
    private isPassageOpen(x: number, y: number): boolean {
        if (x < 0 || x >= this.mazeWidth || y < 0 || y >= this.mazeHeight) {
            return false;
        }

        const tile = this.collisionGrid[y]?.[x];

        if (tile === undefined || tile === TILE_IDS.WALL) {
            return false;
        }

        // Check door state
        if (tile === TILE_IDS.DOOR) {
            const key = GridUtils.positionKey({ x, y });
            return this.doorStates.get(key) ?? false;
        }

        return true;
    }

    /**
     * Move to a target node with animation
     */
    private moveToNode(targetX: number, targetY: number): void {
        this.canMove = false;
        this.gridX = targetX;
        this.gridY = targetY;

        const screenPos = this.toScreen(targetX, targetY);

        // Animate movement
        this.scene.tweens.add({
            targets: this.sprite,
            x: screenPos.x,
            y: screenPos.y,
            duration: this.moveDelay,
            ease: "Power2",
            onComplete: () => {
                this.canMove = true;
                EventBus.emit("explorer-moved", this.getGridPosition());
            }
        });
    }

    /**
     * Check if player reached exit
     */
    private checkExit(): void {
        if (this.gridX === this.exitPosition.x && this.gridY === this.exitPosition.y) {
            EventBus.emit("explorer-reached-exit");
        }
    }

    /**
     * Update collision for a door (called when door state changes)
     */
    updateDoorCollision(x: number, y: number, isOpen: boolean): void {
        const key = GridUtils.positionKey({ x, y });
        this.doorStates.set(key, isOpen);
    }

    /**
     * Get current grid position
     */
    getGridPosition(): GridPosition {
        return { x: this.gridX, y: this.gridY };
    }

    /**
     * Get screen position
     */
    getScreenPosition(): { x: number; y: number } {
        if (this.sprite) {
            return { x: this.sprite.x, y: this.sprite.y };
        }
        return this.toScreen(this.gridX, this.gridY);
    }

    /**
     * Get the player sprite
     */
    getSprite(): Phaser.GameObjects.Sprite | undefined {
        return this.sprite;
    }

    /**
     * Get last movement direction
     */
    getLastDirection(): { x: number; y: number } {
        return this.lastDirection;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.sprite?.destroy();
        EventBus.off("door-toggle", this.handleDoorToggle);
    }

    private toScreen(x: number, y: number): { x: number; y: number } {
        if (this.projection === "isometric") {
            return GridUtils.gridToIsometricScreen(x, y, this.isoOffset);
        }
        return GridUtils.gridToScreen(x, y);
    }

    private setupEventListeners(): void {
        EventBus.on("door-toggle", this.handleDoorToggle);
    }
}
