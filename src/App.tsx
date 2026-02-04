import { useEffect, useState } from "react";
import { ThreeGame } from "./game/three/ThreeGame";
import { DeepScanIdentityCard } from "./game/three/overlays/DeepScanIdentityCard";
import { gamemaster } from "./gamemaster-client";
import { useGameStore } from "./game/stores/gameStore";
import "./App.css";

function App() {
    const [connected, setConnected] = useState(false);

    const role = useGameStore((state) => state.role);
    const gameStarted = useGameStore((state) => state.gameStarted);
    const aiEnabled = useGameStore((state) => state.aiEnabled);
    const isGameOver = useGameStore((state) => state.isGameOver);
    const isVictory = useGameStore((state) => state.isVictory);
    const corruptionLevel = useGameStore((state) => state.corruptionLevel);
    const dilemmaInProgress = useGameStore((state) => state.dilemmaInProgress);
    const setRole = useGameStore((state) => state.setRole);
    const setGameStarted = useGameStore((state) => state.setGameStarted);
    const setAIEnabled = useGameStore((state) => state.setAIEnabled);
    const reset = useGameStore((state) => state.reset);

    // Check for preview mode
    const [previewMode, setPreviewMode] = useState<string | null>(null);

    // Auto-assign role and start from URL parameters
    // ?role=explorer or ?role=protector
    // ?start=true to start without backoffice
    // ?preview=deepscan to preview the DeepScan identity card
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlRole = params.get("role");
        const autoStart = params.get("start") === "true";
        const preview = params.get("preview");

        if (preview) {
            setPreviewMode(preview);
            return; // Don't process other params in preview mode
        }

        if (urlRole === "explorer" || urlRole === "protector") {
            setRole(urlRole);
        }

        if (autoStart) {
            setGameStarted(true);
        }
    }, [setRole, setGameStarted]);

    // Register with gamemaster and setup listeners
    useEffect(() => {
        // Register the game with available actions and role
        gamemaster.register(
            "labyrinthe",
            `Labyrinthe - ${role === 'explorer' ? 'Explorateur' : role === 'protector' ? 'Protecteur' : 'En attente'}`,
            [
                { id: "reset", label: "Réinitialiser" },
                { id: "start", label: "Démarrer la partie" },
                { id: "set_ai", label: "Activer/Désactiver l'IA", params: ["enabled"] },
            ],
            role || undefined
        );

        // Connection status
        gamemaster.onConnect(() => setConnected(true));
        gamemaster.onDisconnect(() => setConnected(false));

        // Handle commands from backoffice
        gamemaster.onCommand(({ action, payload }) => {
            switch (action) {
                case "reset":
                    reset();
                    window.location.reload();
                    break;
                case "start":
                    setGameStarted(true);
                    break;
                case "set_ai": {
                    const enabled = payload?.enabled === true;
                    setAIEnabled(enabled);
                    useGameStore.getState().addMessage(
                        enabled ? "IA activée" : "IA désactivée",
                        enabled ? "warning" : "info"
                    );
                    break;
                }
                case "terminal_purged":
                    // Other game succeeded in purging the corruption
                    useGameStore.getState().purgeCorruption(30);
                    useGameStore.getState().addMessage("Corruption purgée par station externe!", "success");
                    break;
                case "dilemma_start":
                    // Backoffice starts a dilemma - pause the game
                    useGameStore.getState().setDilemmaInProgress(true);
                    break;
                case "dilemma_end":
                    // Backoffice ends the dilemma - resume the game
                    useGameStore.getState().setDilemmaInProgress(false);
                    break;
                case "sidequest_score": {
                    // Sidequest points reduce corruption
                    const points = (payload?.points as number) || 0;
                    const reduction = points * 5;
                    useGameStore.getState().purgeCorruption(reduction);
                    useGameStore.getState().addMessage(
                        `Sidequest: +${points} pts - Corruption -${reduction}%`,
                        "success"
                    );
                    break;
                }
            }
        });

        // Listen for game-message from dilemma app
        gamemaster.onMessage((message: unknown) => {
            const msg = message as { type?: string; isShowing?: boolean };
            if (msg.type === 'dilemma-showing') {
                // Sync dilemma state with the dilemma app
                useGameStore.getState().setDilemmaInProgress(msg.isShowing ?? false);
            }
        });
    }, [role, reset, setGameStarted, setAIEnabled]);

    // Send state updates to backoffice
    useEffect(() => {
        gamemaster.updateState({
            role,
            gameStarted,
            aiEnabled,
            isGameOver,
            isVictory,
            corruptionLevel,
            dilemmaInProgress,
        });
    }, [role, gameStarted, aiEnabled, isGameOver, isVictory, corruptionLevel, dilemmaInProgress]);

    // Send events on game over
    useEffect(() => {
        if (isGameOver) {
            gamemaster.sendEvent(isVictory ? "game_won" : "game_lost", {
                role,
            });
        }
    }, [isGameOver, isVictory, role]);

    // Preview mode - show component directly
    if (previewMode === "deepscan") {
        return (
            <div id="app">
                <DeepScanIdentityCard />
            </div>
        );
    }

    return (
        <div id="app">
            <ThreeGame />
        </div>
    );
}

export default App;
