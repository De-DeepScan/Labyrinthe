import { useState, useCallback, useEffect, useMemo } from 'react';

interface GridCell {
    row: number;
    col: number;
    fixedNumber: number | null;
    pathNumber: number | null;
}

interface GridPuzzleState {
    grid: GridCell[][];
    gridSize: number;
    currentPathLength: number;
    maxNumber: number;
    checkpoints: { row: number; col: number; number: number }[];
    solution: { row: number; col: number }[];
    synapseId: string;
    targetNeuronId: string;
    isComplete: boolean;
}

interface PuzzleOverlayProps {
    synapseId: string;
    targetNeuronId: string;
    difficulty: number;
    onComplete: (synapseId: string, targetNeuronId: string) => void;
    onCancel: () => void;
}

const GRID_SIZE = 4;
const CELL_SIZE = 60;

const COLORS = {
    cellBg: '#2d3748',
    cellBorder: '#4a5568',
    cellHover: '#4299e1',
    pathCell: '#38a169',
    checkpoint: '#ed8936',
    checkpointReached: '#48bb78',
    pathLine: '#68d391',
    invalid: '#e53e3e',
    textNormal: '#e2e8f0',
    textCheckpoint: '#ffffff',
};

export function PuzzleOverlay({ synapseId, targetNeuronId, difficulty, onComplete, onCancel }: PuzzleOverlayProps) {
    const [puzzle, setPuzzle] = useState<GridPuzzleState | null>(null);
    const [currentPath, setCurrentPath] = useState<{ row: number; col: number }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
    const [invalidCell, setInvalidCell] = useState<{ row: number; col: number } | null>(null);
    const [hint, setHint] = useState('');
    const [isCompleted, setIsCompleted] = useState(false);

    // Generate puzzle on mount
    useEffect(() => {
        const newPuzzle = generateGridPuzzle(synapseId, targetNeuronId, difficulty);
        setPuzzle(newPuzzle);
        setHint(`Remplissez les ${GRID_SIZE * GRID_SIZE} cases en passant par les checkpoints dans l'ordre`);
    }, [synapseId, targetNeuronId, difficulty]);

    // Check if cell is in path
    const isCellInPath = useCallback((row: number, col: number) => {
        return currentPath.some(p => p.row === row && p.col === col);
    }, [currentPath]);

    // Check if adjacent to last cell
    const isAdjacentToLastCell = useCallback((row: number, col: number) => {
        if (currentPath.length === 0) return false;
        const last = currentPath[currentPath.length - 1];
        const dr = Math.abs(row - last.row);
        const dc = Math.abs(col - last.col);
        return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }, [currentPath]);

    // Get next checkpoint number
    const getNextCheckpointNumber = useCallback(() => {
        if (!puzzle) return 1;
        for (const checkpoint of puzzle.checkpoints) {
            const cell = puzzle.grid[checkpoint.row][checkpoint.col];
            if (cell.pathNumber === null) {
                return checkpoint.number;
            }
        }
        return puzzle.checkpoints.length + 1;
    }, [puzzle]);

    // Add cell to path
    const addCellToPath = useCallback((row: number, col: number) => {
        if (!puzzle) return;

        const newPath = [...currentPath, { row, col }];
        const pathNumber = newPath.length;

        // Update puzzle grid
        const newGrid = puzzle.grid.map(gridRow =>
            gridRow.map(cell => {
                if (cell.row === row && cell.col === col) {
                    return { ...cell, pathNumber };
                }
                return cell;
            })
        );

        const updatedPuzzle = {
            ...puzzle,
            grid: newGrid,
            currentPathLength: pathNumber,
        };

        setPuzzle(updatedPuzzle);
        setCurrentPath(newPath);

        // Check completion
        const totalCells = GRID_SIZE * GRID_SIZE;
        const cell = newGrid[row][col];
        const lastCheckpoint = puzzle.checkpoints[puzzle.checkpoints.length - 1];

        if (newPath.length === totalCells && cell.fixedNumber === lastCheckpoint.number) {
            setIsCompleted(true);
            setHint('CONNEXION RÉUSSIE !');
            setTimeout(() => {
                onComplete(synapseId, targetNeuronId);
            }, 800);
        } else {
            // Update hint
            const checkpointsReached = puzzle.checkpoints.filter(cp =>
                newGrid[cp.row][cp.col].pathNumber !== null
            ).length;
            setHint(`Cases: ${newPath.length}/${totalCells} | Checkpoints: ${checkpointsReached}/${puzzle.checkpoints.length}`);
        }
    }, [puzzle, currentPath, synapseId, targetNeuronId, onComplete]);

    // Flash invalid cell
    const flashInvalid = useCallback((row: number, col: number) => {
        setInvalidCell({ row, col });
        setTimeout(() => setInvalidCell(null), 200);
    }, []);

    // Try to add cell to path with validation
    const tryAddCellToPath = useCallback((row: number, col: number) => {
        if (!puzzle) return false;

        const cell = puzzle.grid[row][col];

        // Check checkpoint order
        if (cell.fixedNumber !== null) {
            const nextCheckpoint = getNextCheckpointNumber();
            if (cell.fixedNumber !== nextCheckpoint) {
                flashInvalid(row, col);
                return false;
            }
        }

        addCellToPath(row, col);
        return true;
    }, [puzzle, getNextCheckpointNumber, flashInvalid, addCellToPath]);

    // Handle cell click
    const handleCellClick = useCallback((row: number, col: number) => {
        if (!puzzle || isCompleted) return;

        const cell = puzzle.grid[row][col];

        // If path is empty, must start from checkpoint 1
        if (currentPath.length === 0) {
            if (cell.fixedNumber !== 1) {
                flashInvalid(row, col);
                setHint('Commencez par la case 1 !');
                return;
            }
            setIsDragging(true);
            addCellToPath(row, col);
            return;
        }

        // If clicking a cell already in path, undo to that point
        const pathIndex = currentPath.findIndex(p => p.row === row && p.col === col);
        if (pathIndex !== -1) {
            undoToIndex(pathIndex);
            setIsDragging(true);
            return;
        }

        // If adjacent, add to path
        if (isAdjacentToLastCell(row, col)) {
            if (tryAddCellToPath(row, col)) {
                setIsDragging(true);
            }
        }
    }, [puzzle, currentPath, isCompleted, isAdjacentToLastCell, flashInvalid, addCellToPath, tryAddCellToPath]);

    // Handle cell hover (drag)
    const handleCellHover = useCallback((row: number, col: number) => {
        setHoveredCell({ row, col });

        if (!puzzle || !isDragging || isCompleted) return;

        // Skip if already the last cell
        if (currentPath.length > 0) {
            const last = currentPath[currentPath.length - 1];
            if (last.row === row && last.col === col) return;
        }

        // Check if going back (second to last)
        if (currentPath.length >= 2) {
            const secondToLast = currentPath[currentPath.length - 2];
            if (secondToLast.row === row && secondToLast.col === col) {
                undoLastCell();
                return;
            }
        }

        // If already in path, skip
        if (isCellInPath(row, col)) return;

        // If adjacent, try to add
        if (isAdjacentToLastCell(row, col)) {
            tryAddCellToPath(row, col);
        }
    }, [puzzle, isDragging, isCompleted, currentPath, isCellInPath, isAdjacentToLastCell, tryAddCellToPath]);

    // Undo to specific index
    const undoToIndex = useCallback((index: number) => {
        if (!puzzle || index < 0) return;

        const newPath = currentPath.slice(0, index + 1);
        const removedCells = currentPath.slice(index + 1);

        // Update grid
        const newGrid = puzzle.grid.map(gridRow =>
            gridRow.map(cell => {
                if (removedCells.some(rc => rc.row === cell.row && rc.col === cell.col)) {
                    return { ...cell, pathNumber: null };
                }
                return cell;
            })
        );

        setPuzzle({ ...puzzle, grid: newGrid, currentPathLength: newPath.length });
        setCurrentPath(newPath);

        const totalCells = GRID_SIZE * GRID_SIZE;
        const checkpointsReached = puzzle.checkpoints.filter(cp =>
            newGrid[cp.row][cp.col].pathNumber !== null
        ).length;
        setHint(`Cases: ${newPath.length}/${totalCells} | Checkpoints: ${checkpointsReached}/${puzzle.checkpoints.length}`);
    }, [puzzle, currentPath]);

    // Undo last cell
    const undoLastCell = useCallback(() => {
        if (currentPath.length <= 1) return;
        undoToIndex(currentPath.length - 2);
    }, [currentPath, undoToIndex]);

    // Reset puzzle
    const resetPuzzle = useCallback(() => {
        if (!puzzle) return;

        const newGrid = puzzle.grid.map(gridRow =>
            gridRow.map(cell => ({ ...cell, pathNumber: null }))
        );

        setPuzzle({ ...puzzle, grid: newGrid, currentPathLength: 0 });
        setCurrentPath([]);
        setHint(`Remplissez les ${GRID_SIZE * GRID_SIZE} cases en passant par les checkpoints dans l'ordre`);
    }, [puzzle]);

    // Handle mouse up globally
    useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // Render path lines as SVG
    const pathLines = useMemo(() => {
        if (currentPath.length < 2) return null;

        const gridStartX = CELL_SIZE / 2;
        const gridStartY = CELL_SIZE / 2;

        let d = '';
        for (let i = 0; i < currentPath.length; i++) {
            const cell = currentPath[i];
            const x = gridStartX + cell.col * CELL_SIZE;
            const y = gridStartY + cell.row * CELL_SIZE;
            if (i === 0) {
                d += `M ${x} ${y}`;
            } else {
                d += ` L ${x} ${y}`;
            }
        }

        return (
            <svg
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: GRID_SIZE * CELL_SIZE,
                    height: GRID_SIZE * CELL_SIZE,
                    pointerEvents: 'none',
                }}
            >
                <path
                    d={d}
                    stroke={COLORS.pathLine}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.8}
                />
            </svg>
        );
    }, [currentPath]);

    if (!puzzle) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                style={{
                    background: '#1a1a2e',
                    border: '3px solid #4299e1',
                    borderRadius: 8,
                    padding: 24,
                    animation: 'puzzleIn 0.2s ease-out',
                }}
            >
                {/* Title */}
                <h2 style={{
                    margin: '0 0 8px 0',
                    textAlign: 'center',
                    color: isCompleted ? '#48bb78' : '#4299e1',
                    fontFamily: 'Arial Black, sans-serif',
                    fontSize: 24,
                }}>
                    {isCompleted ? 'CONNEXION RÉUSSIE !' : 'CONNEXION NEURONALE'}
                </h2>

                {/* Hint */}
                <p style={{
                    margin: '0 0 16px 0',
                    textAlign: 'center',
                    color: '#a0aec0',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: 12,
                }}>
                    {hint}
                </p>

                {/* Grid */}
                <div
                    style={{
                        position: 'relative',
                        width: GRID_SIZE * CELL_SIZE,
                        height: GRID_SIZE * CELL_SIZE,
                        margin: '0 auto',
                    }}
                >
                    {pathLines}

                    {puzzle.grid.map((gridRow, rowIndex) =>
                        gridRow.map((cell, colIndex) => {
                            const isCheckpoint = cell.fixedNumber !== null;
                            const isInPath = cell.pathNumber !== null;
                            const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
                            const isInvalid = invalidCell?.row === rowIndex && invalidCell?.col === colIndex;

                            let bgColor = COLORS.cellBg;
                            if (isInvalid) {
                                bgColor = COLORS.invalid;
                            } else if (isInPath) {
                                bgColor = isCheckpoint ? COLORS.checkpointReached : COLORS.pathCell;
                            } else if (isCheckpoint) {
                                bgColor = COLORS.checkpoint;
                            }

                            let borderColor = COLORS.cellBorder;
                            if (isInPath) {
                                borderColor = COLORS.pathLine;
                            } else if (isHovered && !isInPath) {
                                borderColor = COLORS.cellHover;
                            }

                            return (
                                <div
                                    key={`${rowIndex}-${colIndex}`}
                                    style={{
                                        position: 'absolute',
                                        left: colIndex * CELL_SIZE,
                                        top: rowIndex * CELL_SIZE,
                                        width: CELL_SIZE - 2,
                                        height: CELL_SIZE - 2,
                                        background: bgColor,
                                        border: `2px solid ${borderColor}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'background 0.1s, border-color 0.1s',
                                    }}
                                    onMouseDown={() => handleCellClick(rowIndex, colIndex)}
                                    onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                                    onMouseLeave={() => setHoveredCell(null)}
                                >
                                    {isCheckpoint && (
                                        <span style={{
                                            fontFamily: 'Arial Black, sans-serif',
                                            fontSize: 16,
                                            color: COLORS.textCheckpoint,
                                        }}>
                                            {cell.fixedNumber}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 16,
                    marginTop: 20,
                }}>
                    <button
                        onClick={resetPuzzle}
                        style={{
                            padding: '8px 24px',
                            background: '#4a5568',
                            border: '2px solid #718096',
                            borderRadius: 4,
                            color: '#e2e8f0',
                            fontFamily: 'Arial Black, sans-serif',
                            fontSize: 14,
                            cursor: 'pointer',
                        }}
                    >
                        RESET
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 24px',
                            background: '#e53e3e',
                            border: '2px solid #fc8181',
                            borderRadius: 4,
                            color: '#fff',
                            fontFamily: 'Arial Black, sans-serif',
                            fontSize: 14,
                            cursor: 'pointer',
                        }}
                    >
                        ANNULER
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes puzzleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
            `}</style>
        </div>
    );
}

// ============= PUZZLE GENERATION =============

function generateGridPuzzle(synapseId: string, targetNeuronId: string, difficulty: number): GridPuzzleState {
    const gridSize = GRID_SIZE;
    const maxNumber = gridSize * gridSize;

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

    // Generate Hamiltonian path
    const solution = generateHamiltonianPath(gridSize);

    // Place checkpoints (more = easier)
    const checkpointCount = difficulty === 1 ? 6 : difficulty === 2 ? 5 : 4;
    const checkpoints = placeCheckpoints(solution, checkpointCount);

    // Mark checkpoints in grid
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
        targetNeuronId,
        isComplete: false,
    };
}

function generateHamiltonianPath(size: number): { row: number; col: number }[] {
    const totalCells = size * size;

    // Try multiple times with different starting positions
    for (let attempt = 0; attempt < 50; attempt++) {
        const startRow = Math.floor(Math.random() * size);
        const startCol = Math.floor(Math.random() * size);

        const visited: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
        const path: { row: number; col: number }[] = [];

        if (backtrackPath(startRow, startCol, visited, path, size, totalCells)) {
            return path;
        }
    }

    // Fallback to snake pattern
    return generateSnakePath(size);
}

function backtrackPath(
    row: number,
    col: number,
    visited: boolean[][],
    path: { row: number; col: number }[],
    size: number,
    totalCells: number
): boolean {
    visited[row][col] = true;
    path.push({ row, col });

    if (path.length === totalCells) {
        return true;
    }

    const neighbors = getShuffledNeighbors(row, col, size, visited);

    // Warnsdorff's heuristic
    neighbors.sort((a, b) => {
        const aNeighbors = countUnvisitedNeighbors(a.row, a.col, size, visited);
        const bNeighbors = countUnvisitedNeighbors(b.row, b.col, size, visited);
        return (aNeighbors - bNeighbors) + (Math.random() - 0.5) * 0.5;
    });

    for (const neighbor of neighbors) {
        if (backtrackPath(neighbor.row, neighbor.col, visited, path, size, totalCells)) {
            return true;
        }
    }

    visited[row][col] = false;
    path.pop();
    return false;
}

function getShuffledNeighbors(row: number, col: number, size: number, visited: boolean[][]) {
    const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
    ];

    // Shuffle
    for (let i = directions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    const neighbors: { row: number; col: number }[] = [];
    for (const dir of directions) {
        const newRow = row + dir.dr;
        const newCol = col + dir.dc;
        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size && !visited[newRow][newCol]) {
            neighbors.push({ row: newRow, col: newCol });
        }
    }

    return neighbors;
}

function countUnvisitedNeighbors(row: number, col: number, size: number, visited: boolean[][]): number {
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
        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size && !visited[newRow][newCol]) {
            count++;
        }
    }
    return count;
}

function generateSnakePath(size: number): { row: number; col: number }[] {
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

function placeCheckpoints(solution: { row: number; col: number }[], count: number) {
    const checkpoints: { row: number; col: number; number: number }[] = [];
    const actualCount = Math.min(count, 9);

    // Always include start and end
    checkpoints.push({ ...solution[0], number: 1 });
    checkpoints.push({ ...solution[solution.length - 1], number: actualCount });

    // Add intermediate checkpoints
    const remainingCount = actualCount - 2;
    if (remainingCount > 0) {
        const step = Math.floor(solution.length / (actualCount - 1));

        for (let i = 1; i <= remainingCount; i++) {
            const baseIndex = i * step;
            const randomOffset = Math.floor(Math.random() * Math.floor(step * 0.4)) - Math.floor(step * 0.2);
            const index = Math.max(1, Math.min(solution.length - 2, baseIndex + randomOffset));
            checkpoints.push({ ...solution[index], number: i + 1 });
        }
    }

    checkpoints.sort((a, b) => a.number - b.number);
    return checkpoints;
}
