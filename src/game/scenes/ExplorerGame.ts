import { Scene } from "phaser";
import { GameConfig } from "../config/GameConfig";
import { MazeGenerator } from "../generators/MazeGenerator";
import { MapManager } from "../managers/MapManager";
import { PlayerManager } from "../managers/PlayerManager";
import { MechanismManager } from "../managers/MechanismManager";
import { FogOfWarManager } from "../managers/FogOfWarManager";
import { NetworkManager } from "../services/NetworkManager";
import type { MazeData, GridPosition } from "../types/interfaces";
import { EventBus } from "../EventBus";
import { GridUtils } from "../utils/GridUtils";

export default class ExplorerGame extends Scene {
    private mazeData!: MazeData;
    private mapManager!: MapManager;
    private playerManager!: PlayerManager;
    private mechanismManager!: MechanismManager;
    private fogOfWarManager!: FogOfWarManager;
    private networkManager!: NetworkManager;
    private isGameOver = false;

    constructor() {
        super("ExplorerGame");
    }

    create(): void {
        this.isGameOver = false;
        this.networkManager = NetworkManager.getInstance();

        // Generate maze
        this.mazeData = MazeGenerator.generate(
            GameConfig.MAZE_WIDTH,
            GameConfig.MAZE_HEIGHT
        );

        // Send maze to guide
        this.networkManager.sendMaze(this.mazeData);

        // Initialize managers
        this.initializeManagers();

        // Setup camera
        this.setupCamera();

        // Setup events
        this.setupEventListeners();

        // UI
        this.addRoleLabel();

        EventBus.emit("current-scene-ready", this);
    }

    private initializeManagers(): void {
        // Create fog manager FIRST (before map renders)
        this.fogOfWarManager = new FogOfWarManager(
            this,
            this.mazeData,
            this.mazeData.explorerSpawn,
            {
                projection: "topdown",
            }
        );

        // Create map manager and link fog BEFORE rendering
        this.mapManager = new MapManager(this, this.mazeData, {
            hideLevers: true,
            doorsAsWalls: true,
            hideExitGlow: true,
            projection: "topdown",
        });
        this.mapManager.setFogManager(this.fogOfWarManager);
        this.mapManager.render();

        // Apply initial visibility after render
        this.fogOfWarManager.applyInitialVisibility();

        this.mechanismManager = new MechanismManager(
            this,
            this.mazeData,
            (x, y) => GridUtils.gridToScreen(x, y)
        );

        this.playerManager = new PlayerManager(
            this,
            this.mazeData.explorerSpawn,
            {
                projection: "topdown",
            }
        );

        this.playerManager.setCollisionData(
            this.mazeData.grid,
            this.mazeData.width,
            this.mazeData.height,
            this.mazeData.exitPosition
        );
    }

    private setupCamera(): void {
        const mapWidth = this.mazeData.width * GameConfig.TILE_SIZE;
        const mapHeight = this.mazeData.height * GameConfig.TILE_SIZE;

        this.cameras.main.setZoom(2.5);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBackgroundColor(0x0a0a0a);

        // Center camera on spawn
        const spawn = this.mazeData.explorerSpawn;
        const spawnScreen = GridUtils.gridToScreen(spawn.x, spawn.y);
        this.cameras.main.centerOn(spawnScreen.x, spawnScreen.y);
    }

    update(): void {
        if (this.isGameOver) return;

        this.playerManager.update();

        // Camera follows player smoothly
        const pos = this.playerManager.getGridPosition();
        const screenPos = GridUtils.gridToScreen(pos.x, pos.y);
        this.cameras.main.centerOn(screenPos.x, screenPos.y);
    }

    private setupEventListeners(): void {
        EventBus.on("explorer-reached-exit", () => this.handleVictory());

        EventBus.on(
            "network-door-changed",
            (data: { x: number; y: number; isOpen: boolean }) => {
                EventBus.emit("door-toggle", data);
            }
        );

        EventBus.on(
            "network-lever-activated",
            (position: GridPosition) => {
                EventBus.emit("guide-activate", position);
            }
        );

        EventBus.on("network-game-restart", () => this.restartGame());
    }

    private addRoleLabel(): void {
        const label = this.add.text(10, 10, "EXPLORATEUR", {
            fontFamily: "Arial Black",
            fontSize: "24px",
            color: "#4a9eff",
            stroke: "#000000",
            strokeThickness: 4,
        });
        label.setScrollFactor(0);
        label.setDepth(1000);

        const instructions = this.add.text(
            10,
            45,
            "Trouvez la sortie verte!",
            {
                fontFamily: "Arial",
                fontSize: "16px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
            }
        );
        instructions.setScrollFactor(0);
        instructions.setDepth(1000);
    }

    private handleVictory(): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        this.networkManager.sendGameWon();

        this.time.delayedCall(500, () => {
            this.cleanup();
            this.scene.start("Victory");
        });
    }

    private restartGame(): void {
        this.cleanup();
        this.scene.start("ExplorerGame");
    }

    private cleanup(): void {
        EventBus.off("explorer-reached-exit");
        EventBus.off("network-door-changed");
        EventBus.off("network-lever-activated");
        EventBus.off("network-game-restart");

        this.mapManager?.destroy();
        this.playerManager?.destroy();
        this.mechanismManager?.destroy();
        this.fogOfWarManager?.destroy();
    }
}
