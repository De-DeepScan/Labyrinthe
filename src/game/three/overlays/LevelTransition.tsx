import { useState, useEffect } from 'react';

interface LevelTransitionProps {
    level: number;
    onComplete: () => void;
}

export function LevelTransition({ level, onComplete }: LevelTransitionProps) {
    const [phase, setPhase] = useState<'fadeIn' | 'display' | 'fadeOut'>('fadeIn');
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        // Phase 1: Fade in
        const fadeInTimer = setTimeout(() => {
            setOpacity(1);
        }, 50);

        // Phase 2: Display
        const displayTimer = setTimeout(() => {
            setPhase('display');
        }, 500);

        // Phase 3: Fade out
        const fadeOutTimer = setTimeout(() => {
            setPhase('fadeOut');
            setOpacity(0);
        }, 2000);

        // Complete
        const completeTimer = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => {
            clearTimeout(fadeInTimer);
            clearTimeout(displayTimer);
            clearTimeout(fadeOutTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.95)',
                opacity,
                transition: 'opacity 0.5s ease-in-out',
                zIndex: 10000,
                pointerEvents: 'all',
            }}
        >
            {/* Glowing circle effect */}
            <div
                style={{
                    position: 'absolute',
                    width: '300px',
                    height: '300px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0, 212, 170, 0.3) 0%, transparent 70%)',
                    animation: 'pulse 2s ease-in-out infinite',
                }}
            />

            {/* Main title */}
            <div
                style={{
                    fontSize: '28px',
                    color: '#00d4aa',
                    textTransform: 'uppercase',
                    letterSpacing: '6px',
                    marginBottom: '20px',
                    opacity: phase === 'fadeIn' ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out 0.1s',
                    fontFamily: 'monospace',
                }}
            >
                Progression
            </div>

            {/* Depth indicator */}
            <div
                style={{
                    fontSize: '80px',
                    fontWeight: 'bold',
                    color: '#00d4aa',
                    textShadow: `
                        0 0 20px rgba(0, 212, 170, 0.8),
                        0 0 40px rgba(0, 212, 170, 0.6),
                        0 0 60px rgba(0, 212, 170, 0.4)
                    `,
                    fontFamily: 'monospace',
                    animation: phase === 'display' ? 'scaleUp 0.3s ease-out' : 'none',
                    transform: phase === 'fadeIn' ? 'scale(0.8)' : 'scale(1)',
                    transition: 'transform 0.5s ease-out',
                }}
            >
                {level === 2 && 'COUCHE 2'}
                {level === 3 && 'NOYAU'}
            </div>

            {/* Subtitle */}
            <div
                style={{
                    fontSize: '18px',
                    color: 'rgba(0, 212, 170, 0.7)',
                    marginTop: '30px',
                    opacity: phase === 'fadeIn' ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out 0.4s',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                    maxWidth: '400px',
                    lineHeight: '1.5',
                }}
            >
                {level === 2 && 'Vous pénétrez plus profondément dans le réseau neuronal...'}
                {level === 3 && 'Vous approchez du cœur de l\'intelligence artificielle...'}
            </div>

            {/* Animated lines */}
            <svg
                style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                }}
            >
                <line
                    x1="0"
                    y1="50%"
                    x2="30%"
                    y2="50%"
                    stroke="#00d4aa"
                    strokeWidth="1"
                    opacity="0.3"
                    style={{
                        animation: 'slideInLeft 0.5s ease-out forwards',
                    }}
                />
                <line
                    x1="70%"
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke="#00d4aa"
                    strokeWidth="1"
                    opacity="0.3"
                    style={{
                        animation: 'slideInRight 0.5s ease-out forwards',
                    }}
                />
            </svg>

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 0.8; }
                }
                @keyframes scaleUp {
                    0% { transform: scale(0.8); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                }
                @keyframes slideInLeft {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
