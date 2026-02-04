import { useRef, useMemo, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const TrailParticles = forwardRef<THREE.Points>((_, ref) => {
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(60);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geo;
    }, []);

    return (
        <points ref={ref} geometry={geometry}>
            <pointsMaterial
                color="#00ffcc"
                size={0.3}
                transparent
                opacity={0.5}
                sizeAttenuation
            />
        </points>
    );
});

interface Explorer3DProps {
    position: [number, number, number];
}

export function Explorer3D({ position }: Explorer3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const trailRef = useRef<THREE.Points>(null);

    // Smooth position interpolation
    const currentPos = useRef(new THREE.Vector3(...position));
    const targetPos = useRef(new THREE.Vector3(...position));

    // Update target position when prop changes
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
        meshRef.current.rotation.x = Math.sin(time * 0.7) * 0.2;

        // Scale pulse
        const scale = 1 + Math.sin(time * 3) * 0.05;
        meshRef.current.scale.setScalar(scale);

        // Trail particles
        if (trailRef.current) {
            const positions = trailRef.current.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < 20; i++) {
                const t = i / 20;
                const offset = {
                    x: Math.sin(time * 2 + i * 0.5) * 0.5 * t,
                    y: -t * 2 + Math.cos(time * 3 + i * 0.3) * 0.3,
                    z: Math.cos(time * 2 + i * 0.5) * 0.5 * t,
                };
                positions.setXYZ(i, offset.x, offset.y, offset.z);
            }
            positions.needsUpdate = true;

            // Fade trail
            const material = trailRef.current.material as THREE.PointsMaterial;
            material.opacity = 0.5 + Math.sin(time * 2) * 0.2;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Glow sphere */}
            <mesh scale={[3, 3, 3]}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial
                    color="#00ffcc"
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Main explorer mesh - Icosahedron */}
            <mesh ref={meshRef}>
                <icosahedronGeometry args={[1.2, 0]} />
                <meshStandardMaterial
                    color="#00d4aa"
                    emissive="#00ffcc"
                    emissiveIntensity={0.6}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>

            {/* Wireframe overlay */}
            <mesh scale={[1.15, 1.15, 1.15]}>
                <icosahedronGeometry args={[1.2, 0]} />
                <meshBasicMaterial
                    color="#00ffcc"
                    wireframe
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Inner core */}
            <mesh>
                <sphereGeometry args={[0.4, 16, 16]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Trail particles */}
            <TrailParticles ref={trailRef} />

            {/* Point light */}
            <pointLight color="#00d4aa" intensity={1} distance={15} />
        </group>
    );
}
