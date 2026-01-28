// Tile type IDs
export const TILE_IDS = {
    FLOOR: 0,
    WALL: 1,
    DOOR: 2,
    LEVER: 3,
    EXIT: 4,
    EXPLORER_SPAWN: 5,
} as const;

// Depth constants for rendering order
export const DEPTH = {
    FLOOR: 0,
    WALL: 10,
    DOOR: 20,
    LEVER: 20,
    EXIT: 15,
    PLAYER: 100,
    GUIDE_CURSOR: 200,
    FOG: 500,
    UI: 1000,
} as const;

// Movement directions
export const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
} as const;

// Animation durations (in ms)
export const ANIMATION = {
    PLAYER_MOVE: 120,
    DOOR_TOGGLE: 200,
    LEVER_TOGGLE: 150,
} as const;
