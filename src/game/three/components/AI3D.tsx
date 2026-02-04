import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AI3DProps {
    position: [number, number, number];
}

export function AI3D({ position }: AI3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const coreRef = useRef<THREE.Mesh>(null);
    const spikesRef = useRef<THREE.Group>(null);

    // Smooth position interpolation
    const currentPos = useRef(new THREE.Vector3(...position));
    const targetPos = useRef(new THREE.Vector3(...position));

    targetPos.current.set(...position);

    useFrame((state) => {
        if (!groupRef.current) return;

        const time = state.clock.elapsedTime;

        // Smooth position lerp
        currentPos.current.lerp(targetPos.current, 0.05);
        groupRef.current.position.copy(currentPos.current);

        // Menacing hover
        groupRef.current.position.y += Math.sin(time * 1.5) * 0.4;

        // Core rotation
        if (coreRef.current) {
            coreRef.current.rotation.y = time * 0.8;
            coreRef.current.rotation.x = time * 0.5;

            // Pulsing scale
            const scale = 1 + Math.sin(time * 4) * 0.15;
            coreRef.current.scale.setScalar(scale);
        }

        // Spikes rotation (opposite direction)
        if (spikesRef.current) {
            spikesRef.current.rotation.y = -time * 0.4;
            spikesRef.current.rotation.z = time * 0.3;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Danger glow */}
            <mesh scale={[4, 4, 4]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color="#ff0044"
                    transparent
                    opacity={0.2}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Outer spikes */}
            <group ref={spikesRef}>
                {[...Array(8)].map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    return (
                        <mesh
                            key={i}
                            position={[
                                Math.cos(angle) * 2,
                                Math.sin(angle * 2) * 0.5,
                                Math.sin(angle) * 2,
                            ]}
                            rotation={[0, angle, Math.PI / 4]}
                        >
                            <coneGeometry args={[0.3, 1.5, 4]} />
                            <meshStandardMaterial
                                color="#ff3366"
                                emissive="#ff0044"
                                emissiveIntensity={0.5}
                            />
                        </mesh>
                    );
                })}
            </group>

            {/* Core octahedron */}
            <mesh ref={coreRef}>
                <octahedronGeometry args={[1.5, 0]} />
                <meshStandardMaterial
                    color="#ff3366"
                    emissive="#ff0044"
                    emissiveIntensity={0.7}
                    roughness={0.2}
                    metalness={0.9}
                />
            </mesh>

            {/* Wireframe */}
            <mesh scale={[1.1, 1.1, 1.1]}>
                <octahedronGeometry args={[1.5, 0]} />
                <meshBasicMaterial
                    color="#ff4477"
                    wireframe
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Inner glowing core */}
            <mesh>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="#ff0000" />
            </mesh>

            {/* Particles orbit */}
            <OrbitingParticles />

            {/* Point lights */}
            <pointLight color="#ff3366" intensity={2} distance={20} />
            <pointLight color="#ff0044" intensity={0.5} distance={10} />
        </group>
    );
}

function OrbitingParticles() {
    const pointsRef = useRef<THREE.Points>(null);

    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(45);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geo;
    }, []);

    useFrame((state) => {
        if (!pointsRef.current) return;

        const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const time = state.clock.elapsedTime;

        for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2 + time * 0.5;
            const radius = 2.5 + Math.sin(time * 2 + i) * 0.5;
            const height = Math.sin(angle * 2 + time) * 1;

            positions.setXYZ(
                i,
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );
        }
        positions.needsUpdate = true;
    });

    return (
        <points ref={pointsRef} geometry={geometry}>
            <pointsMaterial
                color="#ff4477"
                size={0.4}
                transparent
                opacity={0.8}
                sizeAttenuation
            />
        </points>
    );
}
