import type { Synapse } from '../types/interfaces';
import { NeuronType, SynapseState } from '../types/interfaces';
import type { Neuron3D, NeuralNetworkData3D } from '../stores/gameStore';

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// Configuration for organic spherical network
const CONFIG = {
    NEURON_COUNT: 200,            // Nombre de neurones (optimisé pour performance)
    RADIUS: 120,                  // Rayon principal de la sphère
    MIN_DISTANCE: 8,              // Distance minimum entre neurones
    MAX_CONNECTION_DISTANCE: 25,  // Distance max pour connexions
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 4,
    FORCE_ITERATIONS: 60,
    NOISE_SCALE: 0.35,            // Quantité de bruit organique
};

/**
 * Generates an organic 3D neural network with spherical distribution
 */
export function generateNetwork3D(
    radius: number = CONFIG.RADIUS,
    _height?: number,
    _depth?: number,
    neuronCount: number = CONFIG.NEURON_COUNT
): NeuralNetworkData3D {
    // Generate neurons with organic spherical distribution
    const neurons = placeNeuronsOrganic(radius, neuronCount);

    // Create synapses between nearby neurons
    const synapses = createSynapses3D(neurons);

    // Ensure the network is connected
    ensureConnectivity3D(neurons, synapses);

    // Assign entry and core neurons (based on spherical position)
    const { entryId, coreId } = assignSpecialNeuronsSpherical(neurons);

    // Apply force-directed layout for organic appearance
    applyForceDirectedLayoutOrganic(neurons, synapses, radius);

    // Lift entire network above the grid floor (Y = 0)
    liftNetworkAboveFloor(neurons, 10);

    // Update neuron connections array based on synapses
    updateNeuronConnections3D(neurons, synapses);

    // Mark junction neurons (3+ connections)
    markJunctionNeurons3D(neurons);

    // Assign puzzle difficulty to synapses based on distance from entry
    assignSynapseDifficulty3D(neurons, synapses, entryId);

    // Convert to records
    const neuronRecord: Record<string, Neuron3D> = {};
    const synapseRecord: Record<string, Synapse> = {};

    neurons.forEach((n) => (neuronRecord[n.id] = n));
    synapses.forEach((s) => (synapseRecord[s.id] = s));

    // Use diameter as width/height/depth for compatibility
    const diameter = radius * 2;
    return {
        neurons: neuronRecord,
        synapses: synapseRecord,
        entryNeuronId: entryId,
        coreNeuronId: coreId,
        width: diameter,
        height: diameter,
        depth: diameter,
    };
}

/**
 * Simple noise function for organic variation
 */
function noise3D(x: number, y: number, z: number): number {
    // Simple pseudo-random noise based on position
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return n - Math.floor(n);
}

/**
 * Place neurons in an organic spherical distribution with natural variation
 */
function placeNeuronsOrganic(radius: number, count: number): Neuron3D[] {
    const neurons: Neuron3D[] = [];
    const minDistance = CONFIG.MIN_DISTANCE;
    const noiseScale = CONFIG.NOISE_SCALE;

    // Use fibonacci sphere for even distribution + organic noise
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < count; i++) {
        let x: number, y: number, z: number;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            // Fibonacci sphere distribution for base position
            const t = i / count;
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = angleIncrement * i;

            // Base spherical position with varying radius
            // Inner neurons closer to center, outer ones at edge
            const radiusVariation = 0.3 + Math.random() * 0.7;
            const baseRadius = radius * radiusVariation;

            // Add organic noise to break up the perfect sphere
            const noiseX = (noise3D(i * 0.1, 0, 0) - 0.5) * radius * noiseScale;
            const noiseY = (noise3D(0, i * 0.1, 0) - 0.5) * radius * noiseScale;
            const noiseZ = (noise3D(0, 0, i * 0.1) - 0.5) * radius * noiseScale;

            // Calculate position
            x = Math.sin(inclination) * Math.cos(azimuth) * baseRadius + noiseX;
            y = Math.sin(inclination) * Math.sin(azimuth) * baseRadius + noiseY;
            z = Math.cos(inclination) * baseRadius + noiseZ;

            // Add extra random jitter for organic feel
            x += (Math.random() - 0.5) * 15;
            y += (Math.random() - 0.5) * 15;
            z += (Math.random() - 0.5) * 15;

            // Create some "tendrils" extending outward
            if (Math.random() < 0.15) {
                const tendrilLength = radius * (0.2 + Math.random() * 0.3);
                const tendrilDir = { x: x, y: y, z: z };
                const len = Math.sqrt(tendrilDir.x ** 2 + tendrilDir.y ** 2 + tendrilDir.z ** 2);
                if (len > 0) {
                    x += (tendrilDir.x / len) * tendrilLength;
                    y += (tendrilDir.y / len) * tendrilLength;
                    z += (tendrilDir.z / len) * tendrilLength;
                }
            }

            attempts++;
        } while (
            attempts < maxAttempts &&
            neurons.some((n) => distance3D(n, { x, y, z }) < minDistance)
        );

        neurons.push({
            id: `n_${neurons.length}`,
            x,
            y,
            z,
            type: NeuronType.NORMAL,
            connections: [],
            isActivated: false,
            isBlocked: false,
        });
    }

    return neurons;
}

