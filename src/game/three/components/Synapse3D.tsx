import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { Synapse } from '../../types/interfaces';
import type { Neuron3D } from '../../stores/gameStore';

interface Synapse3DProps {
    synapse: Synapse;
    fromNeuron: Neuron3D;
    toNeuron: Neuron3D;
    isVisible: boolean;
}

const SYNAPSE_COLORS: Record<string, string> = {
    dormant: '#0a4a5a',
    active: '#00d4aa',
    solving: '#ffcc00',
    blocked: '#ff3366',
    ai_path: '#ff3366',
    failed: '#666666',
};

export function Synapse3D({ synapse, fromNeuron, toNeuron, isVisible }: Synapse3DProps) {
    const particlesRef = useRef<THREE.Points>(null);

    const color = SYNAPSE_COLORS[synapse.state] || SYNAPSE_COLORS.dormant;
    const isActive = synapse.state === 'active' || synapse.state === 'solving';

    // Line points
    const linePoints = useMemo(() => [
        [fromNeuron.x, fromNeuron.y, fromNeuron.z] as [number, number, number],
        [toNeuron.x, toNeuron.y, toNeuron.z] as [number, number, number],
    ], [fromNeuron, toNeuron]);

    // Create particles for data flow effect
    const { particleGeometry, particleCount } = useMemo(() => {
        const count = isActive ? 10 : 0;
        const positions = new Float32Array(count * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return { particleGeometry: geometry, particleCount: count };
    }, [isActive]);

    // Animate particles along the synapse
    useFrame((state) => {
        if (!particlesRef.current || !isActive) return;

        const positions = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const time = state.clock.elapsedTime;

        for (let i = 0; i < particleCount; i++) {
            const t = ((time * 0.5 + i / particleCount) % 1);
            positions.setXYZ(
                i,
                fromNeuron.x + (toNeuron.x - fromNeuron.x) * t,
                fromNeuron.y + (toNeuron.y - fromNeuron.y) * t,
                fromNeuron.z + (toNeuron.z - fromNeuron.z) * t
            );
        }
        positions.needsUpdate = true;
    });

    const opacity = isVisible ? (isActive ? 0.8 : 0.3) : 0.05;
    const lineWidth = isActive ? 3 : 1;

    return (
        <group>
            {/* Main line */}
            <Line
                points={linePoints}
                color={color}
                lineWidth={lineWidth}
                transparent
                opacity={opacity}
            />

            {/* Glow line for active synapses */}
            {isActive && isVisible && (
                <Line
                    points={linePoints}
                    color={color}
                    lineWidth={6}
                    transparent
                    opacity={0.3}
                />
            )}

            {/* Data flow particles */}
            {isActive && isVisible && (
                <points ref={particlesRef} geometry={particleGeometry}>
                    <pointsMaterial
                        color={color}
                        size={0.5}
                        transparent
                        opacity={0.8}
                        sizeAttenuation
                    />
                </points>
            )}

            {/* Blocked indicator */}
            {synapse.state === 'blocked' && isVisible && (
                <BlockedIndicator
                    position={[
                        (fromNeuron.x + toNeuron.x) / 2,
                        (fromNeuron.y + toNeuron.y) / 2,
                        (fromNeuron.z + toNeuron.z) / 2,
                    ]}
                />
            )}
        </group>
    );
}

function BlockedIndicator({ position }: { position: [number, number, number] }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.z = state.clock.elapsedTime * 2;
            const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
            meshRef.current.scale.setScalar(scale);
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <octahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial
                color={0xff3366}
                emissive={0xff3366}
                emissiveIntensity={0.5}
                transparent
                opacity={0.8}
            />
        </mesh>
    );
}
