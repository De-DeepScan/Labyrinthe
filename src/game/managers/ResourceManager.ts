import { RESOURCE_CONFIG } from "../config/NeuralNetworkConfig";
import { EventBus } from "../EventBus";

/**
 * Manages the Protector's resources
 */
export class ResourceManager {
    private current: number;
    private maximum: number;
    private destroyCost: number;

    // Callbacks
    private onChangeCallback?: (current: number, max: number) => void;
    private onInsufficientCallback?: () => void;

    constructor(
        initial: number = RESOURCE_CONFIG.INITIAL_RESOURCES,
        max: number = RESOURCE_CONFIG.MAX_RESOURCES,
        destroyCost: number = RESOURCE_CONFIG.DESTROY_COST
    ) {
        this.current = initial;
        this.maximum = max;
        this.destroyCost = destroyCost;
    }

    /**
     * Get current resources
     */
    getResources(): number {
        return this.current;
    }

    /**
     * Get maximum resources
     */
    getMaxResources(): number {
        return this.maximum;
    }

    /**
     * Get destroy cost
     */
    getDestroyCost(): number {
        return this.destroyCost;
    }

    /**
     * Check if can afford a cost
     */
    canAfford(cost: number): boolean {
        return this.current >= cost;
    }

    /**
     * Check if can afford to destroy
     */
    canDestroy(): boolean {
        return this.canAfford(this.destroyCost);
    }

    /**
     * Add resources
     */
    addResources(amount: number): void {
        const previousAmount = this.current;
        this.current = Math.min(this.maximum, this.current + amount);

        if (this.current !== previousAmount) {
            this.notifyChange();
            EventBus.emit("resources-changed", {
                current: this.current,
                max: this.maximum,
                delta: this.current - previousAmount,
            });
        }
    }

    /**
     * Spend resources
     * @returns true if successful, false if insufficient
     */
    spendResources(amount: number): boolean {
        if (!this.canAfford(amount)) {
            this.onInsufficientCallback?.();
            EventBus.emit("resources-insufficient", { required: amount, current: this.current });
            return false;
        }

        this.current -= amount;
        this.notifyChange();
        EventBus.emit("resources-changed", {
            current: this.current,
            max: this.maximum,
            delta: -amount,
        });
        return true;
    }

    /**
     * Try to spend destroy cost
     * @returns true if successful, false if insufficient
     */
    tryDestroy(): boolean {
        return this.spendResources(this.destroyCost);
    }

    /**
     * Get resource percentage (0-1)
     */
    getPercentage(): number {
        return this.current / this.maximum;
    }

    /**
     * Reset to initial state
     */
    reset(): void {
        this.current = RESOURCE_CONFIG.INITIAL_RESOURCES;
        this.notifyChange();
    }

    /**
     * Notify change callback
     */
    private notifyChange(): void {
        this.onChangeCallback?.(this.current, this.maximum);
    }

    /**
     * Set change callback
     */
    onResourcesChanged(callback: (current: number, max: number) => void): void {
        this.onChangeCallback = callback;
    }

    /**
     * Set insufficient callback
     */
    onInsufficientResources(callback: () => void): void {
        this.onInsufficientCallback = callback;
    }
}