function createSynapses3D(neurons: Neuron3D[]): Synapse[] {
    const synapses: Synapse[] = [];
    const maxDistance = CONFIG.MAX_CONNECTION_DISTANCE;
    let synapseId = 0;

    for (let i = 0; i < neurons.length; i++) {
        const neuronA = neurons[i];

        const nearby = neurons
            .filter((_, idx) => idx !== i)
            .map((n) => ({ neuron: n, dist: distance3D(neuronA, n) }))
            .filter((item) => item.dist < maxDistance)
            .sort((a, b) => a.dist - b.dist);

        // Prefer connecting to neurons in adjacent layers (by Y position)
        const preferredNearby = nearby.sort((a, b) => {
            const yDiffA = Math.abs(a.neuron.y - neuronA.y);
            const yDiffB = Math.abs(b.neuron.y - neuronA.y);
            // Prefer neurons at similar or slightly different Y levels
            const scoreA = a.dist + yDiffA * 0.5;
            const scoreB = b.dist + yDiffB * 0.5;
            return scoreA - scoreB;
        });

        const connectionCount = Math.min(
            preferredNearby.length,
            CONFIG.MIN_CONNECTIONS +
            Math.floor(Math.random() * (CONFIG.MAX_CONNECTIONS - CONFIG.MIN_CONNECTIONS))
        );

        for (let j = 0; j < connectionCount; j++) {
            const neuronB = preferredNearby[j].neuron;

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

function ensureConnectivity3D(neurons: Neuron3D[], synapses: Synapse[]): void {
    const adjacency = new Map<string, Set<string>>();
    neurons.forEach((n) => adjacency.set(n.id, new Set()));

    synapses.forEach((s) => {
        adjacency.get(s.fromNeuronId)?.add(s.toNeuronId);
        adjacency.get(s.toNeuronId)?.add(s.fromNeuronId);
    });

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

    if (components.length > 1) {
        const mainComponent = components[0];
        let synapseId = synapses.length;

        for (let i = 1; i < components.length; i++) {
            let minDist = Infinity;
            let bestPair: [string, string] | null = null;

            for (const mainId of mainComponent) {
                const mainNeuron = neurons.find((n) => n.id === mainId)!;
                for (const otherId of components[i]) {
                    const otherNeuron = neurons.find((n) => n.id === otherId)!;
                    const dist = distance3D(mainNeuron, otherNeuron);
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

                mainComponent.push(...components[i]);
            }
        }
    }
}

function assignSpecialNeuronsSpherical(
    neurons: Neuron3D[]
): { entryId: string; coreId: string } {
    // Entry: neuron closest to one "pole" (e.g., negative Y side)
    let entryNeuron = neurons[0];
    let minY = Infinity;

    for (const neuron of neurons) {
        // Find neuron most "outside" on the bottom
        const distFromCenter = Math.sqrt(neuron.x ** 2 + neuron.y ** 2 + neuron.z ** 2);
        const score = neuron.y - distFromCenter * 0.3; // Favor lower + outer
        if (score < minY) {
            minY = score;
            entryNeuron = neuron;
        }
    }
    entryNeuron.type = NeuronType.ENTRY;
    entryNeuron.isActivated = true;

    // Core: neuron furthest from entry (opposite side of the network)
    let coreNeuron = neurons[0];
    let maxDist = 0;

    for (const neuron of neurons) {
        if (neuron.id === entryNeuron.id) continue;
        const dist = distance3D(neuron, entryNeuron);
        if (dist > maxDist) {
            maxDist = dist;
            coreNeuron = neuron;
        }
    }
    coreNeuron.type = NeuronType.CORE;

    return { entryId: entryNeuron.id, coreId: coreNeuron.id };
}

function applyForceDirectedLayoutOrganic(
    neurons: Neuron3D[],
    synapses: Synapse[],
    radius: number
): void {
    const iterations = CONFIG.FORCE_ITERATIONS;
    const repulsionStrength = 500;
    const attractionStrength = 0.012;
    const damping = 0.85;
    const minMovement = 0.05;
    // Soft boundary - neurons can exceed this but are gently pushed back
    const softBoundary = radius * 1.3;

    const connected = new Map<string, Set<string>>();
    neurons.forEach((n) => connected.set(n.id, new Set()));
    synapses.forEach((s) => {
        connected.get(s.fromNeuronId)?.add(s.toNeuronId);
        connected.get(s.toNeuronId)?.add(s.fromNeuronId);
    });

    const velocity = new Map<string, Vector3>();
    neurons.forEach((n) => velocity.set(n.id, { x: 0, y: 0, z: 0 }));

    for (let iter = 0; iter < iterations; iter++) {
        for (const neuron of neurons) {
            let fx = 0;
            let fy = 0;
            let fz = 0;

            // Repulsion from nearby neurons
            for (const other of neurons) {
                if (other.id === neuron.id) continue;

                const dx = neuron.x - other.x;
                const dy = neuron.y - other.y;
                const dz = neuron.z - other.z;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));

                if (dist < 40) {
                    const force = repulsionStrength / (dist * dist);
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                    fz += (dz / dist) * force;
                }
            }

            // Attraction to connected neurons
            const neighbors = connected.get(neuron.id) || new Set();
            for (const neighborId of neighbors) {
                const neighbor = neurons.find((n) => n.id === neighborId);
                if (!neighbor) continue;

                const dx = neighbor.x - neuron.x;
                const dy = neighbor.y - neuron.y;
                const dz = neighbor.z - neuron.z;

                fx += dx * attractionStrength;
                fy += dy * attractionStrength;
                fz += dz * attractionStrength;
            }

            // Soft spherical boundary - push neurons back gently if too far
            const distFromCenter = Math.sqrt(neuron.x ** 2 + neuron.y ** 2 + neuron.z ** 2);
            if (distFromCenter > softBoundary) {
                const pushBack = (distFromCenter - softBoundary) * 0.05;
                fx -= (neuron.x / distFromCenter) * pushBack;
                fy -= (neuron.y / distFromCenter) * pushBack;
                fz -= (neuron.z / distFromCenter) * pushBack;
            }

            // Update velocity
            const vel = velocity.get(neuron.id)!;
            vel.x = (vel.x + fx) * damping;
            vel.y = (vel.y + fy) * damping;
            vel.z = (vel.z + fz) * damping;
        }

        // Apply velocities
        let totalMovement = 0;
        for (const neuron of neurons) {
            // Don't move entry and core too much
            if (neuron.type === NeuronType.ENTRY || neuron.type === NeuronType.CORE) {
                continue;
            }

            const vel = velocity.get(neuron.id)!;

            neuron.x += vel.x;
            neuron.y += vel.y;
            neuron.z += vel.z;

            // No hard clamping - let the soft boundary do the work
            totalMovement += Math.abs(vel.x) + Math.abs(vel.y) + Math.abs(vel.z);
        }

        if (totalMovement / neurons.length < minMovement) {
            break;
        }
    }
}

function updateNeuronConnections3D(neurons: Neuron3D[], synapses: Synapse[]): void {
    neurons.forEach((n) => (n.connections = []));

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

function markJunctionNeurons3D(neurons: Neuron3D[]): void {
    for (const neuron of neurons) {
        if (neuron.type === NeuronType.NORMAL && neuron.connections.length >= 3) {
            neuron.type = NeuronType.JUNCTION;
        }
    }
}

function assignSynapseDifficulty3D(
    neurons: Neuron3D[],
    synapses: Synapse[],
    entryId: string
): void {
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

    const maxDist = Math.max(...Array.from(distances.values()));

    for (const synapse of synapses) {
        const fromDist = distances.get(synapse.fromNeuronId) || 0;
        const toDist = distances.get(synapse.toNeuronId) || 0;
        const avgDist = (fromDist + toDist) / 2;
        const relativePos = avgDist / maxDist;

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
 * Lift entire network so all neurons are above the grid floor
 */
function liftNetworkAboveFloor(neurons: Neuron3D[], minHeight: number): void {
    // Find the lowest Y position
    let minY = Infinity;
    for (const neuron of neurons) {
        if (neuron.y < minY) {
            minY = neuron.y;
        }
    }

    // Calculate offset to lift everything above minHeight
    const offset = minHeight - minY;

    // Apply offset to all neurons
    for (const neuron of neurons) {
        neuron.y += offset;
    }
}

function distance3D(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
