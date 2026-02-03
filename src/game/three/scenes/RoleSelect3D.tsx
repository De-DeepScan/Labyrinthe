import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { GridFloor } from '../effects/GridFloor';

export function RoleSelect3D() {
    const role = useGameStore((state) => state.role);
    const gameStarted = useGameStore((state) => state.gameStarted);

    // If role is selected but game not started, show waiting screen
    if (role && !gameStarted) {
        return (
            <group>
                {/* Spherical grid */}
                <GridFloor radius={100} rings={12} segments={32} centerY={15} />

                {/* Waiting message */}
                <Text
                    position={[0, 25, 0]}
                    fontSize={3}
                    color={role === 'explorer' ? '#00d4aa' : '#ff9933'}
                    anchorX="center"
                    anchorY="middle"
                >
                    {role === 'explorer' ? 'EXPLORATEUR' : 'PROTECTEUR'}
                </Text>

                <Text
                    position={[0, 18, 0]}
                    fontSize={2}
                    color="#666688"
                    anchorX="center"
                    anchorY="middle"
                >
                    En attente du gamemaster...
                </Text>

                <Text
                    position={[0, 12, 0]}
                    fontSize={1.2}
                    color="#444466"
                    anchorX="center"
                    anchorY="middle"
                >
                    La partie démarrera bientôt
                </Text>

                {/* Pulsing indicator */}
                <PulsingIndicator color={role === 'explorer' ? '#00d4aa' : '#ff9933'} />

                {/* Floating decorative elements */}
                <FloatingNeurons />
            </group>
        );
    }

    // No role assigned - show configuration message
    return (
        <group>
            {/* Spherical grid */}
            <GridFloor radius={100} rings={12} segments={32} centerY={15} />

            {/* Title */}
            <Text
                position={[0, 25, 0]}
                fontSize={4}
                color="#ff3366"
                anchorX="center"
                anchorY="middle"
            >
                CONFIGURATION REQUISE
            </Text>

            <Text
                position={[0, 18, 0]}
                fontSize={1.5}
                color="#666688"
                anchorX="center"
                anchorY="middle"
            >
                Aucun rôle attribué à cet écran
            </Text>

            <Text
                position={[0, 12, 0]}
                fontSize={1}
                color="#444466"
                anchorX="center"
                anchorY="middle"
            >
                Ajoutez ?role=explorer ou ?role=protector à l'URL
            </Text>

            {/* Floating decorative elements */}
            <FloatingNeurons />
        </group>
    );
}

// Pulsing indicator while waiting
function PulsingIndicator({ color }: { color: string }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
            meshRef.current.scale.setScalar(scale);
            meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 3, 0]}>
            <torusGeometry args={[3, 0.3, 16, 32]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
                transparent
                opacity={0.7}
            />
        </mesh>
    );
}

// Optimized: Reduced from 20 to 10 neurons, using simpler material
function FloatingNeurons() {
    const groupRef = useRef<THREE.Group>(null);
    const neurons = useRef(
        Array.from({ length: 10 }, (_, i) => ({
            x: (Math.random() - 0.5) * 80,
            y: Math.random() * 30 + 5,
            z: (Math.random() - 0.5) * 80,
            speed: 0.5 + Math.random() * 0.5,
            phase: (i / 10) * Math.PI * 2, // Deterministic phase
            size: 0.5 + (i % 3) * 0.25, // Deterministic size
        }))
    ).current;

    useFrame((state) => {
        if (groupRef.current) {
            const time = state.clock.elapsedTime;
            groupRef.current.children.forEach((child, i) => {
                const neuron = neurons[i];
                child.position.y = neuron.y + Math.sin(time * neuron.speed + neuron.phase) * 2;
                child.rotation.x = time * 0.2;
                child.rotation.y = time * 0.3;
            });
        }
    });

    return (
        <group ref={groupRef}>
            {neurons.map((neuron, i) => (
                <mesh key={i} position={[neuron.x, neuron.y, neuron.z]}>
                    <icosahedronGeometry args={[neuron.size, 0]} />
                    <meshBasicMaterial
                        color="#00d4aa"
                        transparent
                        opacity={0.4}
                        wireframe
                    />
                </mesh>
            ))}
        </group>
    );
}
