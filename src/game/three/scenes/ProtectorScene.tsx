import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { NeuralNetworkOptimized } from '../components/NeuralNetworkOptimized';
import { Explorer3DSimple } from '../components/Explorer3DSimple';
import { AI3DSimple } from '../components/AI3DSimple';
import { GridFloor } from '../effects/GridFloor';
import { NetworkManager } from '../../services/NetworkManager';
import { EventBus } from '../../EventBus';
import type { NeuralNetworkData3D } from '../../stores/gameStore';
import dilemmasData from '../../dilemme.json';

// BFS pathfinding
function findPath(network: NeuralNetworkData3D, from: string, to: string): string[] {
    if (from === to) return [];

    const queue: { id: string; path: string[] }[] = [{ id: from, path: [] }];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const neuron = network.neurons[current.id];

        if (!neuron) continue;

        for (const connectionId of neuron.connections) {
            if (visited.has(connectionId)) continue;

            // Skip blocked neurons
            const connectedNeuron = network.neurons[connectionId];
            if (connectedNeuron?.isBlocked) continue;

            // Check if synapse is blocked
            const synapseBlocked = Object.values(network.synapses).some(
                s => ((s.fromNeuronId === current.id && s.toNeuronId === connectionId) ||
                    (s.fromNeuronId === connectionId && s.toNeuronId === current.id)) &&
                    s.state === 'blocked'
            );
            if (synapseBlocked) continue;

            const newPath = [...current.path, connectionId];

            if (connectionId === to) {
                return newPath;
            }

            visited.add(connectionId);
            queue.push({ id: connectionId, path: newPath });
        }
    }

    return []; // No path found
}

