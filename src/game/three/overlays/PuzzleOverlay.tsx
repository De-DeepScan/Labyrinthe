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

// Cyberpunk terminal theme colors
const COLORS = {
    cellBg: 'rgba(0, 20, 30, 0.8)',
    cellBorder: '#00d4aa33',
    cellHover: '#00d4aa',
    pathCell: '#00d4aa',
    checkpoint: '#ff9933',
    checkpointReached: '#00ff88',
    pathLine: '#00ffcc',
    invalid: '#ff3366',
    textNormal: '#00d4aa',
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

    // Generate puzzle based on difficulty/level
    useEffect(() => {
        const newPuzzle = generateGridPuzzle(synapseId, targetNeuronId, difficulty);
        setPuzzle(newPuzzle);
        updateHint(newPuzzle, []);
    }, [synapseId, targetNeuronId, difficulty]);

    // Update hint message based on puzzle state
    const updateHint = useCallback((puz: GridPuzzleState, path: { row: number; col: number }[]) => {
        const checkpointsReached = puz.checkpoints.filter(cp =>
            path.some(p => p.row === cp.row && p.col === cp.col)
        ).length;
        setHint(`Reliez les ${puz.maxCheckpoint} points dans l'ordre (${checkpointsReached}/${puz.maxCheckpoint})`);
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

        // All levels: Just need to connect all checkpoints and end on the last one
        const lastCell = path[path.length - 1];
        const lastCheckpoint = puz.checkpoints[puz.checkpoints.length - 1];
        if (lastCell.row === lastCheckpoint.row && lastCell.col === lastCheckpoint.col) {
            completeSuccess();
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
                {/* Glow effect */}
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <path
                    d={d}
                    stroke="#00ffcc"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.9}
                    filter="url(#glow)"
                />
            </svg>
        );
    }, [puzzle, currentPath]);

    if (!puzzle) return null;

    const levelNames = ['', 'FIREWALL LV.1', 'FIREWALL LV.2', 'FIREWALL LV.3'];

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 10, 20, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                fontFamily: '"Courier New", monospace',
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            {/* CRT scanline effect */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
                    zIndex: 1001,
                }}
            />

            <div
                style={{
                    background: 'rgba(0, 10, 20, 0.98)',
                    border: '2px solid #00d4aa',
                    padding: 30,
                    animation: 'puzzleIn 0.2s ease-out',
                    boxShadow: '0 0 30px rgba(0, 212, 170, 0.3), inset 0 0 30px rgba(0, 212, 170, 0.05)',
                    position: 'relative',
                }}
            >
                {/* Header bar */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, transparent, #00d4aa, transparent)',
                }} />

                {/* Title */}
                <div style={{
                    margin: '0 0 8px 0',
                    textAlign: 'center',
                    color: isCompleted ? '#00ff88' : '#00d4aa',
                    fontSize: 18,
                    letterSpacing: 4,
                    textTransform: 'uppercase',
                    textShadow: isCompleted ? '0 0 10px #00ff88' : '0 0 10px rgba(0, 212, 170, 0.5)',
                }}>
                    {isCompleted ? '> ACCÈS AUTORISÉ <' : `> ${levelNames[puzzle.level]} <`}
                </div>

                {/* Subtitle */}
                <div style={{
                    margin: '0 0 5px 0',
                    textAlign: 'center',
                    color: '#00d4aa88',
                    fontSize: 10,
                    letterSpacing: 2,
                }}>
                    SYSTÈME DE SÉCURITÉ NEURAL
                </div>

                {/* Instructions */}
                <div style={{
                    margin: '0 0 15px 0',
                    textAlign: 'center',
                    color: '#00d4aa',
                    fontSize: 14,
                    animation: 'pulse-text 2s infinite',
                }}>
                    TRACEZ LE CHEMIN AVEC LA SOURIS
                </div>

                {/* Hint */}
                <div style={{
                    margin: '0 0 20px 0',
                    textAlign: 'center',
                    color: '#888',
                    fontSize: 12,
                    padding: '8px 15px',
                    background: 'rgba(0, 212, 170, 0.1)',
                    border: '1px solid rgba(0, 212, 170, 0.2)',
                }}>
                    {hint}
                </div>

                {/* Grid */}
                <div
                    style={{
                        position: 'relative',
                        width: puzzle.gridSize * CELL_SIZE,
                        height: puzzle.gridSize * CELL_SIZE,
                        margin: '0 auto',
                        border: '1px solid rgba(0, 212, 170, 0.3)',
                        boxShadow: 'inset 0 0 20px rgba(0, 212, 170, 0.1)',
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
                            let glowColor = 'transparent';
                            if (isInvalid) {
                                bgColor = 'rgba(255, 51, 102, 0.4)';
                                glowColor = '#ff3366';
                            } else if (isInPath) {
                                bgColor = isCheckpoint ? 'rgba(0, 255, 136, 0.3)' : 'rgba(0, 212, 170, 0.25)';
                                glowColor = isCheckpoint ? '#00ff88' : '#00d4aa';
                            } else if (isCheckpoint) {
                                bgColor = 'rgba(255, 153, 51, 0.3)';
                                glowColor = '#ff9933';
                            }

                            let borderColor = COLORS.cellBorder;
                            if (isInPath) {
                                borderColor = COLORS.pathLine;
                            } else if (isHovered && !isInPath) {
                                borderColor = COLORS.cellHover;
                            } else if (isCheckpoint) {
                                borderColor = '#ff993366';
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
                                        border: `1px solid ${borderColor}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'all 0.15s',
                                        boxShadow: glowColor !== 'transparent' ? `0 0 10px ${glowColor}40, inset 0 0 15px ${glowColor}20` : 'none',
                                    }}
                                    onMouseDown={() => handleCellClick(rowIndex, colIndex)}
                                    onMouseEnter={() => handleCellHover(rowIndex, colIndex)}
                                    onMouseLeave={() => setHoveredCell(null)}
                                >
                                    {isCheckpoint && (
                                        <span style={{
                                            fontFamily: '"Courier New", monospace',
                                            fontSize: 18,
                                            fontWeight: 'bold',
                                            color: isInPath ? '#00ff88' : '#ff9933',
                                            textShadow: isInPath ? '0 0 8px #00ff88' : '0 0 8px #ff9933',
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
                    gap: 20,
                    marginTop: 25,
                }}>
                    <button
                        onClick={resetPuzzle}
                        style={{
                            padding: '10px 30px',
                            background: 'transparent',
                            border: '1px solid #00d4aa',
                            color: '#00d4aa',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 12,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0, 212, 170, 0.2)';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 212, 170, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        [R] Reset
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 30px',
                            background: 'transparent',
                            border: '1px solid #ff3366',
                            color: '#ff3366',
                            fontFamily: '"Courier New", monospace',
                            fontSize: 12,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 51, 102, 0.2)';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 51, 102, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        [ESC] Annuler
                    </button>
                </div>

                {/* Footer bar */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, transparent, #00d4aa, transparent)',
                }} />
            </div>

            <style>{`
                @keyframes puzzleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes pulse-text {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
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
    // Level 1: 4x4, 4 checkpoints, connect checkpoints only
    // Level 2: 4x4, 4 checkpoints, connect checkpoints only
    // Level 3: 5x5, 6 checkpoints, connect checkpoints only (bigger grid)
    const gridSize = level === 3 ? 5 : 4;
    const maxCheckpoint = level === 3 ? 6 : 4;
    const mustFillAll = false; // Never require filling all cells

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
