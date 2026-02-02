import { useMemo } from 'react';
import type { NeuralNetworkData3D } from '../../stores/gameStore';
import { Neuron3D } from './Neuron3D';
import { Synapse3D } from './Synapse3D';

interface NeuralNetwork3DProps {
    networkData: NeuralNetworkData3D;
    showFog: boolean;
    explorerPosition: string | null;
    onNeuronClick?: (neuronId: string) => void;
}

export function NeuralNetwork3D({
    networkData,
    showFog,
    explorerPosition,
    onNeuronClick
}: NeuralNetwork3DProps) {
    // Calculate visibility based on fog of war
    const visibleNeurons = useMemo(() => {
        if (!showFog) {
            // Protector sees everything
            return new Set(Object.keys(networkData.neurons));
        }

        if (!explorerPosition) {
            return new Set<string>();
        }

        // BFS to find visible neurons from explorer position
        const visible = new Set<string>();
        const queue: { id: string; depth: number }[] = [{ id: explorerPosition, depth: 0 }];
        const maxDepth = 3; // Visibility radius

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            if (visible.has(id)) continue;

            const neuron = networkData.neurons[id];
            if (!neuron) continue;

            // Only expand through activated synapses or from current position
            if (depth > 0) {
                const synapse = Object.values(networkData.synapses).find(
                    (s) =>
                        (s.fromNeuronId === id || s.toNeuronId === id) &&
                        (s.state === 'active' || s.state === 'solving')
                );
                if (!synapse && !neuron.isActivated && depth > 1) continue;
            }

            visible.add(id);

            if (depth < maxDepth) {
                for (const neighborId of neuron.connections) {
                    if (!visible.has(neighborId)) {
                        queue.push({ id: neighborId, depth: depth + 1 });
                    }
                }
            }
        }

        return visible;
    }, [networkData, showFog, explorerPosition]);

    // Calculate visible synapses
    const visibleSynapses = useMemo(() => {
        return Object.values(networkData.synapses).filter((synapse) => {
            return visibleNeurons.has(synapse.fromNeuronId) || visibleNeurons.has(synapse.toNeuronId);
        });
    }, [networkData.synapses, visibleNeurons]);

    return (
        <group>
            {/* Render synapses first (behind neurons) */}
            {visibleSynapses.map((synapse) => {
                const fromNeuron = networkData.neurons[synapse.fromNeuronId];
                const toNeuron = networkData.neurons[synapse.toNeuronId];

                if (!fromNeuron || !toNeuron) return null;

                const isVisible =
                    visibleNeurons.has(synapse.fromNeuronId) &&
                    visibleNeurons.has(synapse.toNeuronId);

                return (
                    <Synapse3D
                        key={synapse.id}
                        synapse={synapse}
                        fromNeuron={fromNeuron}
                        toNeuron={toNeuron}
                        isVisible={isVisible}
                    />
                );
            })}

            {/* Render neurons */}
            {Object.values(networkData.neurons).map((neuron) => {
                const isVisible = visibleNeurons.has(neuron.id);
                const isExplorerHere = explorerPosition === neuron.id;

                // Don't render completely hidden neurons if fog is on
                if (showFog && !isVisible && !visibleNeurons.has(neuron.id)) {
                    // Still render dimmed for adjacent neurons
                    const hasVisibleNeighbor = neuron.connections.some((id) =>
                        visibleNeurons.has(id)
                    );
                    if (!hasVisibleNeighbor) return null;
                }

                return (
                    <Neuron3D
                        key={neuron.id}
                        neuron={neuron}
                        isVisible={isVisible}
                        isExplorerHere={isExplorerHere}
                        onClick={() => onNeuronClick?.(neuron.id)}
                    />
                );
            })}
        </group>
    );
}
