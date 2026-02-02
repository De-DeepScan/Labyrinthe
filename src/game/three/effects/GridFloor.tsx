import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface GridFloorProps {
    radius?: number;
    rings?: number;
    segments?: number;
    color?: string;
    centerY?: number;
}

// CRT Shader for the sphere
const crtVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const crtFragmentShader = `
uniform float uTime;
uniform vec3 uColor;
uniform float uScanlineIntensity;
uniform float uFlickerIntensity;
uniform float uNoiseIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// Random function for noise
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    // Base color
    vec3 color = uColor;

    // Scanlines based on vertical position (latitude-like)
    float scanline = sin(vPosition.y * 2.0 + uTime * 3.0) * 0.5 + 0.5;
    scanline = pow(scanline, 8.0) * uScanlineIntensity;

    // Additional horizontal scanlines for CRT effect
    float scanline2 = sin(vPosition.y * 15.0 - uTime * 1.5) * 0.5 + 0.5;
    scanline2 = step(0.5, scanline2) * 0.03;

    // Flicker effect
    float flicker = 1.0 - random(vec2(uTime * 0.1, 0.0)) * uFlickerIntensity;

    // Noise
    float noise = random(vUv + uTime * 0.01) * uNoiseIntensity;

    // Vignette based on viewing angle (edges darker)
    float vignette = dot(vNormal, vec3(0.0, 0.0, 1.0));
    vignette = smoothstep(-0.2, 0.8, vignette);

    // RGB split effect (chromatic aberration on sphere)
    float rgbSplit = sin(vPosition.y * 0.5 + uTime * 2.0) * 0.02;
    vec3 rgbColor = vec3(
        color.r + rgbSplit,
        color.g,
        color.b - rgbSplit
    );

    // Combine effects
    float alpha = 0.015 + scanline + scanline2 + noise;
    alpha *= flicker;
    alpha = clamp(alpha, 0.0, 0.15);

    gl_FragColor = vec4(rgbColor, alpha);
}
`;

export function GridFloor({ radius = 200, rings = 20, segments = 48, color = '#00d4aa', centerY = 80 }: GridFloorProps) {
    const groupRef = useRef<THREE.Group>(null);
    const crtMaterialRef = useRef<THREE.ShaderMaterial>(null);
    const scanlineMeshRef = useRef<THREE.Mesh>(null);

    // Create spherical grid lines (latitude and longitude)
    const sphereLines = useMemo(() => {
        const latitudes: [number, number, number][][] = [];
        const longitudes: [number, number, number][][] = [];

        // Latitude circles (horizontal rings)
        const latCount = rings;
        for (let i = 1; i < latCount; i++) {
            const phi = (i / latCount) * Math.PI; // 0 to PI
            const y = Math.cos(phi) * radius;
            const ringRadius = Math.sin(phi) * radius;

            const points: [number, number, number][] = [];
            for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                points.push([
                    Math.cos(theta) * ringRadius,
                    y,
                    Math.sin(theta) * ringRadius
                ]);
            }
            latitudes.push(points);
        }

        // Longitude lines (vertical meridians)
        const lonCount = 16;
        for (let i = 0; i < lonCount; i++) {
            const theta = (i / lonCount) * Math.PI * 2;
            const points: [number, number, number][] = [];

            for (let j = 0; j <= segments; j++) {
                const phi = (j / segments) * Math.PI;
                const y = Math.cos(phi) * radius;
                const r = Math.sin(phi) * radius;
                points.push([
                    Math.cos(theta) * r,
                    y,
                    Math.sin(theta) * r
                ]);
            }
            longitudes.push(points);
        }

        return { latitudes, longitudes };
    }, [radius, rings, segments]);

    // CRT shader material
    const crtMaterial = useMemo(() => {
        const colorObj = new THREE.Color(color);
        return new THREE.ShaderMaterial({
            vertexShader: crtVertexShader,
            fragmentShader: crtFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: colorObj },
                uScanlineIntensity: { value: 0.08 },
                uFlickerIntensity: { value: 0.03 },
                uNoiseIntensity: { value: 0.02 },
            },
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
        });
    }, [color]);

    // Animation for CRT effects
    useFrame((state) => {
        const time = state.clock.getElapsedTime();

        // Update CRT shader uniforms
        if (crtMaterialRef.current) {
            crtMaterialRef.current.uniforms.uTime.value = time;
        }

        // Pulse animation on scanline mesh
        if (scanlineMeshRef.current) {
            const scale = 1 + Math.sin(time * 0.5) * 0.01;
            scanlineMeshRef.current.scale.setScalar(scale);
        }
    });

    return (
        <group ref={groupRef} position={[0, centerY, 0]}>
            {/* Latitude lines (horizontal circles) */}
            {sphereLines.latitudes.map((points, i) => (
                <Line
                    key={`lat-${i}`}
                    points={points}
                    color={color}
                    lineWidth={1}
                    transparent
                    opacity={0.03}
                />
            ))}

            {/* Longitude lines (vertical meridians) */}
            {sphereLines.longitudes.map((points, i) => (
                <Line
                    key={`lon-${i}`}
                    points={points}
                    color={color}
                    lineWidth={1}
                    transparent
                    opacity={0.025}
                />
            ))}

            {/* CRT effect sphere with shader */}
            <mesh ref={scanlineMeshRef}>
                <sphereGeometry args={[radius, 64, 64]} />
                <primitive object={crtMaterial} ref={crtMaterialRef} attach="material" />
            </mesh>

            {/* Inner glow sphere for depth */}
            <mesh>
                <sphereGeometry args={[radius * 0.98, 32, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.003}
                    side={THREE.BackSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Equator highlight with CRT flicker */}
            <Line
                points={Array.from({ length: 65 }, (_, i) => {
                    const angle = (i / 64) * Math.PI * 2;
                    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number];
                })}
                color={color}
                lineWidth={1}
                transparent
                opacity={0.06}
            />

            {/* Additional scanline rings for enhanced CRT effect */}
            {Array.from({ length: 8 }, (_, i) => {
                const y = ((i + 1) / 9) * 2 * radius - radius;
                const ringRadius = Math.sqrt(radius * radius - y * y);
                if (ringRadius <= 0) return null;
                return (
                    <Line
                        key={`scanline-${i}`}
                        points={Array.from({ length: 65 }, (_, j) => {
                            const angle = (j / 64) * Math.PI * 2;
                            return [Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius] as [number, number, number];
                        })}
                        color="#00ffff"
                        lineWidth={0.5}
                        transparent
                        opacity={0.015}
                    />
                );
            })}
        </group>
    );
}
