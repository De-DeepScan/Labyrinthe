import { useState, useEffect, useMemo } from 'react';

// Glitch characters for corruption effect
const GLITCH_CHARS = '█▓░■□●◆◇▪▫?#@$%&*';

// Lists of names that rotate randomly
const FIRST_NAMES = [
    'Anas', 'Bilal', 'Cassandra', 'François', 'Noa', 'Samuel', 'Lucas',
    'Jules-Antoine', 'Ethan', 'Daria', 'Elliot', 'Léo', 'Guillaume'
];

const LAST_NAMES = [
    'El Ahouje', 'El Makaoui', 'Delmas-Marchiset', 'Blavoët', 'Brault',
    'Borras', 'Lévêque', 'Bouault', 'Frot', 'Karpenko', 'Allen', 'Brieau', 'Renoult'
];

// Generate a corrupted/glitched string
function corruptText(text: string, corruptionLevel: number = 0.7): string {
    return text
        .split('')
        .map((char) => {
            if (char === ' ') return ' ';
            if (Math.random() < corruptionLevel) {
                return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
            }
            return char;
        })
        .join('');
}

// Generate corrupted text that changes over time
function useGlitchingText(originalText: string, corruptionLevel: number = 0.7, interval: number = 150): string {
    const [text, setText] = useState(() => corruptText(originalText, corruptionLevel));

    useEffect(() => {
        const timer = setInterval(() => {
            setText(corruptText(originalText, corruptionLevel));
        }, interval);
        return () => clearInterval(timer);
    }, [originalText, corruptionLevel, interval]);

    return text;
}

// Generate text that randomly cycles through a list of options with corruption
function useRotatingGlitchText(
    options: string[],
    corruptionLevel: number = 0.7,
    rotateInterval: number = 300,
    glitchInterval: number = 150
): string {
    const [currentOption, setCurrentOption] = useState(() =>
        options[Math.floor(Math.random() * options.length)]
    );
    const [text, setText] = useState(() => corruptText(currentOption, corruptionLevel));

    // Rotate between options
    useEffect(() => {
        const timer = setInterval(() => {
            const newOption = options[Math.floor(Math.random() * options.length)];
            setCurrentOption(newOption);
        }, rotateInterval);
        return () => clearInterval(timer);
    }, [options, rotateInterval]);

    // Apply glitch effect
    useEffect(() => {
        const timer = setInterval(() => {
            setText(corruptText(currentOption, corruptionLevel));
        }, glitchInterval);
        return () => clearInterval(timer);
    }, [currentOption, corruptionLevel, glitchInterval]);

    return text;
}

