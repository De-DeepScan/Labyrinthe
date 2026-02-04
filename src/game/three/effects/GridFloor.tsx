import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GridFloorProps {
    radius?: number;
    rings?: number;
    segments?: number;
    color?: string;
    centerY?: number;
}

// Simplified CRT Shader - optimized
const crtVertexShader = `
varying vec3 vPosition;

void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const crtFragmentShader = `
uniform float uTime;
uniform vec3 uColor;

varying vec3 vPosition;

void main() {
    // Simplified scanline effect
    float scanline = sin(vPosition.y * 2.0 + uTime * 3.0) * 0.5 + 0.5;
    scanline = pow(scanline, 8.0) * 0.08;

    float alpha = 0.015 + scanline;
    alpha = clamp(alpha, 0.0, 0.12);

    gl_FragColor = vec4(uColor, alpha);
}
`;

export function GridFloor({ radius = 200, rings = 16, segments = 32, color = '#00d4aa', centerY = 80 }: GridFloorProps) {
    const groupRef = useRef<THREE.Group>(null);
    const crtMaterialRef = useRef<THREE.ShaderMaterial>(null);

    // Create all grid lines as a single merged BufferGeometry
    const gridGeometry = useMemo(() => {
        const vertices: number[] = [];

        // Latitude circles (horizontal rings) - reduced count
        const latCount = Math.min(rings, 16);
        for (let i = 1; i < latCount; i++) {
            const phi = (i / latCount) * Math.PI;
            const y = Math.cos(phi) * radius;
            const ringRadius = Math.sin(phi) * radius;

            for (let j = 0; j < segments; j++) {
                const theta1 = (j / segments) * Math.PI * 2;
                const theta2 = ((j + 1) / segments) * Math.PI * 2;

                vertices.push(
                    Math.cos(theta1) * ringRadius, y, Math.sin(theta1) * ringRadius,
                    Math.cos(theta2) * ringRadius, y, Math.sin(theta2) * ringRadius
                );
            }
        }

        // Longitude lines (vertical meridians) - reduced count
        const lonCount = 12;
        for (let i = 0; i < lonCount; i++) {
            const theta = (i / lonCount) * Math.PI * 2;

            for (let j = 0; j < segments; j++) {
                const phi1 = (j / segments) * Math.PI;
                const phi2 = ((j + 1) / segments) * Math.PI;

                const y1 = Math.cos(phi1) * radius;
                const r1 = Math.sin(phi1) * radius;
                const y2 = Math.cos(phi2) * radius;
                const r2 = Math.sin(phi2) * radius;

                vertices.push(
                    Math.cos(theta) * r1, y1, Math.sin(theta) * r1,
                    Math.cos(theta) * r2, y2, Math.sin(theta) * r2
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        return geometry;
    }, [radius, rings, segments]);

    // CRT shader material - cached
    const crtMaterial = useMemo(() => {
        const colorObj = new THREE.Color(color);
        return new THREE.ShaderMaterial({
            vertexShader: crtVertexShader,
            fragmentShader: crtFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: colorObj },
            },
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
        });
    }, [color]);

    // Line material - cached
    const lineMaterial = useMemo(() => {
        return new THREE.LineBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.03,
        });
    }, [color]);

    // Animation for CRT effects - simplified
    useFrame((state) => {
        if (crtMaterialRef.current) {
            crtMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <group ref={groupRef} position={[0, centerY, 0]}>
            {/* All grid lines in a single LineSegments call */}
            <lineSegments geometry={gridGeometry} material={lineMaterial} />

            {/* CRT effect sphere with shader - reduced resolution */}
            <mesh>
                <sphereGeometry args={[radius, 32, 32]} />
                <primitive object={crtMaterial} ref={crtMaterialRef} attach="material" />
            </mesh>

            {/* Inner glow sphere - reduced resolution */}
            <mesh>
                <sphereGeometry args={[radius * 0.98, 16, 16]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.003}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}
