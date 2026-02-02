import { useEffect, useState } from "react";
import { ThreeGame } from "./game/three/ThreeGame";
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
    const setRole = useGameStore((state) => state.setRole);
    const setGameStarted = useGameStore((state) => state.setGameStarted);
    const setAIEnabled = useGameStore((state) => state.setAIEnabled);
    const reset = useGameStore((state) => state.reset);

    // Auto-assign role from URL parameter (?role=explorer or ?role=protector)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlRole = params.get("role");
        if (urlRole === "explorer" || urlRole === "protector") {
            setRole(urlRole);
        }
    }, [setRole]);

    // Register with gamemaster and setup listeners
    useEffect(() => {
        // Register the game with available actions
        gamemaster.register("labyrinthe", "Labyrinthe Neural", [
            { id: "reset", label: "Réinitialiser" },
            { id: "start", label: "Démarrer la partie" },
            { id: "enable_ai", label: "Activer l'IA" },
            { id: "disable_ai", label: "Désactiver l'IA" },
        ]);

        // Connection status
        gamemaster.onConnect(() => setConnected(true));
        gamemaster.onDisconnect(() => setConnected(false));

        // Handle commands from backoffice
        gamemaster.onCommand(({ action }) => {
            switch (action) {
                case "reset":
                    reset();
                    window.location.reload();
                    break;
                case "start":
                    setGameStarted(true);
                    break;
                case "enable_ai":
                    setAIEnabled(true);
                    useGameStore.getState().addMessage("IA activée", "warning");
                    break;
                case "disable_ai":
                    setAIEnabled(false);
                    useGameStore.getState().addMessage("IA désactivée", "info");
                    break;
            }
        });
    }, [reset, setGameStarted, setAIEnabled]);

    // Send state updates to backoffice
    useEffect(() => {
        gamemaster.updateState({
            role,
            gameStarted,
            aiEnabled,
            isGameOver,
            isVictory,
        });
    }, [role, gameStarted, aiEnabled, isGameOver, isVictory]);

    // Send events on game over
    useEffect(() => {
        if (isGameOver) {
            gamemaster.sendEvent(isVictory ? "game_won" : "game_lost", {
                role,
            });
        }
    }, [isGameOver, isVictory, role]);

    return (
        <div id="app">
            {/* Connection indicator */}
            <div style={{
                position: 'fixed',
                top: 10,
                right: 10,
                padding: '4px 8px',
                background: connected ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 51, 102, 0.2)',
                border: `1px solid ${connected ? '#00ff88' : '#ff3366'}`,
                borderRadius: 4,
                fontFamily: 'Courier New, monospace',
                fontSize: 10,
                color: connected ? '#00ff88' : '#ff3366',
                zIndex: 9999,
            }}>
                {connected ? '● BACKOFFICE' : '○ DÉCONNECTÉ'}
            </div>

            <ThreeGame />
        </div>
    );
}

export default App;
