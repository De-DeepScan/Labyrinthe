import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { RoleSelect3D } from './scenes/RoleSelect3D';
import { ExplorerScene } from './scenes/ExplorerScene';
import { CyberpunkEffects } from './effects/CyberpunkEffects';
import { LoadingScreen } from './components/LoadingScreen';
import { PuzzleOverlay } from './overlays/PuzzleOverlay';
import { DilemmaOverlay } from './overlays/DilemmaOverlay';
import { LevelTransition } from './overlays/LevelTransition';
import { ProtectorTerminal } from './overlays/ProtectorTerminal';
import { DeepScanIdentityCard } from './overlays/DeepScanIdentityCard';
import { DilemmaWaitOverlay } from './overlays/DilemmaWaitOverlay';
import { PadlockCodeOverlay } from './overlays/PadlockCodeOverlay';
import { NetworkManager } from '../services/NetworkManager';
import { EventBus } from '../EventBus';
import { gamemaster } from '../../gamemaster-client';

export function ThreeGame() {
    const role = useGameStore((state) => state.role);
    const gameStarted = useGameStore((state) => state.gameStarted);
    const [isLoading, setIsLoading] = useState(true);

    const handleLoaded = useCallback(() => {
        setIsLoading(false);
    }, []);

    // Show RoleSelect if no role or if role selected but game not started
    const showRoleSelect = !role || (role && !gameStarted);

    // Protector uses a full-screen terminal interface instead of 3D scene
    if (role === 'protector' && gameStarted) {
        return (
            <div style={{ width: '100vw', height: '100vh', background: '#000408' }}>
                <ProtectorTerminal />
                <ProtectorUIOverlays />
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', background: '#000408' }}>
            <Canvas
                camera={{ position: [0, 50, 80], fov: 60 }}
                gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
                dpr={1}
                onCreated={handleLoaded}
            >
                <Suspense fallback={null}>
                    {/* Simplified lighting */}
                    <ambientLight intensity={0.3} color="#112233" />
                    <directionalLight position={[50, 50, 50]} intensity={0.5} color="#00d4aa" />

                    {/* Scene based on role and game started state */}
                    {showRoleSelect && <RoleSelect3D />}
                    {role === 'explorer' && gameStarted && <ExplorerScene />}

                    {/* Reduced post-processing */}
                    <CyberpunkEffects />
                </Suspense>
            </Canvas>

            {/* Loading overlay */}
            {isLoading && <LoadingScreen />}

            {/* UI Overlays rendered outside Canvas */}
            <UIOverlays />
        </div>
    );
}

function UIOverlays() {
    const messages = useGameStore((state) => state.messages);
    const role = useGameStore((state) => state.role);
    const resources = useGameStore((state) => state.resources);
    const activePuzzle = useGameStore((state) => state.activePuzzle);
    const setActivePuzzle = useGameStore((state) => state.setActivePuzzle);
    const setExplorerPosition = useGameStore((state) => state.setExplorerPosition);
    const addToExplorerPath = useGameStore((state) => state.addToExplorerPath);
    const networkData = useGameStore((state) => state.networkData);
    const isGameOver = useGameStore((state) => state.isGameOver);
    const isVictory = useGameStore((state) => state.isVictory);
    const reset = useGameStore((state) => state.reset);
    const showDilemma = useGameStore((state) => state.showDilemma);
    const showTerminal = useGameStore((state) => state.showTerminal);
    const setShowTerminal = useGameStore((state) => state.setShowTerminal);
    const aiRepairProgress = useGameStore((state) => state.aiRepairProgress);
    const showLevelTransition = useGameStore((state) => state.showLevelTransition);
    const pendingLevel = useGameStore((state) => state.pendingLevel);
    const completeLevelTransition = useGameStore((state) => state.completeLevelTransition);
    const dilemmaInProgress = useGameStore((state) => state.dilemmaInProgress);

    const handlePuzzleComplete = useCallback((synapseId: string, targetNeuronId: string) => {
        // Activate synapse and neuron
        useGameStore.getState().updateSynapseState(synapseId, 'active');
        useGameStore.getState().activateNeuron(targetNeuronId);

        // Move explorer to target neuron
        setExplorerPosition(targetNeuronId);
        addToExplorerPath(targetNeuronId);

        // Check if reached core neuron - advance to next level
        if (networkData && targetNeuronId === networkData.coreNeuronId) {
            const currentLevel = useGameStore.getState().currentLevel;

            // Send event to backoffice
            gamemaster.sendEvent('level_complete', { level: currentLevel });

            if (currentLevel >= 3) {
                // Final level complete - show padlock code modal (no dilemma)
                useGameStore.getState().addMessage('VICTOIRE ! Tous les niveaux complétés !', 'success');
                useGameStore.getState().setShowPadlockCode(true);
            } else {
                // Levels 1 and 2: trigger dilemma pause
                useGameStore.getState().setDilemmaInProgress(true);
                // Notify ARIA to show a dilemma
                gamemaster.sendMessage({ type: 'dilemma-showing', data: { isShowing: true } });
                // Advance to next level
                useGameStore.getState().addMessage(`Niveau ${currentLevel} terminé ! Passage au niveau ${currentLevel + 1}`, 'success');
                useGameStore.getState().advanceLevel();
                // Notify Protector about level transition
                NetworkManager.getInstance().send('level-transition', { nextLevel: currentLevel + 1 });
            }
        }

        // Notify protector
        NetworkManager.getInstance().sendExplorerMoved({
            neuronId: targetNeuronId,
            activatedPath: useGameStore.getState().explorerPath
        });

        // Close puzzle
        setActivePuzzle(null);
    }, [networkData, setExplorerPosition, addToExplorerPath, setActivePuzzle]);

    const handlePuzzleCancel = useCallback(() => {
        if (activePuzzle) {
            // Reset synapse to dormant
            useGameStore.getState().updateSynapseState(activePuzzle.synapseId, 'dormant');
        }
        setActivePuzzle(null);
    }, [activePuzzle, setActivePuzzle]);

    return (
        <>
            {/* Puzzle Overlay */}
            {activePuzzle && (
                <PuzzleOverlay
                    synapseId={activePuzzle.synapseId}
                    targetNeuronId={activePuzzle.targetNeuronId}
                    difficulty={activePuzzle.difficulty}
                    onComplete={handlePuzzleComplete}
                    onCancel={handlePuzzleCancel}
                />
            )}

            {/* Dilemma Overlay */}
            {showDilemma && <DilemmaOverlay />}

            {/* Terminal Overlay */}
            {showTerminal && <TerminalOverlay />}

            {/* Level Transition Animation */}
            {showLevelTransition && pendingLevel && !dilemmaInProgress && (
                <LevelTransition
                    level={pendingLevel}
                    onComplete={completeLevelTransition}
                />
            )}

            {/* AI Repair Progress Bar */}
            {role === 'protector' && aiRepairProgress && (
                <div style={{
                    position: 'fixed',
                    top: 80,
                    right: 20,
                    padding: '12px 16px',
                    background: 'rgba(255, 51, 102, 0.95)',
                    border: '2px solid #ff3366',
                    borderRadius: 8,
                    zIndex: 200,
                    minWidth: 200,
                }}>
                    <div style={{
                        color: '#fff',
                        fontFamily: 'Courier New, monospace',
                        fontSize: 12,
                        marginBottom: 8,
                    }}>
                        L'IA RÉPARE UN NEURONE
                    </div>
                    <div style={{
                        width: '100%',
                        height: 8,
                        background: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: 4,
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${aiRepairProgress.progress * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ff3366, #ff6699)',
                            borderRadius: 4,
                            transition: 'width 0.1s linear',
                        }} />
                    </div>
                    <div style={{
                        color: '#ffccdd',
                        fontFamily: 'Courier New, monospace',
                        fontSize: 10,
                        marginTop: 4,
                    }}>
                        {Math.round(aiRepairProgress.progress * 100)}%
                    </div>
                </div>
            )}

            {/* Terminal Button for Protector */}
            {role === 'protector' && networkData && !showTerminal && (
                <button
                    onClick={() => setShowTerminal(true)}
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        padding: '12px 20px',
                        background: 'rgba(0, 212, 170, 0.2)',
                        border: '2px solid #00d4aa',
                        borderRadius: 8,
                        color: '#00d4aa',
                        fontFamily: 'Courier New, monospace',
                        fontSize: 14,
                        cursor: 'pointer',
                        zIndex: 100,
                    }}
                >
                    TERMINAL [T]
                </button>
            )}

            {/* Waiting Overlay for Protector - Simple black screen */}
            {role === 'protector' && !networkData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#000000',
                    zIndex: 500,
                }} />
            )}

            {/* Dilemma Wait Overlay */}
            {dilemmaInProgress && <DilemmaWaitOverlay />}

            {/* Padlock Code Overlay */}
            <PadlockCodeOverlay />

            {/* Game Over Overlay */}
            {isGameOver && !dilemmaInProgress && (
                isVictory ? (
                    <DeepScanIdentityCard />
                ) : (
                    <div style={{
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
                        zIndex: 1000,
                    }}>
                        <div style={{
                            color: '#ff3366',
                            fontFamily: 'Courier New, monospace',
                            fontSize: 48,
                            marginBottom: 20,
                            textShadow: '0 0 20px #ff3366, 0 0 40px #ff3366',
                        }}>
                            CONNEXION PERDUE
                        </div>
                        <div style={{
                            color: '#888',
                            fontFamily: 'Courier New, monospace',
                            fontSize: 18,
                        }}>
                            L'IA a intercepté l'explorateur...
                        </div>
                    </div>
                )
            )}

            {/* Messages */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                pointerEvents: 'none',
                zIndex: 100,
            }}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            padding: '8px 16px',
                            background: msg.type === 'error' ? 'rgba(255, 51, 102, 0.9)' :
                                msg.type === 'warning' ? 'rgba(255, 153, 51, 0.9)' :
                                    msg.type === 'success' ? 'rgba(0, 255, 136, 0.9)' :
                                        'rgba(0, 212, 170, 0.9)',
                            color: '#000',
                            fontFamily: 'Courier New, monospace',
                            fontSize: 14,
                            borderRadius: 4,
                            animation: 'fadeIn 0.3s ease',
                        }}
                    >
                        {msg.text}
                    </div>
                ))}
            </div>

            {/* Protector Resources HUD */}
            {role === 'protector' && (
                <div style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    padding: '12px 20px',
                    background: 'rgba(10, 22, 40, 0.95)',
                    border: '2px solid #00d4aa',
                    fontFamily: 'Courier New, monospace',
                    color: '#00d4aa',
                    zIndex: 100,
                }}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>RESSOURCES</div>
                    <div style={{ fontSize: 24 }}>{resources.current} / {resources.maximum}</div>
                    <div style={{
                        width: '100%',
                        height: 4,
                        background: '#1a3a4a',
                        marginTop: 8,
                        borderRadius: 2,
                    }}>
                        <div style={{
                            width: `${(resources.current / resources.maximum) * 100}%`,
                            height: '100%',
                            background: resources.current > 50 ? '#00d4aa' :
                                resources.current > 20 ? '#ff9933' : '#ff3366',
                            borderRadius: 2,
                            transition: 'width 0.3s, background 0.3s',
                        }} />
                    </div>
                </div>
            )}

        </>
    );
}

