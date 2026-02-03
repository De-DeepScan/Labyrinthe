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
    checkpoints: { row: number; col: number; number: number }[];
    solution: { row: number; col: number }[];
    synapseId: string;
    targetNeuronId: string;
    isComplete: boolean;
    level: number;
    mustFillAll: boolean;
    maxCheckpoint: number;
}

interface PuzzleOverlayProps {
    synapseId: string;
    targetNeuronId: string;
    difficulty: number; // 1, 2, or 3 = level
    onComplete: (synapseId: string, targetNeuronId: string) => void;
    onCancel: () => void;
}

const CELL_SIZE = 50;

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
    // Show warning only for the first puzzle of level 2 (synapse s_0)
    const [showLevelWarning, setShowLevelWarning] = useState(difficulty === 2 && synapseId === 's_0');

    // Generate puzzle based on difficulty/level
    useEffect(() => {
        const newPuzzle = generateGridPuzzle(synapseId, targetNeuronId, difficulty);
        setPuzzle(newPuzzle);
        updateHint(newPuzzle, []);
    }, [synapseId, targetNeuronId, difficulty]);

    // Update hint message based on puzzle state
    const updateHint = useCallback((puz: GridPuzzleState, path: { row: number; col: number }[]) => {
        if (puz.level === 1) {
            const checkpointsReached = puz.checkpoints.filter(cp =>
                path.some(p => p.row === cp.row && p.col === cp.col)
            ).length;
            setHint(`Reliez les ${puz.maxCheckpoint} points dans l'ordre (${checkpointsReached}/${puz.maxCheckpoint})`);
        } else {
            const totalCells = puz.gridSize * puz.gridSize;
            const checkpointsReached = puz.checkpoints.filter(cp =>
                path.some(p => p.row === cp.row && p.col === cp.col)
            ).length;
            setHint(`Remplissez toutes les cases (${path.length}/${totalCells}) - Checkpoints: ${checkpointsReached}/${puz.maxCheckpoint}`);
        }
    }, []);

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

    // Get next checkpoint number we need to reach
    const getNextCheckpointNumber = useCallback(() => {
        if (!puzzle) return 1;
        for (const checkpoint of puzzle.checkpoints) {
            const reached = currentPath.some(p => p.row === checkpoint.row && p.col === checkpoint.col);
            if (!reached) {
                return checkpoint.number;
            }
        }
        return puzzle.maxCheckpoint + 1;
    }, [puzzle, currentPath]);

    // Check if adding this cell would skip a checkpoint
    const wouldSkipCheckpoint = useCallback((row: number, col: number) => {
        if (!puzzle) return false;

        const cell = puzzle.grid[row][col];
        if (cell.fixedNumber === null) return false;

        const nextCheckpoint = getNextCheckpointNumber();
        return cell.fixedNumber !== nextCheckpoint;
    }, [puzzle, getNextCheckpointNumber]);

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
        updateHint(updatedPuzzle, newPath);

        // Check completion based on level
        checkCompletion(updatedPuzzle, newPath);
    }, [puzzle, currentPath, updateHint]);

    // Check if puzzle is complete
    const checkCompletion = useCallback((puz: GridPuzzleState, path: { row: number; col: number }[]) => {
        // All checkpoints must be reached in order
        const allCheckpointsReached = puz.checkpoints.every(cp =>
            path.some(p => p.row === cp.row && p.col === cp.col)
        );

        if (!allCheckpointsReached) return;

        if (puz.level === 1) {
            // Level 1: Just need to connect all 4 checkpoints
            const lastCell = path[path.length - 1];
            const lastCheckpoint = puz.checkpoints[puz.checkpoints.length - 1];
            if (lastCell.row === lastCheckpoint.row && lastCell.col === lastCheckpoint.col) {
                completeSuccess();
            }
        } else {
            // Level 2 & 3: Must fill ALL cells AND end on last checkpoint
            const totalCells = puz.gridSize * puz.gridSize;
            const lastCell = path[path.length - 1];
            const lastCheckpoint = puz.checkpoints[puz.checkpoints.length - 1];

            if (path.length === totalCells &&
                lastCell.row === lastCheckpoint.row &&
                lastCell.col === lastCheckpoint.col) {
                completeSuccess();
            }
        }
    }, []);

    const completeSuccess = useCallback(() => {
        setIsCompleted(true);
        setHint('CONNEXION REUSSIE !');
        setTimeout(() => {
            onComplete(synapseId, targetNeuronId);
        }, 800);
    }, [synapseId, targetNeuronId, onComplete]);

    // Flash invalid cell
    const flashInvalid = useCallback((row: number, col: number) => {
        setInvalidCell({ row, col });
        setTimeout(() => setInvalidCell(null), 200);
    }, []);

    // Try to add cell to path with validation
    const tryAddCellToPath = useCallback((row: number, col: number) => {
        if (!puzzle) return false;

        // Check if this would skip a checkpoint
        if (wouldSkipCheckpoint(row, col)) {
            flashInvalid(row, col);
            return false;
        }

        addCellToPath(row, col);
        return true;
    }, [puzzle, wouldSkipCheckpoint, flashInvalid, addCellToPath]);

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

        const updatedPuzzle = { ...puzzle, grid: newGrid, currentPathLength: newPath.length };
        setPuzzle(updatedPuzzle);
        setCurrentPath(newPath);
        updateHint(updatedPuzzle, newPath);
    }, [puzzle, currentPath, updateHint]);

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

        const updatedPuzzle = { ...puzzle, grid: newGrid, currentPathLength: 0 };
        setPuzzle(updatedPuzzle);
        setCurrentPath([]);
        updateHint(updatedPuzzle, []);
    }, [puzzle, updateHint]);

    // Handle mouse up globally
    useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    // Render path lines as SVG
    const pathLines = useMemo(() => {
        if (!puzzle || currentPath.length < 2) return null;

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
                    width: puzzle.gridSize * CELL_SIZE,
                    height: puzzle.gridSize * CELL_SIZE,
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
    }, [puzzle, currentPath]);

    if (!puzzle) return null;

    // Show warning screen for level 2 first puzzle
    if (showLevelWarning) {
        return (
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.95)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}
            >
                <div
                    style={{
                        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
                        border: '3px solid #f6ad55',
                        borderRadius: 12,
                        padding: '40px 50px',
                        maxWidth: 450,
                        textAlign: 'center',
                        boxShadow: '0 0 30px rgba(246, 173, 85, 0.3)',
                    }}
                >
                    {/* Warning icon */}
                    <div style={{
                        fontSize: 60,
                        marginBottom: 20,
                    }}>
                        ⚠️
                    </div>

                    {/* Title */}
                    <h2 style={{
                        margin: '0 0 20px 0',
                        color: '#f6ad55',
                        fontFamily: 'monospace',
                        fontSize: 24,
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                    }}>
                        Nouveau Firewall
                    </h2>

                    {/* Warning text */}
                    <p style={{
                        margin: '0 0 15px 0',
                        color: '#e2e8f0',
                        fontSize: 18,
                        lineHeight: 1.6,
                        fontFamily: 'monospace',
                    }}>
                        À partir de maintenant, vous devez <span style={{ color: '#f6ad55', fontWeight: 'bold' }}>remplir TOUTES les cases</span> de la grille !
                    </p>

                    <p style={{
                        margin: '0 0 30px 0',
                        color: '#a0aec0',
                        fontSize: 14,
                        lineHeight: 1.5,
                        fontFamily: 'monospace',
                    }}>
                        Tracez un chemin qui passe par tous les checkpoints dans l'ordre ET qui remplit chaque case de la grille.
                    </p>

                    {/* Continue button */}
                    <button
                        onClick={() => setShowLevelWarning(false)}
                        style={{
                            padding: '12px 40px',
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#1a1a2e',
                            background: 'linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            textTransform: 'uppercase',
                            letterSpacing: 1,
                            transition: 'transform 0.1s, box-shadow 0.1s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(246, 173, 85, 0.5)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        Compris !
                    </button>
                </div>
            </div>
        );
    }

    const levelNames = ['', 'NIVEAU 1 - CONNEXION', 'NIVEAU 2 - PARCOURS', 'NIVEAU 3 - LABYRINTHE'];

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
                    fontSize: 20,
                }}>
                    {isCompleted ? 'CONNEXION REUSSIE !' : levelNames[puzzle.level]}
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
                        width: puzzle.gridSize * CELL_SIZE,
                        height: puzzle.gridSize * CELL_SIZE,
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
                                        borderRadius: 4,
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
    // Difficulty determines the level
    const level = difficulty;

    // Level config
    // Level 1: 5x5, 4 checkpoints, don't need to fill all
    // Level 1: 4x4, 4 checkpoints, connect only
    // Level 2: 4x4, 4 checkpoints, must fill all
    // Level 3: 5x5, 6 checkpoints, must fill all
    const gridSize = level === 3 ? 5 : 4;
    const maxCheckpoint = level === 3 ? 6 : 4;
    const mustFillAll = level >= 2;

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

    // Generate solution path (Hamiltonian for level 2/3, or shorter for level 1)
    const solution = mustFillAll
        ? generateHamiltonianPath(gridSize)
        : generateShortPath(gridSize, maxCheckpoint);

    // Place checkpoints along the solution
    const checkpoints = placeCheckpointsOnPath(solution, maxCheckpoint, mustFillAll);

    // Mark checkpoints in grid
    for (const checkpoint of checkpoints) {
        grid[checkpoint.row][checkpoint.col].fixedNumber = checkpoint.number;
    }

    return {
        grid,
        gridSize,
        currentPathLength: 0,
        checkpoints,
        solution,
        synapseId,
        targetNeuronId,
        isComplete: false,
        level,
        mustFillAll,
        maxCheckpoint,
    };
}

