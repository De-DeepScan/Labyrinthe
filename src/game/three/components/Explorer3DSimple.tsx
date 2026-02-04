import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Explorer3DSimpleProps {
    position: [number, number, number];
}

export function Explorer3DSimple({ position }: Explorer3DSimpleProps) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);

    // Smooth position interpolation
    const currentPos = useRef(new THREE.Vector3(...position));
    const targetPos = useRef(new THREE.Vector3(...position));

    targetPos.current.set(...position);

    useFrame((state) => {
        if (!groupRef.current || !meshRef.current) return;

        const time = state.clock.elapsedTime;

        // Smooth position lerp
        currentPos.current.lerp(targetPos.current, 0.08);
        groupRef.current.position.copy(currentPos.current);

        // Floating animation
        groupRef.current.position.y += Math.sin(time * 2) * 0.3;

        // Rotation
        meshRef.current.rotation.y = time * 0.5;
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Glow */}
            <mesh scale={[2.5, 2.5, 2.5]}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshBasicMaterial color="#00ffcc" transparent opacity={0.15} side={THREE.BackSide} />
            </mesh>

            {/* Main mesh */}
            <mesh ref={meshRef}>
                <icosahedronGeometry args={[1.2, 0]} />
                <meshStandardMaterial
                    color="#00d4aa"
                    emissive="#00ffcc"
                    emissiveIntensity={0.5}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>

            {/* Inner core */}
            <mesh>
                <sphereGeometry args={[0.4, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
        </group>
    );
}