export function DeepScanIdentityCard() {
    // Lists in uppercase for display
    const lastNamesUpper = useMemo(() => LAST_NAMES.map(n => n.toUpperCase()), []);

    // Fixed data - only birth date is clearly visible
    const birthDate = '21/07/2005';
    const age = '20 ans';

    // Corrupted data - names rotate randomly through the lists (lower corruption to be more readable)
    // Rotation every 2-2.5 seconds, glitch effect every 300ms
    const corruptedName = useRotatingGlitchText(lastNamesUpper, 0.35, 2500, 300);
    const corruptedFirstName = useRotatingGlitchText(FIRST_NAMES, 0.3, 2000, 300);
    const corruptedAge = useGlitchingText(age, 0.75, 220);
    const corruptedDescription = useGlitchingText(
        'Sujet identifié comme ancien ingénieur en intelligence artificielle chez NeuroTech Industries. ' +
        'Impliqué dans le projet ARIA avant sa défection en 2024. Dernière localisation connue: secteur 7-Delta. ' +
        'Classification: PRIORITÉ ALPHA. Accès aux protocoles de sécurité niveau 5. ' +
        'Compétences confirmées: architecture neuronale, cryptographie quantique, infiltration système. ' +
        'ATTENTION: Sujet considéré comme hautement dangereux. Approche non autorisée sans équipe tactique complète. ' +
        'Notes additionnelles: connexion suspectée avec le réseau clandestin "Les Éveillés". ' +
        'Surveillance continue recommandée. Statut actuel: EN FUITE.',
        0.6,
        100
    );

    // Glitching photo effect
    const [photoGlitch, setPhotoGlitch] = useState(false);
    useEffect(() => {
        const timer = setInterval(() => {
            if (Math.random() < 0.3) {
                setPhotoGlitch(true);
                setTimeout(() => setPhotoGlitch(false), 50 + Math.random() * 100);
            }
        }, 500);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                fontFamily: 'Courier New, monospace',
            }}
        >
            {/* Card container */}
            <div
                style={{
                    width: '700px',
                    background: 'linear-gradient(135deg, #0a0a12 0%, #1a1a2e 100%)',
                    border: '2px solid #00d4aa',
                    boxShadow: '0 0 30px rgba(0, 212, 170, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)',
                    padding: '0',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Scan lines overlay */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                />

                {/* Header */}
                <div
                    style={{
                        background: 'linear-gradient(90deg, #00d4aa 0%, #00a080 100%)',
                        padding: '15px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <div
                        style={{
                            color: '#000',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            letterSpacing: '2px',
                        }}
                    >
                        FICHE DE DONNÉES GROUPE DEEPSCAN
                    </div>
                    <div
                        style={{
                            color: '#000',
                            fontSize: '12px',
                            opacity: 0.7,
                        }}
                    >
                        [CLASSIFIÉ - NIVEAU 5]
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
                    {/* Photo section */}
                    <div
                        style={{
                            width: '150px',
                            flexShrink: 0,
                        }}
                    >
                        {/* Photo placeholder with glitch effect */}
                        <div
                            style={{
                                width: '150px',
                                height: '180px',
                                background: photoGlitch
                                    ? `linear-gradient(${Math.random() * 360}deg, #ff0000, #00ff00, #0000ff)`
                                    : 'linear-gradient(180deg, #2a2a3e 0%, #1a1a2e 100%)',
                                border: '2px solid #00d4aa',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                filter: photoGlitch ? 'brightness(1.5) contrast(1.5)' : 'none',
                            }}
                        >
                            {/* Silhouette */}
                            <svg
                                width="100"
                                height="120"
                                viewBox="0 0 100 120"
                                style={{
                                    opacity: photoGlitch ? 0.3 : 0.5,
                                    filter: photoGlitch ? `hue-rotate(${Math.random() * 360}deg)` : 'none',
                                }}
                            >
                                {/* Head */}
                                <circle cx="50" cy="35" r="25" fill="#00d4aa" opacity="0.3" />
                                {/* Body */}
                                <ellipse cx="50" cy="95" rx="35" ry="30" fill="#00d4aa" opacity="0.3" />
                            </svg>

                            {/* Corruption overlay on photo */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignContent: 'center',
                                    justifyContent: 'center',
                                    fontSize: '10px',
                                    color: '#ff0000',
                                    opacity: 0.6,
                                    overflow: 'hidden',
                                }}
                            >
                                {Array.from({ length: 80 }).map((_, i) => (
                                    <span key={i} style={{ opacity: Math.random() }}>
                                        {GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]}
                                    </span>
                                ))}
                            </div>

                            {/* "DONNÉES CORROMPUES" label */}
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    left: '0',
                                    right: '0',
                                    textAlign: 'center',
                                    fontSize: '8px',
                                    color: '#ff4444',
                                    letterSpacing: '1px',
                                }}
                            >
                                [DONNÉES CORROMPUES]
                            </div>
                        </div>

                        {/* ID Number */}
                        <div
                            style={{
                                marginTop: '10px',
                                fontSize: '10px',
                                color: '#666',
                                textAlign: 'center',
                            }}
                        >
                            ID: {useGlitchingText('DSC-2024-0847', 0.5, 300)}
                        </div>
                    </div>

                    {/* Data section */}
                    <div style={{ flex: 1 }}>
                        {/* Data table */}
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                marginBottom: '15px',
                            }}
                        >
                            <tbody>
                                {/* Row 1: Name / First Name */}
                                <tr>
                                    <td
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #333',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            width: '50%',
                                        }}
                                    >
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                                            NOM
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '16px',
                                                color: '#ff6666',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 5px rgba(255, 0, 0, 0.5)',
                                            }}
                                        >
                                            {corruptedName}
                                        </div>
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #333',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            width: '50%',
                                        }}
                                    >
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                                            PRÉNOM
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '16px',
                                                color: '#ff6666',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 5px rgba(255, 0, 0, 0.5)',
                                            }}
                                        >
                                            {corruptedFirstName}
                                        </div>
                                    </td>
                                </tr>

                                {/* Row 2: Birth Date / Age */}
                                <tr>
                                    <td
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #333',
                                            background: 'rgba(0, 50, 40, 0.3)',
                                            width: '50%',
                                        }}
                                    >
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                                            DATE DE NAISSANCE
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '18px',
                                                color: '#00ff88',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 10px rgba(0, 255, 136, 0.8)',
                                                letterSpacing: '2px',
                                            }}
                                        >
                                            {birthDate}
                                        </div>
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px',
                                            border: '1px solid #333',
                                            background: 'rgba(0, 0, 0, 0.3)',
                                            width: '50%',
                                        }}
                                    >
                                        <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                                            ÂGE
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '16px',
                                                color: '#ff6666',
                                                fontWeight: 'bold',
                                                textShadow: '0 0 5px rgba(255, 0, 0, 0.5)',
                                            }}
                                        >
                                            {corruptedAge}
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Description section */}
                        <div
                            style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid #333',
                                padding: '12px',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '10px',
                                    color: '#666',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <span>PROFIL / DESCRIPTION</span>
                                <span style={{ color: '#ff4444' }}>[PARTIELLEMENT RÉCUPÉRÉ]</span>
                            </div>
                            <div
                                style={{
                                    fontSize: '11px',
                                    color: '#aa6666',
                                    lineHeight: '1.6',
                                    maxHeight: '120px',
                                    overflow: 'hidden',
                                    textShadow: '0 0 3px rgba(255, 0, 0, 0.3)',
                                }}
                            >
                                {corruptedDescription}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        borderTop: '1px solid #333',
                        padding: '10px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                    }}
                >
                    <div style={{ fontSize: '10px', color: '#ff4444' }}>
                        ⚠ INTÉGRITÉ DES DONNÉES: 12% - RÉCUPÉRATION EN COURS...
                    </div>
                    <div style={{ fontSize: '10px', color: '#666' }}>
                        DeepScan Systems v4.7.2
                    </div>
                </div>
            </div>

            {/* Mission success message */}
            <div
                style={{
                    marginTop: '30px',
                    textAlign: 'center',
                }}
            >
                <div
                    style={{
                        color: '#00ff88',
                        fontSize: '24px',
                        marginBottom: '10px',
                        textShadow: '0 0 20px #00ff88',
                        letterSpacing: '4px',
                    }}
                >
                    EXTRACTION RÉUSSIE
                </div>
                <div
                    style={{
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '20px',
                    }}
                >
                    Données partielles récupérées du noyau neural
                </div>
            </div>

            {/* Ambient glitch effects */}
            <style>{`
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}</style>
        </div>
    );
}
