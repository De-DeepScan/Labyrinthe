// Depth constants for rendering order
export const DEPTH = {
    BACKGROUND: 0,
    SYNAPSE: 10,
    SYNAPSE_ACTIVE: 15,
    NEURON: 20,
    AI_PATH: 25,
    AI_ENTITY: 30,
    EXPLORER: 50,
    FOG: 100,
    PUZZLE_BG: 200,
    PUZZLE_ELEMENTS: 210,
    FIREWALL_BG: 200,
    FIREWALL_ELEMENTS: 210,
    UI: 500,
    POPUP: 600,
} as const;

// Animation durations (in ms)
export const ANIMATION = {
    NEURON_PULSE: 300,
    SYNAPSE_ACTIVATE: 400,
    EXPLORER_MOVE: 300,
    AI_MOVE: 200,
    PUZZLE_TRANSITION: 200,
    FIREWALL_FLASH: 400,
    POPUP_FADE: 300,
} as const;

// Game states
export const GAME_STATE = {
    WAITING: "waiting",
    PLAYING: "playing",
    PUZZLE: "puzzle",
    PAUSED: "paused",
    VICTORY: "victory",
    DEFEAT: "defeat",
} as const;

// Logic gate types
export const LOGIC_GATES = {
    AND: "AND",
    OR: "OR",
    XOR: "XOR",
} as const;
