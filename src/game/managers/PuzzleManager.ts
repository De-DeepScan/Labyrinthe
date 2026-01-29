import { Scene } from "phaser";
import { DEPTH } from "../config/Constants";
import { EventBus } from "../EventBus";

// Grid cell for the path puzzle
interface GridCell {
    row: number;
    col: number;
    fixedNumber: number | null; // Pre-placed checkpoint number
    pathNumber: number | null;  // Number assigned by player's path
}

// Grid puzzle state
interface GridPuzzleState {
    grid: GridCell[][];
    gridSize: number;
    currentPathLength: number;
    maxNumber: number;
    checkpoints: { row: number; col: number; number: number }[];
    solution: { row: number; col: number }[]; // The solution path
    synapseId: string;
    isComplete: boolean;
}

// Visual element for a grid cell
interface GridCellVisual {
    background: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
    hitArea: Phaser.GameObjects.Rectangle;
}

/**
 * Manages the Path Puzzle mini-game (Numbrix/Hidato style)
 * Goal: Create a continuous path from 1 to maxNumber, passing through checkpoints in order
 * The path must fill the entire grid without revisiting cells
 */
export class PuzzleManager {
    private scene: Scene;
    private gridPuzzle: GridPuzzleState | null = null;

    private container?: Phaser.GameObjects.Container;
    private overlay?: Phaser.GameObjects.Rectangle;
    private pathGraphics?: Phaser.GameObjects.Graphics;
    private gridCellVisuals: Map<string, GridCellVisual> = new Map();

    private titleText?: Phaser.GameObjects.Text;
    private hintText?: Phaser.GameObjects.Text;
    private closeButtonBg?: Phaser.GameObjects.Arc;
    private closeButtonHitArea?: Phaser.GameObjects.Arc;
    private undoButtonBg?: Phaser.GameObjects.Rectangle;
    private undoButtonHitArea?: Phaser.GameObjects.Rectangle;
    private closeButtonContainer?: Phaser.GameObjects.Container;

    // Player's current path
    private currentPath: { row: number; col: number }[] = [];

    // Drag state for snake-like drawing
    private isDragging: boolean = false;

    // Callbacks
    private onCompleteCallback?: (synapseId: string) => void;
    private onFailCallback?: (synapseId: string) => void;
    private onCloseCallback?: () => void;

    // Configuration
    private readonly CELL_SIZE = 50;
    private readonly GRID_SIZE = 6; // 6x6 = 36 cells (more manageable)
    private readonly COLORS = {
        CELL_BG: 0x2d3748,
        CELL_BORDER: 0x4a5568,
        CELL_HOVER: 0x4299e1,
        PATH_CELL: 0x38a169,
        CHECKPOINT: 0xed8936,
        CHECKPOINT_REACHED: 0x48bb78,
        PATH_LINE: 0x68d391,
        TEXT_NORMAL: "#e2e8f0",
        TEXT_CHECKPOINT: "#ffffff",
        INVALID: 0xe53e3e,
    };

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Start a new puzzle for a synapse
     */
    startPuzzle(synapseId: string, difficulty: number): GridPuzzleState {
        this.gridPuzzle = this.generateGridPuzzle(synapseId, difficulty);
        this.showGridPuzzleUI();
        return this.gridPuzzle;
    }

    /**
     * Generate a solvable grid puzzle using backtracking
     * Creates a Hamiltonian path through the grid, then places checkpoints
     */
    private generateGridPuzzle(synapseId: string, difficulty: number): GridPuzzleState {
        const gridSize = this.GRID_SIZE;
        const maxNumber = gridSize * gridSize; // 81 for 9x9

        // Initialize empty grid
        const grid: GridCell[][] = [];
        for (let row = 0; row < gridSize; row++) {
            grid[row] = [];
            for (let col = 0; col < gridSize; col++) {
                grid[row][col] = {
                    row,
                    col,
                    fixedNumber: null,
                    pathNumber: null,
                };
            }
        }

        // Generate a valid Hamiltonian path through the grid
        const solution = this.generateHamiltonianPath(gridSize);

        // Place checkpoints along the path based on difficulty
        // More checkpoints = easier puzzle
        const checkpointCount = difficulty === 1 ? 12 : difficulty === 2 ? 9 : 7;
        const checkpoints = this.placeCheckpoints(solution, checkpointCount, maxNumber);

        // Mark checkpoints in the grid
        for (const checkpoint of checkpoints) {
            grid[checkpoint.row][checkpoint.col].fixedNumber = checkpoint.number;
        }

        return {
            grid,
            gridSize,
            currentPathLength: 0,
            maxNumber,
            checkpoints,
            solution,
            synapseId,
            isComplete: false,
        };
    }

