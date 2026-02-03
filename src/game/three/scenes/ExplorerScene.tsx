import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { NeuralNetworkOptimized } from '../components/NeuralNetworkOptimized';
import { Explorer3DSimple } from '../components/Explorer3DSimple';
import { GridFloor } from '../effects/GridFloor';
import { generateNetwork3D } from '../../generators/NeuralNetworkGenerator3D';
import { NetworkManager } from '../../services/NetworkManager';
import { EventBus } from '../../EventBus';

export function ExplorerScene() {
    const controlsRef = useRef<any>(null);
    const targetPositionRef = useRef(new THREE.Vector3(0, 0, 0));
    const networkDataRef = useRef<ReturnType<typeof generateNetwork3D> | null>(null);

    const networkData = useGameStore((state) => state.networkData);
    const setNetworkData = useGameStore((state) => state.setNetworkData);
    const explorerPosition = useGameStore((state) => state.explorerPosition);
    const setExplorerPosition = useGameStore((state) => state.setExplorerPosition);
    const addToExplorerPath = useGameStore((state) => state.addToExplorerPath);
    const showDilemma = useGameStore((state) => state.showDilemma);

    // Generate network on mount
    useEffect(() => {
        if (!networkData) {
            const network = generateNetwork3D();
            networkDataRef.current = network;
            setNetworkData(network);
            setExplorerPosition(network.entryNeuronId);
            addToExplorerPath(network.entryNeuronId);

            // Send to protector via NetworkManager
            const nm = NetworkManager.getInstance();
            nm.sendNetworkData(network as any);

            // Set initial camera target
            const entryNeuron = network.neurons[network.entryNeuronId];
            if (entryNeuron) {
                targetPositionRef.current.set(entryNeuron.x, entryNeuron.y, entryNeuron.z);
            }
        }
    }, [networkData, setNetworkData, setExplorerPosition, addToExplorerPath]);

    // Re-send network data when protector connects (in case they missed the initial send)
    useEffect(() => {
        const handlePartnerConnected = () => {
            const currentNetwork = networkDataRef.current || useGameStore.getState().networkData;
            if (currentNetwork) {
                const nm = NetworkManager.getInstance();
                nm.sendNetworkData(currentNetwork as any);
                // Also send current explorer position
                const explorerPos = useGameStore.getState().explorerPosition;
                if (explorerPos) {
                    nm.sendExplorerMoved({
                        neuronId: explorerPos,
                        activatedPath: useGameStore.getState().explorerPath
                    });
                }
            }
        };

        EventBus.on('partner-connected', handlePartnerConnected);
        return () => {
            EventBus.off('partner-connected', handlePartnerConnected);
        };
    }, []);

    // Handle explicit game state request from protector (after reset/reconnection)
    useEffect(() => {
        const handleGameStateRequest = () => {
            const currentNetwork = networkDataRef.current || useGameStore.getState().networkData;
            if (currentNetwork) {
                const nm = NetworkManager.getInstance();
                const state = useGameStore.getState();

                // Get blocked neurons from network data
                const blockedNeurons = Object.values(currentNetwork.neurons)
                    .filter(n => n.isBlocked)
                    .map(n => n.id);

                nm.sendGameStateResponse({
                    networkData: currentNetwork as any,
                    explorerPosition: state.explorerPosition || currentNetwork.entryNeuronId,
                    explorerPath: state.explorerPath,
                    aiState: state.aiState ? {
                        currentNeuronId: state.aiState.currentNeuronId,
                        path: state.aiState.targetPath
                    } : null,
                    blockedNeurons,
                });
            }
        };

        EventBus.on('request-game-state', handleGameStateRequest);
        return () => {
            EventBus.off('request-game-state', handleGameStateRequest);
        };
    }, []);

    // Listen for dilemma triggered by protector (when AI catches explorer)
    useEffect(() => {
        const handleDilemmaTriggered = (data: { title: string; description: string; choices: { id: string; description: string }[] }) => {
            useGameStore.getState().addMessage('L\'IA vous a attrapé !', 'error');
            useGameStore.getState().setShowDilemma(true, data);
        };

        EventBus.on('network-dilemma-triggered', handleDilemmaTriggered);
        return () => {
            EventBus.off('network-dilemma-triggered', handleDilemmaTriggered);
        };
    }, []);

    // Update target position when explorer moves
    useEffect(() => {
        if (networkData && explorerPosition) {
            const neuron = networkData.neurons[explorerPosition];
            if (neuron) {
                targetPositionRef.current.set(neuron.x, neuron.y, neuron.z);
            }
        }
    }, [networkData, explorerPosition]);

    // Smoothly animate camera target to follow explorer
    useFrame(() => {
        if (controlsRef.current) {
            const controls = controlsRef.current;
            // Smooth interpolation towards target (lerp factor 0.08 for smooth movement)
            controls.target.lerp(targetPositionRef.current, 0.08);
            controls.update();
        }
    });

    if (!networkData) {
        return null;
    }

    return (
        <group>
            {/* Controls - pan disabled to keep focus on explorer */}
            <OrbitControls
                ref={controlsRef}
                enablePan={false}
                enableZoom={true}
                enableRotate={true}
                minDistance={20}
                maxDistance={400}
                maxPolarAngle={Math.PI / 2.1}
            />

            {/* Spherical grid surrounding the network */}
            <GridFloor radius={800} rings={24} segments={64} centerY={60} />

            {/* Neural Network - Optimized */}
            <NeuralNetworkOptimized
                networkData={networkData}
                showFog={true}
                explorerPosition={explorerPosition}
                onNeuronClick={handleNeuronClick}
            />

            {/* Explorer - Simplified */}
            {explorerPosition && networkData.neurons[explorerPosition] && (
                <Explorer3DSimple
                    position={[
                        networkData.neurons[explorerPosition].x,
                        networkData.neurons[explorerPosition].y,
                        networkData.neurons[explorerPosition].z,
                    ]}
                />
            )}
        </group>
    );

    function handleNeuronClick(neuronId: string) {
        // Block movement during dilemma
        if (showDilemma) {
            useGameStore.getState().addMessage('Répondez au dilemme d\'abord !', 'warning');
            return;
        }
        if (!networkData || neuronId === explorerPosition) return;

        const currentNeuron = networkData.neurons[explorerPosition!];
        const targetNeuron = networkData.neurons[neuronId];

        if (!currentNeuron || !targetNeuron) return;

        // Check if adjacent
        if (!currentNeuron.connections.includes(neuronId)) {
            useGameStore.getState().addMessage('Neurone non adjacent', 'warning');
            return;
        }

        // Check if synapse is blocked
        const synapseId = Object.keys(networkData.synapses).find((id) => {
            const s = networkData.synapses[id];
            return (
                (s.fromNeuronId === explorerPosition && s.toNeuronId === neuronId) ||
                (s.fromNeuronId === neuronId && s.toNeuronId === explorerPosition)
            );
        });

        if (synapseId) {
            const synapse = networkData.synapses[synapseId];
            if (synapse.state === 'blocked') {
                useGameStore.getState().addMessage('Synapse bloquée !', 'error');
                return;
            }

            // Start puzzle if synapse is dormant
            if (synapse.state === 'dormant' && !targetNeuron.isActivated) {
                // Set synapse to solving state
                useGameStore.getState().updateSynapseState(synapseId, 'solving');
                // Trigger puzzle overlay
                useGameStore.getState().setActivePuzzle({
                    synapseId,
                    targetNeuronId: neuronId,
                    difficulty: synapse.difficulty || 1,
                });
                useGameStore.getState().addMessage('Résolution du puzzle...', 'info');
                return; // Don't move yet
            }
        }

        // Move explorer
        setExplorerPosition(neuronId);
        addToExplorerPath(neuronId);

        // Check victory
        if (neuronId === networkData.coreNeuronId) {
            useGameStore.getState().addMessage('VICTOIRE ! Noyau atteint !', 'success');
            useGameStore.getState().setGameOver(true);
        }

        // Notify protector
        NetworkManager.getInstance().sendExplorerMoved({ neuronId, activatedPath: useGameStore.getState().explorerPath });
    }
}
