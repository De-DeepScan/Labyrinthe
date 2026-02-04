import { useState, useEffect } from 'react';

export function DilemmaWaitOverlay() {
    const [dots, setDots] = useState('');

    // Animate dots
    useEffect(() => {
        const timer = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
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
                zIndex: 9999,
                fontFamily: 'Courier New, monospace',
            }}
        >
            {/* Glowing border effect */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '500px',
                    height: '200px',
                    border: '2px solid #00d4aa',
                    boxShadow: '0 0 30px rgba(0, 212, 170, 0.3), inset 0 0 30px rgba(0, 212, 170, 0.1)',
                    background: 'rgba(0, 20, 15, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {/* Main text */}
                <div
                    style={{
                        color: '#00d4aa',
                        fontSize: '36px',
                        fontWeight: 'bold',
                        letterSpacing: '4px',
                        textTransform: 'uppercase',
                        textShadow: '0 0 20px rgba(0, 212, 170, 0.8)',
                        marginBottom: '20px',
                    }}
                >
                    Faites votre choix
                </div>

                {/* Waiting indicator */}
                <div
                    style={{
                        color: '#888',
                        fontSize: '16px',
                        letterSpacing: '2px',
                    }}
                >
                    En attente de décision{dots}
                </div>
            </div>

            {/* Scan lines effect */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
                    pointerEvents: 'none',
                }}
            />

            {/* CSS for animations */}
            <style>{`
                @keyframes pulse-border {
                    0%, 100% { box-shadow: 0 0 30px rgba(0, 212, 170, 0.3), inset 0 0 30px rgba(0, 212, 170, 0.1); }
                    50% { box-shadow: 0 0 50px rgba(0, 212, 170, 0.5), inset 0 0 40px rgba(0, 212, 170, 0.2); }
                }
            `}</style>
        </div>
    );
}
