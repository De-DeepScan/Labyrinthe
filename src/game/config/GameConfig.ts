export class GameConfig {
    // Maze dimensions (odd numbers for proper maze generation)
    static readonly MAZE_WIDTH = 41;
    static readonly MAZE_HEIGHT = 35;
    static readonly TILE_SIZE = 32;
    static readonly ISO_TILE_WIDTH = GameConfig.TILE_SIZE * 2;
    static readonly ISO_TILE_HEIGHT = GameConfig.TILE_SIZE;
    static readonly ISO_TILT_DEG = 80;
    static readonly ISO_VERTICAL_SCALE = Math.sin((GameConfig.ISO_TILT_DEG * Math.PI) / 180);
    static readonly TILE_SPACING = 1.8;

    // Explorer player configuration
    static readonly EXPLORER_SPEED = 150;
    static readonly EXPLORER_VISION_RADIUS = 2; // Tiles visible around explorer (reduced)
    static readonly PLAYER_SPEED = GameConfig.EXPLORER_SPEED;

    // Guide player configuration
    static readonly GUIDE_CURSOR_SPEED = 300;

    // Mechanism configuration
    static readonly DOOR_COUNT = 8;
    static readonly LEVER_COUNT = 8;

    // Screen configuration
    static readonly SCREEN_WIDTH = 1280;
    static readonly SCREEN_HEIGHT = 720;
    static readonly SPLIT_RATIO = 0.5; // 50% each for split screen

    // Spawn positions
    static readonly EXPLORER_SPAWN = { x: 1, y: 1 };

    // Colors
    static readonly COLORS = {
        FLOOR: 0x3a3a3a,
        WALL: 0x1a1a1a,
        EXPLORER: 0x4a9eff,
        GUIDE_CURSOR: 0xffcc00,
        EXIT: 0x00ff88,
        DOOR_CLOSED: 0x8b4513,
        DOOR_OPEN: 0x654321,
        LEVER_OFF: 0x666666,
        LEVER_ON: 0x00ff00,
        FOG: 0x000000,
        FOG_REVEALED: 0x111111,
    } as const;

    // Link ("wire") styling for the neuron-like grid
    static readonly LINK_STYLE = {
        WIDTH: 6,
        COLOR: 0x6c86ff,
        ALPHA: 0.9,
        NODE_COLOR: 0x6c86ff,
        NODE_ALPHA: 0.95,
        NODE_RADIUS: Math.max(3, Math.floor(GameConfig.TILE_SIZE * 0.12)),
    } as const;

    // Style for disabled/cut links (formerly "walls")
    static readonly LINK_OFF_STYLE = {
        WIDTH: 4,
        COLOR: 0x3c4566,
        ALPHA: 0.35,
        NODE_COLOR: 0x3c4566,
        NODE_ALPHA: 0.4,
        NODE_RADIUS: Math.max(2, Math.floor(GameConfig.TILE_SIZE * 0.08)),
    } as const;

    // Phaser configuration
    static readonly PHASER_CONFIG = {
        BACKGROUND_COLOR: "#1a1a2e",
        PARENT: "game-container",
    } as const;
}