// Simplified overlays for Protector (terminal-based interface)
function ProtectorUIOverlays() {
    const networkData = useGameStore((state) => state.networkData);
    const isGameOver = useGameStore((state) => state.isGameOver);
    const isVictory = useGameStore((state) => state.isVictory);
    const reset = useGameStore((state) => state.reset);
    const showLevelTransition = useGameStore((state) => state.showLevelTransition);
    const pendingLevel = useGameStore((state) => state.pendingLevel);
    const completeLevelTransition = useGameStore((state) => state.completeLevelTransition);
    const setNetworkData = useGameStore((state) => state.setNetworkData);
    const unlockSynapse = useGameStore((state) => state.unlockSynapse);
    const dilemmaInProgress = useGameStore((state) => state.dilemmaInProgress);

    const triggerLevelTransition = useGameStore((state) => state.triggerLevelTransition);

    // Listen for network data from explorer
    useEffect(() => {
        const handleNetworkData = (data: any) => {
            setNetworkData(data);
        };

        const handleSynapseUnlocked = (data: { synapseId: string }) => {
            unlockSynapse(data.synapseId);
        };

        const handleLevelTransition = (_data: { nextLevel: number }) => {
            // Trigger level transition on Protector side
            triggerLevelTransition();
        };

        EventBus.on('network-data-received', handleNetworkData);
        EventBus.on('network-synapse-unlocked', handleSynapseUnlocked);
        EventBus.on('network-level-transition', handleLevelTransition);

        // Request game state if explorer is already connected
        NetworkManager.getInstance().requestGameState();

        return () => {
            EventBus.off('network-data-received', handleNetworkData);
            EventBus.off('network-synapse-unlocked', handleSynapseUnlocked);
            EventBus.off('network-level-transition', handleLevelTransition);
        };
    }, [setNetworkData, unlockSynapse, triggerLevelTransition]);

    return (
        <>
            {/* Waiting Overlay for Protector - Simple black screen */}
            {!networkData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#000000',
                    zIndex: 10000,
                }} />
            )}

            {/* Level Transition Animation */}
            {showLevelTransition && pendingLevel && !dilemmaInProgress && (
                <LevelTransition
                    level={pendingLevel}
                    onComplete={completeLevelTransition}
                />
            )}

            {/* Dilemma Wait Overlay */}
            {dilemmaInProgress && <DilemmaWaitOverlay />}

            {/* Padlock Code Overlay */}
            <PadlockCodeOverlay />

            {/* Game Over Overlay */}
            {isGameOver && !dilemmaInProgress && (
                isVictory ? (
                    <DeepScanIdentityCard />
                ) : (
                    <div style={{
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
                    }}>
                        <div style={{
                            color: '#ff3366',
                            fontFamily: 'Courier New, monospace',
                            fontSize: 48,
                            marginBottom: 20,
                            textShadow: '0 0 20px #ff3366, 0 0 40px #ff3366',
                        }}>
                            ÉCHEC DE LA MISSION
                        </div>
                        <div style={{
                            color: '#888',
                            fontFamily: 'Courier New, monospace',
                            fontSize: 18,
                        }}>
                            La connexion a été perdue...
                        </div>
                    </div>
                )
            )}
        </>
    );
}
