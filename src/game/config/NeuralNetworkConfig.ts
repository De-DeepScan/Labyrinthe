// Configuration for the Neural Network game

export const NEURAL_NETWORK_CONFIG = {
    // Network generation
    NEURON_COUNT: 75,
    MIN_CONNECTIONS: 2,
    MAX_CONNECTIONS: 5,
    AVERAGE_CONNECTIVITY: 3,

    // Layout
    NETWORK_WIDTH: 1600,
    NETWORK_HEIGHT: 1000,
    MIN_NEURON_DISTANCE: 70,
    FORCE_ITERATIONS: 120,

    // Visual
    NEURON_RADIUS: 20,
    NEURON_RADIUS_CORE: 35,
    NEURON_RADIUS_ENTRY: 25,
    SYNAPSE_WIDTH: 4,
    SYNAPSE_WIDTH_ACTIVE: 6,

    // Colors
    COLORS: {
        NEURON_NORMAL: 0x4a5568,
        NEURON_ACTIVATED: 0x48bb78,
        NEURON_ENTRY: 0x4299e1,
        NEURON_CORE: 0xed8936,
        NEURON_BLOCKED: 0xe53e3e,

        SYNAPSE_DORMANT: 0x4a5568,
        SYNAPSE_ACTIVE: 0x48bb78,
        SYNAPSE_SOLVING: 0xecc94b,
        SYNAPSE_BLOCKED: 0xe53e3e,
        SYNAPSE_AI_PATH: 0x9f7aea,

        AI_ENTITY: 0xe53e3e,
        AI_PATH: 0xfc8181,

        EXPLORER: 0x4299e1,

        FOG: 0x1a202c,
        BACKGROUND: 0x1a1a2e,
    },

    // Explorer
    EXPLORER_VISION_RADIUS: 3, // Number of neurons visible around explorer

    // AI Behavior
    AI_BASE_SPEED: 0.2, // Neurons per second (slower)
    AI_SPEED_INCREASE: 0.003, // Speed increase per second (0.3%)
    AI_MAX_SPEED: 1.0, // Lower maximum speed
    AI_HACK_TIME: 5000, // Time in ms to hack through a destroyed neuron

    // Animation
    ANIMATION: {
        NEURON_PULSE: 300,
        SYNAPSE_ACTIVATE: 400,
        AI_MOVE: 200,
        EXPLORER_MOVE: 300,
    },
} as const;

export const RESOURCE_CONFIG = {
    INITIAL_RESOURCES: 30,
    MAX_RESOURCES: 100,
    DESTROY_COST: 15, // Coût pour détruire un neurone
    FIREWALL_BASE_REWARD: 10,
    FIREWALL_ROUND_MULTIPLIER: 1,
} as const;

export const PUZZLE_CONFIG = {
    CIRCLE_COUNT: 8,
    CIRCLE_RADIUS: 30,
    CIRCLE_SPACING: 100,

    COLORS: {
        OFF: 0x4a5568,
        WRONG: 0xe53e3e,
        CORRECT: 0x48bb78,
        CONNECTION: 0x718096,
        CONNECTION_ACTIVE: 0x4299e1,
    },

    // Difficulty affects gate distribution
    // Easy: 70% OR, 20% AND, 10% XOR
    // Medium: 40% OR, 40% AND, 20% XOR
    // Hard: 20% OR, 40% AND, 40% XOR
    GATE_DISTRIBUTION: {
        1: { OR: 0.7, AND: 0.2, XOR: 0.1 },
        2: { OR: 0.4, AND: 0.4, XOR: 0.2 },
        3: { OR: 0.2, AND: 0.4, XOR: 0.4 },
    },
} as const;

export const FIREWALL_CONFIG = {
    COLORS: ["red", "blue", "green", "yellow"] as const,
    BASE_SEQUENCE_LENGTH: 3,
    SEQUENCE_INCREMENT: 1,
    BASE_SPEED: 800, // ms between flashes
    SPEED_DECREASE: 50, // ms faster per round
    MIN_SPEED: 300,
    FLASH_DURATION: 400,
    GAP_DURATION: 200,

    BUTTON_SIZE: 100,
    BUTTON_SPACING: 20,

    BUTTON_COLORS: {
        red: { normal: 0xe53e3e, flash: 0xfc8181 },
        blue: { normal: 0x4299e1, flash: 0x90cdf4 },
        green: { normal: 0x48bb78, flash: 0x9ae6b4 },
        yellow: { normal: 0xecc94b, flash: 0xfaf089 },
    },
} as const;
