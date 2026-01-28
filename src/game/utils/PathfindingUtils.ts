import { TILE_IDS } from "../config/Constants";
import type { GridPosition } from "../types/interfaces";
import { GridUtils } from "./GridUtils";

export class PathfindingUtils {
    /**
     * Check if a path exists between start and end using BFS
     */
    static pathExists(
        grid: number[][],
        start: GridPosition,
        end: GridPosition,
        treatDoorsAsOpen: boolean = false
    ): boolean {
        const height = grid.length;
        const width = grid[0].length;

        const visited = new Set<string>();
        const queue: GridPosition[] = [start];
        visited.add(GridUtils.positionKey(start));

        while (queue.length > 0) {
            const current = queue.shift()!;

            if (GridUtils.positionsEqual(current, end)) {
                return true;
            }

            for (const neighbor of GridUtils.getAdjacentPositions(current)) {
                if (!GridUtils.isInBounds(neighbor, width, height)) continue;

                const key = GridUtils.positionKey(neighbor);
                if (visited.has(key)) continue;

                const tile = grid[neighbor.y][neighbor.x];

                // Check if walkable
                if (tile === TILE_IDS.WALL) continue;
                if (tile === TILE_IDS.DOOR && !treatDoorsAsOpen) continue;

                visited.add(key);
                queue.push(neighbor);
            }
        }

        return false;
    }

    /**
     * Find the shortest path using BFS
     */
    static findPath(
        grid: number[][],
        start: GridPosition,
        end: GridPosition,
        treatDoorsAsOpen: boolean = false
    ): GridPosition[] | null {
        const height = grid.length;
        const width = grid[0].length;

        const visited = new Set<string>();
        const queue: { pos: GridPosition; path: GridPosition[] }[] = [
            { pos: start, path: [start] },
        ];
        visited.add(GridUtils.positionKey(start));

        while (queue.length > 0) {
            const { pos: current, path } = queue.shift()!;

            if (GridUtils.positionsEqual(current, end)) {
                return path;
            }

            for (const neighbor of GridUtils.getAdjacentPositions(current)) {
                if (!GridUtils.isInBounds(neighbor, width, height)) continue;

                const key = GridUtils.positionKey(neighbor);
                if (visited.has(key)) continue;

                const tile = grid[neighbor.y][neighbor.x];

                if (tile === TILE_IDS.WALL) continue;
                if (tile === TILE_IDS.DOOR && !treatDoorsAsOpen) continue;

                visited.add(key);
                queue.push({ pos: neighbor, path: [...path, neighbor] });
            }
        }

        return null;
    }

    /**
     * Check if a position is reachable from start
     */
    static isReachable(
        grid: number[][],
        start: GridPosition,
        target: GridPosition,
        treatDoorsAsOpen: boolean = false
    ): boolean {
        return this.pathExists(grid, start, target, treatDoorsAsOpen);
    }

    /**
     * Get all reachable positions from a starting point
     */
    static getReachablePositions(
        grid: number[][],
        start: GridPosition,
        treatDoorsAsOpen: boolean = false
    ): Set<string> {
        const height = grid.length;
        const width = grid[0].length;

        const visited = new Set<string>();
        const queue: GridPosition[] = [start];
        visited.add(GridUtils.positionKey(start));

        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const neighbor of GridUtils.getAdjacentPositions(current)) {
                if (!GridUtils.isInBounds(neighbor, width, height)) continue;

                const key = GridUtils.positionKey(neighbor);
                if (visited.has(key)) continue;

                const tile = grid[neighbor.y][neighbor.x];

                if (tile === TILE_IDS.WALL) continue;
                if (tile === TILE_IDS.DOOR && !treatDoorsAsOpen) continue;

                visited.add(key);
                queue.push(neighbor);
            }
        }

        return visited;
    }
}
