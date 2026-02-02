import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { NeuralNetworkData3D, Neuron3D } from '../../stores/gameStore';

interface NeuralNetworkOptimizedProps {
    networkData: NeuralNetworkData3D;
    showFog: boolean;
    explorerPosition: string | null;
    onNeuronClick?: (neuronId: string) => void;
}

// Color constants - Vibrant cyberpunk palette
const COLORS = {
    normal: new THREE.Color(0x4a9fff),      // Bleu électrique
    entry: new THREE.Color(0x00ff88),       // Vert néon vif
    core: new THREE.Color(0xff00ff),        // Magenta vif
    junction: new THREE.Color(0x00d4ff),    // Cyan
    activated: new THREE.Color(0x00ffcc),   // Turquoise néon
    blocked: new THREE.Color(0xff2244),     // Rouge vif
    hidden: new THREE.Color(0x1a2a3a),      // Bleu très sombre
    adjacent: new THREE.Color(0xffff00),    // Jaune vif pour les adjacents
    current: new THREE.Color(0x00ff00),     // Vert lime pour position actuelle
};

const SIZES: Record<string, number> = {
    normal: 2,
    entry: 3,
    core: 4,
    junction: 2.2,
};

export function NeuralNetworkOptimized({
    networkData,
    showFog,
    explorerPosition,
    onNeuronClick
}: NeuralNetworkOptimizedProps) {
    const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
    const neuronsArray = useMemo(() => Object.values(networkData.neurons), [networkData.neurons]);
    const neuronCount = neuronsArray.length;

    // Calculate adjacent neurons (connected to explorer position)
    const adjacentNeurons = useMemo(() => {
        if (!explorerPosition) return new Set<string>();
        const current = networkData.neurons[explorerPosition];
        if (!current) return new Set<string>();
        return new Set(current.connections);
    }, [networkData.neurons, explorerPosition]);

    // Calculate visibility
    const visibleNeurons = useMemo(() => {
        if (!showFog) return new Set(Object.keys(networkData.neurons));
        if (!explorerPosition) return new Set<string>();

        const visible = new Set<string>();
        const queue: { id: string; depth: number }[] = [{ id: explorerPosition, depth: 0 }];
        const maxDepth = 3;

        while (queue.length > 0) {
            const { id, depth } = queue.shift()!;
            if (visible.has(id)) continue;

            const neuron = networkData.neurons[id];
            if (!neuron) continue;

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

    // Geometry for instances
    const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);

    // Material for instances with emissive glow
    const material = useMemo(() => new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.15,
        metalness: 0.9,
        emissive: new THREE.Color(0x4488ff),
        emissiveIntensity: 0.5,
    }), []);

    // Dummy object for matrix calculations
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colorArray = useMemo(() => new Float32Array(neuronCount * 3), [neuronCount]);

    // Update instances
    useEffect(() => {
        if (!instancedMeshRef.current) return;

        neuronsArray.forEach((neuron, i) => {
            const isVisible = visibleNeurons.has(neuron.id);
            const isAdjacent = adjacentNeurons.has(neuron.id);
            const isCurrent = neuron.id === explorerPosition;
            const baseSize = SIZES[neuron.type] || 1.5;

            // Adjacent neurons are slightly larger
            const size = isCurrent ? baseSize * 1.3 : isAdjacent ? baseSize * 1.2 : baseSize;

            // Position and scale
            dummy.position.set(neuron.x, neuron.y, neuron.z);
            dummy.scale.setScalar(isVisible ? size : size * 0.5);
            dummy.updateMatrix();
            instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);

            // Color - priority: current > adjacent > blocked > activated > type
            let color: THREE.Color;
            if (!isVisible) {
                color = COLORS.hidden;
            } else if (isCurrent) {
                color = COLORS.current;
            } else if (isAdjacent) {
                color = COLORS.adjacent;
            } else if (neuron.isBlocked) {
                color = COLORS.blocked;
            } else if (neuron.isActivated) {
                color = COLORS.activated;
            } else {
                color = COLORS[neuron.type as keyof typeof COLORS] || COLORS.normal;
            }

            colorArray[i * 3] = color.r;
            colorArray[i * 3 + 1] = color.g;
            colorArray[i * 3 + 2] = color.b;
        });

        instancedMeshRef.current.instanceMatrix.needsUpdate = true;
        instancedMeshRef.current.geometry.setAttribute(
            'color',
            new THREE.InstancedBufferAttribute(colorArray, 3)
        );
    }, [neuronsArray, visibleNeurons, adjacentNeurons, explorerPosition, dummy, colorArray]);

    // Click handler
    const handleClick = (event: THREE.Event) => {
        if (!onNeuronClick) return;
        const instanceId = (event as any).instanceId;
        if (instanceId !== undefined && instanceId < neuronsArray.length) {
            onNeuronClick(neuronsArray[instanceId].id);
        }
    };

    // Synapses - with highlighting for adjacent connections
    const synapseLines = useMemo(() => {
        const lines: Array<{
            points: [[number, number, number], [number, number, number]];
            color: string;
            opacity: number;
            lineWidth: number;
            isAdjacent: boolean;
        }> = [];

        Object.values(networkData.synapses).forEach((synapse) => {
            const from = networkData.neurons[synapse.fromNeuronId];
            const to = networkData.neurons[synapse.toNeuronId];
            if (!from || !to) return;

            const isVisible = visibleNeurons.has(from.id) && visibleNeurons.has(to.id);
            const isActive = synapse.state === 'active' || synapse.state === 'solving';

            // Check if this synapse connects to explorer position
            const isAdjacentSynapse = explorerPosition &&
                (synapse.fromNeuronId === explorerPosition || synapse.toNeuronId === explorerPosition);

            let color: string;
            let opacity: number;
            let lineWidth: number;

            if (synapse.state === 'blocked') {
                color = '#ff0044';
                opacity = 1;
                lineWidth = 3;
            } else if (isAdjacentSynapse) {
                // Bright yellow for adjacent connections - very visible
                color = '#ffff00';
                opacity = 1;
                lineWidth = 5;
            } else if (isActive) {
                color = '#00ffcc';
                opacity = 0.9;
                lineWidth = 3;
            } else {
                color = '#4a9fff';
                opacity = isVisible ? 0.6 : 0.08;
                lineWidth = isVisible ? 2 : 1;
            }

            lines.push({
                points: [
                    [from.x, from.y, from.z],
                    [to.x, to.y, to.z],
                ],
                color,
                opacity,
                lineWidth,
                isAdjacent: !!isAdjacentSynapse,
            });
        });

        // Sort so adjacent lines render on top
        return lines.sort((a, b) => (a.isAdjacent ? 1 : 0) - (b.isAdjacent ? 1 : 0));
    }, [networkData, visibleNeurons, explorerPosition]);

    return (
        <group>
            {/* Instanced neurons */}
            <instancedMesh
                ref={instancedMeshRef}
                args={[geometry, material, neuronCount]}
                onClick={handleClick}
            />

            {/* Synapses */}
            {synapseLines.map((line, i) => (
                <Line
                    key={i}
                    points={line.points}
                    color={line.color}
                    lineWidth={line.lineWidth}
                    transparent
                    opacity={line.opacity}
                />
            ))}

            {/* Subtle glow for all visible neurons */}
            <NeuronGlows
                neurons={neuronsArray}
                visibleNeurons={visibleNeurons}
            />

            {/* Visual highlights */}
            <NeuronHighlights
                networkData={networkData}
                neurons={neuronsArray}
                visibleNeurons={visibleNeurons}
                adjacentNeurons={adjacentNeurons}
                explorerPosition={explorerPosition}
            />
        </group>
    );
}

