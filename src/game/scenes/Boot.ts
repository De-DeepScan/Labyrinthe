import { Scene } from "phaser";

export default class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload(): void {
        // Boot scene doesn't need external assets for this game
        // We'll use simple graphics
    }

    create(): void {
        this.scene.start("Preloader");
    }
}