// Generate a short path for level 1 (just connecting checkpoints)
function generateShortPath(size: number, checkpointCount: number): { row: number; col: number }[] {
    // Generate a random wandering path
    const path: { row: number; col: number }[] = [];
    const visited: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

    // Start from a random position
    let row = Math.floor(Math.random() * size);
    let col = Math.floor(Math.random() * size);

    // Walk randomly until we have enough length for checkpoints
    const minLength = checkpointCount * 3; // At least 3 cells between each checkpoint
    const maxLength = checkpointCount * 5;
    const targetLength = minLength + Math.floor(Math.random() * (maxLength - minLength));

    while (path.length < targetLength) {
        if (!visited[row][col]) {
            path.push({ row, col });
            visited[row][col] = true;
        }

        // Get unvisited neighbors
        const neighbors = getUnvisitedNeighbors(row, col, size, visited);

        if (neighbors.length === 0) {
            // Dead end, backtrack or restart
            if (path.length >= checkpointCount * 2) break;
            // Restart from a different position
            row = Math.floor(Math.random() * size);
            col = Math.floor(Math.random() * size);
            continue;
        }

        // Move to a random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        row = next.row;
        col = next.col;
    }

    return path;
}

function getUnvisitedNeighbors(row: number, col: number, size: number, visited: boolean[][]) {
    const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
    ];

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

