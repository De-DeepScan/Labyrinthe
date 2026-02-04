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

// Generate random variations for each neuron (seeded by neuron id for consistency)
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function getNeuronVariation(neuronId: string): { sizeMultiplier: number; opacityMultiplier: number; glowMultiplier: number } {
    const hash = hashString(neuronId);
    return {
        sizeMultiplier: 0.85 + (hash % 30) / 100,      // 0.85 to 1.15
        opacityMultiplier: 0.7 + (hash % 40) / 100,    // 0.7 to 1.1
        glowMultiplier: 0.6 + ((hash >> 4) % 50) / 100 // 0.6 to 1.1
    };
}

export function NeuralNetworkOptimized({
    networkData,
    showFog,
    explorerPosition,
    onNeuronClick
}: NeuralNetworkOptimizedProps) {
    const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
    const lowOpacityMeshRef = useRef<THREE.InstancedMesh>(null);

    // Split neurons into normal and low-opacity groups
    const { normalNeurons, lowOpacityNeurons } = useMemo(() => {
        const all = Object.values(networkData.neurons);
        const normal = all.filter(n => !n.opacity || n.opacity >= 1);
        const lowOpacity = all.filter(n => n.opacity && n.opacity < 1);
        return { normalNeurons: normal, lowOpacityNeurons: lowOpacity };
    }, [networkData.neurons]);

    const neuronsArray = useMemo(() => Object.values(networkData.neurons), [networkData.neurons]);
    const neuronCount = normalNeurons.length;
    const lowOpacityCount = lowOpacityNeurons.length;

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

    // Material for low-opacity neurons (inner layer)
    const lowOpacityMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.15,
        metalness: 0.9,
        emissive: new THREE.Color(0x4488ff),
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
    }), []);

    // Dummy object for matrix calculations - reused
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const colorArray = useMemo(() => new Float32Array(neuronCount * 3), [neuronCount]);
    const lowOpacityColorArray = useMemo(() => new Float32Array(lowOpacityCount * 3), [lowOpacityCount]);
    const colorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null);
    const lowOpacityColorAttributeRef = useRef<THREE.InstancedBufferAttribute | null>(null);

    // Update normal opacity instances
    useEffect(() => {
        if (!instancedMeshRef.current) return;

        normalNeurons.forEach((neuron, i) => {
            const isVisible = visibleNeurons.has(neuron.id);
            const isAdjacent = adjacentNeurons.has(neuron.id);
            const isCurrent = neuron.id === explorerPosition;
            const baseSize = SIZES[neuron.type] || 1.5;

            // Get random variation for this neuron
            const variation = getNeuronVariation(neuron.id);

            // Adjacent neurons are slightly larger, apply random size variation
            const size = (isCurrent ? baseSize * 1.3 : isAdjacent ? baseSize * 1.2 : baseSize) * variation.sizeMultiplier;

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

        // Reuse existing color buffer instead of creating new one
        if (!colorAttributeRef.current) {
            colorAttributeRef.current = new THREE.InstancedBufferAttribute(colorArray, 3);
            instancedMeshRef.current.geometry.setAttribute('color', colorAttributeRef.current);
        } else {
            colorAttributeRef.current.set(colorArray);
            colorAttributeRef.current.needsUpdate = true;
        }
    }, [normalNeurons, visibleNeurons, adjacentNeurons, explorerPosition, dummy, colorArray]);

    // Update low-opacity instances (inner layer)
    useEffect(() => {
        if (!lowOpacityMeshRef.current || lowOpacityNeurons.length === 0) return;

        lowOpacityNeurons.forEach((neuron, i) => {
            const baseSize = SIZES[neuron.type] || 1.5;
            const variation = getNeuronVariation(neuron.id);
            const size = baseSize * variation.sizeMultiplier * 0.8; // Slightly smaller

            dummy.position.set(neuron.x, neuron.y, neuron.z);
            dummy.scale.setScalar(size);
            dummy.updateMatrix();
            lowOpacityMeshRef.current!.setMatrixAt(i, dummy.matrix);

            // Use hidden/dim color for inner neurons
            const color = COLORS.hidden;
            lowOpacityColorArray[i * 3] = color.r;
            lowOpacityColorArray[i * 3 + 1] = color.g;
            lowOpacityColorArray[i * 3 + 2] = color.b;
        });

        lowOpacityMeshRef.current.instanceMatrix.needsUpdate = true;

        if (!lowOpacityColorAttributeRef.current) {
            lowOpacityColorAttributeRef.current = new THREE.InstancedBufferAttribute(lowOpacityColorArray, 3);
            lowOpacityMeshRef.current.geometry.setAttribute('color', lowOpacityColorAttributeRef.current);
        } else {
            lowOpacityColorAttributeRef.current.set(lowOpacityColorArray);
            lowOpacityColorAttributeRef.current.needsUpdate = true;
        }
    }, [lowOpacityNeurons, dummy, lowOpacityColorArray]);

    // Click handler (only for normal neurons, not inner layer)
    const handleClick = (event: THREE.Event) => {
        if (!onNeuronClick) return;
        const instanceId = (event as any).instanceId;
        if (instanceId !== undefined && instanceId < normalNeurons.length) {
            onNeuronClick(normalNeurons[instanceId].id);
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
                lineWidth = 10;
            } else if (isAdjacentSynapse) {
                // Bright yellow for adjacent connections - very visible
                color = '#ffff00';
                opacity = 1;
                lineWidth = 12;
            } else if (isActive) {
                color = '#00ffcc';
                opacity = 0.9;
                lineWidth = 8;
            } else {
                // Decorative synapses get a slightly different color for the pulse effect
                const isDecorative = synapse.id.startsWith('s_deco_');
                color = isDecorative ? '#3366aa' : '#4a9fff';
                opacity = isVisible ? 0.8 : (isDecorative ? 0.35 : 0.2);
                lineWidth = isVisible ? 6 : (isDecorative ? 2 : 3);
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
            {/* Instanced neurons - normal opacity */}
            <instancedMesh
                ref={instancedMeshRef}
                args={[geometry, material, neuronCount]}
                onClick={handleClick}
            />

            {/* Instanced neurons - low opacity (inner layer) */}
            {lowOpacityCount > 0 && (
                <instancedMesh
                    ref={lowOpacityMeshRef}
                    args={[geometry, lowOpacityMaterial, lowOpacityCount]}
                />
            )}

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

            {/* Synapse Pulse Effects - information flowing between neurons */}
            <SynapsePulses
                networkData={networkData}
                visibleNeurons={visibleNeurons}
            />

            {/* Subtle glow for all visible neurons */}
            <NeuronGlows
                neurons={neuronsArray}
                visibleNeurons={visibleNeurons}
            />

            {/* Orbiting particles around neurons */}
            <NeuronParticles
                neurons={neuronsArray}
                visibleNeurons={visibleNeurons}
                adjacentNeurons={adjacentNeurons}
                explorerPosition={explorerPosition}
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
            {/* Core neuron - optimized with reduced geometry resolution */}
            {coreNeuron && (
                <group position={[coreNeuron.x, coreNeuron.y, coreNeuron.z]}>
                    {/* Single combined glow - reduced from 3 spheres */}
                    <mesh>
                        <sphereGeometry args={[10, 8, 8]} />
                        <meshBasicMaterial color="#ff00ff" transparent opacity={0.2} side={THREE.BackSide} />
                    </mesh>
                    {/* Core pulse ring */}
                    <mesh ref={(el) => { if (el) ringRefs.current[100] = el; }}>
                        <ringGeometry args={[6, 7, 16]} />
                        <meshBasicMaterial color="#ff00ff" transparent opacity={0.8} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            )}

            {/* Entry neuron glow - reduced resolution */}
            {neurons.find(n => n.type === 'entry') && (
                <group position={[neurons.find(n => n.type === 'entry')!.x, neurons.find(n => n.type === 'entry')!.y, neurons.find(n => n.type === 'entry')!.z]}>
                    <mesh>
                        <sphereGeometry args={[8, 8, 8]} />
                        <meshBasicMaterial color="#00ff88" transparent opacity={0.2} side={THREE.BackSide} />
                    </mesh>
                </group>
            )}

            {/* Current position - reduced resolution */}
            {explorerNeuron && (
                <group position={[explorerNeuron.x, explorerNeuron.y, explorerNeuron.z]}>
                    <mesh>
                        <sphereGeometry args={[6, 8, 8]} />
                        <meshBasicMaterial color="#00ff00" transparent opacity={0.3} side={THREE.BackSide} />
                    </mesh>
                    <mesh ref={(el) => { if (el) ringRefs.current[0] = el; }}>
                        <ringGeometry args={[4, 5, 16]} />
                        <meshBasicMaterial color="#00ff00" transparent opacity={0.9} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            )}

            {/* Adjacent neurons - limit to first 8 for performance */}
            {adjacentNeuronObjects.slice(0, 8).map((neuron, i) => (
                <group key={neuron.id} position={[neuron.x, neuron.y, neuron.z]}>
                    <mesh>
                        <sphereGeometry args={[5, 6, 6]} />
                        <meshBasicMaterial color="#ffff00" transparent opacity={0.25} side={THREE.BackSide} />
                    </mesh>
                    <mesh ref={(el) => { if (el) ringRefs.current[i + 1] = el; }}>
                        <ringGeometry args={[3.5, 4, 12]} />
                        <meshBasicMaterial color="#ffff00" transparent opacity={0.7} side={THREE.DoubleSide} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

// Glow effect for all visible neurons with random variations
function NeuronGlows({
    neurons,
    visibleNeurons
}: {
    neurons: Neuron3D[];
    visibleNeurons: Set<string>;
}) {
    const glowRef = useRef<THREE.InstancedMesh>(null);
    const timeRef = useRef(0);

    const visibleNeuronsArray = useMemo(() => {
        return neurons.filter(n => visibleNeurons.has(n.id));
    }, [neurons, visibleNeurons]);

    const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), []);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x4488ff),
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        depthWrite: false,
    }), []);

    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Animate glow with random variations
    useFrame((state) => {
        if (!glowRef.current) return;
        timeRef.current = state.clock.elapsedTime;

        visibleNeuronsArray.forEach((neuron, i) => {
            const variation = getNeuronVariation(neuron.id);
            const baseSize = SIZES[neuron.type] || 2;

            // Animate glow size with slight pulsing based on neuron's unique phase
            const phase = hashString(neuron.id) % 100 / 10;
            const pulse = 1 + Math.sin(timeRef.current * 2 + phase) * 0.15 * variation.glowMultiplier;
            const glowSize = baseSize * 2 * variation.sizeMultiplier * pulse;

            dummy.position.set(neuron.x, neuron.y, neuron.z);
            dummy.scale.setScalar(glowSize);
            dummy.updateMatrix();
            glowRef.current!.setMatrixAt(i, dummy.matrix);
        });

        glowRef.current.instanceMatrix.needsUpdate = true;
    });

    useEffect(() => {
        if (!glowRef.current) return;

        visibleNeuronsArray.forEach((neuron, i) => {
            const variation = getNeuronVariation(neuron.id);
            const baseSize = SIZES[neuron.type] || 2;
            const glowSize = baseSize * 2 * variation.sizeMultiplier;

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

// Particle shader for orbiting particles around neurons
const particleVertexShader = `
    attribute float particleIndex;
    attribute vec3 neuronPosition;
    attribute vec3 particleColor;
    attribute float orbitRadius;
    attribute float orbitSpeed;
    attribute float orbitPhase;
    attribute float verticalOffset;

    uniform float uTime;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = particleColor;

        // Calculate orbital position
        float angle = uTime * orbitSpeed + orbitPhase;
        float vertAngle = uTime * orbitSpeed * 0.7 + orbitPhase * 2.0;

        vec3 offset = vec3(
            cos(angle) * orbitRadius,
            sin(vertAngle) * verticalOffset,
            sin(angle) * orbitRadius
        );

        vec3 worldPosition = neuronPosition + offset;

        // Pulsing alpha based on position - brighter for visibility
        vAlpha = 0.6 + sin(uTime * 3.0 + orbitPhase) * 0.4;

        vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size attenuation - larger for better visibility at distance
        gl_PointSize = 4.0 * (400.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 2.0, 12.0);
    }
`;

const particleFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        // Circular particle with soft edge
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        float alpha = vAlpha * (1.0 - dist * 2.0);
        gl_FragColor = vec4(vColor, alpha);
    }
`;

// Particles floating around neurons - visible on ALL neurons
function NeuronParticles({
    neurons,
    visibleNeurons,
    adjacentNeurons,
    explorerPosition
}: {
    neurons: Neuron3D[];
    visibleNeurons: Set<string>;
    adjacentNeurons: Set<string>;
    explorerPosition: string | null;
}) {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // Create particle data - 3 particles per neuron (all neurons, not just visible)
    const particleData = useMemo(() => {
        const particlesPerNeuron = 3;
        const totalParticles = neurons.length * particlesPerNeuron;

        const positions = new Float32Array(totalParticles * 3);
        const neuronPositions = new Float32Array(totalParticles * 3);
        const colors = new Float32Array(totalParticles * 3);
        const orbitRadii = new Float32Array(totalParticles);
        const orbitSpeeds = new Float32Array(totalParticles);
        const orbitPhases = new Float32Array(totalParticles);
        const verticalOffsets = new Float32Array(totalParticles);
        const particleIndices = new Float32Array(totalParticles);

        neurons.forEach((neuron, neuronIndex) => {
            const isVisible = visibleNeurons.has(neuron.id);
            const isAdjacent = adjacentNeurons.has(neuron.id);
            const isCurrent = neuron.id === explorerPosition;
            const baseSize = SIZES[neuron.type] || 2;

            // Choose color based on neuron state
            let color: THREE.Color;
            if (isCurrent) {
                color = COLORS.current;
            } else if (isAdjacent) {
                color = COLORS.adjacent;
            } else if (neuron.isBlocked) {
                color = COLORS.blocked;
            } else if (!isVisible) {
                // Dimmer color for non-visible neurons
                color = new THREE.Color(0x2244aa);
            } else {
                color = COLORS[neuron.type as keyof typeof COLORS] || COLORS.normal;
            }

            const hash = hashString(neuron.id);

            for (let p = 0; p < particlesPerNeuron; p++) {
                const i = neuronIndex * particlesPerNeuron + p;

                // Initial position (will be overridden by shader)
                positions[i * 3] = neuron.x;
                positions[i * 3 + 1] = neuron.y;
                positions[i * 3 + 2] = neuron.z;

                // Store neuron center
                neuronPositions[i * 3] = neuron.x;
                neuronPositions[i * 3 + 1] = neuron.y;
                neuronPositions[i * 3 + 2] = neuron.z;

                // Particle color (slightly varied, dimmer for non-visible)
                const colorVariation = 0.8 + ((hash + p * 17) % 40) / 100;
                const visibilityFactor = isVisible ? 1.0 : 0.4;
                colors[i * 3] = color.r * colorVariation * visibilityFactor;
                colors[i * 3 + 1] = color.g * colorVariation * visibilityFactor;
                colors[i * 3 + 2] = color.b * colorVariation * visibilityFactor;

                // Orbit parameters - varied per particle
                orbitRadii[i] = baseSize * (1.5 + ((hash + p * 31) % 30) / 30);
                orbitSpeeds[i] = 0.5 + ((hash + p * 13) % 50) / 100;
                orbitPhases[i] = (p / particlesPerNeuron) * Math.PI * 2 + ((hash % 100) / 100) * Math.PI;
                verticalOffsets[i] = baseSize * (0.5 + ((hash + p * 7) % 30) / 60);
                particleIndices[i] = i;
            }
        });

        return {
            positions,
            neuronPositions,
            colors,
            orbitRadii,
            orbitSpeeds,
            orbitPhases,
            verticalOffsets,
            particleIndices,
            count: totalParticles
        };
    }, [neurons, visibleNeurons, adjacentNeurons, explorerPosition]);

    // Create geometry with attributes
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(particleData.positions, 3));
        geo.setAttribute('neuronPosition', new THREE.BufferAttribute(particleData.neuronPositions, 3));
        geo.setAttribute('particleColor', new THREE.BufferAttribute(particleData.colors, 3));
        geo.setAttribute('orbitRadius', new THREE.BufferAttribute(particleData.orbitRadii, 1));
        geo.setAttribute('orbitSpeed', new THREE.BufferAttribute(particleData.orbitSpeeds, 1));
        geo.setAttribute('orbitPhase', new THREE.BufferAttribute(particleData.orbitPhases, 1));
        geo.setAttribute('verticalOffset', new THREE.BufferAttribute(particleData.verticalOffsets, 1));
        geo.setAttribute('particleIndex', new THREE.BufferAttribute(particleData.particleIndices, 1));
        return geo;
    }, [particleData]);

    // Shader material
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            uniforms: {
                uTime: { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
    }, []);

    // Animate particles
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    if (particleData.count === 0) return null;

    return (
        <points ref={pointsRef} geometry={geometry}>
            <primitive object={material} ref={materialRef} attach="material" />
        </points>
    );
}

// Pulse shader for synapse information flow (background ambient effect)
const pulseVertexShader = `
    attribute float pulseProgress;
    attribute vec3 startPos;
    attribute vec3 endPos;
    attribute vec3 pulseColor;
    attribute float pulseSpeed;
    attribute float pulsePhase;

    uniform float uTime;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        vColor = pulseColor;

        // Calculate current progress along the synapse (0 to 1, looping)
        float progress = fract(uTime * pulseSpeed + pulsePhase);

        // Lerp between start and end positions
        vec3 currentPos = mix(startPos, endPos, progress);

        // Pulsing alpha - stays visible longer
        float distFromCenter = abs(progress - 0.5) * 2.0;
        vAlpha = (1.0 - distFromCenter * 0.5) * 0.8;

        vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Small subtle particles for background ambient effect
        gl_PointSize = 4.0 * (300.0 / -mvPosition.z);
        gl_PointSize = clamp(gl_PointSize, 1.5, 8.0);
    }
`;

const pulseFragmentShader = `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
        // Circular particle with bright glow effect
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;

        // Soft glow falloff with very bright center
        float alpha = vAlpha * (1.0 - dist * 0.8);
        alpha = max(0.0, alpha);

        // Very bright glow color for visibility
        vec3 glowColor = vColor * 3.0;
        gl_FragColor = vec4(glowColor, alpha);
    }
`;

// Animated pulses flowing along background/decorative synapses only
function SynapsePulses({
    networkData,
}: {
    networkData: NeuralNetworkData3D;
    visibleNeurons: Set<string>;
}) {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    // Create pulse data for decorative synapses only (background effect)
    const pulseData = useMemo(() => {
        const allSynapses = Object.values(networkData.synapses);

        // Only decorative synapses (background links)
        const decorativeSynapses = allSynapses.filter(s => s.id.startsWith('s_deco_'));

        // Create multiple pulses per synapse for a denser effect
        const pulsesPerSynapse = 2;
        const totalPulses = decorativeSynapses.length * pulsesPerSynapse;

        const positions = new Float32Array(totalPulses * 3);
        const startPositions = new Float32Array(totalPulses * 3);
        const endPositions = new Float32Array(totalPulses * 3);
        const colors = new Float32Array(totalPulses * 3);
        const speeds = new Float32Array(totalPulses);
        const phases = new Float32Array(totalPulses);

        decorativeSynapses.forEach((synapse, synapseIndex) => {
            const from = networkData.neurons[synapse.fromNeuronId];
            const to = networkData.neurons[synapse.toNeuronId];
            if (!from || !to) return;

            for (let p = 0; p < pulsesPerSynapse; p++) {
                const i = synapseIndex * pulsesPerSynapse + p;
                const hash = hashString(synapse.id + p);

                // Initial position (will be overridden by shader)
                positions[i * 3] = from.x;
                positions[i * 3 + 1] = from.y;
                positions[i * 3 + 2] = from.z;

                // Alternate direction for some pulses
                const reverse = p % 2 === 1;
                startPositions[i * 3] = reverse ? to.x : from.x;
                startPositions[i * 3 + 1] = reverse ? to.y : from.y;
                startPositions[i * 3 + 2] = reverse ? to.z : from.z;

                endPositions[i * 3] = reverse ? from.x : to.x;
                endPositions[i * 3 + 1] = reverse ? from.y : to.y;
                endPositions[i * 3 + 2] = reverse ? from.z : to.z;

                // Color - soft cyan/blue tones for ambient data flow
                const colorChoice = hash % 4;
                if (colorChoice === 0) {
                    // Soft Cyan
                    colors[i * 3] = 0.2;
                    colors[i * 3 + 1] = 0.8;
                    colors[i * 3 + 2] = 1.0;
                } else if (colorChoice === 1) {
                    // Electric Blue
                    colors[i * 3] = 0.3;
                    colors[i * 3 + 1] = 0.5;
                    colors[i * 3 + 2] = 1.0;
                } else if (colorChoice === 2) {
                    // Turquoise
                    colors[i * 3] = 0.0;
                    colors[i * 3 + 1] = 0.7;
                    colors[i * 3 + 2] = 0.8;
                } else {
                    // Purple-blue
                    colors[i * 3] = 0.4;
                    colors[i * 3 + 1] = 0.3;
                    colors[i * 3 + 2] = 1.0;
                }

                // Speed and phase - varied for natural look
                speeds[i] = 0.1 + (hash % 20) / 100; // 0.1 to 0.3 (slower for ambient)
                phases[i] = (p / pulsesPerSynapse) + (hash % 100) / 100;
            }
        });

        return {
            positions,
            startPositions,
            endPositions,
            colors,
            speeds,
            phases,
            count: totalPulses
        };
    }, [networkData]);

    // Create geometry with attributes
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pulseData.positions, 3));
        geo.setAttribute('startPos', new THREE.BufferAttribute(pulseData.startPositions, 3));
        geo.setAttribute('endPos', new THREE.BufferAttribute(pulseData.endPositions, 3));
        geo.setAttribute('pulseColor', new THREE.BufferAttribute(pulseData.colors, 3));
        geo.setAttribute('pulseSpeed', new THREE.BufferAttribute(pulseData.speeds, 1));
        geo.setAttribute('pulsePhase', new THREE.BufferAttribute(pulseData.phases, 1));
        return geo;
    }, [pulseData]);

    // Shader material
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            vertexShader: pulseVertexShader,
            fragmentShader: pulseFragmentShader,
            uniforms: {
                uTime: { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
    }, []);

    // Animate pulses
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    if (pulseData.count === 0) return null;

    return (
        <points ref={pointsRef} geometry={geometry}>
            <primitive object={material} ref={materialRef} attach="material" />
        </points>
    );
}
