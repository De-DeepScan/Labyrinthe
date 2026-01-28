import { LogicGate } from "../types/interfaces";

/**
 * Utility functions for evaluating logic gates
 */
export class LogicGateUtils {
    /**
     * Evaluate a logic gate with given inputs
     */
    static evaluate(gate: LogicGate, inputs: (0 | 1)[]): 0 | 1 {
        if (inputs.length === 0) return 0;

        switch (gate) {
            case LogicGate.AND:
                return inputs.every((v) => v === 1) ? 1 : 0;

            case LogicGate.OR:
                return inputs.some((v) => v === 1) ? 1 : 0;

            case LogicGate.XOR: {
                let count = 0;
                for (const v of inputs) {
                    if (v === 1) count++;
                }
                return (count % 2) as 0 | 1;
            }

            default:
                return inputs[0];
        }
    }

    /**
     * Get a random gate based on difficulty distribution
     */
    static getRandomGate(difficulty: number): LogicGate {
        const distributions: Record<number, { OR: number; AND: number; XOR: number }> = {
            1: { OR: 0.7, AND: 0.2, XOR: 0.1 },
            2: { OR: 0.4, AND: 0.4, XOR: 0.2 },
            3: { OR: 0.2, AND: 0.4, XOR: 0.4 },
        };

        const dist = distributions[difficulty] || distributions[1];
        const rand = Math.random();

        if (rand < dist.OR) return LogicGate.OR;
        if (rand < dist.OR + dist.AND) return LogicGate.AND;
        return LogicGate.XOR;
    }

    /**
     * Get display symbol for a gate
     */
    static getSymbol(gate: LogicGate): string {
        switch (gate) {
            case LogicGate.AND:
                return "&";
            case LogicGate.OR:
                return "|";
            case LogicGate.XOR:
                return "^";
            default:
                return "?";
        }
    }

    /**
     * Get description for a gate
     */
    static getDescription(gate: LogicGate): string {
        switch (gate) {
            case LogicGate.AND:
                return "AND: All inputs must be ON";
            case LogicGate.OR:
                return "OR: At least one input must be ON";
            case LogicGate.XOR:
                return "XOR: Odd number of inputs must be ON";
            default:
                return "";
        }
    }
}