function placeCheckpointsOnPath(
    solution: { row: number; col: number }[],
    checkpointCount: number,
    mustFillAll: boolean
): { row: number; col: number; number: number }[] {
    const checkpoints: { row: number; col: number; number: number }[] = [];

    if (mustFillAll) {
        // For levels 2 and 3: spread checkpoints evenly across the full path
        const step = Math.floor(solution.length / (checkpointCount - 1));

        for (let i = 0; i < checkpointCount; i++) {
            let index: number;
            if (i === 0) {
                index = 0; // First checkpoint at start
            } else if (i === checkpointCount - 1) {
                index = solution.length - 1; // Last checkpoint at end
            } else {
                // Spread in between with slight randomization
                const baseIndex = i * step;
                const randomOffset = Math.floor(Math.random() * Math.floor(step * 0.3)) - Math.floor(step * 0.15);
                index = Math.max(1, Math.min(solution.length - 2, baseIndex + randomOffset));
            }

            checkpoints.push({ ...solution[index], number: i + 1 });
        }
    } else {
        // For level 1: place checkpoints along the path
        const step = Math.floor(solution.length / (checkpointCount - 1));

        for (let i = 0; i < checkpointCount; i++) {
            let index: number;
            if (i === 0) {
                index = 0;
            } else if (i === checkpointCount - 1) {
                index = solution.length - 1;
            } else {
                index = Math.min(solution.length - 1, i * step);
            }

            checkpoints.push({ ...solution[index], number: i + 1 });
        }
    }

    return checkpoints;
}