export function ProtectorScene() {
    const controlsRef = useRef<any>(null);
    const aiMoveTimerRef = useRef<number>(0);
    const [aiPath, setAiPath] = useState<string[]>([]);
    const aiStartPositionRef = useRef<string | null>(null);

    const networkData = useGameStore((state) => state.networkData);
    const setNetworkData = useGameStore((state) => state.setNetworkData);
    const explorerPosition = useGameStore((state) => state.explorerPosition);
    const setExplorerPosition = useGameStore((state) => state.setExplorerPosition);
    const aiState = useGameStore((state) => state.aiState);
    const setAIState = useGameStore((state) => state.setAIState);
    const resources = useGameStore((state) => state.resources);
    const spendResources = useGameStore((state) => state.spendResources);
    const isGameOver = useGameStore((state) => state.isGameOver);
    const aiSlowdownActive = useGameStore((state) => state.aiSlowdownActive);
    const showDilemma = useGameStore((state) => state.showDilemma);
    const aiEnabled = useGameStore((state) => state.aiEnabled);

    // Recalculate AI path when explorer or AI moves
    useEffect(() => {
        if (!networkData || !aiState || !explorerPosition) return;
        const path = findPath(networkData, aiState.currentNeuronId, explorerPosition);
        setAiPath(path);
    }, [networkData, aiState?.currentNeuronId, explorerPosition]);

    // State for AI repair progress
    const setAIRepairProgress = useGameStore((state) => state.setAIRepairProgress);
    const aiRepairTimerRef = useRef<number>(0);
    const [pendingRepairNeuron, setPendingRepairNeuron] = useState<string | null>(null);

    // Find a blocked neuron to start repairing
    const findBlockedNeuronToRepair = useCallback(() => {
        if (!networkData || !aiState) return null;

        const currentNeuron = networkData.neurons[aiState.currentNeuronId];
        if (!currentNeuron) return null;

        // Find adjacent blocked neurons first
        for (const connectionId of currentNeuron.connections) {
            const connectedNeuron = networkData.neurons[connectionId];
            if (connectedNeuron?.isBlocked) {
                return connectionId;
            }
        }

        // If no adjacent blocked neuron, find the closest blocked neuron
        const blockedNeurons = Object.values(networkData.neurons).filter(n => n.isBlocked);
        if (blockedNeurons.length > 0) {
            blockedNeurons.sort((a, b) => {
                const distA = Math.sqrt(
                    Math.pow(a.x - currentNeuron.x, 2) +
                    Math.pow(a.y - currentNeuron.y, 2) +
                    Math.pow(a.z - currentNeuron.z, 2)
                );
                const distB = Math.sqrt(
                    Math.pow(b.x - currentNeuron.x, 2) +
                    Math.pow(b.y - currentNeuron.y, 2) +
                    Math.pow(b.z - currentNeuron.z, 2)
                );
                return distA - distB;
            });
            return blockedNeurons[0].id;
        }

        return null;
    }, [networkData, aiState]);

    // Complete the repair of a neuron
    const completeRepair = useCallback((neuronId: string) => {
        if (!networkData) return;

        console.log('AI completed repair of neuron:', neuronId);
        useGameStore.getState().unblockNeuron(neuronId);
        useGameStore.getState().addMessage('L\'IA a réparé un neurone !', 'warning');

        // Also unblock connected synapses
        Object.entries(networkData.synapses).forEach(([synapseId, synapse]) => {
            if ((synapse.fromNeuronId === neuronId || synapse.toNeuronId === neuronId) &&
                synapse.state === 'blocked') {
                useGameStore.getState().updateSynapseState(synapseId, 'dormant');
            }
        });

        // Notify explorer
        NetworkManager.getInstance().sendNeuronHacked(neuronId);

        // Reset repair state
        setAIRepairProgress(null);
        setPendingRepairNeuron(null);
        aiRepairTimerRef.current = 0;
    }, [networkData, setAIRepairProgress]);

    // Start repairing a neuron (returns true if repair started)
    const startRepair = useCallback((neuronId: string) => {
        console.log('AI starting repair of neuron:', neuronId);
        useGameStore.getState().addMessage('L\'IA répare un neurone...', 'info');
        setAIRepairProgress({ neuronId, progress: 0 });
        setPendingRepairNeuron(neuronId);
        aiRepairTimerRef.current = 0;
        return true;
    }, [setAIRepairProgress]);

    // AI movement logic
    const moveAI = useCallback(() => {
        if (!networkData || !aiState || !explorerPosition || isGameOver) {
            console.log('moveAI early return:', { networkData: !!networkData, aiState: !!aiState, explorerPosition, isGameOver });
            return;
        }

        // If currently repairing, don't move
        if (pendingRepairNeuron) {
            console.log('AI is repairing, cannot move');
            return;
        }

        // Recalculate path to explorer
        let path = findPath(networkData, aiState.currentNeuronId, explorerPosition);
        console.log('AI path from', aiState.currentNeuronId, 'to', explorerPosition, ':', path);

        // If no path found, start repairing a blocked neuron
        if (path.length === 0) {
            console.log('No path found, AI looking for neuron to repair...');
            const neuronToRepair = findBlockedNeuronToRepair();
            if (neuronToRepair) {
                startRepair(neuronToRepair);
                return;
            }
        }

        if (path.length > 0) {
            const nextNeuronId = path[0];

            // Check if AI caught explorer - trigger dilemma instead of game over
            if (nextNeuronId === explorerPosition) {
                useGameStore.getState().addMessage('L\'IA a attrapé l\'explorateur !', 'error');

                // Pick a random dilemma from the JSON file
                const randomDilemma = dilemmasData[Math.floor(Math.random() * dilemmasData.length)];

                const dilemmaData = {
                    title: 'DILEMME ÉTHIQUE',
                    description: randomDilemma.description,
                    choices: randomDilemma.choices
                };

                // Trigger dilemma locally
                useGameStore.getState().setShowDilemma(true, dilemmaData);

                // Send dilemma to explorer
                NetworkManager.getInstance().sendDilemmaTriggered(dilemmaData);

                // Reset AI to starting position
                if (aiStartPositionRef.current) {
                    setAIState({
                        ...aiState,
                        currentNeuronId: aiStartPositionRef.current,
                        targetPath: [],
                    });
                    setAiPath([]);
                }
                return;
            }

            // Move AI to next neuron
            console.log('AI moving to:', nextNeuronId);
            setAIState({
                ...aiState,
                currentNeuronId: nextNeuronId,
                targetPath: path.slice(1),
            });

            setAiPath(path.slice(1));
        } else {
            console.log('No path found for AI and no neurons to repair!');
        }
    }, [networkData, aiState, explorerPosition, isGameOver, setAIState, pendingRepairNeuron, findBlockedNeuronToRepair, startRepair]);

    // AI movement and repair timer using useFrame
    useFrame((_, delta) => {
        // Pause during dilemma, game over, or when AI is disabled
        if (!networkData || !aiState || !explorerPosition || isGameOver || showDilemma || !aiEnabled) return;

        // Handle repair progress
        if (pendingRepairNeuron) {
            aiRepairTimerRef.current += delta;
            const repairDuration = 3.0; // 3 seconds to repair
            const progress = Math.min(aiRepairTimerRef.current / repairDuration, 1);

            setAIRepairProgress({ neuronId: pendingRepairNeuron, progress });

            if (progress >= 1) {
                completeRepair(pendingRepairNeuron);
            }
            return; // Don't move while repairing
        }

        aiMoveTimerRef.current += delta;

        // AI moves every 4 seconds (adjustable with speed) - slower for better gameplay
        // Apply 30% slowdown when hack is active
        const slowdownFactor = aiSlowdownActive ? 1.3 : 1.0;
        const effectiveSpeedMultiplier = Math.max(0.1, aiState.speedMultiplier || 0);
        const moveInterval = (4.0 / effectiveSpeedMultiplier) * slowdownFactor;

        if (aiMoveTimerRef.current >= moveInterval) {
            aiMoveTimerRef.current = 0;
            moveAI();
        }
    });

    // Listen for network data from explorer
    useEffect(() => {
        // Initialize NetworkManager
        const nm = NetworkManager.getInstance();

        const handleNetworkData = (data: any) => {
            setNetworkData(data);

            // Initialize explorer position at entry point
            if (data.entryNeuronId) {
                setExplorerPosition(data.entryNeuronId);
            }

            // Initialize AI at a position far from entry
            if (data.neurons) {
                const neurons = Object.values(data.neurons) as any[];
                const entryNeuron = data.neurons[data.entryNeuronId];
                let farthest = neurons[0];
                let maxDist = 0;
                neurons.forEach((n: any) => {
                    if (n.id !== data.entryNeuronId && n.type !== 'core') {
                        const dist = Math.sqrt(
                            Math.pow(n.x - entryNeuron.x, 2) +
                            Math.pow(n.y - entryNeuron.y, 2) +
                            Math.pow(n.z - entryNeuron.z, 2)
                        );
                        if (dist > maxDist) {
                            maxDist = dist;
                            farthest = n;
                        }
                    }
                });

                console.log('AI initialized at neuron:', farthest.id, 'Explorer at:', data.entryNeuronId);

                // Save starting position for respawn
                aiStartPositionRef.current = farthest.id;

                setAIState({
                    currentNeuronId: farthest.id,
                    targetPath: [],
                    speed: 0.2,
                    baseSpeed: 0.2,
                    speedMultiplier: 1,
                    isConnected: true,
                    moveProgress: 0,
                });
            }
        };

        const handleExplorerMoved = (data: any) => {
            setExplorerPosition(data.neuronId);
        };

        // Handle full game state response (for reconnection after reset)
        const handleGameStateReceived = (data: any) => {
            console.log('Received full game state from explorer:', data);

            // Apply network data
            if (data.networkData) {
                setNetworkData(data.networkData);
            }

            // Apply explorer position
            if (data.explorerPosition) {
                setExplorerPosition(data.explorerPosition);
            }

            // Apply AI state (keep same position or initialize if not set)
            if (data.aiState && data.networkData) {
                aiStartPositionRef.current = data.aiState.currentNeuronId;
                setAIState({
                    currentNeuronId: data.aiState.currentNeuronId,
                    targetPath: data.aiState.path || [],
                    speed: 0.2,
                    baseSpeed: 0.2,
                    speedMultiplier: 1,
                    isConnected: true,
                    moveProgress: 0,
                });
            } else if (data.networkData) {
                // Initialize AI at a position far from explorer
                const neurons = Object.values(data.networkData.neurons) as any[];
                const explorerNeuron = data.networkData.neurons[data.explorerPosition || data.networkData.entryNeuronId];
                let farthest = neurons[0];
                let maxDist = 0;
                neurons.forEach((n: any) => {
                    if (n.id !== data.explorerPosition && n.type !== 'core' && !n.isBlocked) {
                        const dist = Math.sqrt(
                            Math.pow(n.x - explorerNeuron.x, 2) +
                            Math.pow(n.y - explorerNeuron.y, 2) +
                            Math.pow(n.z - explorerNeuron.z, 2)
                        );
                        if (dist > maxDist) {
                            maxDist = dist;
                            farthest = n;
                        }
                    }
                });

                aiStartPositionRef.current = farthest.id;
                setAIState({
                    currentNeuronId: farthest.id,
                    targetPath: [],
                    speed: 0.2,
                    baseSpeed: 0.2,
                    speedMultiplier: 1,
                    isConnected: true,
                    moveProgress: 0,
                });
            }

        };

        EventBus.on('network-data-received', handleNetworkData);
        EventBus.on('network-explorer-moved', handleExplorerMoved);
        EventBus.on('game-state-received', handleGameStateReceived);

        // Request game state if we don't have network data and partner might be connected
        // This handles the case where protector was reset and needs to reconnect
        // Retry every 2 seconds until we get network data
        const requestInterval = setInterval(() => {
            if (!useGameStore.getState().networkData) {
                console.log('Protector requesting game state from explorer...');
                nm.requestGameState();
            } else {
                clearInterval(requestInterval);
            }
        }, 2000);

        // Initial request after 500ms
        const initialRequestTimeout = setTimeout(() => {
            if (!useGameStore.getState().networkData) {
                console.log('Protector initial game state request...');
                nm.requestGameState();
            }
        }, 500);

        return () => {
            EventBus.off('network-data-received', handleNetworkData);
            EventBus.off('network-explorer-moved', handleExplorerMoved);
            EventBus.off('game-state-received', handleGameStateReceived);
            clearInterval(requestInterval);
            clearTimeout(initialRequestTimeout);
        };
    }, [setNetworkData, setExplorerPosition, setAIState]);

    const handleNeuronClick = (neuronId: string) => {
        // Block actions during dilemma
        if (showDilemma) {
            useGameStore.getState().addMessage('Attendez la fin du dilemme !', 'warning');
            return;
        }
        if (!networkData) return;

        const neuron = networkData.neurons[neuronId];
        if (!neuron) return;

        // Can't destroy entry, core, or current explorer position
        if (neuron.type === 'entry' || neuron.type === 'core') {
            useGameStore.getState().addMessage('Impossible de détruire ce neurone', 'warning');
            return;
        }

        if (neuronId === explorerPosition) {
            useGameStore.getState().addMessage("L'explorateur est sur ce neurone", 'warning');
            return;
        }

        // Check resources
        if (!spendResources(resources.blockCost)) {
            useGameStore.getState().addMessage('Ressources insuffisantes', 'error');
            return;
        }

        // Block the neuron
        useGameStore.getState().blockNeuron(neuronId);
        useGameStore.getState().addMessage(`Neurone détruit (-${resources.blockCost} ressources)`, 'success');

        // Block all synapses connected to this neuron
        Object.entries(networkData.synapses).forEach(([synapseId, synapse]) => {
            if (synapse.fromNeuronId === neuronId || synapse.toNeuronId === neuronId) {
                useGameStore.getState().updateSynapseState(synapseId, 'blocked');
            }
        });

        // Notify explorer
        NetworkManager.getInstance().sendNeuronDestroyed(neuronId, useGameStore.getState().resources.current);
    };

    if (!networkData) {
        return (
            <group>
                <GridFloor />
                {/* Waiting message handled by HTML overlay */}
            </group>
        );
    }

    return (
        <group>
            {/* Controls - restricted to stay inside the sphere */}
            <OrbitControls
                ref={controlsRef}
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={30}
                maxDistance={700}
                maxPolarAngle={Math.PI / 2.1}
            />
            {/* Restrict camera target to stay inside sphere */}
            <CameraConstraint controlsRef={controlsRef} maxRadius={750} />

            {/* Spherical grid surrounding the network */}
            <GridFloor radius={800} rings={24} segments={64} centerY={60} />

            {/* Neural Network - Optimized, full visibility */}
            <NeuralNetworkOptimized
                networkData={networkData}
                showFog={false}
                explorerPosition={explorerPosition}
                onNeuronClick={handleNeuronClick}
            />

            {/* Explorer (remote view) - Simplified */}
            {explorerPosition && networkData.neurons[explorerPosition] && (
                <Explorer3DSimple
                    position={[
                        networkData.neurons[explorerPosition].x,
                        networkData.neurons[explorerPosition].y,
                        networkData.neurons[explorerPosition].z,
                    ]}
                />
            )}

            {/* AI - Simplified */}
            {aiState && networkData.neurons[aiState.currentNeuronId] && (
                <AI3DSimple
                    position={[
                        networkData.neurons[aiState.currentNeuronId].x,
                        networkData.neurons[aiState.currentNeuronId].y,
                        networkData.neurons[aiState.currentNeuronId].z,
                    ]}
                />
            )}

            {/* AI Path visualization */}
            {aiState && aiPath.length > 0 && (
                <AIPathVisualization
                    networkData={networkData}
                    aiCurrentId={aiState.currentNeuronId}
                    path={aiPath}
                />
            )}
        </group>
    );
}

