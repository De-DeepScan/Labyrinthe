// Maze data structure
export interface MazeData {
    grid: number[][];
    explorerSpawn: GridPosition;
    exitPosition: GridPosition;
    doors: Door[];
    levers: Lever[];
    width: number;
    height: number;
}

// Grid position
export interface GridPosition {
    x: number;
    y: number;
}

// Door mechanism
export interface Door {
    id: number;
    x: number;
    y: number;
    isOpen: boolean;
    sprite?: Phaser.GameObjects.Rectangle;
}

// Lever mechanism
export interface Lever {
    id: number;
    x: number;
    y: number;
    isActive: boolean;
    linkedDoorIds: number[];
    sprite?: Phaser.GameObjects.Rectangle;
}

// Player controls interface
export interface PlayerControls {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    action?: Phaser.Input.Keyboard.Key;
}

// Player manager interface
export interface IPlayerManager {
    getGridPosition(): GridPosition;
    getSprite(): Phaser.GameObjects.Rectangle | undefined;
    update(): void;
}

// Map manager interface
export interface IMapManager {
    isWalkable(x: number, y: number): boolean;
    isDoor(x: number, y: number): boolean;
    isExit(x: number, y: number): boolean;
    isLever(x: number, y: number): boolean;
    getTileAt(x: number, y: number): number;
}
