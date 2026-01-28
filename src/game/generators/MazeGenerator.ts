import { TILE_IDS } from "../config/Constants";
import { GameConfig } from "../config/GameConfig";
import type { MazeData, GridPosition, Door, Lever } from "../types/interfaces";
import { PathfindingUtils } from "../utils/PathfindingUtils";
import { GridUtils } from "../utils/GridUtils";

export class MazeGenerator {
    private static readonly MAX_GENERATION_ATTEMPTS = 100;
    private static readonly MIN_DOORS_ON_PATH = 3; // Minimum doors blocking the path to exit

    /**
     * Generate a random maze with doors and levers
     * Guarantees the maze is always solvable
     */
    static generate(width: number, height: number): MazeData {
        // Ensure odd dimensions for proper maze generation
        width = width % 2 === 0 ? width + 1 : width;
        height = height % 2 === 0 ? height + 1 : height;

        for (let attempt = 0; attempt < this.MAX_GENERATION_ATTEMPTS; attempt++) {
            const result = this.tryGenerate(width, height);
            if (result) {
                console.log(`Maze generated successfully on attempt ${attempt + 1}`);
                return result;
            }
        }

        // Fallback: generate a simple maze without mechanisms
        console.warn("Could not generate solvable maze with mechanisms, creating simple maze");
        return this.generateSimpleMaze(width, height);
    }

    /**
     * Try to generate a valid maze
     */
    private static tryGenerate(width: number, height: number): MazeData | null {
        // Initialize grid with walls
        const grid: number[][] = Array(height)
            .fill(null)
            .map(() => Array(width).fill(TILE_IDS.WALL));

        // Generate maze using recursive backtracking
        this.carvePassages(grid, 1, 1, width, height);

        // Place spawn and exit
        const explorerSpawn: GridPosition = { x: 1, y: 1 };
        const exitPosition: GridPosition = { x: width - 2, y: height - 2 };

        // Ensure spawn and exit are floor tiles
        grid[explorerSpawn.y][explorerSpawn.x] = TILE_IDS.FLOOR;
        grid[exitPosition.y][exitPosition.x] = TILE_IDS.EXIT;

        // Verify basic connectivity (without doors)
        if (!PathfindingUtils.pathExists(grid, explorerSpawn, exitPosition, false)) {
            return null;
        }

        // Place doors and levers with validation
        const mechanisms = this.placeMechanismsSafely(grid, explorerSpawn, exitPosition);
        if (!mechanisms) {
            return null;
        }

        const { doors, levers } = mechanisms;

        // Final validation
        if (!this.validateMaze(grid, explorerSpawn, exitPosition, doors, levers)) {
            return null;
        }

        return {
            grid,
            explorerSpawn,
            exitPosition,
            doors,
            levers,
            width,
            height,
        };
    }

    /**
     * Generate a simple maze without mechanisms (fallback)
     */
    private static generateSimpleMaze(width: number, height: number): MazeData {
        const grid: number[][] = Array(height)
            .fill(null)
            .map(() => Array(width).fill(TILE_IDS.WALL));

        this.carvePassages(grid, 1, 1, width, height);

        const explorerSpawn: GridPosition = { x: 1, y: 1 };
        const exitPosition: GridPosition = { x: width - 2, y: height - 2 };

        grid[explorerSpawn.y][explorerSpawn.x] = TILE_IDS.FLOOR;
        grid[exitPosition.y][exitPosition.x] = TILE_IDS.EXIT;

        return {
            grid,
            explorerSpawn,
            exitPosition,
            doors: [],
            levers: [],
            width,
            height,
        };
    }

