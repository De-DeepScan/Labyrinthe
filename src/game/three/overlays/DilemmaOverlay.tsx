import { useCallback } from 'react';
import { useGameStore } from '../../stores/gameStore';

interface DilemmaChoice {
    id: string;
    label: string;
    description: string;
}

interface DilemmaData {
    title: string;
    description: string;
    choices: DilemmaChoice[];
}

export function DilemmaOverlay() {
    const dilemmaData = useGameStore((state) => state.dilemmaData) as DilemmaData | null;
    const setShowDilemma = useGameStore((state) => state.setShowDilemma);

    const handleChoice = useCallback((choiceId: string) => {
        // Ethical dilemma - choice has been made, AI already reset to start
        useGameStore.getState().addMessage('Choix effectué. L\'IA retourne à son point de départ.', 'info');

        // Close dilemma
        setShowDilemma(false);
    }, [setShowDilemma]);

    if (!dilemmaData) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0a1628 0%, #1a0a28 100%)',
                border: '2px solid #ff3366',
                borderRadius: 12,
                padding: 32,
                maxWidth: 500,
                width: '90%',
                boxShadow: '0 0 40px rgba(255, 51, 102, 0.3)',
            }}>
                {/* Title */}
                <div style={{
                    color: '#ff3366',
                    fontFamily: 'Arial Black, sans-serif',
                    fontSize: 24,
                    marginBottom: 16,
                    textAlign: 'center',
                    textShadow: '0 0 10px rgba(255, 51, 102, 0.5)',
                }}>
                    {dilemmaData.title}
                </div>

                {/* Description */}
                <div style={{
                    color: '#888',
                    fontFamily: 'Courier New, monospace',
                    fontSize: 14,
                    marginBottom: 24,
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}>
                    {dilemmaData.description}
                </div>

                {/* Choices */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }}>
                    {dilemmaData.choices.map((choice, index) => (
                        <button
                            key={choice.id}
                            onClick={() => handleChoice(choice.id)}
                            style={{
                                padding: '16px 20px',
                                background: 'rgba(255, 51, 102, 0.1)',
                                border: '1px solid #ff3366',
                                borderRadius: 8,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 51, 102, 0.3)';
                                e.currentTarget.style.transform = 'translateX(5px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 51, 102, 0.1)';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }}
                        >
                            <div style={{
                                color: '#ccc',
                                fontFamily: 'Courier New, monospace',
                                fontSize: 14,
                                lineHeight: 1.4,
                            }}>
                                <span style={{ color: '#ff3366', fontWeight: 'bold' }}>{index + 1}.</span> {choice.description}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
