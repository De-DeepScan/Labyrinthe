// ============= NEURAL NETWORK CORE =============

// Neuron types
export const NeuronType = {
    NORMAL: "normal",
    ENTRY: "entry",
    CORE: "core",
    JUNCTION: "junction",
} as const;
export type NeuronType = (typeof NeuronType)[keyof typeof NeuronType];

// Represents a single neuron node in the network
export interface Neuron {
    id: string;
    x: number;
    y: number;
    type: NeuronType;
    connections: string[]; // IDs of connected neurons
    isActivated: boolean;
    isBlocked: boolean;
}

// Synapse states
export const SynapseState = {
    DORMANT: "dormant",
    SOLVING: "solving",
    ACTIVE: "active",
    FAILED: "failed",
    BLOCKED: "blocked",
    AI_PATH: "ai_path",
} as const;
export type SynapseState = (typeof SynapseState)[keyof typeof SynapseState];

// Represents a connection between two neurons
export interface Synapse {
    id: string;
    fromNeuronId: string;
    toNeuronId: string;
    state: SynapseState;
    difficulty: number; // Puzzle difficulty 1-3
    isUnlocked: boolean; // Must be unlocked by Protector before Explorer can traverse
}

// The complete neural network structure
export interface NeuralNetworkData {
    neurons: Record<string, Neuron>;
    synapses: Record<string, Synapse>;
    entryNeuronId: string;
    coreNeuronId: string;
    width: number;
    height: number;
}

// ============= SIGNAL PROPAGATION PUZZLE =============

// Logic gate types
export const LogicGate = {
    AND: "AND",
    OR: "OR",
    XOR: "XOR",
} as const;
export type LogicGate = (typeof LogicGate)[keyof typeof LogicGate];

// Circle states
export const CircleState = {
    OFF: "off",
    WRONG: "wrong",
    CORRECT: "correct",
} as const;
export type CircleState = (typeof CircleState)[keyof typeof CircleState];

export interface PuzzleCircle {
    id: number;
    state: CircleState;
    targetState: 0 | 1;
    x: number;
    y: number;
    connections: number[]; // IDs of connectable circles
    gateType: LogicGate;
}

export interface PuzzleConnection {
    from: number;
    to: number;
}

export interface PuzzleState {
    circles: PuzzleCircle[];
    activeConnections: PuzzleConnection[];
    solution: (0 | 1)[];
    difficulty: number;
    synapseId: string;
    isComplete: boolean;
}

// ============= FIREWALL MINI-GAME =============

// Firewall colors
export const FirewallColor = {
    RED: "red",
    BLUE: "blue",
    GREEN: "green",
    YELLOW: "yellow",
} as const;
export type FirewallColor = (typeof FirewallColor)[keyof typeof FirewallColor];

export interface FirewallSequence {
    colors: FirewallColor[];
    currentIndex: number;
    playerSequence: FirewallColor[];
    speed: number;
    round: number;
}

export interface FirewallState {
    isActive: boolean;
    sequence: FirewallSequence;
    resourceReward: number;
}

// ============= RESOURCE SYSTEM =============

export interface ResourceState {
    current: number;
    maximum: number;
    blockCost: number;
}

// ============= AI STATE =============

export interface AIState {
    currentNeuronId: string;
    targetPath: string[];
    speed: number;
    baseSpeed: number;
    speedMultiplier: number;
    isConnected: boolean;
    moveProgress: number;
}

// ============= PLAYER STATES =============

export interface ExplorerState {
    currentNeuronId: string;
    activatedPath: string[];
    isPuzzleSolving: boolean;
    currentPuzzle: PuzzleState | null;
}

export interface ProtectorState {
    resources: ResourceState;
    blockedSynapses: string[];
    isPlayingFirewall: boolean;
    firewallState: FirewallState | null;
    // Hacker role state
    selectedSynapseId: string | null;
    isHacking: boolean;
    hackingProgress: number;
}

// ============= NETWORK MESSAGES =============

export type PlayerRole = "explorer" | "protector" | null;

export type NetworkMessageType =
    | "player-connected"
    | "player-connected-ack"
    | "ping"
    | "pong"
    | "request-game-state"
    | "game-state-response"
    | "network-generated"
    | "explorer-moved"
    | "explorer-position-update"
    | "synapse-activated"
    | "synapse-deactivated"
    | "synapse-blocked"
    | "synapse-unlocked"
    | "synapse-unlock-failed"
    | "neuron-destroyed"
    | "neuron-hacked"
    | "ai-position"
    | "ai-connected"
    | "puzzle-started"
    | "puzzle-completed"
    | "puzzle-failed"
    | "game-won"
    | "game-lost"
    | "game-restart"
    | "dilemma-triggered"
    | "dilemma-choice";

export interface NetworkMessage {
    type: NetworkMessageType;
    data: unknown;
    from: PlayerRole;
    timestamp: number;
}

// ============= LEGACY (kept for compatibility) =============

export interface GridPosition {
    x: number;
    y: number;
}

export interface PlayerControls {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    action?: Phaser.Input.Keyboard.Key;
}