    /**
     * Recursive backtracking algorithm to carve passages
     */
    private static carvePassages(
        grid: number[][],
        x: number,
        y: number,
        width: number,
        height: number
    ): void {
        grid[y][x] = TILE_IDS.FLOOR;

        // Directions: up, down, left, right (shuffled)
        const directions = this.shuffleArray([
            { dx: 0, dy: -2 }, // Up
            { dx: 0, dy: 2 }, // Down
            { dx: -2, dy: 0 }, // Left
            { dx: 2, dy: 0 }, // Right
        ]);

        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;

            // Check bounds and if unvisited
            if (
                newX > 0 &&
                newX < width - 1 &&
                newY > 0 &&
                newY < height - 1 &&
                grid[newY][newX] === TILE_IDS.WALL
            ) {
                // Carve passage between cells
                grid[y + dir.dy / 2][x + dir.dx / 2] = TILE_IDS.FLOOR;

                // Recursively carve from new position
                this.carvePassages(grid, newX, newY, width, height);
            }
        }
    }

    /**
     * Find passages on the critical path from spawn to exit
     */
    private static findCriticalPathPassages(
        grid: number[][],
        spawn: GridPosition,
        exit: GridPosition
    ): GridPosition[] {
        const path = PathfindingUtils.findPath(grid, spawn, exit, false);
        if (!path) return [];

        const passages: GridPosition[] = [];

        // Find passage positions along the path (tiles with one even coordinate)
        for (const pos of path) {
            const isPassage = (pos.x % 2 === 0) !== (pos.y % 2 === 0);
            if (isPassage) {
                // Skip positions too close to spawn or exit
                const distToSpawn = Math.abs(pos.x - spawn.x) + Math.abs(pos.y - spawn.y);
                const distToExit = Math.abs(pos.x - exit.x) + Math.abs(pos.y - exit.y);
                if (distToSpawn > 2 && distToExit > 2) {
                    passages.push(pos);
                }
            }
        }

        return passages;
    }

    /**
     * Place doors and levers safely, ensuring solvability
     * Guarantees at least MIN_DOORS_ON_PATH doors on the critical path
     */
    private static placeMechanismsSafely(
        grid: number[][],
        spawn: GridPosition,
        exit: GridPosition
    ): { doors: Door[]; levers: Lever[] } | null {
        const doors: Door[] = [];
        const levers: Lever[] = [];

        // Find passages on the critical path
        const criticalPathPassages = this.findCriticalPathPassages(grid, spawn, exit);

        // Check if we have enough passages on critical path
        if (criticalPathPassages.length < this.MIN_DOORS_ON_PATH) {
            return null; // Not enough passages on critical path
        }

        // Find all other passage positions for additional doors
        const allPassagePositions = this.findPassagePositions(grid, spawn, exit);

        // Find all node positions for potential levers
        const leverPositions = this.findLeverPositions(grid, spawn, exit);
        const shuffledLevers = this.shuffleArray([...leverPositions]);

        if (shuffledLevers.length < GameConfig.LEVER_COUNT) {
            return null; // Not enough positions for levers
        }

        // First, place levers in positions reachable from spawn (without any doors)
        const reachableFromSpawn = PathfindingUtils.getReachablePositions(grid, spawn, false);

        // Filter lever positions that are reachable
        const reachableLeverPositions = shuffledLevers.filter(pos =>
            reachableFromSpawn.has(GridUtils.positionKey(pos))
        );

        if (reachableLeverPositions.length < GameConfig.LEVER_COUNT) {
            return null; // Not enough reachable positions for levers
        }

        // Place levers at reachable positions
        for (let i = 0; i < GameConfig.LEVER_COUNT; i++) {
            const pos = reachableLeverPositions[i];
            levers.push({
                id: i,
                x: pos.x,
                y: pos.y,
                isActive: false,
                linkedDoorIds: [],
            });
            grid[pos.y][pos.x] = TILE_IDS.LEVER;
        }

        let doorId = 0;

        // STEP 1: Place doors on critical path first (at least MIN_DOORS_ON_PATH)
        const shuffledCriticalPassages = this.shuffleArray([...criticalPathPassages]);
        let doorsOnPath = 0;

        for (const pos of shuffledCriticalPassages) {
            if (doorsOnPath >= this.MIN_DOORS_ON_PATH && doorId >= GameConfig.DOOR_COUNT) break;

            // Temporarily place door
            const originalTile = grid[pos.y][pos.x];
            grid[pos.y][pos.x] = TILE_IDS.DOOR;

            // Check if all levers are still reachable from spawn
            let allLeversReachable = true;
            for (const lever of levers) {
                if (!PathfindingUtils.pathExists(grid, spawn, { x: lever.x, y: lever.y }, false)) {
                    allLeversReachable = false;
                    break;
                }
            }

            if (allLeversReachable) {
                doors.push({
                    id: doorId,
                    x: pos.x,
                    y: pos.y,
                    isOpen: false,
                });
                doorId++;
                doorsOnPath++;
            } else {
                // Revert door placement
                grid[pos.y][pos.x] = originalTile;
            }
        }

        // Check if we placed enough doors on critical path
        if (doorsOnPath < this.MIN_DOORS_ON_PATH) {
            return null; // Could not place enough doors on path
        }

        // STEP 2: Place additional doors elsewhere if needed
        const usedPositions = new Set(doors.map(d => GridUtils.positionKey({ x: d.x, y: d.y })));
        const remainingPassages = allPassagePositions.filter(
            pos => !usedPositions.has(GridUtils.positionKey(pos))
        );
        const shuffledRemaining = this.shuffleArray(remainingPassages);

        for (const pos of shuffledRemaining) {
            if (doorId >= GameConfig.DOOR_COUNT) break;

            // Temporarily place door
            const originalTile = grid[pos.y][pos.x];
            grid[pos.y][pos.x] = TILE_IDS.DOOR;

            // Check if all levers are still reachable
            let allLeversReachable = true;
            for (const lever of levers) {
                if (!PathfindingUtils.pathExists(grid, spawn, { x: lever.x, y: lever.y }, false)) {
                    allLeversReachable = false;
                    break;
                }
            }

            if (allLeversReachable) {
                doors.push({
                    id: doorId,
                    x: pos.x,
                    y: pos.y,
                    isOpen: false,
                });
                doorId++;
            } else {
                grid[pos.y][pos.x] = originalTile;
            }
        }

        // Link levers to doors (each lever controls one door)
        for (let i = 0; i < levers.length; i++) {
            if (i < doors.length) {
                levers[i].linkedDoorIds = [doors[i].id];
            }
        }

        // Final check: exit must be reachable with all doors open
        if (!PathfindingUtils.pathExists(grid, spawn, exit, true)) {
            return null;
        }

        return { doors, levers };
    }

    /**
     * Validate the complete maze
     */
    private static validateMaze(
        grid: number[][],
        spawn: GridPosition,
        exit: GridPosition,
        doors: Door[],
        levers: Lever[]
    ): boolean {
        // 1. All levers must be reachable from spawn WITHOUT opening doors
        for (const lever of levers) {
            if (!PathfindingUtils.pathExists(grid, spawn, { x: lever.x, y: lever.y }, false)) {
                console.log(`Validation failed: Lever at ${lever.x},${lever.y} is not reachable`);
                return false;
            }
        }

        // 2. Exit must be reachable with all doors open
        if (!PathfindingUtils.pathExists(grid, spawn, exit, true)) {
            console.log("Validation failed: Exit is not reachable even with doors open");
            return false;
        }

        // 3. If there are doors, there must be at least one lever per door
        if (doors.length > 0 && levers.length < doors.length) {
            console.log("Validation failed: Not enough levers for doors");
            return false;
        }

        // 4. Each door must have at least one lever linked to it
        for (const door of doors) {
            const hasLever = levers.some(lever => lever.linkedDoorIds.includes(door.id));
            if (!hasLever) {
                console.log(`Validation failed: Door ${door.id} has no lever`);
                return false;
            }
        }

        // 5. Exit should NOT be reachable without opening doors (at least one door blocks path)
        if (PathfindingUtils.pathExists(grid, spawn, exit, false)) {
            console.log("Validation failed: Exit is reachable without opening any door");
            return false;
        }

        return true;
    }

    /**
     * Find passage positions (tiles between nodes - even coordinate on one axis)
     * These are valid positions for doors
     */
    private static findPassagePositions(
        grid: number[][],
        spawn: GridPosition,
        exit: GridPosition
    ): GridPosition[] {
        const positions: GridPosition[] = [];
        const height = grid.length;
        const width = grid[0].length;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (grid[y][x] !== TILE_IDS.FLOOR) continue;

                // Passage positions have one even coordinate
                const isPassage = (x % 2 === 0) !== (y % 2 === 0);
                if (!isPassage) continue;

                // Skip positions too close to spawn or exit
                const distToSpawn = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);
                const distToExit = Math.abs(x - exit.x) + Math.abs(y - exit.y);
                if (distToSpawn <= 2 || distToExit <= 2) continue;

                positions.push({ x, y });
            }
        }

        return positions;
    }

    /**
     * Find positions suitable for levers (node positions - odd coordinates)
     */
    private static findLeverPositions(
        grid: number[][],
        spawn: GridPosition,
        exit: GridPosition
    ): GridPosition[] {
        const positions: GridPosition[] = [];
        const height = grid.length;
        const width = grid[0].length;

        for (let y = 1; y < height - 1; y += 2) {
            for (let x = 1; x < width - 1; x += 2) {
                if (grid[y][x] !== TILE_IDS.FLOOR) continue;

                // Skip spawn and exit
                if (x === spawn.x && y === spawn.y) continue;
                if (x === exit.x && y === exit.y) continue;

                positions.push({ x, y });
            }
        }

        return positions;
    }

    /**
     * Fisher-Yates shuffle
     */
    private static shuffleArray<T>(array: T[]): T[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}
