import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { TILE_IDS, DEPTH } from "../config/Constants";
import type { MazeData } from "../types/interfaces";
import { GridUtils } from "../utils/GridUtils";
import { EventBus } from "../EventBus";
import type { FogOfWarManager } from "./FogOfWarManager";

export interface MapManagerOptions {
    hideLevers?: boolean;
    doorsAsWalls?: boolean;
    hideExitGlow?: boolean;
    projection?: "topdown" | "isometric";
    isoOffset?: { x: number; y: number };
}

/**
 * MapManager - Renders maze as a network/graph of nodes connected by links
 * Only cells at odd coordinates (1,1), (1,3), (3,1), etc. are rendered as nodes
 * Links are drawn between adjacent nodes when there's a passage (no wall) between them
 */
export class MapManager {
    private scene: Scene;
    private mazeData: MazeData;
    private nodeSprites: Map<string, Phaser.GameObjects.Shape> = new Map();
    private linkGraphics?: Phaser.GameObjects.Graphics;
    private doorStates: Map<string, boolean> = new Map();
    private options: MapManagerOptions;
    private projection: "topdown" | "isometric";
    private isoOffset: { x: number; y: number };
    private fogManager?: FogOfWarManager;

    constructor(scene: Scene, mazeData: MazeData, options: MapManagerOptions = {}) {
        this.scene = scene;
        this.mazeData = mazeData;
        this.options = {
            hideLevers: false,
            doorsAsWalls: false,
            hideExitGlow: false,
            projection: "topdown",
            isoOffset: { x: 0, y: 0 },
            ...options,
        };

        this.projection = this.options.projection ?? "topdown";
        this.isoOffset =
            this.options.isoOffset ??
            (this.projection === "isometric"
                ? GridUtils.getIsometricOffset(mazeData.width, mazeData.height)
                : { x: 0, y: 0 });

        this.setupEventListeners();
    }

    /**
     * Set the fog of war manager for visibility-based rendering
     */
    setFogManager(fogManager: FogOfWarManager): void {
        this.fogManager = fogManager;
    }

    render(): void {
        // First draw all links (behind nodes)
        this.drawAllLinks();

        // Then render nodes on top
        this.renderAllNodes();

        // Render exit glow (unless hidden)
        if (!this.options.hideExitGlow) {
            this.renderExit();
        }
    }

    /**
     * Check if a position is a "node" (cell at odd coordinates)
     */
    private isNodePosition(x: number, y: number): boolean {
        return x % 2 === 1 && y % 2 === 1;
    }

    /**
     * Check if there's a passage between two adjacent nodes
     */
    private hasPassageBetween(x1: number, y1: number, x2: number, y2: number): boolean {
        const { grid } = this.mazeData;

        // Calculate the position of the passage between the two nodes
        const passageX = (x1 + x2) / 2;
        const passageY = (y1 + y2) / 2;

        // Check if the passage is walkable
        const passageTile = grid[passageY]?.[passageX];

        if (passageTile === undefined) return false;

        // If it's a door, check door state
        if (passageTile === TILE_IDS.DOOR) {
            const key = GridUtils.positionKey({ x: passageX, y: passageY });
            return this.doorStates.get(key) ?? false;
        }

        // Wall = no passage, anything else = passage exists
        return passageTile !== TILE_IDS.WALL;
    }

    /**
     * Check if a link between two nodes should be visible
     */
    private isLinkVisible(x1: number, y1: number, x2: number, y2: number): boolean {
        if (!this.fogManager) return true;

        // Link is visible if at least one of the nodes is currently visible
        return this.fogManager.isNodeVisible(x1, y1) || this.fogManager.isNodeVisible(x2, y2);
    }

