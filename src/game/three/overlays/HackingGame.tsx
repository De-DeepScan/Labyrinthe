import { useState, useEffect, useCallback, useRef } from 'react';

interface HackingGameProps {
    synapseId: string;
    difficulty: number;
    onComplete: (success: boolean) => void;
    corruptionLevel?: number; // 0-100, affects character visibility
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

// Glitch characters for corruption effect
const GLITCH_CHARS = '!@#$%^&*()[]{}|;:,.<>?/\\~`█▓▒░▀▄▌▐■□▪▫●○◊◦';

// Get a corrupted version of a character based on corruption level
function getCorruptedChar(char: string, corruptionLevel: number, index: number, time: number): { char: string; opacity: number; glitched: boolean } {
    if (corruptionLevel < 20) {
        return { char, opacity: 1, glitched: false };
    }

    // Use a pseudo-random based on position and time for flickering effect
    const seed = (index * 17 + Math.floor(time * 3)) % 100;
    const corruptionChance = (corruptionLevel - 20) / 100; // 0 at 20%, 0.8 at 100%

    if (seed < corruptionChance * 100) {
        // Character is corrupted
        const glitchType = seed % 4;

        if (glitchType === 0) {
            // Replace with glitch character
            const glitchIndex = (index + Math.floor(time * 5)) % GLITCH_CHARS.length;
            return { char: GLITCH_CHARS[glitchIndex], opacity: 0.7, glitched: true };
        } else if (glitchType === 1) {
            // Make character nearly invisible
            return { char, opacity: 0.1 + Math.random() * 0.2, glitched: true };
        } else if (glitchType === 2) {
            // Show wrong character (shifted)
            const shifted = String.fromCharCode(char.charCodeAt(0) + (seed % 5) - 2);
            return { char: shifted, opacity: 0.6, glitched: true };
        } else {
            // Flicker between visible and invisible
            return { char, opacity: Math.random() > 0.5 ? 1 : 0.1, glitched: true };
        }
    }

    // Slight opacity reduction based on corruption
    const baseOpacity = 1 - (corruptionLevel - 20) / 200;
    return { char, opacity: baseOpacity, glitched: false };
}

export function HackingGame({ synapseId, difficulty, onComplete, corruptionLevel = 0 }: HackingGameProps) {
    // Difficulty settings - no time limit
    // Level 1: 5 chars, 3 sequences
    // Level 2: 5 chars, 3 sequences
    // Level 3: 6 chars, 4 sequences
    const sequenceCount = difficulty === 3 ? 4 : 3;

    const [sequences, setSequences] = useState<HackSequence[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'success' | 'failed'>('playing');
    const [glitchEffect, setGlitchEffect] = useState(false);
    const [corruptionTime, setCorruptionTime] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update corruption time for flickering effect
    useEffect(() => {
        if (corruptionLevel < 20) return;

        const interval = setInterval(() => {
            setCorruptionTime((t) => t + 0.1);
        }, 100);

        return () => clearInterval(interval);
    }, [corruptionLevel]);

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

    // Focus input - keep focus at all times during gameplay
    useEffect(() => {
        inputRef.current?.focus();
    }, [currentIndex]);

    // Re-focus input when clicking anywhere in the game area
    const handleContainerClick = useCallback(() => {
        if (gameState === 'playing') {
            inputRef.current?.focus();
        }
    }, [gameState]);

    // Keep focus on input even when clicking outside
    useEffect(() => {
        if (gameState !== 'playing') return;

        const handleGlobalClick = () => {
            inputRef.current?.focus();
        };

        document.addEventListener('click', handleGlobalClick);
        return () => document.removeEventListener('click', handleGlobalClick);
    }, [gameState]);

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
            onClick={handleContainerClick}
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                filter: glitchEffect ? 'hue-rotate(90deg)' : 'none',
                transition: 'filter 0.1s',
                cursor: 'text',
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

                                // Apply corruption effect to untyped characters
                                const corrupted = !isTyped && seq.status === 'active'
                                    ? getCorruptedChar(char, corruptionLevel, index * 10 + charIndex, corruptionTime)
                                    : { char, opacity: 1, glitched: false };

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
                                                : corrupted.glitched
                                                ? 'rgba(255, 0, 0, 0.1)'
                                                : 'rgba(0, 0, 0, 0.3)',
                                            border: `1px solid ${
                                                isCurrent
                                                    ? '#00d4aa'
                                                    : isTyped
                                                    ? isCorrect
                                                        ? '#00ff00'
                                                        : '#ff4444'
                                                    : corrupted.glitched
                                                    ? '#ff444466'
                                                    : '#333'
                                            }`,
                                            color: isTyped
                                                ? isCorrect
                                                    ? '#00ff00'
                                                    : '#ff4444'
                                                : seq.status === 'active'
                                                ? corrupted.glitched
                                                    ? '#ff6666'
                                                    : '#00d4aa'
                                                : '#666',
                                            opacity: isTyped ? 1 : corrupted.opacity,
                                            boxShadow: isCurrent ? '0 0 10px rgba(0, 212, 170, 0.5)' : 'none',
                                            animation: isCurrent ? 'blink 1s infinite' : 'none',
                                            transition: 'opacity 0.1s',
                                            textShadow: corrupted.glitched ? '0 0 5px #ff0000' : 'none',
                                        }}
                                    >
                                        {corrupted.char}
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

            {/* Instructions - more explicit */}
            {gameState === 'playing' && (
                <div
                    style={{
                        marginTop: '20px',
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            fontSize: '16px',
                            color: '#00d4aa',
                            marginBottom: '8px',
                            fontWeight: 'bold',
                            animation: 'pulse-text 1.5s infinite',
                        }}
                    >
                        TAPEZ AU CLAVIER
                    </div>
                    <div
                        style={{
                            fontSize: '12px',
                            color: '#888',
                        }}
                    >
                        Recopiez les commandes affichées ci-dessus
                    </div>
                    <div
                        style={{
                            marginTop: '10px',
                            fontSize: '20px',
                            color: '#00d4aa',
                            animation: 'blink-cursor 0.8s infinite',
                        }}
                    >
                        _
                    </div>
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

            {/* CSS for animations */}
            <style>{`
                @keyframes blink {
                    0%, 50% { border-color: #00d4aa; }
                    51%, 100% { border-color: transparent; }
                }
                @keyframes pulse-text {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes blink-cursor {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}
