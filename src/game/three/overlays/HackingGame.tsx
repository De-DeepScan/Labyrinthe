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

// Hacking commands by difficulty level
const HACKING_COMMANDS = {
    // Level 1: 5 characters, 3 sequences
    1: [
        'CRACK', 'BREAK', 'ENTER', 'PROBE', 'SNIFF',
        'SPAWN', 'TRACE', 'PATCH', 'CLONE', 'FLASH',
        'PARSE', 'QUERY', 'STACK', 'ROUTE', 'CHMOD',
    ],
    // Level 2: 5 characters, 3 sequences
    2: [
        'CRACK', 'BREAK', 'PROXY', 'SHELL', 'ADMIN',
        'SPOOF', 'TRACE', 'PATCH', 'GRANT', 'CHOWN',
        'FORGE', 'HIJAK', 'SNOOP', 'STEAL', 'CHMOD',
    ],
    // Level 3: 6 characters, 4 sequences
    3: [
        'BYPASS', 'TUNNEL', 'DECODE', 'CIPHER', 'BREACH',
        'SPLICE', 'HIJACK', 'KEYLOG', 'TROJAN', 'ROOTKT',
        'PHREEK', 'MALWAR', 'SPIDER', 'ZOMBIE', 'DAEMON',
    ],
};

// Get random commands for a difficulty level
function getRandomCommands(difficulty: number, count: number): string[] {
    const commands = HACKING_COMMANDS[difficulty as keyof typeof HACKING_COMMANDS] || HACKING_COMMANDS[1];
    const shuffled = [...commands].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

export function HackingGame({ synapseId, difficulty, onComplete }: HackingGameProps) {
    // Difficulty settings - no time limit
    // Level 1: 5 chars, 3 sequences
    // Level 2: 5 chars, 3 sequences
    // Level 3: 6 chars, 4 sequences
    const sequenceCount = difficulty === 3 ? 4 : 3;

    const [sequences, setSequences] = useState<HackSequence[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'success' | 'failed'>('playing');
    const [glitchEffect, setGlitchEffect] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize sequences with meaningful commands
    useEffect(() => {
        const commands = getRandomCommands(difficulty, sequenceCount);
        const newSequences: HackSequence[] = commands.map((cmd, i) => ({
            chars: cmd,
            typed: '',
            status: i === 0 ? 'active' : 'pending',
        }));
        setSequences(newSequences);
        setCurrentIndex(0);
        setGameState('playing');
    }, [difficulty, sequenceCount]);

    // Focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentIndex]);

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
                    marginBottom: '30px',
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
                    Tapez les commandes pour pirater la synapse
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
