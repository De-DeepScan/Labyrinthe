import type { Neuron, Synapse, NeuralNetworkData } from "../types/interfaces";
import { NeuronType, SynapseState } from "../types/interfaces";
import { NEURAL_NETWORK_CONFIG } from "../config/NeuralNetworkConfig";

interface Vector2 {
    x: number;
    y: number;
}

/**
 * Generates an organic-looking neural network using force-directed layout
 */
export class NeuralNetworkGenerator {
    /**
     * Generate a complete neural network
     */
    static generate(
        width: number = NEURAL_NETWORK_CONFIG.NETWORK_WIDTH,
        height: number = NEURAL_NETWORK_CONFIG.NETWORK_HEIGHT,
        neuronCount: number = NEURAL_NETWORK_CONFIG.NEURON_COUNT
    ): NeuralNetworkData {
        // Generate neurons
        const neurons = this.placeNeurons(width, height, neuronCount);

        // Create synapses between nearby neurons
        const synapses = this.createSynapses(neurons);

        // Ensure the network is connected
        this.ensureConnectivity(neurons, synapses);

        // Assign entry and core neurons
        const { entryId, coreId } = this.assignSpecialNeurons(neurons, width, height);

        // Apply force-directed layout for organic appearance
        this.applyForceDirectedLayout(neurons, synapses, width, height);

        // Update neuron connections array based on synapses
        this.updateNeuronConnections(neurons, synapses);

        // Mark junction neurons (3+ connections)
        this.markJunctionNeurons(neurons);

        // Assign puzzle difficulty to synapses based on distance from entry
        this.assignSynapseDifficulty(neurons, synapses, entryId);

        // Convert to records
        const neuronRecord: Record<string, Neuron> = {};
        const synapseRecord: Record<string, Synapse> = {};

        neurons.forEach((n) => (neuronRecord[n.id] = n));
        synapses.forEach((s) => (synapseRecord[s.id] = s));

        return {
            neurons: neuronRecord,
            synapses: synapseRecord,
            entryNeuronId: entryId,
            coreNeuronId: coreId,
            width,
            height,
        };
    }

    /**
     * Place neurons randomly within bounds
     */
    private static placeNeurons(width: number, height: number, count: number): Neuron[] {
        const neurons: Neuron[] = [];
        const padding = 50;
        const minDistance = NEURAL_NETWORK_CONFIG.MIN_NEURON_DISTANCE;

        for (let i = 0; i < count; i++) {
            let x: number, y: number;
            let attempts = 0;
            const maxAttempts = 100;

            // Try to find a position that's not too close to existing neurons
            do {
                x = padding + Math.random() * (width - padding * 2);
                y = padding + Math.random() * (height - padding * 2);
                attempts++;
            } while (
                attempts < maxAttempts &&
                neurons.some((n) => this.distance(n, { x, y }) < minDistance)
            );

            neurons.push({
                id: `n_${i}`,
                x,
                y,
                type: NeuronType.NORMAL,
                connections: [],
                isActivated: false,
                isBlocked: false,
            });
        }

        return neurons;
    }

    /**
     * Create synapses between neurons based on proximity
     */
    private static createSynapses(neurons: Neuron[]): Synapse[] {
        const synapses: Synapse[] = [];
        const maxDistance = NEURAL_NETWORK_CONFIG.MIN_NEURON_DISTANCE * 3;
        let synapseId = 0;

        for (let i = 0; i < neurons.length; i++) {
            const neuronA = neurons[i];

            // Find nearby neurons and connect
            const nearby = neurons
                .filter((_, idx) => idx !== i)
                .map((n) => ({ neuron: n, dist: this.distance(neuronA, n) }))
                .filter((item) => item.dist < maxDistance)
                .sort((a, b) => a.dist - b.dist);

            // Connect to 2-4 nearest neurons
            const connectionCount = Math.min(
                nearby.length,
                NEURAL_NETWORK_CONFIG.MIN_CONNECTIONS +
                    Math.floor(Math.random() * (NEURAL_NETWORK_CONFIG.MAX_CONNECTIONS - NEURAL_NETWORK_CONFIG.MIN_CONNECTIONS))
            );

            for (let j = 0; j < connectionCount; j++) {
                const neuronB = nearby[j].neuron;

                // Check if synapse already exists
                const exists = synapses.some(
                    (s) =>
                        (s.fromNeuronId === neuronA.id && s.toNeuronId === neuronB.id) ||
                        (s.fromNeuronId === neuronB.id && s.toNeuronId === neuronA.id)
                );

                if (!exists) {
                    synapses.push({
                        id: `s_${synapseId++}`,
                        fromNeuronId: neuronA.id,
                        toNeuronId: neuronB.id,
                        state: SynapseState.DORMANT,
                        difficulty: 1,
                    });
                }
            }
        }

        return synapses;
    }

