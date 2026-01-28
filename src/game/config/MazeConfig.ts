import { TILE_IDS } from "./Constants";
import { GameConfig } from "./GameConfig";

export interface TileTypeConfig {
    color: number;
    isSolid: boolean;
    isWalkable: boolean;
    isDoor?: boolean;
    isLever?: boolean;
    isExit?: boolean;
    isSpawn?: boolean;
}

export const MAZE_TILE_TYPES: { [key: number]: TileTypeConfig } = {
    [TILE_IDS.FLOOR]: {
        color: GameConfig.COLORS.FLOOR,
        isSolid: false,
        isWalkable: true,
    },
    [TILE_IDS.WALL]: {
        color: GameConfig.COLORS.WALL,
        isSolid: true,
        isWalkable: false,
    },
    [TILE_IDS.DOOR]: {
        color: GameConfig.COLORS.DOOR_CLOSED,
        isSolid: true,
        isWalkable: false,
        isDoor: true,
    },
    [TILE_IDS.LEVER]: {
        color: GameConfig.COLORS.LEVER_OFF,
        isSolid: false,
        isWalkable: true,
        isLever: true,
    },
    [TILE_IDS.EXIT]: {
        color: GameConfig.COLORS.EXIT,
        isSolid: false,
        isWalkable: true,
        isExit: true,
    },
    [TILE_IDS.EXPLORER_SPAWN]: {
        color: GameConfig.COLORS.FLOOR,
        isSolid: false,
        isWalkable: true,
        isSpawn: true,
    },
};
