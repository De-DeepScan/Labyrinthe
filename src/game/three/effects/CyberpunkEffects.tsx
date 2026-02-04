import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Resolution } from 'postprocessing';

export function CyberpunkEffects() {
    return (
        <EffectComposer multisampling={0}>
            <Bloom
                intensity={0.6}
                luminanceThreshold={0.5}
                luminanceSmoothing={0.8}
                mipmapBlur={true}
                resolutionX={Resolution.AUTO_SIZE}
                resolutionY={Resolution.AUTO_SIZE}
                levels={4}
            />
        </EffectComposer>
    );
}

// Lightweight version without effects
export function NoEffects() {
    return null;
}
