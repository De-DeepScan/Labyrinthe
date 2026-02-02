import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Neuron3D as Neuron3DType } from '../../stores/gameStore';

interface Neuron3DProps {
    neuron: Neuron3DType;
    isVisible: boolean;
    isExplorerHere: boolean;
    onClick?: () => void;
}

const NEURON_COLORS: Record<string, { base: number; emissive: number }> = {
    normal: { base: 0x1a3a4a, emissive: 0x00d4aa },
    entry: { base: 0x00d4aa, emissive: 0x00ffcc },
    core: { base: 0xff9933, emissive: 0xffaa44 },
    junction: { base: 0x2a4a5a, emissive: 0x00d4aa },
    activated: { base: 0x00d4aa, emissive: 0x00ffcc },
    blocked: { base: 0xff3366, emissive: 0xff4477 },
};

const NEURON_SIZES: Record<string, number> = {
    normal: 1.5,
    entry: 2,
    core: 2.5,
    junction: 1.8,
};

export function Neuron3D({ neuron, isVisible, isExplorerHere, onClick }: Neuron3DProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    const size = NEURON_SIZES[neuron.type] || 1.5;

    const colors = useMemo(() => {
        if (neuron.isBlocked) return NEURON_COLORS.blocked;
        if (neuron.isActivated && neuron.type !== 'entry' && neuron.type !== 'core') {
            return NEURON_COLORS.activated;
        }
        return NEURON_COLORS[neuron.type] || NEURON_COLORS.normal;
    }, [neuron.type, neuron.isActivated, neuron.isBlocked]);

    const geometry = useMemo(() => {
        if (neuron.type === 'core') {
            return new THREE.DodecahedronGeometry(size, 0);
        } else if (neuron.type === 'entry' || neuron.isActivated) {
            return new THREE.IcosahedronGeometry(size, 0);
        }
        return new THREE.IcosahedronGeometry(size, 1);
    }, [neuron.type, neuron.isActivated, size]);

    // Animation
    useFrame((state) => {
        if (!meshRef.current) return;

        const time = state.clock.elapsedTime;

        // Gentle rotation
        meshRef.current.rotation.y = time * 0.2;
        meshRef.current.rotation.x = Math.sin(time * 0.3) * 0.1;

        // Pulse for special neurons
        if (neuron.type === 'core' || neuron.type === 'entry') {
            const scale = 1 + Math.sin(time * 2) * 0.05;
            meshRef.current.scale.setScalar(scale);
        }

        // Explorer here pulse
        if (isExplorerHere && meshRef.current) {
            const scale = 1 + Math.sin(time * 4) * 0.1;
            meshRef.current.scale.setScalar(scale);
        }

        // Glow animation
        if (glowRef.current) {
            const material = glowRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = 0.15 + Math.sin(time * 2) * 0.05;
        }
    });

    const opacity = isVisible ? 1 : 0.15;
    const emissiveIntensity = isVisible ? (neuron.type === 'core' ? 0.6 : neuron.type === 'entry' ? 0.4 : 0.2) : 0.05;

    return (
        <group position={[neuron.x, neuron.y, neuron.z]}>
            {/* Glow sphere */}
            <mesh ref={glowRef} scale={[2.5, 2.5, 2.5]}>
                <sphereGeometry args={[size, 16, 16]} />
                <meshBasicMaterial
                    color={colors.emissive}
                    transparent
                    opacity={isVisible ? 0.15 : 0.02}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Main neuron */}
            <mesh
                ref={meshRef}
                geometry={geometry}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                }}
                onPointerEnter={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerLeave={() => {
                    document.body.style.cursor = 'auto';
                }}
            >
                <meshStandardMaterial
                    color={colors.base}
                    emissive={colors.emissive}
                    emissiveIntensity={emissiveIntensity}
                    transparent
                    opacity={opacity}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>

            {/* Wireframe overlay for activated neurons */}
            {(neuron.isActivated || neuron.type === 'core' || neuron.type === 'entry') && isVisible && (
                <mesh geometry={geometry} scale={[1.02, 1.02, 1.02]}>
                    <meshBasicMaterial
                        color={colors.emissive}
                        wireframe
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            )}
        </group>
    );
}
