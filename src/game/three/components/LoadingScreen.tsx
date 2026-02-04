export function LoadingScreen() {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000408',
            zIndex: 1000,
        }}>
            <div style={{
                fontFamily: 'Courier New, monospace',
                fontSize: 24,
                color: '#00d4aa',
                marginBottom: 20,
                animation: 'pulse 1.5s ease-in-out infinite',
            }}>
                INITIALISATION DU RÉSEAU NEURAL
            </div>
            <div style={{
                width: 200,
                height: 4,
                background: '#1a3a4a',
                borderRadius: 2,
                overflow: 'hidden',
            }}>
                <div style={{
                    width: '30%',
                    height: '100%',
                    background: '#00d4aa',
                    borderRadius: 2,
                    animation: 'loading 1.5s ease-in-out infinite',
                }} />
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(200%); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
        </div>
    );
}