    /**
     * Draw all links between connected nodes
     */
    private drawAllLinks(): void {
        this.linkGraphics?.destroy();
        this.linkGraphics = this.scene.add.graphics();
        this.linkGraphics.setDepth(DEPTH.FLOOR - 1);

        const { grid, width, height } = this.mazeData;

        // Iterate through all node positions (odd coordinates)
        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const tile = grid[y][x];

                // Skip if this position is a wall (shouldn't happen for odd positions)
                if (tile === TILE_IDS.WALL) continue;

                // Check link to the right node (x+2, y)
                if (x + 2 < width && this.hasPassageBetween(x, y, x + 2, y)) {
                    if (this.isLinkVisible(x, y, x + 2, y)) {
                        this.drawLink(x, y, x + 2, y);
                    }
                }

                // Check link to the bottom node (x, y+2)
                if (y + 2 < height && this.hasPassageBetween(x, y, x, y + 2)) {
                    if (this.isLinkVisible(x, y, x, y + 2)) {
                        this.drawLink(x, y, x, y + 2);
                    }
                }
            }
        }
    }

    /**
     * Render all nodes (cells at odd coordinates)
     */
    private renderAllNodes(): void {
        const { grid, width, height } = this.mazeData;

        // Iterate through all node positions (odd coordinates)
        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const tileType = grid[y][x];

                // Skip walls (shouldn't happen at odd positions in a proper maze)
                if (tileType === TILE_IDS.WALL) continue;

                this.renderNode(x, y, tileType);
            }
        }
    }

    /**
     * Render a single node
     */
    private renderNode(x: number, y: number, tileType: number): void {
        const screenPos = this.toScreen(x, y);
        const key = GridUtils.positionKey({ x, y });

        // Handle levers for Explorer (hide them)
        if (tileType === TILE_IDS.LEVER && this.options.hideLevers) {
            tileType = TILE_IDS.FLOOR;
        }

        // Determine node color based on tile type
        let color: number = GameConfig.COLORS.FLOOR;

        switch (tileType) {
            case TILE_IDS.EXIT:
                color = GameConfig.COLORS.EXIT;
                break;
            case TILE_IDS.LEVER:
                color = GameConfig.COLORS.FLOOR;
                break;
            case TILE_IDS.DOOR:
                // Doors at node positions (shouldn't happen often)
                color = this.options.doorsAsWalls
                    ? GameConfig.COLORS.WALL
                    : GameConfig.COLORS.DOOR_CLOSED;
                break;
            default:
                color = GameConfig.COLORS.FLOOR;
        }

        // Create node shape
        const nodeSize = GameConfig.TILE_SIZE * 0.8;
        const depth = this.getTileDepth(tileType, screenPos.y);

        const node = this.scene.add.rectangle(
            screenPos.x,
            screenPos.y,
            nodeSize,
            nodeSize * (this.projection === "isometric" ? GameConfig.ISO_VERTICAL_SCALE : 1),
            color
        );
        node.setDepth(depth);
        node.setStrokeStyle(2, 0x4a6fa5);

        // Initially hide if fog manager exists (fog will control visibility)
        if (this.fogManager) {
            node.setAlpha(0);
        }

        this.nodeSprites.set(key, node);

        // Add lever indicator if needed
        if (tileType === TILE_IDS.LEVER && !this.options.hideLevers) {
            const indicator = this.scene.add.circle(
                screenPos.x,
                screenPos.y,
                nodeSize * 0.25,
                GameConfig.COLORS.LEVER_OFF
            );
            indicator.setDepth(depth + 1);
            if (this.fogManager) {
                indicator.setAlpha(0);
            }
            this.nodeSprites.set(`${key}_indicator`, indicator);
        }
    }

    /**
     * Draw a link between two nodes
     */
    private drawLink(x1: number, y1: number, x2: number, y2: number): void {
        if (!this.linkGraphics) return;

        const p1 = this.toScreen(x1, y1);
        const p2 = this.toScreen(x2, y2);

        // Draw the link line
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
     * Render exit with glow effect
     */
    private renderExit(): void {
        const { exitPosition } = this.mazeData;
        const screenPos = this.toScreen(exitPosition.x, exitPosition.y);
        const key = `exit_glow`;

        const glowRadius = GameConfig.TILE_SIZE * 0.6;

        const glow = this.scene.add.circle(
            screenPos.x,
            screenPos.y,
            glowRadius,
            GameConfig.COLORS.EXIT,
            0.3
        );

        glow.setDepth(DEPTH.EXIT - 1);

        // Initially hide if fog manager exists
        if (this.fogManager) {
            glow.setAlpha(0);
        }

        this.nodeSprites.set(key, glow);

        this.scene.tweens.add({
            targets: glow,
            scale: 1.5,
            alpha: this.fogManager ? 0 : 0.1,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    /**
     * Update node visibility based on fog of war
     */
    updateNodeVisibility(x: number, y: number, isVisible: boolean): void {
        const key = GridUtils.positionKey({ x, y });
        const node = this.nodeSprites.get(key);

        if (node) {
            this.scene.tweens.add({
                targets: node,
                alpha: isVisible ? 1 : 0,
                duration: 150,
                ease: "Power2",
            });
        }

        // Also update indicator if exists
        const indicator = this.nodeSprites.get(`${key}_indicator`);
        if (indicator) {
            this.scene.tweens.add({
                targets: indicator,
                alpha: isVisible ? 1 : 0,
                duration: 150,
                ease: "Power2",
            });
        }

        // Update exit glow
        const { exitPosition } = this.mazeData;
        if (x === exitPosition.x && y === exitPosition.y) {
            const exitGlow = this.nodeSprites.get('exit_glow');
            if (exitGlow) {
                this.scene.tweens.add({
                    targets: exitGlow,
                    alpha: isVisible ? 0.3 : 0,
                    duration: 150,
                    ease: "Power2",
                });
            }
        }

        // Redraw links when visibility changes
        this.drawAllLinks();
    }

    private toScreen(x: number, y: number): { x: number; y: number } {
        return this.projection === "isometric"
            ? GridUtils.gridToIsometricScreen(x, y, this.isoOffset)
            : GridUtils.gridToScreen(x, y);
    }

    private getTileDepth(tileType: number, screenY: number): number {
        if (this.projection === "isometric") {
            let offset: number = DEPTH.FLOOR;
            if (tileType === TILE_IDS.WALL) offset = DEPTH.WALL;
            else if (tileType === TILE_IDS.DOOR) offset = DEPTH.DOOR;
            return screenY + offset;
        }

        return tileType === TILE_IDS.DOOR
            ? DEPTH.DOOR
            : DEPTH.FLOOR;
    }

    private setupEventListeners(): void {
        EventBus.on("door-toggle", (data: { x: number; y: number; isOpen: boolean }) => {
            this.updateDoorState(data.x, data.y, data.isOpen);
        });

        EventBus.on("lever-toggle", (data: { x: number; y: number; isActive: boolean }) => {
            if (!this.options.hideLevers) {
                this.updateLeverVisual(data.x, data.y, data.isActive);
            }
        });

        // Listen for visibility updates from fog manager
        EventBus.on("node-visibility-changed", (data: { x: number; y: number; isVisible: boolean }) => {
            this.updateNodeVisibility(data.x, data.y, data.isVisible);
        });
    }

    /**
     * Update door state and redraw links
     */
    private updateDoorState(x: number, y: number, isOpen: boolean): void {
        const key = GridUtils.positionKey({ x, y });
        this.doorStates.set(key, isOpen);

        // Redraw all links to reflect new door state
        this.drawAllLinks();
    }

    private updateLeverVisual(x: number, y: number, isActive: boolean): void {
        const key = GridUtils.positionKey({ x, y });
        const indicator = this.nodeSprites.get(`${key}_indicator`);

        if (indicator) {
            (indicator as Phaser.GameObjects.Arc).setFillStyle(
                isActive
                    ? GameConfig.COLORS.LEVER_ON
                    : GameConfig.COLORS.LEVER_OFF
            );
        }
    }

    /**
     * Check if a position is walkable (for PlayerManager)
     */
    isWalkable(x: number, y: number): boolean {
        const { grid, width, height } = this.mazeData;

        if (x < 0 || x >= width || y < 0 || y >= height) return false;

        const tile = grid[y][x];

        if (tile === TILE_IDS.WALL) return false;

        if (tile === TILE_IDS.DOOR) {
            const key = GridUtils.positionKey({ x, y });
            return this.doorStates.get(key) ?? false;
        }

        return true;
    }

    /**
     * Check if there's a valid path from one node to an adjacent node
     */
    canMoveBetweenNodes(fromX: number, fromY: number, toX: number, toY: number): boolean {
        // Check if both positions are valid nodes
        if (!this.isNodePosition(fromX, fromY) || !this.isNodePosition(toX, toY)) {
            return false;
        }

        // Check if they are adjacent (distance of 2 in grid)
        const dx = Math.abs(toX - fromX);
        const dy = Math.abs(toY - fromY);

        if (!((dx === 2 && dy === 0) || (dx === 0 && dy === 2))) {
            return false;
        }

        return this.hasPassageBetween(fromX, fromY, toX, toY);
    }

    destroy(): void {
        EventBus.off("door-toggle");
        EventBus.off("lever-toggle");
        EventBus.off("node-visibility-changed");
        this.nodeSprites.forEach((sprite) => sprite.destroy());
        this.nodeSprites.clear();
        this.linkGraphics?.destroy();
    }
}
