import type { Synapse } from '../types/interfaces';
import { NeuronType, SynapseState } from '../types/interfaces';
import type { Neuron3D, NeuralNetworkData3D } from '../stores/gameStore';

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// Configuration for the simplified network with decorative neurons
const CONFIG = {
    MAIN_PATH_LENGTH: 4,          // Entry + 3 neurons to reach core
    DECORATIVE_NEURON_COUNT: 1500, // Outer decorative neurons (80%-125% radius)
    INNER_NEURON_COUNT: 800,      // Inner decorative neurons (0%-80% radius, 0.3 opacity)
    DECORATIVE_SYNAPSE_COUNT: 300, // Decorative synapses between decorative neurons
    DECORATIVE_SYNAPSE_MAX_DISTANCE: 60, // Max distance for decorative synapse connection
    RADIUS: 360,                  // Radius of the sphere (3x larger)
    MIN_DISTANCE: 12,             // Minimum distance between neurons
    PATH_SPACING: 45,             // Spacing between main path neurons (keeps path within 50% of radius)
};

/**
 * Generates a simplified 3D neural network with:
 * - Entry neuron at the center
 * - Only 3 intermediate neurons to the core (3 levels)
 * - Many decorative non-connected neurons filling the space
 */
export function generateNetwork3D(
    radius: number = CONFIG.RADIUS,
    _height?: number,
    _depth?: number,
    _neuronCount?: number
): NeuralNetworkData3D {
    const neurons: Neuron3D[] = [];
    const synapses: Synapse[] = [];

    // 1. Create the main path (Entry -> 3 neurons -> Core)
    const mainPathNeurons = createMainPath(radius);
    neurons.push(...mainPathNeurons);

    // 2. Create synapses for the main path
    for (let i = 0; i < mainPathNeurons.length - 1; i++) {
        synapses.push({
            id: `s_${i}`,
            fromNeuronId: mainPathNeurons[i].id,
            toNeuronId: mainPathNeurons[i + 1].id,
            state: SynapseState.DORMANT,
            difficulty: i + 1, // Level 1, 2, 3
            isUnlocked: i === 0, // First synapse is unlocked, rest must be hacked by Protector
        });
    }

    // 3. Update connections for main path neurons
    for (let i = 0; i < mainPathNeurons.length; i++) {
        const neuron = mainPathNeurons[i];
        if (i > 0) {
            neuron.connections.push(mainPathNeurons[i - 1].id);
        }
        if (i < mainPathNeurons.length - 1) {
            neuron.connections.push(mainPathNeurons[i + 1].id);
        }
    }

    // 4. Add outer decorative neurons (80%-125% radius, full opacity)
    const decorativeNeurons = createDecorativeNeurons(radius, mainPathNeurons);
    neurons.push(...decorativeNeurons);

    // 5. Add inner decorative neurons (0%-80% radius, 0.3 opacity)
    const innerNeurons = createInnerNeurons(radius, mainPathNeurons);
    neurons.push(...innerNeurons);

    // 6. Create decorative synapses between some decorative neurons (purely visual)
    const allDecorativeNeurons = [...decorativeNeurons, ...innerNeurons];
    const decorativeSynapses = createDecorativeSynapses(allDecorativeNeurons);
    synapses.push(...decorativeSynapses);

    // 7. Lift network above floor
    liftNetworkAboveFloor(neurons, 10);

    // Convert to records
    const neuronRecord: Record<string, Neuron3D> = {};
    const synapseRecord: Record<string, Synapse> = {};

    neurons.forEach((n) => (neuronRecord[n.id] = n));
    synapses.forEach((s) => (synapseRecord[s.id] = s));

    const diameter = radius * 2;
    return {
        neurons: neuronRecord,
        synapses: synapseRecord,
        entryNeuronId: mainPathNeurons[0].id,
        coreNeuronId: mainPathNeurons[mainPathNeurons.length - 1].id,
        width: diameter,
        height: diameter,
        depth: diameter,
    };
}