// Highlights for special neurons with animation
function NeuronHighlights({
    neurons,
    visibleNeurons,
    adjacentNeurons,
    explorerPosition
}: {
    networkData: NeuralNetworkData3D;
    neurons: Neuron3D[];
    visibleNeurons: Set<string>;
    adjacentNeurons: Set<string>;
    explorerPosition: string | null;
}) {
    const ringRefs = useRef<THREE.Mesh[]>([]);

    const coreNeuron = neurons.find(n => n.type === 'core');
    const explorerNeuron = explorerPosition ? neurons.find(n => n.id === explorerPosition) : null;

    // Get adjacent neuron objects
    const adjacentNeuronObjects = useMemo(() => {
        return neurons.filter(n => adjacentNeurons.has(n.id) && visibleNeurons.has(n.id));
    }, [neurons, adjacentNeurons, visibleNeurons]);

    // Animate rings
    useFrame((state) => {
        const time = state.clock.elapsedTime;
        ringRefs.current.forEach((ring, i) => {
            if (ring) {
                // Pulsing scale
                const pulse = 1 + Math.sin(time * 3 + i * 0.5) * 0.2;
                ring.scale.setScalar(pulse);
                // Rotation
                ring.rotation.z = time * 0.5;
            }
        });
    });

    return (
        <group>
            {/* Core neuron - VERY visible with multiple glow layers */}
            {coreNeuron && (
                <group position={[coreNeuron.x, coreNeuron.y, coreNeuron.z]}>
                    {/* Outer glow - large */}
                    <mesh>
                        <sphereGeometry args={[12, 16, 16]} />
                        <meshBasicMaterial color="#ff00ff" transparent opacity={0.15} side={THREE.BackSide} />
                    </mesh>
                    {/* Medium glow */}
                    <mesh>
                        <sphereGeometry args={[8, 16, 16]} />
                        <meshBasicMaterial color="#ff44ff" transparent opacity={0.25} side={THREE.BackSide} />
                    </mesh>
                    {/* Inner glow */}
                    <mesh>
                        <sphereGeometry args={[5, 16, 16]} />
                        <meshBasicMaterial color="#ff88ff" transparent opacity={0.4} side={THREE.BackSide} />
                    </mesh>
                    {/* Core pulse ring */}
                    <mesh ref={(el) => { if (el) ringRefs.current[100] = el; }}>
                        <ringGeometry args={[6, 7, 32]} />
                        <meshBasicMaterial color="#ff00ff" transparent opacity={0.8} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            )}

            {/* Entry neuron glow */}
            {neurons.find(n => n.type === 'entry') && (
                <group position={[neurons.find(n => n.type === 'entry')!.x, neurons.find(n => n.type === 'entry')!.y, neurons.find(n => n.type === 'entry')!.z]}>
                    <mesh>
                        <sphereGeometry args={[8, 16, 16]} />
                        <meshBasicMaterial color="#00ff88" transparent opacity={0.2} side={THREE.BackSide} />
                    </mesh>
                </group>
            )}

            {/* Current position - bright green glow */}
            {explorerNeuron && (
                <group position={[explorerNeuron.x, explorerNeuron.y, explorerNeuron.z]}>
                    {/* Outer glow */}
                    <mesh>
                        <sphereGeometry args={[6, 12, 12]} />
                        <meshBasicMaterial color="#00ff00" transparent opacity={0.3} side={THREE.BackSide} />
                    </mesh>
                    {/* Pulsing ring */}
                    <mesh ref={(el) => { if (el) ringRefs.current[0] = el; }}>
                        <ringGeometry args={[4, 5, 32]} />
                        <meshBasicMaterial color="#00ff00" transparent opacity={0.9} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            )}

            {/* Adjacent neurons - bright yellow highlights */}
            {adjacentNeuronObjects.map((neuron, i) => (
                <group key={neuron.id} position={[neuron.x, neuron.y, neuron.z]}>
                    {/* Outer glow */}
                    <mesh>
                        <sphereGeometry args={[5, 8, 8]} />
                        <meshBasicMaterial color="#ffff00" transparent opacity={0.25} side={THREE.BackSide} />
                    </mesh>
                    {/* Pulsing ring */}
                    <mesh ref={(el) => { if (el) ringRefs.current[i + 1] = el; }}>
                        <ringGeometry args={[3.5, 4, 24]} />
                        <meshBasicMaterial color="#ffff00" transparent opacity={0.7} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// Glow effect for all visible neurons
function NeuronGlows({
    neurons,
    visibleNeurons
}: {
    neurons: Neuron3D[];
    visibleNeurons: Set<string>;
}) {
    const glowRef = useRef<THREE.InstancedMesh>(null);

    const visibleNeuronsArray = useMemo(() => {
        return neurons.filter(n => visibleNeurons.has(n.id));
    }, [neurons, visibleNeurons]);

    const geometry = useMemo(() => new THREE.SphereGeometry(1, 12, 12), []);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x4488ff),
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        depthWrite: false,
    }), []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!glowRef.current) return;

        visibleNeuronsArray.forEach((neuron, i) => {
            const baseSize = SIZES[neuron.type] || 2;
            const glowSize = baseSize * 2;

            dummy.position.set(neuron.x, neuron.y, neuron.z);
            dummy.scale.setScalar(glowSize);
            dummy.updateMatrix();
            glowRef.current!.setMatrixAt(i, dummy.matrix);
        });

        glowRef.current.instanceMatrix.needsUpdate = true;
    }, [visibleNeuronsArray, dummy]);

    if (visibleNeuronsArray.length === 0) return null;

    return (
        <instancedMesh
            ref={glowRef}
            args={[geometry, material, visibleNeuronsArray.length]}
        />
    );
}
