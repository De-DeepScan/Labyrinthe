import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import { GridFloor } from '../effects/GridFloor';

export function RoleSelect3D() {
    const setRole = useGameStore((state) => state.setRole);
    const [hovered, setHovered] = useState<'explorer' | 'protector' | null>(null);

    return (
        <group>
            {/* Spherical grid */}
            <GridFloor radius={100} rings={12} segments={32} centerY={15} />

            {/* Title */}
            <Text
                position={[0, 25, 0]}
                fontSize={4}
                color="#00d4aa"
                anchorX="center"
                anchorY="middle"
            >
                INFILTRATION NEURALE
            </Text>

            <Text
                position={[0, 20, 0]}
                fontSize={1.5}
                color="#666688"
                anchorX="center"
                anchorY="middle"
            >
                Choisissez votre rôle
            </Text>

            {/* Explorer button */}
            <RoleButton
                position={[-15, 5, 0]}
                label="EXPLORATEUR"
                description="Naviguez le réseau neural"
                color="#00d4aa"
                isHovered={hovered === 'explorer'}
                onHover={() => setHovered('explorer')}
                onLeave={() => setHovered(null)}
                onClick={() => setRole('explorer')}
            />

            {/* Protector button */}
            <RoleButton
                position={[15, 5, 0]}
                label="PROTECTEUR"
                description="Défendez contre l'IA"
                color="#ff9933"
                isHovered={hovered === 'protector'}
                onHover={() => setHovered('protector')}
                onLeave={() => setHovered(null)}
                onClick={() => setRole('protector')}
            />

            {/* Floating decorative elements */}
            <FloatingNeurons />
        </group>
    );
}

interface RoleButtonProps {
    position: [number, number, number];
    label: string;
    description: string;
    color: string;
    isHovered: boolean;
    onHover: () => void;
    onLeave: () => void;
    onClick: () => void;
}

function RoleButton({
    position,
    label,
    description,
    color,
    isHovered,
    onHover,
    onLeave,
    onClick
}: RoleButtonProps) {
    const groupRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (groupRef.current) {
            // Hover animation
            const targetScale = isHovered ? 1.1 : 1;
            groupRef.current.scale.lerp(
                new THREE.Vector3(targetScale, targetScale, targetScale),
                0.1
            );

            // Gentle float
            groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.3;
        }

        if (glowRef.current) {
            // Glow pulse
            const material = glowRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = isHovered ? 0.4 : 0.1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Glow */}
            <mesh ref={glowRef} position={[0, 0, -0.5]}>
                <planeGeometry args={[18, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.1} />
            </mesh>

            {/* Panel background */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[16, 10, 0.5]} />
                <meshStandardMaterial
                    color="#0a1628"
                    emissive={color}
                    emissiveIntensity={isHovered ? 0.1 : 0.02}
                />
            </mesh>

            {/* Border */}
            <lineSegments position={[0, 0, 0.3]}>
                <edgesGeometry args={[new THREE.BoxGeometry(16, 10, 0.1)]} />
                <lineBasicMaterial color={color} linewidth={2} />
            </lineSegments>

            {/* Icon (simple geometric shape) */}
            <mesh position={[0, 1.5, 1]}>
                <icosahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.5}
                    wireframe
                />
            </mesh>

            {/* Label */}
            <Text
                position={[0, -1.5, 1]}
                fontSize={1.2}
                color={color}
                anchorX="center"
                anchorY="middle"
            >
                {label}
            </Text>

            {/* Description */}
            <Text
                position={[0, -3, 1]}
                fontSize={0.6}
                color="#666688"
                anchorX="center"
                anchorY="middle"
            >
                {description}
            </Text>

            {/* Hit area */}
            <mesh
                position={[0, 0, 1]}
                onPointerEnter={onHover}
                onPointerLeave={onLeave}
                onClick={onClick}
            >
                <planeGeometry args={[16, 10]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>
        </group>
    );
}

function FloatingNeurons() {
    const groupRef = useRef<THREE.Group>(null);
    const neurons = useRef(
        Array.from({ length: 20 }, () => ({
            x: (Math.random() - 0.5) * 80,
            y: Math.random() * 30 + 5,
            z: (Math.random() - 0.5) * 80,
            speed: 0.5 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
        }))
    ).current;

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.children.forEach((child, i) => {
                const neuron = neurons[i];
                child.position.y = neuron.y + Math.sin(state.clock.elapsedTime * neuron.speed + neuron.phase) * 2;
                child.rotation.x = state.clock.elapsedTime * 0.2;
                child.rotation.y = state.clock.elapsedTime * 0.3;
            });
        }
    });

    return (
        <group ref={groupRef}>
            {neurons.map((neuron, i) => (
                <mesh key={i} position={[neuron.x, neuron.y, neuron.z]}>
                    <icosahedronGeometry args={[0.5 + Math.random() * 0.5, 0]} />
                    <meshStandardMaterial
                        color="#00d4aa"
                        emissive="#00d4aa"
                        emissiveIntensity={0.3}
                        transparent
                        opacity={0.5}
                        wireframe
                    />
                </mesh>
            ))}
        </group>
    );
}