/**
 * Create the main path: Entry (center) -> 3 intermediate neurons -> Core
 */
function createMainPath(_radius: number): Neuron3D[] {
    const neurons: Neuron3D[] = [];
    const spacing = CONFIG.PATH_SPACING;

    // Entry neuron at center (0, 0, 0)
    neurons.push({
        id: 'n_entry',
        x: 0,
        y: 0,
        z: 0,
        type: NeuronType.ENTRY,
        connections: [],
        isActivated: true,
        isBlocked: false,
    });

    // Create a path that spirals outward
    // Each neuron is progressively further from center in a spiral pattern
    const angles = [
        { theta: Math.PI * 0.3, phi: Math.PI * 0.4 },   // Level 1
        { theta: Math.PI * 0.7, phi: Math.PI * 0.6 },   // Level 2
        { theta: Math.PI * 1.2, phi: Math.PI * 0.5 },   // Level 3
        { theta: Math.PI * 1.8, phi: Math.PI * 0.3 },   // Core
    ];

    for (let i = 0; i < 4; i++) {
        const distFromCenter = spacing * (i + 1);
        const angle = angles[i];

        const x = Math.sin(angle.phi) * Math.cos(angle.theta) * distFromCenter;
        const y = Math.sin(angle.phi) * Math.sin(angle.theta) * distFromCenter;
        const z = Math.cos(angle.phi) * distFromCenter;

        const isCore = i === 3;
        neurons.push({
            id: isCore ? 'n_core' : `n_path_${i}`,
            x,
            y,
            z,
            type: isCore ? NeuronType.CORE : NeuronType.JUNCTION,
            connections: [],
            isActivated: false,
            isBlocked: false,
        });
    }

    return neurons;
}

/**
 * Create decorative neurons that fill the space but are NOT connected
 */
function createDecorativeNeurons(sphereRadius: number, mainPathNeurons: Neuron3D[]): Neuron3D[] {
    const decorativeNeurons: Neuron3D[] = [];
    const count = CONFIG.DECORATIVE_NEURON_COUNT;
    const minDistance = CONFIG.MIN_DISTANCE;

    // Golden ratio for Fibonacci sphere
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < count; i++) {
        let x: number, y: number, z: number;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            // Fibonacci sphere distribution
            const t = i / count;
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = angleIncrement * i;

            // Varying radius - neurons pushed to outer edge (80%-125% of radius)
            const radiusVariation = 0.8 + Math.random() * 0.45;
            const baseRadius = sphereRadius * radiusVariation;

            // Add noise for organic feel
            const noiseX = (Math.random() - 0.5) * 20;
            const noiseY = (Math.random() - 0.5) * 20;
            const noiseZ = (Math.random() - 0.5) * 20;

            x = Math.sin(inclination) * Math.cos(azimuth) * baseRadius + noiseX;
            y = Math.sin(inclination) * Math.sin(azimuth) * baseRadius + noiseY;
            z = Math.cos(inclination) * baseRadius + noiseZ;

            attempts++;
        } while (
            attempts < maxAttempts &&
            (
                // Check distance from main path neurons
                mainPathNeurons.some(n => distance3D(n, { x, y, z }) < minDistance * 2) ||
                // Check distance from other decorative neurons
                decorativeNeurons.some(n => distance3D(n, { x, y, z }) < minDistance)
            )
        );

        if (attempts < maxAttempts) {
            decorativeNeurons.push({
                id: `n_deco_${i}`,
                x,
                y,
                z,
                type: NeuronType.NORMAL,
                connections: [], // Not connected to anything
                isActivated: false,
                isBlocked: false,
            });
        }
    }

    return decorativeNeurons;
}

/**
 * Create inner decorative neurons (0%-80% radius) with low opacity
 */
