import { AUTO, Game } from "phaser";
import { GameConfig } from "./config/GameConfig";
import Boot from "./scenes/Boot";
import Preloader from "./scenes/Preloader";
import RoleSelect from "./scenes/RoleSelect";
import Victory from "./scenes/Victory";

// Placeholder scenes - will be replaced in Phase 9-10
class ExplorerGame extends Phaser.Scene {
    constructor() {
        super("ExplorerGame");
    }
    create() {
        this.add
            .text(640, 360, "Explorer Game - Coming Soon", {
                fontSize: "32px",
                color: "#ffffff",
            })
            .setOrigin(0.5);
    }
}

class ProtectorGame extends Phaser.Scene {
    constructor() {
        super("ProtectorGame");
    }
    create() {
        this.add
            .text(640, 360, "Protector Game - Coming Soon", {
                fontSize: "32px",
                color: "#ffffff",
            })
            .setOrigin(0.5);
    }
}

class Defeat extends Phaser.Scene {
    constructor() {
        super("Defeat");
    }
    create() {
        this.add
            .text(640, 360, "DEFEAT", {
                fontSize: "48px",
                color: "#e53e3e",
            })
            .setOrigin(0.5);
    }
}

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
    scene: [Boot, Preloader, RoleSelect, ExplorerGame, ProtectorGame, Victory, Defeat],
};

const StartGame = (parent: string): Phaser.Game => {
    return new Game({ ...config, parent });
};

export default StartGame;