    /**
     * Generate a Hamiltonian path through the grid using randomized backtracking
     * This creates truly random, non-linear paths
     */
    private generateHamiltonianPath(size: number): { row: number; col: number }[] {
        const totalCells = size * size;

        // Try multiple times with different starting positions
        for (let attempt = 0; attempt < 50; attempt++) {
            // Random starting position
            const startRow = Math.floor(Math.random() * size);
            const startCol = Math.floor(Math.random() * size);

            const visited: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
            const path: { row: number; col: number }[] = [];

            if (this.backtrackPath(startRow, startCol, visited, path, size, totalCells)) {
                return path;
            }
        }

        // Fallback to snake pattern if backtracking fails (should be rare)
        return this.generateSnakePath(size);
    }

    /**
     * Recursive backtracking to find a Hamiltonian path
     */
    private backtrackPath(
        row: number,
        col: number,
        visited: boolean[][],
        path: { row: number; col: number }[],
        size: number,
        totalCells: number
    ): boolean {
        // Mark current cell as visited
        visited[row][col] = true;
        path.push({ row, col });

        // Check if we've visited all cells
        if (path.length === totalCells) {
            return true;
        }

        // Get all valid neighbors and shuffle them for randomness
        const neighbors = this.getShuffledNeighbors(row, col, size, visited);

        // Use Warnsdorff's heuristic: prefer cells with fewer unvisited neighbors
        // This dramatically improves success rate
        neighbors.sort((a, b) => {
            const aNeighbors = this.countUnvisitedNeighbors(a.row, a.col, size, visited);
            const bNeighbors = this.countUnvisitedNeighbors(b.row, b.col, size, visited);
            // Add small random factor to break ties randomly
            return (aNeighbors - bNeighbors) + (Math.random() - 0.5) * 0.5;
        });

        // Try each neighbor
        for (const neighbor of neighbors) {
            if (this.backtrackPath(neighbor.row, neighbor.col, visited, path, size, totalCells)) {
                return true;
            }
        }

        // Backtrack
        visited[row][col] = false;
        path.pop();
        return false;
    }

    /**
     * Get shuffled list of unvisited neighbors
     */
    private getShuffledNeighbors(
        row: number,
        col: number,
        size: number,
        visited: boolean[][]
    ): { row: number; col: number }[] {
        const directions = [
            { dr: -1, dc: 0 }, // Up
            { dr: 1, dc: 0 },  // Down
            { dr: 0, dc: -1 }, // Left
            { dr: 0, dc: 1 },  // Right
        ];

        // Shuffle directions
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        const neighbors: { row: number; col: number }[] = [];

        for (const dir of directions) {
            const newRow = row + dir.dr;
            const newCol = col + dir.dc;

            if (newRow >= 0 && newRow < size &&
                newCol >= 0 && newCol < size &&
                !visited[newRow][newCol]) {
                neighbors.push({ row: newRow, col: newCol });
            }
        }

        return neighbors;
    }

