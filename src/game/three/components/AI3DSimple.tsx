import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AI3DSimpleProps {
    position: [number, number, number];
}

export function AI3DSimple({ position }: AI3DSimpleProps) {
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);

    const currentPos = useRef(new THREE.Vector3(...position));
    const targetPos = useRef(new THREE.Vector3(...position));

    targetPos.current.set(...position);

    useFrame((state) => {
        if (!groupRef.current) return;

        const time = state.clock.elapsedTime;

        // Smooth position
        currentPos.current.lerp(targetPos.current, 0.05);
        groupRef.current.position.copy(currentPos.current);

        // Hover
        groupRef.current.position.y += Math.sin(time * 1.5) * 0.4;

        // Core rotation
        if (coreRef.current) {
            coreRef.current.rotation.y = time * 0.8;
            coreRef.current.rotation.x = time * 0.5;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Outer glow - large */}
            <mesh scale={[12, 12, 12]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#ff0044" transparent opacity={0.15} side={THREE.BackSide} />
            </mesh>

            {/* Middle glow */}
            <mesh scale={[8, 8, 8]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial color="#ff2255" transparent opacity={0.25} side={THREE.BackSide} />
            </mesh>

            {/* Core - rotating octahedron */}
            <mesh ref={coreRef}>
                <octahedronGeometry args={[5, 0]} />
                <meshStandardMaterial
                    color="#ff3366"
                    emissive="#ff0044"
                    emissiveIntensity={1.0}
                    roughness={0.2}
                    metalness={0.9}
                />
            </mesh>

            {/* Inner glowing core */}
            <mesh>
                <sphereGeometry args={[2, 12, 12]} />
                <meshBasicMaterial color="#ff0000" />
            </mesh>

            {/* Spikes for menacing look */}
            {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = (i / 6) * Math.PI * 2;
                return (
                    <mesh key={i} position={[Math.cos(angle) * 6, 0, Math.sin(angle) * 6]} rotation={[0, angle, Math.PI / 2]}>
                        <coneGeometry args={[1.5, 4, 4]} />
                        <meshStandardMaterial color="#ff2244" emissive="#ff0022" emissiveIntensity={0.8} />
                    </mesh>
                );
            })}
        </group>
    );
}
