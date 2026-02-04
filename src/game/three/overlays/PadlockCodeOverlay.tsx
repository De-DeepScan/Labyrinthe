import { useGameStore } from '../../stores/gameStore';

export function PadlockCodeOverlay() {
    const showPadlockCode = useGameStore((state) => state.showPadlockCode);
    const setShowPadlockCode = useGameStore((state) => state.setShowPadlockCode);

    if (!showPadlockCode) return null;

    const handleClose = () => {
        setShowPadlockCode(false);
        // Trigger victory after closing
        useGameStore.getState().setGameOver(true);
    };

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
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3000,
                fontFamily: 'Courier New, monospace',
            }}
        >
            <div
                style={{
                    background: 'linear-gradient(135deg, #0a1628 0%, #1a2a18 100%)',
                    border: '3px solid #00d4aa',
                    borderRadius: 16,
                    padding: '48px 64px',
                    textAlign: 'center',
                    boxShadow: '0 0 60px rgba(0, 212, 170, 0.4), inset 0 0 30px rgba(0, 212, 170, 0.1)',
                    animation: 'fadeInScale 0.5s ease-out',
                }}
            >
                {/* Success icon */}
                <div
                    style={{
                        fontSize: 64,
                        marginBottom: 24,
                        animation: 'pulse 2s infinite',
                    }}
                >
                    🔓
                </div>

                {/* Title */}
                <div
                    style={{
                        color: '#00d4aa',
                        fontSize: 28,
                        fontWeight: 'bold',
                        marginBottom: 16,
                        textTransform: 'uppercase',
                        letterSpacing: 4,
                        textShadow: '0 0 20px rgba(0, 212, 170, 0.8)',
                    }}
                >
                    Mission accomplie !
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        color: '#888',
                        fontSize: 16,
                        marginBottom: 32,
                    }}
                >
                    Le code du cadenas est :
                </div>

                {/* Code display */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 16,
                        marginBottom: 40,
                    }}
                >
                    {['2', '0', '1'].map((digit, index) => (
                        <div
                            key={index}
                            style={{
                                width: 80,
                                height: 100,
                                background: 'rgba(0, 212, 170, 0.1)',
                                border: '3px solid #00d4aa',
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 56,
                                fontWeight: 'bold',
                                color: '#00ff88',
                                textShadow: '0 0 30px rgba(0, 255, 136, 0.8)',
                                animation: `digitReveal 0.5s ease-out ${index * 0.2}s both`,
                            }}
                        >
                            {digit}
                        </div>
                    ))}
                </div>

                {/* Close button */}
                <button
                    onClick={handleClose}
                    style={{
                        padding: '16px 48px',
                        fontSize: 18,
                        fontWeight: 'bold',
                        background: 'linear-gradient(135deg, #00d4aa 0%, #00a080 100%)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#000',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: 2,
                        transition: 'all 0.3s',
                        boxShadow: '0 4px 20px rgba(0, 212, 170, 0.4)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 212, 170, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.4)';
                    }}
                >
                    Continuer
                </button>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fadeInScale {
                    0% {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
                @keyframes digitReveal {
                    0% {
                        opacity: 0;
                        transform: translateY(20px) scale(0.5);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
}
