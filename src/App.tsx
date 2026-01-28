import { useRef } from "react";
import { type IRefPhaserGame, PhaserGame } from "./PhaserGame";
import "./App.css";

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    const currentScene = (_scene: Phaser.Scene) => {
        // Scene change handler - can be used for React UI updates
    };

    return (
        <div id="app">
            <PhaserGame ref={phaserRef} currentActiveScene={currentScene} />
        </div>
    );
}

export default App;
