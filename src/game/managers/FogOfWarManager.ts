import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { TILE_IDS, DEPTH } from "../config/Constants";
import type { GridPosition, MazeData } from "../types/interfaces";
import { GridUtils } from "../utils/GridUtils";
import { EventBus } from "../EventBus";

/**
 * FogOfWarManager - Creates fog only for nodes (odd grid positions)
 * Vision is calculated based on connected nodes via passages
 * Nodes outside vision range are completely hidden (not semi-transparent)
 */
export class FogOfWarManager {
    private scene: Scene;
    private mazeData: MazeData;
    private fogTiles: Map<string, Phaser.GameObjects.Rectangle> = new Map();
    private visibleNodes: Set<string> = new Set();
    private explorerPosition: GridPosition;
    private projection: "topdown" | "isometric";
    private isoOffset: { x: number; y: number };

    constructor(
        scene: Scene,
        mazeData: MazeData,
        explorerSpawn: GridPosition,
        options: { projection?: "topdown" | "isometric"; isoOffset?: { x: number; y: number } } = {}
    ) {
        this.scene = scene;
        this.mazeData = mazeData;
        this.explorerPosition = explorerSpawn;
        this.projection = options.projection ?? "topdown";
        this.isoOffset =
            options.isoOffset ??
            (this.projection === "isometric"
                ? GridUtils.getIsometricOffset(mazeData.width, mazeData.height)
                : { x: 0, y: 0 });
        this.createFogLayer();
        this.setupEventListeners();
        this.updateVisibility();
    }

    /**
     * Create fog tiles only for node positions (odd coordinates)
     */
    private createFogLayer(): void {
        const { width, height } = this.mazeData;
        const nodeSize = GameConfig.TILE_SIZE * 0.9;
        const fogHeight = nodeSize * (this.projection === "isometric" ? GameConfig.ISO_VERTICAL_SCALE : 1);

        // Only create fog for nodes (odd positions)
        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const screenPos = this.toScreen(x, y);
                const key = GridUtils.positionKey({ x, y });

                const fogTile = this.scene.add.rectangle(
                    screenPos.x,
                    screenPos.y,
                    nodeSize,
                    fogHeight,
                    GameConfig.COLORS.FOG,
                    0.95
                );
                fogTile.setDepth(DEPTH.FOG);

                this.fogTiles.set(key, fogTile);
            }
        }
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        EventBus.on("explorer-moved", (position: GridPosition) => {
            this.explorerPosition = position;
            this.updateVisibility();
        });
    }

    /**
     * Update visibility based on explorer position
     */
    updateVisibility(): void {
        const previousVisible = new Set(this.visibleNodes);
        this.visibleNodes.clear();

        // Calculate visible nodes using BFS through connected passages
        this.calculateVisibility();

        // Update fog tile visuals and emit events
        this.updateFogVisuals(previousVisible);
    }

    /**
     * Calculate visible nodes using BFS from player position
     * Visibility spreads through connected passages up to vision radius
     */
    private calculateVisibility(): void {
        const { x: playerX, y: playerY } = this.explorerPosition;
        const visionRadius = GameConfig.EXPLORER_VISION_RADIUS;

        // BFS to find all visible nodes within radius
        const queue: { x: number; y: number; dist: number }[] = [{ x: playerX, y: playerY, dist: 0 }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            const key = GridUtils.positionKey({ x: current.x, y: current.y });

            if (visited.has(key)) continue;
            visited.add(key);

            // Mark as visible
            this.visibleNodes.add(key);

            // Stop expanding if at max radius
            if (current.dist >= visionRadius) continue;

            // Check adjacent nodes (2 cells away)
            const directions = [
                { dx: 2, dy: 0 },
                { dx: -2, dy: 0 },
                { dx: 0, dy: 2 },
                { dx: 0, dy: -2 },
            ];

            for (const dir of directions) {
                const nextX = current.x + dir.dx;
                const nextY = current.y + dir.dy;
                const nextKey = GridUtils.positionKey({ x: nextX, y: nextY });

                if (visited.has(nextKey)) continue;

                // Check if there's a passage between nodes
                if (this.hasPassageBetween(current.x, current.y, nextX, nextY)) {
                    queue.push({ x: nextX, y: nextY, dist: current.dist + 1 });
                }
            }
        }
    }

    /**
     * Check if there's a passage between two adjacent nodes
     */
    private hasPassageBetween(x1: number, y1: number, x2: number, y2: number): boolean {
        const { grid, width, height } = this.mazeData;

        // Check bounds
        if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) {
            return false;
        }

        // Calculate passage position
        const passageX = (x1 + x2) / 2;
        const passageY = (y1 + y2) / 2;

        const tile = grid[passageY]?.[passageX];

        // Wall = no passage
        return tile !== undefined && tile !== TILE_IDS.WALL;
    }

    /**
     * Update fog tile visuals based on visibility
     * Nodes are either fully visible or completely hidden
     */
    private updateFogVisuals(previousVisible: Set<string>): void {
        this.fogTiles.forEach((fogTile, key) => {
            const isVisible = this.visibleNodes.has(key);
            const wasVisible = previousVisible.has(key);

            // Parse position from key
            const [xStr, yStr] = key.split(',');
            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);

            if (isVisible) {
                // Currently visible - fully transparent fog
                if (!wasVisible) {
                    this.scene.tweens.add({
                        targets: fogTile,
                        alpha: 0,
                        duration: 150,
                        ease: "Power2",
                    });
                    // Emit visibility event for MapManager
                    EventBus.emit("node-visibility-changed", { x, y, isVisible: true });
                } else {
                    fogTile.setAlpha(0);
                }
            } else {
                // Not visible - fully opaque fog (completely hidden)
                if (wasVisible) {
                    this.scene.tweens.add({
                        targets: fogTile,
                        alpha: 0.95,
                        duration: 200,
                        ease: "Power2",
                    });
                    // Emit visibility event for MapManager
                    EventBus.emit("node-visibility-changed", { x, y, isVisible: false });
                } else {
                    fogTile.setAlpha(0.95);
                }
            }
        });
    }

    /**
     * Check if a node is currently visible
     */
    isNodeVisible(x: number, y: number): boolean {
        const key = GridUtils.positionKey({ x, y });
        return this.visibleNodes.has(key);
    }

    /**
     * Apply initial visibility to all nodes (called after map render)
     * Emits events for MapManager to update node/link visibility
     */
    applyInitialVisibility(): void {
        const { width, height } = this.mazeData;

        // Emit visibility events for all nodes
        for (let y = 1; y < height; y += 2) {
            for (let x = 1; x < width; x += 2) {
                const isVisible = this.isNodeVisible(x, y);
                EventBus.emit("node-visibility-changed", { x, y, isVisible });
            }
        }
    }

    /**
     * Get all fog tiles
     */
    getFogTiles(): Phaser.GameObjects.Rectangle[] {
        return Array.from(this.fogTiles.values());
    }

    /**
     * Cleanup
     */
    destroy(): void {
        EventBus.off("explorer-moved");
        this.fogTiles.forEach((tile) => tile.destroy());
        this.fogTiles.clear();
    }

    private toScreen(x: number, y: number): { x: number; y: number } {
        if (this.projection === "isometric") {
            return GridUtils.gridToIsometricScreen(x, y, this.isoOffset);
        }
        return GridUtils.gridToScreen(x, y);
    }
}
