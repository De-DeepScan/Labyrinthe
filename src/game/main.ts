import { AUTO, Game } from "phaser";
import { GameConfig } from "./config/GameConfig";
import Boot from "./scenes/Boot";
import Preloader from "./scenes/Preloader";
import RoleSelect from "./scenes/RoleSelect";
import ExplorerGame from "./scenes/ExplorerGame";
import GuideGame from "./scenes/GuideGame";
import Victory from "./scenes/Victory";

const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GameConfig.SCREEN_WIDTH,
    height: GameConfig.SCREEN_HEIGHT,
    parent: GameConfig.PHASER_CONFIG.PARENT,
    backgroundColor: GameConfig.PHASER_CONFIG.BACKGROUND_COLOR,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
        },
    },
    scene: [Boot, Preloader, RoleSelect, ExplorerGame, GuideGame, Victory],
};

const StartGame = (parent: string): Phaser.Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
