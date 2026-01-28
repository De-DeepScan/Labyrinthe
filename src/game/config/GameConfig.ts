export class GameConfig {
    // Screen configuration
    static readonly SCREEN_WIDTH = 1280;
    static readonly SCREEN_HEIGHT = 720;

    // Network visualization
    static readonly NETWORK_PADDING = 50;

    // Colors - Main palette
    static readonly COLORS = {
        // Background
        BACKGROUND: 0x1a1a2e,
        BACKGROUND_DARK: 0x0f0f1a,

        // Neurons
        NEURON_NORMAL: 0x4a5568,
        NEURON_ACTIVATED: 0x48bb78,
        NEURON_ENTRY: 0x4299e1,
        NEURON_CORE: 0xed8936,
        NEURON_BLOCKED: 0xe53e3e,
        NEURON_GLOW: 0x63b3ed,

        // Synapses
        SYNAPSE_DORMANT: 0x4a5568,
        SYNAPSE_ACTIVE: 0x48bb78,
        SYNAPSE_SOLVING: 0xecc94b,
        SYNAPSE_BLOCKED: 0xe53e3e,
        SYNAPSE_AI_PATH: 0x9f7aea,

        // Entities
        EXPLORER: 0x4299e1,
        AI_ENTITY: 0xe53e3e,
        AI_PATH: 0xfc8181,

        // UI
        UI_PRIMARY: 0x4299e1,
        UI_SUCCESS: 0x48bb78,
        UI_DANGER: 0xe53e3e,
        UI_WARNING: 0xecc94b,
        UI_TEXT: 0xffffff,
        UI_TEXT_DIM: 0xa0aec0,

        // Fog
        FOG: 0x000000,
        FOG_ALPHA: 0.85,
    } as const;

    // Phaser configuration
    static readonly PHASER_CONFIG = {
        BACKGROUND_COLOR: "#1a1a2e",
        PARENT: "game-container",
    } as const;

    // Font styles
    static readonly FONTS = {
        TITLE: {
            fontFamily: "Arial Black",
            fontSize: "48px",
            color: "#ffffff",
        },
        SUBTITLE: {
            fontFamily: "Arial",
            fontSize: "24px",
            color: "#a0aec0",
        },
        BUTTON: {
            fontFamily: "Arial",
            fontSize: "20px",
            color: "#ffffff",
        },
        UI: {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
        },
    } as const;
}
