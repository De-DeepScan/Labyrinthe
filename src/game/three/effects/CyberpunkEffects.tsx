import { EffectComposer, Bloom } from '@react-three/postprocessing';

export function CyberpunkEffects() {
    return (
        <EffectComposer multisampling={0}>
            <Bloom
                intensity={0.8}
                luminanceThreshold={0.4}
                luminanceSmoothing={0.9}
                mipmapBlur={false}
            />
        </EffectComposer>
    );
}

// Lightweight version without effects
export function NoEffects() {
    return null;
}
