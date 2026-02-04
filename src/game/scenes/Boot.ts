import { Scene } from "phaser";

export default class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        // No assets to load for now
    }

    create() {
        this.scene.start("Preloader");
    }
}