// Component to visualize AI path
function AIPathVisualization({
    networkData,
    aiCurrentId,
    path,
}: {
    networkData: NeuralNetworkData3D;
    aiCurrentId: string;
    path: string[];
}) {
    const points = useMemo(() => {
        const allIds = [aiCurrentId, ...path];
        return allIds
            .map(id => {
                const neuron = networkData.neurons[id];
                if (!neuron) return null;
                return new THREE.Vector3(neuron.x, neuron.y, neuron.z);
            })
            .filter((p): p is THREE.Vector3 => p !== null);
    }, [networkData, aiCurrentId, path]);

    if (points.length < 2) return null;

    return (
        <group>
            {/* Main path line */}
            <Line
                points={points}
                color="#ff2244"
                lineWidth={4}
                opacity={0.8}
                transparent
            />
            {/* Glow effect - wider line behind */}
            <Line
                points={points}
                color="#ff0000"
                lineWidth={8}
                opacity={0.3}
                transparent
            />
            {/* Path markers at each waypoint */}
            {points.slice(1).map((point, i) => (
                <mesh key={i} position={point}>
                    <sphereGeometry args={[1.5, 8, 8]} />
                    <meshBasicMaterial
                        color="#ff2244"
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            ))}
        </group>
    );
}

// Component to restrict camera/controls target inside a sphere
function CameraConstraint({
    controlsRef,
    maxRadius
}: {
    controlsRef: React.RefObject<any>;
    maxRadius: number;
}) {
    useFrame(() => {
        if (!controlsRef.current) return;

        const controls = controlsRef.current;
        const target = controls.target as THREE.Vector3;
        const camera = controls.object as THREE.Camera;

        // Clamp target position inside sphere
        const targetDistance = target.length();
        if (targetDistance > maxRadius * 0.8) {
            target.normalize().multiplyScalar(maxRadius * 0.8);
            controls.update();
        }

        // Clamp camera position inside sphere
        const cameraDistance = camera.position.length();
        if (cameraDistance > maxRadius) {
            camera.position.normalize().multiplyScalar(maxRadius);
            controls.update();
        }
    });

    return null;
}