    /**
     * Count unvisited neighbors of a cell (for Warnsdorff's heuristic)
     */
    private countUnvisitedNeighbors(
        row: number,
        col: number,
        size: number,
        visited: boolean[][]
    ): number {
        const directions = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 },
        ];

        let count = 0;
        for (const dir of directions) {
            const newRow = row + dir.dr;
            const newCol = col + dir.dc;

            if (newRow >= 0 && newRow < size &&
                newCol >= 0 && newCol < size &&
                !visited[newRow][newCol]) {
                count++;
            }
        }

        return count;
    }

    /**
     * Fallback snake pattern (guaranteed to work)
     */
    private generateSnakePath(size: number): { row: number; col: number }[] {
        const path: { row: number; col: number }[] = [];

        for (let row = 0; row < size; row++) {
            if (row % 2 === 0) {
                for (let col = 0; col < size; col++) {
                    path.push({ row, col });
                }
            } else {
                for (let col = size - 1; col >= 0; col--) {
                    path.push({ row, col });
                }
            }
        }

        return path;
    }

    /**
     * Place checkpoints along the solution path with randomization
     * Checkpoints are numbered 1-9 maximum, distributed along the path
     */
    private placeCheckpoints(
        solution: { row: number; col: number }[],
        count: number,
        _maxNumber: number
    ): { row: number; col: number; number: number }[] {
        const checkpoints: { row: number; col: number; number: number }[] = [];

        // Limit to 9 checkpoints max (numbers 1-9)
        const actualCount = Math.min(count, 9);

        // Always include start (1) and end (last checkpoint number)
        checkpoints.push({ ...solution[0], number: 1 });
        checkpoints.push({ ...solution[solution.length - 1], number: actualCount });

        // Add intermediate checkpoints with randomization
        const remainingCount = actualCount - 2;
        if (remainingCount > 0) {
            // Distribute checkpoints evenly along the path
            const step = Math.floor(solution.length / (actualCount - 1));

            for (let i = 1; i <= remainingCount; i++) {
                // Calculate base index with some randomization
                const baseIndex = i * step;
                const randomOffset = Math.floor(Math.random() * Math.floor(step * 0.4)) - Math.floor(step * 0.2);
                const index = Math.max(1, Math.min(solution.length - 2, baseIndex + randomOffset));

                checkpoints.push({ ...solution[index], number: i + 1 });
            }
        }

        // Sort checkpoints by their number
        checkpoints.sort((a, b) => a.number - b.number);

        return checkpoints;
    }

    /**
     * Show the grid puzzle UI
     */
    private showGridPuzzleUI(): void {
        if (!this.gridPuzzle) return;

        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        this.container = this.scene.add.container(centerX, centerY);
        this.container.setDepth(DEPTH.PUZZLE_BG);
        this.container.setScrollFactor(0);

        // Background overlay
        this.overlay = this.scene.add.rectangle(
            0, 0,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000, 0.8
        );
        this.overlay.setInteractive();
        this.container.add(this.overlay);

        // Calculate grid dimensions
        const gridWidth = this.GRID_SIZE * this.CELL_SIZE;
        const gridHeight = this.GRID_SIZE * this.CELL_SIZE;
        const panelWidth = gridWidth + 80;
        const panelHeight = gridHeight + 160;

        // Main panel
        const panel = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e);
        panel.setStrokeStyle(3, 0x4299e1);
        this.container.add(panel);

        // Title
        this.titleText = this.scene.add.text(0, -panelHeight / 2 + 30, "CONNEXION NEURONALE", {
            fontFamily: "Arial Black",
            fontSize: "24px",
            color: "#4299e1",
        }).setOrigin(0.5);
        this.container.add(this.titleText);

        // Hint text
        const checkpointCount = this.gridPuzzle?.checkpoints.length || 0;
        this.hintText = this.scene.add.text(0, -panelHeight / 2 + 60, `Maintenez le clic et glissez de 1 à ${checkpointCount} dans l'ordre`, {
            fontFamily: "Arial",
            fontSize: "12px",
            color: "#a0aec0",
        }).setOrigin(0.5);
        this.container.add(this.hintText);

        // Path graphics (for drawing lines between cells)
        this.pathGraphics = this.scene.add.graphics();
        this.container.add(this.pathGraphics);

        // Create the grid
        this.createGridCells(centerX, centerY);

        // Create buttons
        this.createCloseButton(panelWidth, panelHeight, centerX, centerY);
        this.createUndoButton(panelWidth, panelHeight, centerX, centerY);

        // Entrance animation
        this.container.setScale(0.8);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: "Back.easeOut",
        });

        // Don't initialize starting cell - player must start from checkpoint 1
        const totalCells = this.gridPuzzle.gridSize * this.gridPuzzle.gridSize;
        this.updateHint(`Remplissez les ${totalCells} cases en passant par les checkpoints dans l'ordre`);
    }

    /**
     * Create the grid cells
     */
    private createGridCells(screenCenterX: number, screenCenterY: number): void {
        if (!this.gridPuzzle || !this.container) return;

        const gridStartX = -(this.GRID_SIZE * this.CELL_SIZE) / 2 + this.CELL_SIZE / 2;
        const gridStartY = -(this.GRID_SIZE * this.CELL_SIZE) / 2 + this.CELL_SIZE / 2 + 20;

        for (let row = 0; row < this.GRID_SIZE; row++) {
            for (let col = 0; col < this.GRID_SIZE; col++) {
                const cell = this.gridPuzzle.grid[row][col];
                const x = gridStartX + col * this.CELL_SIZE;
                const y = gridStartY + row * this.CELL_SIZE;

                // Cell background
                const isCheckpoint = cell.fixedNumber !== null;
                const bgColor = isCheckpoint ? this.COLORS.CHECKPOINT : this.COLORS.CELL_BG;

                const background = this.scene.add.rectangle(
                    x, y,
                    this.CELL_SIZE - 2,
                    this.CELL_SIZE - 2,
                    bgColor
                );
                background.setStrokeStyle(1, this.COLORS.CELL_BORDER);
                this.container.add(background);

                // Cell text (number)
                const textValue = cell.fixedNumber !== null ? `${cell.fixedNumber}` : "";
                const textColor = isCheckpoint ? this.COLORS.TEXT_CHECKPOINT : this.COLORS.TEXT_NORMAL;
                const text = this.scene.add.text(x, y, textValue, {
                    fontFamily: "Arial Black",
                    fontSize: isCheckpoint ? "16px" : "14px",
                    color: textColor,
                }).setOrigin(0.5);
                this.container.add(text);

                // Hit area (fixed to screen coordinates)
                const hitArea = this.scene.add.rectangle(
                    screenCenterX + x,
                    screenCenterY + y,
                    this.CELL_SIZE - 2,
                    this.CELL_SIZE - 2,
                    0x000000,
                    0 // Invisible
                );
                hitArea.setScrollFactor(0);
                hitArea.setDepth(DEPTH.PUZZLE_ELEMENTS + 10);
                hitArea.setInteractive({ useHandCursor: true });

                // Interactions - drag to draw like a snake
                hitArea.on("pointerover", () => {
                    if (!this.isCellInPath(row, col)) {
                        background.setStrokeStyle(2, this.COLORS.CELL_HOVER);
                    }
                    // If dragging, try to add this cell to path
                    if (this.isDragging) {
                        this.handleCellDrag(row, col);
                    }
                });

                hitArea.on("pointerout", () => {
                    if (!this.isCellInPath(row, col)) {
                        background.setStrokeStyle(1, this.COLORS.CELL_BORDER);
                    }
                });

                hitArea.on("pointerdown", () => {
                    this.handleCellPointerDown(row, col);
                });

                hitArea.on("pointerup", () => {
                    this.isDragging = false;
                });

                // Store references
                const key = `${row},${col}`;
                this.gridCellVisuals.set(key, { background, text, hitArea });
            }
        }

        // Global pointer up to stop dragging
        this.scene.input.on("pointerup", () => {
            this.isDragging = false;
        });
    }

    /**
     * Check if a cell is in the current path
     */
    private isCellInPath(row: number, col: number): boolean {
        return this.currentPath.some(p => p.row === row && p.col === col);
    }

    /**
     * Check if a cell is adjacent to the last cell in the path
     */
    private isAdjacentToLastCell(row: number, col: number): boolean {
        if (this.currentPath.length === 0) return false;

        const last = this.currentPath[this.currentPath.length - 1];
        const dr = Math.abs(row - last.row);
        const dc = Math.abs(col - last.col);

        // Adjacent = exactly one step in row OR column (not diagonal)
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    /**
     * Handle pointer down on a cell - start dragging
     */
    private handleCellPointerDown(row: number, col: number): void {
        if (!this.gridPuzzle) return;

        const cell = this.gridPuzzle.grid[row][col];

        // If path is empty, must start from checkpoint 1
        if (this.currentPath.length === 0) {
            if (cell.fixedNumber !== 1) {
                this.flashInvalidCell(row, col);
                this.updateHint("Commencez par la case 1 !");
                return;
            }
            // Start the path from checkpoint 1
            this.isDragging = true;
            this.addCellToPath(row, col);
            return;
        }

        // If clicking a cell already in path, undo to that point
        const pathIndex = this.currentPath.findIndex(p => p.row === row && p.col === col);
        if (pathIndex !== -1) {
            this.undoToIndex(pathIndex);
            this.isDragging = true; // Allow continuing from this point
            return;
        }

        // If adjacent to last cell, start dragging and add this cell
        if (this.isAdjacentToLastCell(row, col)) {
            if (this.tryAddCellToPath(row, col)) {
                this.isDragging = true;
            }
        }
    }

    /**
     * Handle cell drag (pointer over while dragging)
     */
    private handleCellDrag(row: number, col: number): void {
        if (!this.gridPuzzle || !this.isDragging) return;

        // Skip if already the last cell
        if (this.currentPath.length > 0) {
            const last = this.currentPath[this.currentPath.length - 1];
            if (last.row === row && last.col === col) {
                return;
            }
        }

        // Check if this is the second-to-last cell (allows backtracking)
        if (this.currentPath.length >= 2) {
            const secondToLast = this.currentPath[this.currentPath.length - 2];
            if (secondToLast.row === row && secondToLast.col === col) {
                // User is going back - remove the last cell
                this.undoLastCell();
                return;
            }
        }

        // If already in path (but not second-to-last), just stop
        const pathIndex = this.currentPath.findIndex(p => p.row === row && p.col === col);
        if (pathIndex !== -1) {
            return;
        }

        // Try to add if adjacent
        if (this.isAdjacentToLastCell(row, col)) {
            this.tryAddCellToPath(row, col);
        }
    }

    /**
     * Try to add a cell to the path, checking checkpoint constraints
     * Returns true if successful
     */
    private tryAddCellToPath(row: number, col: number): boolean {
        if (!this.gridPuzzle) return false;

        const cell = this.gridPuzzle.grid[row][col];

        // Check if this cell has a checkpoint that's not in sequence
        if (cell.fixedNumber !== null) {
            const nextCheckpoint = this.getNextCheckpointNumber();
            // If it's a checkpoint, it must be the next expected checkpoint
            if (cell.fixedNumber !== nextCheckpoint) {
                this.flashInvalidCell(row, col);
                return false;
            }
        }

        // Add cell to path
        this.addCellToPath(row, col);
        return true;
    }

    /**
     * Get the next checkpoint number that needs to be reached
     * Based on which checkpoints have already been visited in the path
     */
    private getNextCheckpointNumber(): number {
        if (!this.gridPuzzle) return 1;

        // Find which checkpoints have been reached
        for (const checkpoint of this.gridPuzzle.checkpoints) {
            const cell = this.gridPuzzle.grid[checkpoint.row][checkpoint.col];
            if (cell.pathNumber === null) {
                // This checkpoint hasn't been reached yet
                return checkpoint.number;
            }
        }
        // All checkpoints reached
        return this.gridPuzzle.checkpoints.length + 1;
    }

    /**
     * Add a cell to the current path
     */
    private addCellToPath(row: number, col: number): void {
        if (!this.gridPuzzle) return;

        const pathNumber = this.currentPath.length + 1;
        this.currentPath.push({ row, col });
        this.gridPuzzle.grid[row][col].pathNumber = pathNumber;
        this.gridPuzzle.currentPathLength = pathNumber;

        // Update visual
        this.updateCellVisual(row, col);
        this.drawPath();

        // Check if puzzle is complete:
        // - All cells must be filled (path length = total cells)
        // - The last cell must be the final checkpoint
        const totalCells = this.gridPuzzle.gridSize * this.gridPuzzle.gridSize;
        const cell = this.gridPuzzle.grid[row][col];
        const lastCheckpoint = this.gridPuzzle.checkpoints[this.gridPuzzle.checkpoints.length - 1];

        if (this.currentPath.length === totalCells && cell.fixedNumber === lastCheckpoint.number) {
            // All cells filled AND reached the final checkpoint - puzzle complete!
            this.gridPuzzle.isComplete = true;
            this.onPuzzleComplete();
        } else {
            // Update hint with progress
            this.updateProgressHint();
        }
    }

    /**
     * Count how many checkpoints have been reached
     */
    private getCheckpointsReached(): number {
        if (!this.gridPuzzle) return 0;

        let count = 0;
        for (const checkpoint of this.gridPuzzle.checkpoints) {
            const cell = this.gridPuzzle.grid[checkpoint.row][checkpoint.col];
            if (cell.pathNumber !== null) {
                count++;
            }
        }
        return count;
    }

    /**
     * Undo the path to a specific index
     */
    private undoToIndex(index: number): void {
        if (!this.gridPuzzle || index < 0) return;

        // Remove cells after the index
        while (this.currentPath.length > index + 1) {
            const removed = this.currentPath.pop();
            if (removed) {
                this.gridPuzzle.grid[removed.row][removed.col].pathNumber = null;
                this.resetCellVisual(removed.row, removed.col);
            }
        }

        this.gridPuzzle.currentPathLength = this.currentPath.length;
        this.drawPath();

        this.updateProgressHint();
    }

    /**
     * Undo the last cell added to the path
     */
    private undoLastCell(): void {
        if (!this.gridPuzzle || this.currentPath.length <= 1) return; // Can't undo starting cell

        const removed = this.currentPath.pop();
        if (removed) {
            this.gridPuzzle.grid[removed.row][removed.col].pathNumber = null;
            this.gridPuzzle.currentPathLength = this.currentPath.length;
            this.resetCellVisual(removed.row, removed.col);
            this.drawPath();

            this.updateProgressHint();
        }
    }

    /**
     * Update the progress hint text
     */
    private updateProgressHint(): void {
        if (!this.gridPuzzle) return;

        const totalCells = this.gridPuzzle.gridSize * this.gridPuzzle.gridSize;
        const nextCheckpoint = this.getNextCheckpointNumber();
        const checkpointsReached = this.getCheckpointsReached();
        const totalCheckpoints = this.gridPuzzle.checkpoints.length;

        this.updateHint(`Cases: ${this.currentPath.length}/${totalCells} | Checkpoint: ${checkpointsReached}/${totalCheckpoints} | Prochain: ${nextCheckpoint}`);
    }

    /**
     * Update a cell's visual to show it's in the path
     * Non-checkpoint cells only change color, they don't show numbers
     */
    private updateCellVisual(row: number, col: number): void {
        if (!this.gridPuzzle) return;

        const key = `${row},${col}`;
        const visual = this.gridCellVisuals.get(key);
        if (!visual) return;

        const cell = this.gridPuzzle.grid[row][col];
        const isCheckpoint = cell.fixedNumber !== null;

        // Update background color - checkpoints turn green, regular cells turn green too
        const bgColor = isCheckpoint ? this.COLORS.CHECKPOINT_REACHED : this.COLORS.PATH_CELL;
        visual.background.setFillStyle(bgColor);
        visual.background.setStrokeStyle(2, this.COLORS.PATH_LINE);

        // Only checkpoints keep their number displayed - regular cells stay empty
        // (no change to text for non-checkpoint cells)
    }

    /**
     * Reset a cell's visual to its original state
     */
    private resetCellVisual(row: number, col: number): void {
        if (!this.gridPuzzle) return;

        const key = `${row},${col}`;
        const visual = this.gridCellVisuals.get(key);
        if (!visual) return;

        const cell = this.gridPuzzle.grid[row][col];
        const isCheckpoint = cell.fixedNumber !== null;

        // Reset background color
        const bgColor = isCheckpoint ? this.COLORS.CHECKPOINT : this.COLORS.CELL_BG;
        visual.background.setFillStyle(bgColor);
        visual.background.setStrokeStyle(1, this.COLORS.CELL_BORDER);

        // Reset text
        if (isCheckpoint) {
            visual.text.setText(`${cell.fixedNumber}`);
        } else {
            visual.text.setText("");
        }
    }

    /**
     * Flash a cell red to indicate invalid move
     */
    private flashInvalidCell(row: number, col: number): void {
        const key = `${row},${col}`;
        const visual = this.gridCellVisuals.get(key);
        if (!visual) return;

        const originalColor = visual.background.fillColor;
        visual.background.setFillStyle(this.COLORS.INVALID);

        this.scene.time.delayedCall(200, () => {
            visual.background.setFillStyle(originalColor);
        });
    }

    /**
     * Draw the path lines connecting cells
     */
    private drawPath(): void {
        if (!this.pathGraphics || this.currentPath.length < 2) {
            this.pathGraphics?.clear();
            return;
        }

        const graphics = this.pathGraphics;
        graphics.clear();

        const gridStartX = -(this.GRID_SIZE * this.CELL_SIZE) / 2 + this.CELL_SIZE / 2;
        const gridStartY = -(this.GRID_SIZE * this.CELL_SIZE) / 2 + this.CELL_SIZE / 2 + 20;

        graphics.lineStyle(4, this.COLORS.PATH_LINE, 0.8);
        graphics.beginPath();

        for (let i = 0; i < this.currentPath.length; i++) {
            const cell = this.currentPath[i];
            const x = gridStartX + cell.col * this.CELL_SIZE;
            const y = gridStartY + cell.row * this.CELL_SIZE;

            if (i === 0) {
                graphics.moveTo(x, y);
            } else {
                graphics.lineTo(x, y);
            }
        }

        graphics.strokePath();
    }

    /**
     * Handle puzzle completion
     */
    private onPuzzleComplete(): void {
        if (!this.gridPuzzle) return;

        this.scene.tweens.add({
            targets: this.container,
            scale: 1.02,
            duration: 150,
            yoyo: true,
            onComplete: () => {
                if (this.titleText) {
                    this.titleText.setText("CONNEXION RÉUSSIE !");
                    this.titleText.setColor("#48bb78");
                }
                this.updateHint("Félicitations !");

                this.scene.time.delayedCall(800, () => {
                    const synapseId = this.gridPuzzle?.synapseId || "";
                    this.hidePuzzleUI();
                    EventBus.emit("puzzle-completed", synapseId);
                    this.onCompleteCallback?.(synapseId);
                });
            },
        });
    }

    /**
     * Update hint text
     */
    private updateHint(text: string): void {
        if (this.hintText) {
            this.hintText.setText(text);
        }
    }

    /**
     * Create close button
     */
    private createCloseButton(_panelWidth: number, panelHeight: number, centerX: number, centerY: number): void {
        if (!this.container) return;

        const gridWidth = this.GRID_SIZE * this.CELL_SIZE;
        const btnX = gridWidth / 2 + 15;
        const btnY = -panelHeight / 2 + 25;

        this.closeButtonContainer = this.scene.add.container(btnX, btnY);

        this.closeButtonBg = this.scene.add.circle(0, 0, 18, 0xe53e3e);
        const text = this.scene.add.text(0, 0, "X", {
            fontFamily: "Arial Black",
            fontSize: "18px",
            color: "#ffffff",
        }).setOrigin(0.5);

        this.closeButtonContainer.add([this.closeButtonBg, text]);
        this.container.add(this.closeButtonContainer);

        // Hit area
        this.closeButtonHitArea = this.scene.add.circle(
            centerX + btnX,
            centerY + btnY,
            18,
            0x000000,
            0
        );
        this.closeButtonHitArea.setScrollFactor(0);
        this.closeButtonHitArea.setDepth(DEPTH.PUZZLE_ELEMENTS + 10);
        this.closeButtonHitArea.setInteractive({ useHandCursor: true });

        this.closeButtonHitArea.on("pointerover", () => {
            if (this.closeButtonBg) this.closeButtonBg.setScale(1.1);
        });
        this.closeButtonHitArea.on("pointerout", () => {
            if (this.closeButtonBg) this.closeButtonBg.setScale(1);
        });
        this.closeButtonHitArea.on("pointerdown", () => {
            const synapseId = this.gridPuzzle?.synapseId || "";
            this.hidePuzzleUI();
            EventBus.emit("puzzle-cancelled", synapseId);
            if (this.onFailCallback) this.onFailCallback(synapseId);
            if (this.onCloseCallback) this.onCloseCallback();
        });
    }

    /**
     * Create undo button
     */
    private createUndoButton(_panelWidth: number, panelHeight: number, centerX: number, centerY: number): void {
        if (!this.container) return;

        const btnX = 0;
        const btnY = panelHeight / 2 - 35;

        const undoBtn = this.scene.add.container(btnX, btnY);

        this.undoButtonBg = this.scene.add.rectangle(0, 0, 120, 35, 0x4a5568);
        this.undoButtonBg.setStrokeStyle(2, 0x718096);
        const text = this.scene.add.text(0, 0, "ANNULER", {
            fontFamily: "Arial Black",
            fontSize: "14px",
            color: "#e2e8f0",
        }).setOrigin(0.5);

        undoBtn.add([this.undoButtonBg, text]);
        this.container.add(undoBtn);

        // Hit area
        this.undoButtonHitArea = this.scene.add.rectangle(
            centerX + btnX,
            centerY + btnY,
            120,
            35,
            0x000000,
            0
        );
        this.undoButtonHitArea.setScrollFactor(0);
        this.undoButtonHitArea.setDepth(DEPTH.PUZZLE_ELEMENTS + 10);
        this.undoButtonHitArea.setInteractive({ useHandCursor: true });

        this.undoButtonHitArea.on("pointerover", () => {
            this.undoButtonBg?.setFillStyle(0x5a6578);
        });
        this.undoButtonHitArea.on("pointerout", () => {
            this.undoButtonBg?.setFillStyle(0x4a5568);
        });
        this.undoButtonHitArea.on("pointerdown", () => {
            this.undoLastCell();
        });
    }

    /**
     * Hide the puzzle UI
     */
    hidePuzzleUI(): void {
        if (!this.container) return;

        this.scene.tweens.add({
            targets: this.container,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                this.cleanup();
            },
        });
    }

    /**
     * Cleanup puzzle resources
     */
    private cleanup(): void {
        // Remove interactivity from overlay
        if (this.overlay) {
            this.overlay.removeInteractive();
            this.overlay = undefined;
        }

        // Remove interactivity from close button
        if (this.closeButtonBg) {
            this.closeButtonBg = undefined;
        }

        if (this.closeButtonHitArea) {
            this.closeButtonHitArea.removeInteractive();
            this.closeButtonHitArea.destroy();
            this.closeButtonHitArea = undefined;
        }

        // Remove interactivity from undo button
        if (this.undoButtonBg) {
            this.undoButtonBg = undefined;
        }

        if (this.undoButtonHitArea) {
            this.undoButtonHitArea.removeInteractive();
            this.undoButtonHitArea.destroy();
            this.undoButtonHitArea = undefined;
        }

        // Remove all grid cell visuals and hit areas
        for (const [, visual] of this.gridCellVisuals) {
            if (visual.hitArea) {
                visual.hitArea.removeInteractive();
                visual.hitArea.destroy();
            }
        }
        this.gridCellVisuals.clear();

        // Destroy graphics
        this.pathGraphics?.destroy();
        this.pathGraphics = undefined;

        // Destroy container
        this.container?.destroy();
        this.container = undefined;

        // Reset state
        this.gridPuzzle = null;
        this.currentPath = [];
        this.isDragging = false;
        this.titleText = undefined;
        this.hintText = undefined;
    }

    /**
     * Get current puzzle state (for compatibility)
     */
    getCurrentPuzzle(): GridPuzzleState | null {
        return this.gridPuzzle;
    }

    isPuzzleActive(): boolean {
        return this.gridPuzzle !== null;
    }

    onComplete(callback: (synapseId: string) => void): void {
        this.onCompleteCallback = callback;
    }

    onFail(callback: (synapseId: string) => void): void {
        this.onFailCallback = callback;
    }

    onClose(callback: () => void): void {
        this.onCloseCallback = callback;
    }

    destroy(): void {
        this.cleanup();
    }
}
