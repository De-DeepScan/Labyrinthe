import { useState, useEffect, useCallback, useRef } from 'react';

interface HackingGameProps {
    synapseId: string;
    difficulty: number;
    onComplete: (success: boolean) => void;
}

interface HackSequence {
    chars: string;
    typed: string;
    status: 'pending' | 'active' | 'success' | 'failed';
}

// Generate random hex-like character sequences
function generateSequence(length: number): string {
    const chars = 'ABCDEF0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function HackingGame({ synapseId, difficulty, onComplete }: HackingGameProps) {
    // Difficulty settings
    const sequenceLength = 4 + difficulty; // 5, 6, 7 chars per sequence
    const sequenceCount = 2 + difficulty; // 3, 4, 5 sequences
    const timeLimit = (15 - difficulty * 2) * 1000; // 13s, 11s, 9s

    const [sequences, setSequences] = useState<HackSequence[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(timeLimit);
    const [gameState, setGameState] = useState<'playing' | 'success' | 'failed'>('playing');
    const [glitchEffect, setGlitchEffect] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize sequences
    useEffect(() => {
        const newSequences: HackSequence[] = [];
        for (let i = 0; i < sequenceCount; i++) {
            newSequences.push({
                chars: generateSequence(sequenceLength),
                typed: '',
                status: i === 0 ? 'active' : 'pending',
            });
        }
        setSequences(newSequences);
        setCurrentIndex(0);
        setTimeRemaining(timeLimit);
        setGameState('playing');
    }, [sequenceLength, sequenceCount, timeLimit]);

    // Focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentIndex]);

    // Timer
    useEffect(() => {
        if (gameState !== 'playing') return;

        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 100) {
                    setGameState('failed');
                    setTimeout(() => onComplete(false), 1000);
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [gameState, onComplete]);

    // Handle input
    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (gameState !== 'playing') return;

            const value = e.target.value.toUpperCase();
            const currentSequence = sequences[currentIndex];

            if (!currentSequence) return;

            // Update typed value
            const newSequences = [...sequences];
            newSequences[currentIndex] = { ...currentSequence, typed: value };

            // Check if sequence matches
            if (value === currentSequence.chars) {
                // Success on this sequence
                newSequences[currentIndex].status = 'success';

                // Trigger glitch effect
                setGlitchEffect(true);
                setTimeout(() => setGlitchEffect(false), 200);

                if (currentIndex === sequences.length - 1) {
                    // All sequences complete!
                    setGameState('success');
                    setSequences(newSequences);
                    setTimeout(() => onComplete(true), 800);
                } else {
                    // Move to next sequence
                    newSequences[currentIndex + 1].status = 'active';
                    setCurrentIndex(currentIndex + 1);
                    setSequences(newSequences);
                    e.target.value = '';
                }
            } else if (value.length === currentSequence.chars.length) {
                // Wrong sequence
                newSequences[currentIndex].status = 'failed';
                newSequences[currentIndex].typed = '';
                setSequences(newSequences);
                e.target.value = '';

                // Quick reset to active
                setTimeout(() => {
                    setSequences((prev) => {
                        const updated = [...prev];
                        updated[currentIndex] = {
                            ...updated[currentIndex],
                            status: 'active',
                            typed: '',
                        };
                        return updated;
                    });
                }, 300);
            } else {
                setSequences(newSequences);
            }
        },
        [gameState, sequences, currentIndex, onComplete]
    );

    // Progress percentage
    const progress = (currentIndex / sequences.length) * 100;
    const timeProgress = (timeRemaining / timeLimit) * 100;

    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                filter: glitchEffect ? 'hue-rotate(90deg)' : 'none',
                transition: 'filter 0.1s',
            }}
        >
            {/* Header */}
            <div
                style={{
                    fontSize: '18px',
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '4px',
                    color: gameState === 'failed' ? '#ff4444' : gameState === 'success' ? '#00ff00' : '#00d4aa',
                }}
            >
                {gameState === 'failed'
                    ? 'HACK ÉCHOUÉ'
                    : gameState === 'success'
                    ? 'HACK RÉUSSI'
                    : `HACKING ${synapseId.toUpperCase()}`}
            </div>

            {/* Time bar */}
            <div
                style={{
                    width: '400px',
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    marginBottom: '30px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        width: `${timeProgress}%`,
                        height: '100%',
                        backgroundColor: timeProgress < 30 ? '#ff4444' : timeProgress < 60 ? '#ffaa00' : '#00d4aa',
                        transition: 'width 0.1s linear, background-color 0.3s',
                    }}
                />
            </div>

            {/* Sequences display */}
            <div style={{ marginBottom: '30px' }}>
                {sequences.map((seq, index) => (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '10px',
                            opacity: seq.status === 'pending' ? 0.3 : 1,
                            transition: 'opacity 0.3s',
                        }}
                    >
                        {/* Status indicator */}
                        <div
                            style={{
                                width: '20px',
                                height: '20px',
                                marginRight: '15px',
                                border: '2px solid',
                                borderColor:
                                    seq.status === 'success'
                                        ? '#00ff00'
                                        : seq.status === 'failed'
                                        ? '#ff4444'
                                        : seq.status === 'active'
                                        ? '#00d4aa'
                                        : '#444',
                                backgroundColor:
                                    seq.status === 'success' ? 'rgba(0, 255, 0, 0.2)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                            }}
                        >
                            {seq.status === 'success' && '✓'}
                        </div>

                        {/* Characters */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {seq.chars.split('').map((char, charIndex) => {
                                const typedChar = seq.typed[charIndex] || '';
                                const isCorrect = typedChar === char;
                                const isTyped = typedChar !== '';
                                const isCurrent = seq.status === 'active' && charIndex === seq.typed.length;

                                return (
                                    <div
                                        key={charIndex}
                                        style={{
                                            width: '32px',
                                            height: '40px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '20px',
                                            fontWeight: 'bold',
                                            backgroundColor: isTyped
                                                ? isCorrect
                                                    ? 'rgba(0, 255, 0, 0.2)'
                                                    : 'rgba(255, 0, 0, 0.2)'
                                                : 'rgba(0, 0, 0, 0.3)',
                                            border: `1px solid ${
                                                isCurrent
                                                    ? '#00d4aa'
                                                    : isTyped
                                                    ? isCorrect
                                                        ? '#00ff00'
                                                        : '#ff4444'
                                                    : '#333'
                                            }`,
                                            color: isTyped
                                                ? isCorrect
                                                    ? '#00ff00'
                                                    : '#ff4444'
                                                : seq.status === 'active'
                                                ? '#00d4aa'
                                                : '#666',
                                            boxShadow: isCurrent ? '0 0 10px rgba(0, 212, 170, 0.5)' : 'none',
                                            animation: isCurrent ? 'blink 1s infinite' : 'none',
                                        }}
                                    >
                                        {char}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Hidden input for keyboard capture */}
            <input
                ref={inputRef}
                type="text"
                onChange={handleInput}
                disabled={gameState !== 'playing'}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    pointerEvents: gameState === 'playing' ? 'auto' : 'none',
                }}
                autoFocus
            />

            {/* Instructions */}
            {gameState === 'playing' && (
                <div
                    style={{
                        fontSize: '12px',
                        color: '#666',
                        textAlign: 'center',
                    }}
                >
                    Tapez les séquences affichées pour déverrouiller la synapse
                </div>
            )}

            {/* Progress bar */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '200px',
                }}
            >
                <div
                    style={{
                        fontSize: '10px',
                        color: '#666',
                        marginBottom: '5px',
                        textAlign: 'center',
                    }}
                >
                    Progression: {Math.round(progress)}%
                </div>
                <div
                    style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: '#00d4aa',
                            transition: 'width 0.3s',
                        }}
                    />
                </div>
            </div>

            {/* CSS for blink animation */}
            <style>{`
                @keyframes blink {
                    0%, 50% { border-color: #00d4aa; }
                    51%, 100% { border-color: transparent; }
                }
            `}</style>
        </div>
    );
}
