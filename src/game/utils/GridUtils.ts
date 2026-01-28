import { GameConfig } from "../config/GameConfig";
import type { GridPosition } from "../types/interfaces";

export class GridUtils {
    static gridToScreen(x: number, y: number) {
        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;
        return {
            x: x * step,
            y: y * step,
        };
    }

    static screenToGrid(screenX: number, screenY: number): GridPosition {
        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;
        return {
            x: Math.round(screenX / step),
            y: Math.round(screenY / step),
        };
    }

    static gridToIsometricScreen(
        x: number,
        y: number,
        offset: { x: number; y: number }
    ) {
        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;

        const isoX = (x - y) * (step / 2);
        const isoY = (x + y) * (step * GameConfig.ISO_VERTICAL_SCALE / 2);

        return {
            x: isoX + offset.x,
            y: isoY + offset.y,
        };
    }

    static screenToIsometricGrid(
        screenX: number,
        screenY: number,
        offset: { x: number; y: number }
    ): GridPosition {
        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;

        // Remove offset
        const relX = screenX - offset.x;
        const relY = screenY - offset.y;

        // Inverse isometric transformation
        const halfStep = step / 2;
        const isoYScale = (step * GameConfig.ISO_VERTICAL_SCALE) / 2;

        // Solve inverse:
        // isoX = (x - y) * halfStep  =>  x - y = isoX / halfStep
        // isoY = (x + y) * isoYScale =>  x + y = isoY / isoYScale
        const gridX = Math.round((relX / halfStep + relY / isoYScale) / 2);
        const gridY = Math.round((relY / isoYScale - relX / halfStep) / 2);

        return { x: gridX, y: gridY };
    }

    static positionsEqual(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
        return a.x === b.x && a.y === b.y;
    }


    static getIsometricBounds(width: number, height: number) {
        const step = GameConfig.TILE_SIZE + GameConfig.TILE_SPACING;

        const w = (width + height) * (step / 2);
        const h = (width + height) * (step * GameConfig.ISO_VERTICAL_SCALE / 2);

        return { width: w, height: h };
    }

    static getIsometricOffset(width: number, height: number) {
        const { width: w } = this.getIsometricBounds(width, height);
        return {
            x: w / 2,
            y: 0,
        };
    }

    static positionKey(pos: GridPosition): string {
        return `${pos.x},${pos.y}`;
    }

    static isInBounds(pos: GridPosition, width: number, height: number): boolean {
        return (
            pos.x >= 0 &&
            pos.y >= 0 &&
            pos.x < width &&
            pos.y < height
        );
    }

    static getAdjacentPositions(pos: GridPosition): GridPosition[] {
        return [
            { x: pos.x, y: pos.y - 1 }, // Up
            { x: pos.x, y: pos.y + 1 }, // Down
            { x: pos.x - 1, y: pos.y }, // Left
            { x: pos.x + 1, y: pos.y }, // Right
        ];
    }
}
