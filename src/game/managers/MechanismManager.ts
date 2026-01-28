import { Scene } from "phaser";
import type { MazeData, Door, Lever, GridPosition } from "../types/interfaces";
import { GridUtils } from "../utils/GridUtils";
import { EventBus } from "../EventBus";

export class MechanismManager {
    private scene: Scene;
    private doors: Map<number, Door> = new Map();
    private levers: Map<number, Lever> = new Map();
    private positionToLever: Map<string, number> = new Map();
    private toScreen: (x: number, y: number) => { x: number; y: number };

    constructor(
        scene: Scene,
        mazeData: MazeData,
        screenProjector: (x: number, y: number) => { x: number; y: number } = (x, y) =>
            GridUtils.gridToScreen(x, y)
    ) {
        this.scene = scene;
        this.toScreen = screenProjector;
        this.initializeMechanisms(mazeData);
        this.setupEventListeners();
    }

    /**
     * Initialize doors and levers from maze data
     */
    private initializeMechanisms(mazeData: MazeData): void {
        // Initialize doors
        mazeData.doors.forEach((door) => {
            this.doors.set(door.id, { ...door, isOpen: false });
        });

        // Initialize levers
        mazeData.levers.forEach((lever) => {
            this.levers.set(lever.id, { ...lever, isActive: false });
            const key = GridUtils.positionKey({ x: lever.x, y: lever.y });
            this.positionToLever.set(key, lever.id);
        });
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        EventBus.on("guide-activate", (position: GridPosition) => {
            this.handleActivation(position);
        });
    }

    /**
     * Handle activation at a position
     */
    private handleActivation(position: GridPosition): void {
        const key = GridUtils.positionKey(position);
        const leverId = this.positionToLever.get(key);

        if (leverId !== undefined) {
            this.toggleLever(leverId);
        }
    }

    /**
     * Toggle a lever and its linked doors
     */
    private toggleLever(leverId: number): void {
        const lever = this.levers.get(leverId);
        if (!lever) return;

        // Toggle lever state
        lever.isActive = !lever.isActive;

        // Emit lever toggle event for visual update
        EventBus.emit("lever-toggle", {
            x: lever.x,
            y: lever.y,
            isActive: lever.isActive,
        });

        // Toggle linked doors
        lever.linkedDoorIds.forEach((doorId) => {
            this.toggleDoor(doorId);
        });

        // Visual feedback
        this.createActivationEffect(lever.x, lever.y);
    }

    /**
     * Toggle a door's open/closed state
     */
    private toggleDoor(doorId: number): void {
        const door = this.doors.get(doorId);
        if (!door) return;

        door.isOpen = !door.isOpen;

        // Emit door toggle event for visual update and collision
        EventBus.emit("door-toggle", {
            x: door.x,
            y: door.y,
            isOpen: door.isOpen,
        });

        // Visual feedback
        this.createDoorEffect(door.x, door.y, door.isOpen);
    }

    /**
     * Create visual effect when activating a lever
     */
    private createActivationEffect(x: number, y: number): void {
        const screenPos = this.toScreen(x, y);

        const circle = this.scene.add.circle(
            screenPos.x,
            screenPos.y,
            10,
            0x00ff00,
            1
        );

        this.scene.tweens.add({
            targets: circle,
            scale: 3,
            alpha: 0,
            duration: 300,
            ease: "Power2",
            onComplete: () => circle.destroy(),
        });
    }

    /**
     * Create visual effect when a door opens/closes
     */
    private createDoorEffect(x: number, y: number, isOpen: boolean): void {
        const screenPos = this.toScreen(x, y);
        const color = isOpen ? 0x00ff00 : 0xff0000;

        const rect = this.scene.add.rectangle(
            screenPos.x,
            screenPos.y,
            32,
            32,
            color,
            0.5
        );

        this.scene.tweens.add({
            targets: rect,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            ease: "Power2",
            onComplete: () => rect.destroy(),
        });
    }

    /**
     * Check if a door is open at position
     */
    isDoorOpen(x: number, y: number): boolean {
        for (const door of this.doors.values()) {
            if (door.x === x && door.y === y) {
                return door.isOpen;
            }
        }
        return false;
    }

    /**
     * Get lever at position
     */
    getLeverAt(x: number, y: number): Lever | undefined {
        const key = GridUtils.positionKey({ x, y });
        const leverId = this.positionToLever.get(key);
        return leverId !== undefined ? this.levers.get(leverId) : undefined;
    }

    /**
     * Get all doors
     */
    getDoors(): Door[] {
        return Array.from(this.doors.values());
    }

    /**
     * Get all levers
     */
    getLevers(): Lever[] {
        return Array.from(this.levers.values());
    }

    /**
     * Cleanup
     */
    destroy(): void {
        EventBus.off("guide-activate");
    }
}
