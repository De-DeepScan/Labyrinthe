import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { SynapseState } from '../../types/interfaces';
import { NetworkManager } from '../../services/NetworkManager';
import { HackingGame } from './HackingGame';
import { EventBus } from '../../EventBus';

// Corruption settings
const CORRUPTION_INTERVAL = 2000; // Add corruption every 2 seconds
const CORRUPTION_AMOUNT = 3; // Amount of corruption to add each interval

interface TerminalLine {
    id: string;
    text: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'system';
}

export function ProtectorTerminal() {
    const networkData = useGameStore((s) => s.networkData);
    const explorerPosition = useGameStore((s) => s.explorerPosition);
    const selectedSynapseId = useGameStore((s) => s.selectedSynapseId);
    const isHacking = useGameStore((s) => s.isHacking);
    const setSelectedSynapse = useGameStore((s) => s.setSelectedSynapse);
    const setIsHacking = useGameStore((s) => s.setIsHacking);
    const unlockSynapse = useGameStore((s) => s.unlockSynapse);
    const currentLevel = useGameStore((s) => s.currentLevel);
    const corruptionLevel = useGameStore((s) => s.corruptionLevel);
    const addCorruption = useGameStore((s) => s.addCorruption);
    const aiEnabled = useGameStore((s) => s.aiEnabled);

    const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
    const [glitchActive, setGlitchActive] = useState(false);
    const [showCorruptionWarning, setShowCorruptionWarning] = useState(false);
    const [corruptionStarted, setCorruptionStarted] = useState(false);
    const lastCorruptionWarning = useRef(0);

    // Add terminal log
    const addLog = useCallback((text: string, type: TerminalLine['type'] = 'info') => {
        const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setTerminalLines((prev) => [...prev.slice(-50), { id, text, type }]);
    }, []);

    // Initial terminal boot sequence
    useEffect(() => {
        const bootSequence = [
            { text: '> NEURAL_HACK v2.4.1 - Interface de piratage', type: 'system' as const, delay: 0 },
            { text: '> Connexion au réseau neuronal...', type: 'system' as const, delay: 300 },
            { text: '> Authentification bypass: OK', type: 'success' as const, delay: 600 },
            { text: '> Scan des synapses en cours...', type: 'info' as const, delay: 900 },
            { text: '> Synapses détectées. Prêt pour infiltration.', type: 'success' as const, delay: 1200 },
            { text: '----------------------------------------', type: 'system' as const, delay: 1500 },
        ];

        bootSequence.forEach(({ text, type, delay }) => {
            setTimeout(() => addLog(text, type), delay);
        });
    }, [addLog]);

    // Corruption start sequence: 6s delay -> 3s warning popup -> start corruption
    useEffect(() => {
        if (!aiEnabled || corruptionStarted) return;

        // Wait 6 seconds before showing warning
        const delayTimer = setTimeout(() => {
            setShowCorruptionWarning(true);

            // After 3 seconds, hide warning and start corruption
            setTimeout(() => {
                setShowCorruptionWarning(false);
                setCorruptionStarted(true);
                addLog('> ALERTE: ARIA tente de corrompre le système!', 'error');
            }, 3000);
        }, 6000);

        return () => clearTimeout(delayTimer);
    }, [aiEnabled, corruptionStarted, addLog]);

    // Automatic corruption timer (only after corruption has started)
    useEffect(() => {
        if (!aiEnabled || !corruptionStarted) return;

        const interval = setInterval(() => {
            addCorruption(CORRUPTION_AMOUNT);
        }, CORRUPTION_INTERVAL);

        return () => clearInterval(interval);
    }, [aiEnabled, corruptionStarted, addCorruption]);

    // Corruption warning messages
    useEffect(() => {
        const thresholds = [25, 50, 75, 90];
        const currentThreshold = thresholds.find(
            (t) => corruptionLevel >= t && lastCorruptionWarning.current < t
        );

        if (currentThreshold) {
            lastCorruptionWarning.current = currentThreshold;
            const messages: Record<number, string> = {
                25: '> ALERTE: Corruption détectée (25%)',
                50: '> DANGER: Corruption critique (50%)',
                75: '> URGENCE: Système instable (75%)',
                90: '> CRITIQUE: Défaillance imminente (90%)',
            };
            addLog(messages[currentThreshold], 'error');
        }
    }, [corruptionLevel, addLog]);

    // Random glitch effects based on corruption level
    useEffect(() => {
        if (corruptionLevel < 20) return;

        const glitchInterval = setInterval(() => {
            // Higher corruption = more frequent glitches
            const glitchChance = corruptionLevel / 200;
            if (Math.random() < glitchChance) {
                setGlitchActive(true);
                setTimeout(() => setGlitchActive(false), 100 + Math.random() * 200);
            }
        }, 500);

        return () => clearInterval(glitchInterval);
    }, [corruptionLevel]);

    // Track explorer position changes (from local state) - no log message

    // Listen for explorer position updates from network
    useEffect(() => {
        const handleExplorerPositionUpdate = (data: { neuronId: string }) => {
            useGameStore.getState().setExplorerPosition(data.neuronId);
        };

        const handleExplorerMoved = (data: { neuronId: string; activatedPath: string[] }) => {
            const store = useGameStore.getState();
            store.setExplorerPosition(data.neuronId);
            // Update synapse states based on path
            if (data.activatedPath.length > 1) {
                const lastNeuronId = data.activatedPath[data.activatedPath.length - 2];
                const networkData = store.networkData;
                if (networkData) {
                    const synapseId = Object.keys(networkData.synapses).find((id) => {
                        const s = networkData.synapses[id];
                        return (
                            (s.fromNeuronId === lastNeuronId && s.toNeuronId === data.neuronId) ||
                            (s.fromNeuronId === data.neuronId && s.toNeuronId === lastNeuronId)
                        );
                    });
                    if (synapseId) {
                        store.updateSynapseState(synapseId, SynapseState.ACTIVE);
                    }
                }
            }
            // No log message for explorer movement
        };

        EventBus.on('network-explorer-position-update', handleExplorerPositionUpdate);
        EventBus.on('network-explorer-moved', handleExplorerMoved);

        return () => {
            EventBus.off('network-explorer-position-update', handleExplorerPositionUpdate);
            EventBus.off('network-explorer-moved', handleExplorerMoved);
        };
    }, [addLog]);

    // Get main path synapses (not decorative)
    const mainSynapses = networkData
        ? Object.values(networkData.synapses).filter((s) => !s.id.startsWith('s_deco_'))
        : [];

    // Handle synapse selection
    const handleSelectSynapse = (synapseId: string) => {
        if (isHacking) return; // Can't change selection while hacking
        setSelectedSynapse(synapseId);
        addLog(`> Synapse sélectionnée: ${synapseId}`, 'info');
    };

    // Start hacking
    const handleStartHack = () => {
        if (!selectedSynapseId || !networkData) return;
        const synapse = networkData.synapses[selectedSynapseId];
        if (!synapse || synapse.isUnlocked) {
            addLog('> ERREUR: Synapse déjà déverrouillée', 'error');
            return;
        }
        setIsHacking(true);
        addLog(`> Démarrage du hack sur ${selectedSynapseId}...`, 'warning');
    };

    // Handle hack completion
    const handleHackComplete = (success: boolean) => {
        setIsHacking(false);
        if (success && selectedSynapseId) {
            unlockSynapse(selectedSynapseId);
            addLog(`> SUCCÈS: Synapse ${selectedSynapseId} déverrouillée!`, 'success');

            // Notify network
            NetworkManager.getInstance().send('synapse-unlocked', { synapseId: selectedSynapseId });

            // Auto-select next locked synapse
            const nextLocked = mainSynapses.find(
                (s) => !s.isUnlocked && s.id !== selectedSynapseId
            );
            if (nextLocked) {
                setSelectedSynapse(nextLocked.id);
            } else {
                setSelectedSynapse(null);
            }
        } else {
            addLog(`> ÉCHEC: Hack interrompu. Réessayez.`, 'error');

            NetworkManager.getInstance().send('synapse-unlock-failed', { synapseId: selectedSynapseId });
        }
    };

    // Get synapse status display
    const getSynapseStatus = (synapse: typeof mainSynapses[0]) => {
        if (synapse.isUnlocked) {
            if (synapse.state === SynapseState.ACTIVE) {
                return { text: 'TRAVERSÉE', color: '#00ff00' };
            }
            return { text: 'DÉVERROUILLÉE', color: '#00d4aa' };
        }
        return { text: 'VERROUILLÉE', color: '#ff4444' };
    };

    const selectedSynapse = selectedSynapseId && networkData
        ? networkData.synapses[selectedSynapseId]
        : null;

    // Calculate corruption visual effects
    const corruptionColor = corruptionLevel > 50
        ? `rgba(${Math.min(255, 50 + corruptionLevel * 2)}, ${Math.max(0, 20 - corruptionLevel / 5)}, ${Math.max(0, 30 - corruptionLevel / 3)}, 0.98)`
        : 'rgba(0, 10, 20, 0.98)';

    const textCorruptionColor = corruptionLevel > 30
        ? `hsl(${Math.max(0, 170 - corruptionLevel * 1.5)}, 100%, ${Math.min(70, 50 + corruptionLevel / 4)}%)`
        : '#00d4aa';

    // Difficulty modifier based on corruption (used in hacking game)
    const corruptionDifficultyBonus = Math.floor(corruptionLevel / 30);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: corruptionColor,
                fontFamily: '"Courier New", monospace',
                color: textCorruptionColor,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px',
                overflow: 'hidden',
                filter: glitchActive
                    ? `hue-rotate(${Math.random() * 360}deg) brightness(${1.5 + Math.random()})`
                    : corruptionLevel > 60
                    ? `brightness(${1 + (corruptionLevel - 60) / 100}) contrast(${1 + (corruptionLevel - 60) / 200})`
                    : 'none',
                transition: glitchActive ? 'none' : 'filter 0.5s, background-color 1s',
            }}
        >
            {/* Corruption indicator bar */}
            {corruptionLevel > 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    }}
                >
                    <div
                        style={{
                            width: `${corruptionLevel}%`,
                            height: '100%',
                            backgroundColor: corruptionLevel > 75 ? '#ff0000' : corruptionLevel > 50 ? '#ff6600' : corruptionLevel > 25 ? '#ffaa00' : '#ff4444',
                            transition: 'width 0.5s, background-color 0.5s',
                            boxShadow: corruptionLevel > 50 ? `0 0 10px ${corruptionLevel > 75 ? '#ff0000' : '#ff6600'}` : 'none',
                        }}
                    />
                </div>
            )}

            {/* Header */}
            <div
                style={{
                    borderBottom: '1px solid #00d4aa',
                    paddingBottom: '10px',
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <div style={{ fontSize: '20px', textTransform: 'uppercase', letterSpacing: '3px' }}>
                    NEURAL_HACK Terminal
                </div>
                <div style={{ fontSize: '14px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span style={{ color: '#00ff00' }}>NIVEAU {currentLevel}</span>
                    <span style={{ color: '#888' }}>|</span>
                    <span style={{ color: '#00ff00' }}>EXPLORATEUR: {explorerPosition || 'N/A'}</span>
                    <span style={{ color: '#888' }}>|</span>
                    <span style={{
                        color: corruptionLevel > 75 ? '#ff0000' : corruptionLevel > 50 ? '#ff6600' : corruptionLevel > 25 ? '#ffaa00' : '#00d4aa',
                        fontWeight: corruptionLevel > 50 ? 'bold' : 'normal',
                        animation: corruptionLevel > 75 ? 'blink 0.5s infinite' : 'none',
                    }}>
                        CORRUPTION: {corruptionLevel}%
                    </span>
                </div>
            </div>

            {/* Main content */}
            <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden' }}>
                {/* Left panel - Synapse list */}
                <div
                    style={{
                        width: '300px',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRight: '1px solid rgba(0, 212, 170, 0.3)',
                        paddingRight: '15px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '14px',
                            marginBottom: '10px',
                            color: '#888',
                            textTransform: 'uppercase',
                        }}
                    >
                        Synapses du chemin principal
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {mainSynapses.map((synapse) => {
                            const status = getSynapseStatus(synapse);
                            const isSelected = synapse.id === selectedSynapseId;
                            return (
                                <div
                                    key={synapse.id}
                                    onClick={() => handleSelectSynapse(synapse.id)}
                                    style={{
                                        padding: '10px',
                                        marginBottom: '5px',
                                        backgroundColor: isSelected
                                            ? 'rgba(0, 212, 170, 0.2)'
                                            : 'rgba(0, 0, 0, 0.3)',
                                        border: isSelected
                                            ? '1px solid #00d4aa'
                                            : '1px solid rgba(0, 212, 170, 0.2)',
                                        cursor: isHacking ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                        {synapse.id.toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '10px', color: '#666' }}>
                                            Niveau {synapse.difficulty}
                                        </span>
                                        <span style={{ fontSize: '10px', color: status.color }}>
                                            {status.text}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Center panel - Hacking area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {isHacking && selectedSynapse ? (
                        <HackingGame
                            synapseId={selectedSynapseId!}
                            difficulty={Math.min(3, selectedSynapse.difficulty + corruptionDifficultyBonus)}
                            onComplete={handleHackComplete}
                            corruptionLevel={corruptionLevel}
                        />
                    ) : selectedSynapse ? (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '24px',
                                    marginBottom: '20px',
                                    textTransform: 'uppercase',
                                }}
                            >
                                Synapse {selectedSynapseId}
                            </div>
                            <div
                                style={{
                                    fontSize: '14px',
                                    color: '#888',
                                    marginBottom: '30px',
                                    textAlign: 'center',
                                }}
                            >
                                {selectedSynapse.fromNeuronId} → {selectedSynapse.toNeuronId}
                                <br />
                                Difficulté: {selectedSynapse.difficulty}
                            </div>
                            {!selectedSynapse.isUnlocked ? (
                                <button
                                    onClick={handleStartHack}
                                    style={{
                                        padding: '15px 40px',
                                        fontSize: '16px',
                                        backgroundColor: 'transparent',
                                        border: '2px solid #00d4aa',
                                        color: '#00d4aa',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        transition: 'all 0.3s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.2)';
                                        e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 212, 170, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    Lancer le Hack
                                </button>
                            ) : (
                                <div style={{ color: '#00ff00', fontSize: '18px' }}>
                                    ✓ Synapse déjà déverrouillée
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                                fontSize: '16px',
                            }}
                        >
                            Sélectionnez une synapse à hacker
                        </div>
                    )}
                </div>

                {/* Right panel - Terminal log */}
                <div
                    style={{
                        width: '350px',
                        display: 'flex',
                        flexDirection: 'column',
                        borderLeft: '1px solid rgba(0, 212, 170, 0.3)',
                        paddingLeft: '15px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '14px',
                            marginBottom: '10px',
                            color: '#888',
                            textTransform: 'uppercase',
                        }}
                    >
                        Journal système
                    </div>
                    <div
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            fontSize: '11px',
                            lineHeight: '1.6',
                        }}
                    >
                        {terminalLines.map((line) => (
                            <div
                                key={line.id}
                                style={{
                                    color:
                                        line.type === 'error'
                                            ? '#ff4444'
                                            : line.type === 'success'
                                            ? '#00ff00'
                                            : line.type === 'warning'
                                            ? '#ffaa00'
                                            : line.type === 'system'
                                            ? '#00d4aa'
                                            : '#888',
                                    marginBottom: '3px',
                                }}
                            >
                                {line.text}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CRT scanline effect */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)',
                    zIndex: 10,
                }}
            />

            {/* Corruption glitch overlay */}
            {corruptionLevel > 40 && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: 'none',
                        background: `linear-gradient(
                            ${Math.random() * 360}deg,
                            transparent 0%,
                            rgba(255, 0, 0, ${corruptionLevel / 500}) ${30 + Math.random() * 20}%,
                            transparent ${50 + Math.random() * 20}%,
                            rgba(0, 255, 255, ${corruptionLevel / 500}) ${70 + Math.random() * 10}%,
                            transparent 100%
                        )`,
                        zIndex: 11,
                        opacity: glitchActive ? 1 : 0.3,
                        mixBlendMode: 'screen',
                    }}
                />
            )}

            {/* ARIA Corruption Warning Popup */}
            {showCorruptionWarning && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            padding: '40px 60px',
                            border: '3px solid #ff0000',
                            backgroundColor: 'rgba(20, 0, 0, 0.95)',
                            textAlign: 'center',
                            animation: 'warning-blink 0.5s infinite',
                            boxShadow: '0 0 50px rgba(255, 0, 0, 0.5), inset 0 0 30px rgba(255, 0, 0, 0.1)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '16px',
                                color: '#ff0000',
                                marginBottom: '15px',
                                letterSpacing: '4px',
                            }}
                        >
                            ▲ ALERTE INTRUSION ▲
                        </div>
                        <div
                            style={{
                                fontSize: '24px',
                                color: '#ff4444',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '3px',
                                marginBottom: '15px',
                                textShadow: '0 0 20px rgba(255, 0, 0, 0.8)',
                            }}
                        >
                            ARIA
                        </div>
                        <div
                            style={{
                                fontSize: '16px',
                                color: '#ff6666',
                                lineHeight: '1.6',
                            }}
                        >
                            tente de corrompre
                            <br />
                            le panneau de commande
                        </div>
                        <div
                            style={{
                                marginTop: '20px',
                                fontSize: '12px',
                                color: '#ff4444',
                                animation: 'pulse-fast 0.3s infinite',
                            }}
                        >
                            ● DÉFENSE ACTIVE ●
                        </div>
                    </div>
                </div>
            )}

            {/* CSS for animations */}
            <style>{`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
                @keyframes warning-blink {
                    0%, 50% {
                        border-color: #ff0000;
                        box-shadow: 0 0 50px rgba(255, 0, 0, 0.5), inset 0 0 30px rgba(255, 0, 0, 0.1);
                    }
                    51%, 100% {
                        border-color: #ff6600;
                        box-shadow: 0 0 30px rgba(255, 100, 0, 0.3), inset 0 0 20px rgba(255, 100, 0, 0.05);
                    }
                }
                @keyframes pulse-fast {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}