    /**
     * Ensure all neurons are connected (no isolated nodes)
     */
    private static ensureConnectivity(neurons: Neuron[], synapses: Synapse[]): void {
        // Build adjacency list
        const adjacency = new Map<string, Set<string>>();
        neurons.forEach((n) => adjacency.set(n.id, new Set()));

        synapses.forEach((s) => {
            adjacency.get(s.fromNeuronId)?.add(s.toNeuronId);
            adjacency.get(s.toNeuronId)?.add(s.fromNeuronId);
        });

        // Find connected components using BFS
        const visited = new Set<string>();
        const components: string[][] = [];

        for (const neuron of neurons) {
            if (visited.has(neuron.id)) continue;

            const component: string[] = [];
            const queue = [neuron.id];

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visited.has(current)) continue;

                visited.add(current);
                component.push(current);

                const neighbors = adjacency.get(current) || new Set();
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }

            components.push(component);
        }

        // Connect isolated components to the main component
        if (components.length > 1) {
            const mainComponent = components[0];
            let synapseId = synapses.length;

            for (let i = 1; i < components.length; i++) {
                // Find closest pair between main component and this component
                let minDist = Infinity;
                let bestPair: [string, string] | null = null;

                for (const mainId of mainComponent) {
                    const mainNeuron = neurons.find((n) => n.id === mainId)!;
                    for (const otherId of components[i]) {
                        const otherNeuron = neurons.find((n) => n.id === otherId)!;
                        const dist = this.distance(mainNeuron, otherNeuron);
                        if (dist < minDist) {
                            minDist = dist;
                            bestPair = [mainId, otherId];
                        }
                    }
                }

                if (bestPair) {
                    synapses.push({
                        id: `s_${synapseId++}`,
                        fromNeuronId: bestPair[0],
                        toNeuronId: bestPair[1],
                        state: SynapseState.DORMANT,
                        difficulty: 1,
                    });

                    // Merge component into main
                    mainComponent.push(...components[i]);
                }
            }
        }
    }

    /**
     * Assign entry (edge) and core (center) neurons
     */
    private static assignSpecialNeurons(
        neurons: Neuron[],
        width: number,
        height: number
    ): { entryId: string; coreId: string } {
        const centerX = width / 2;
        const centerY = height / 2;

        // Find neuron closest to center -> CORE
        let coreNeuron = neurons[0];
        let minDistToCenter = Infinity;

        for (const neuron of neurons) {
            const dist = this.distance(neuron, { x: centerX, y: centerY });
            if (dist < minDistToCenter) {
                minDistToCenter = dist;
                coreNeuron = neuron;
            }
        }
        coreNeuron.type = NeuronType.CORE;

        // Find neuron furthest from core -> ENTRY
        let entryNeuron = neurons[0];
        let maxDistFromCore = 0;

        for (const neuron of neurons) {
            if (neuron.id === coreNeuron.id) continue;
            const dist = this.distance(neuron, coreNeuron);
            if (dist > maxDistFromCore) {
                maxDistFromCore = dist;
                entryNeuron = neuron;
            }
        }
        entryNeuron.type = NeuronType.ENTRY;
        entryNeuron.isActivated = true; // Entry is already activated

        return { entryId: entryNeuron.id, coreId: coreNeuron.id };
    }

    /**
     * Apply force-directed layout algorithm for organic appearance
     */
    private static applyForceDirectedLayout(
        neurons: Neuron[],
        synapses: Synapse[],
        width: number,
        height: number
    ): void {
        const iterations = NEURAL_NETWORK_CONFIG.FORCE_ITERATIONS;
        const repulsionStrength = 5000;
        const attractionStrength = 0.01;
        const damping = 0.9;
        const minMovement = 0.1;
        const padding = 50;

        // Build adjacency for attraction
        const connected = new Map<string, Set<string>>();
        neurons.forEach((n) => connected.set(n.id, new Set()));
        synapses.forEach((s) => {
            connected.get(s.fromNeuronId)?.add(s.toNeuronId);
            connected.get(s.toNeuronId)?.add(s.fromNeuronId);
        });

        // Velocity for each neuron
        const velocity = new Map<string, Vector2>();
        neurons.forEach((n) => velocity.set(n.id, { x: 0, y: 0 }));

        for (let iter = 0; iter < iterations; iter++) {
            // Calculate forces
            for (const neuron of neurons) {
                let fx = 0;
                let fy = 0;

                // Repulsion from all other neurons
                for (const other of neurons) {
                    if (other.id === neuron.id) continue;

                    const dx = neuron.x - other.x;
                    const dy = neuron.y - other.y;
                    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

                    const force = repulsionStrength / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }

                // Attraction to connected neurons
                const neighbors = connected.get(neuron.id) || new Set();
                for (const neighborId of neighbors) {
                    const neighbor = neurons.find((n) => n.id === neighborId);
                    if (!neighbor) continue;

                    const dx = neighbor.x - neuron.x;
                    const dy = neighbor.y - neuron.y;

                    fx += dx * attractionStrength;
                    fy += dy * attractionStrength;
                }

                // Center gravity for core
                if (neuron.type === NeuronType.CORE) {
                    const centerX = width / 2;
                    const centerY = height / 2;
                    fx += (centerX - neuron.x) * 0.05;
                    fy += (centerY - neuron.y) * 0.05;
                }

                // Edge gravity for entry
                if (neuron.type === NeuronType.ENTRY) {
                    // Push toward nearest edge
                    const distToLeft = neuron.x;
                    const distToRight = width - neuron.x;
                    const distToTop = neuron.y;
                    const distToBottom = height - neuron.y;
                    const minEdgeDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                    if (minEdgeDist === distToLeft) fx -= 50;
                    else if (minEdgeDist === distToRight) fx += 50;
                    else if (minEdgeDist === distToTop) fy -= 50;
                    else fy += 50;
                }

                // Update velocity
                const vel = velocity.get(neuron.id)!;
                vel.x = (vel.x + fx) * damping;
                vel.y = (vel.y + fy) * damping;
            }

            // Apply velocities
            let totalMovement = 0;
            for (const neuron of neurons) {
                const vel = velocity.get(neuron.id)!;

                neuron.x += vel.x;
                neuron.y += vel.y;

                // Clamp to bounds
                neuron.x = Math.max(padding, Math.min(width - padding, neuron.x));
                neuron.y = Math.max(padding, Math.min(height - padding, neuron.y));

                totalMovement += Math.abs(vel.x) + Math.abs(vel.y);
            }

            // Early exit if stable
            if (totalMovement / neurons.length < minMovement) {
                break;
            }
        }
    }

    /**
     * Update neuron connections array based on synapses
     */
    private static updateNeuronConnections(neurons: Neuron[], synapses: Synapse[]): void {
        // Clear existing connections
        neurons.forEach((n) => (n.connections = []));

        // Add connections from synapses
        for (const synapse of synapses) {
            const fromNeuron = neurons.find((n) => n.id === synapse.fromNeuronId);
            const toNeuron = neurons.find((n) => n.id === synapse.toNeuronId);

            if (fromNeuron && !fromNeuron.connections.includes(synapse.toNeuronId)) {
                fromNeuron.connections.push(synapse.toNeuronId);
            }
            if (toNeuron && !toNeuron.connections.includes(synapse.fromNeuronId)) {
                toNeuron.connections.push(synapse.fromNeuronId);
            }
        }
    }

    /**
     * Mark neurons with 3+ connections as junctions
     */
    private static markJunctionNeurons(neurons: Neuron[]): void {
        for (const neuron of neurons) {
            if (
                neuron.type === NeuronType.NORMAL &&
                neuron.connections.length >= 3
            ) {
                neuron.type = NeuronType.JUNCTION;
            }
        }
    }

    /**
     * Assign puzzle difficulty based on distance from entry
     */
    private static assignSynapseDifficulty(
        neurons: Neuron[],
        synapses: Synapse[],
        entryId: string
    ): void {
        // BFS to calculate distance from entry
        const distances = new Map<string, number>();
        const queue: { id: string; dist: number }[] = [{ id: entryId, dist: 0 }];

        while (queue.length > 0) {
            const { id, dist } = queue.shift()!;
            if (distances.has(id)) continue;
            distances.set(id, dist);

            const neuron = neurons.find((n) => n.id === id);
            if (!neuron) continue;

            for (const neighborId of neuron.connections) {
                if (!distances.has(neighborId)) {
                    queue.push({ id: neighborId, dist: dist + 1 });
                }
            }
        }

        // Find max distance
        const maxDist = Math.max(...Array.from(distances.values()));

        // Assign difficulty based on relative distance
        for (const synapse of synapses) {
            const fromDist = distances.get(synapse.fromNeuronId) || 0;
            const toDist = distances.get(synapse.toNeuronId) || 0;
            const avgDist = (fromDist + toDist) / 2;
            const relativePos = avgDist / maxDist;

            // 0-33%: easy (1), 33-66%: medium (2), 66-100%: hard (3)
            if (relativePos < 0.33) {
                synapse.difficulty = 1;
            } else if (relativePos < 0.66) {
                synapse.difficulty = 2;
            } else {
                synapse.difficulty = 3;
            }
        }
    }

    /**
     * Calculate distance between two points
     */
    private static distance(a: Vector2, b: Vector2): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Find synapse between two neurons
     */
    static findSynapse(
        synapses: Record<string, Synapse>,
        neuronAId: string,
        neuronBId: string
    ): Synapse | undefined {
        return Object.values(synapses).find(
            (s) =>
                (s.fromNeuronId === neuronAId && s.toNeuronId === neuronBId) ||
                (s.fromNeuronId === neuronBId && s.toNeuronId === neuronAId)
        );
    }

    /**
     * Get all synapses connected to a neuron
     */
    static getSynapsesForNeuron(
        synapses: Record<string, Synapse>,
        neuronId: string
    ): Synapse[] {
        return Object.values(synapses).filter(
            (s) => s.fromNeuronId === neuronId || s.toNeuronId === neuronId
        );
    }
}