function createInnerNeurons(sphereRadius: number, mainPathNeurons: Neuron3D[]): Neuron3D[] {
    const innerNeurons: Neuron3D[] = [];
    const count = CONFIG.INNER_NEURON_COUNT;
    const minDistance = CONFIG.MIN_DISTANCE;

    // Golden ratio for Fibonacci sphere
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = Math.PI * 2 * goldenRatio;

    for (let i = 0; i < count; i++) {
        let x: number, y: number, z: number;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            // Fibonacci sphere distribution
            const t = i / count;
            const inclination = Math.acos(1 - 2 * t);
            const azimuth = angleIncrement * i;

            // Varying radius - inner layer (0%-80% of radius)
            const radiusVariation = Math.random() * 0.8;
            const baseRadius = sphereRadius * radiusVariation;

            // Add noise for organic feel
            const noiseX = (Math.random() - 0.5) * 15;
            const noiseY = (Math.random() - 0.5) * 15;
            const noiseZ = (Math.random() - 0.5) * 15;

            x = Math.sin(inclination) * Math.cos(azimuth) * baseRadius + noiseX;
            y = Math.sin(inclination) * Math.sin(azimuth) * baseRadius + noiseY;
            z = Math.cos(inclination) * baseRadius + noiseZ;

            attempts++;
        } while (
            attempts < maxAttempts &&
            (
                // Check distance from main path neurons
                mainPathNeurons.some(n => distance3D(n, { x, y, z }) < minDistance * 3) ||
                // Check distance from other inner neurons
                innerNeurons.some(n => distance3D(n, { x, y, z }) < minDistance)
            )
        );

        if (attempts < maxAttempts) {
            innerNeurons.push({
                id: `n_inner_${i}`,
                x,
                y,
                z,
                type: NeuronType.NORMAL,
                connections: [],
                isActivated: false,
                isBlocked: false,
                opacity: 0.15, // Low opacity for inner layer
            });
        }
    }

    return innerNeurons;
}

/**
 * Create decorative synapses between nearby decorative neurons (purely visual)
 */
function createDecorativeSynapses(decorativeNeurons: Neuron3D[]): Synapse[] {
    const synapses: Synapse[] = [];
    const targetCount = CONFIG.DECORATIVE_SYNAPSE_COUNT;
    const maxDistance = CONFIG.DECORATIVE_SYNAPSE_MAX_DISTANCE;

    // Shuffle neurons for random selection
    const shuffled = [...decorativeNeurons].sort(() => Math.random() - 0.5);
    const usedPairs = new Set<string>();

    let synapseIndex = 0;

    for (const neuron of shuffled) {
        if (synapses.length >= targetCount) break;

        // Find nearby neurons to connect
        const nearby = decorativeNeurons.filter(other => {
            if (other.id === neuron.id) return false;
            const dist = distance3D(neuron, other);
            return dist < maxDistance && dist > 10; // Not too close, not too far
        });

        if (nearby.length === 0) continue;

        // Connect to 1-3 random nearby neurons
        const connectCount = Math.min(Math.floor(Math.random() * 3) + 1, nearby.length);
        const shuffledNearby = nearby.sort(() => Math.random() - 0.5).slice(0, connectCount);

        for (const target of shuffledNearby) {
            if (synapses.length >= targetCount) break;

            // Avoid duplicate pairs
            const pairKey = [neuron.id, target.id].sort().join('-');
            if (usedPairs.has(pairKey)) continue;
            usedPairs.add(pairKey);

            // Add synapse
            synapses.push({
                id: `s_deco_${synapseIndex++}`,
                fromNeuronId: neuron.id,
                toNeuronId: target.id,
                state: SynapseState.DORMANT,
                difficulty: 0, // Decorative - no difficulty
                isUnlocked: true, // Decorative synapses don't need unlocking
            });

            // Update neuron connections
            neuron.connections.push(target.id);
            target.connections.push(neuron.id);
        }
    }

    return synapses;
}

/**
 * Lift entire network so all neurons are above the grid floor
 */
function liftNetworkAboveFloor(neurons: Neuron3D[], minHeight: number): void {
    let minY = Infinity;
    for (const neuron of neurons) {
        if (neuron.y < minY) {
            minY = neuron.y;
        }
    }

    const offset = minHeight - minY + 60; // Add extra offset to center vertically

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
