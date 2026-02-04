import { create } from 'zustand';
import type {
    NeuralNetworkData,
    Neuron,
    PlayerRole,
    AIState,
    ResourceState,
    PuzzleState
} from '../types/interfaces';
import { SynapseState } from '../types/interfaces';
import { NetworkManager } from '../services/NetworkManager';

// Extended Neuron with Z coordinate for 3D
export interface Neuron3D extends Omit<Neuron, 'x' | 'y'> {
    x: number;
    y: number;
    z: number;
    opacity?: number; // Optional opacity for decorative neurons (default 1.0)
}

// Extended Network data for 3D
export interface NeuralNetworkData3D extends Omit<NeuralNetworkData, 'neurons'> {
    neurons: Record<string, Neuron3D>;
    depth: number;
}

interface GameState {
    // Role
    role: PlayerRole;
    setRole: (role: PlayerRole) => void;

    // Gamemaster control
    gameStarted: boolean;
    setGameStarted: (started: boolean) => void;
    aiEnabled: boolean;
    setAIEnabled: (enabled: boolean) => void;

    // Network data
    networkData: NeuralNetworkData3D | null;
    setNetworkData: (data: NeuralNetworkData3D) => void;

    // Explorer state
    explorerPosition: string | null;
    explorerPath: string[];
    setExplorerPosition: (neuronId: string) => void;
    addToExplorerPath: (neuronId: string) => void;

    // AI state
    aiState: AIState | null;
    setAIState: (state: AIState) => void;
    updateAIPosition: (neuronId: string, progress: number) => void;

    // Synapse states
    updateSynapseState: (synapseId: string, state: SynapseState) => void;
    unlockSynapse: (synapseId: string) => void;

    // Hacking state (Protector)
    selectedSynapseId: string | null;
    isHacking: boolean;
    setSelectedSynapse: (synapseId: string | null) => void;
    setIsHacking: (hacking: boolean) => void;

    // Neuron states
    activateNeuron: (neuronId: string) => void;
    blockNeuron: (neuronId: string) => void;
    unblockNeuron: (neuronId: string) => void;

    // Resources (Protector)
    resources: ResourceState;
    setResources: (resources: ResourceState) => void;
    spendResources: (amount: number) => boolean;
    addResources: (amount: number) => void;

    // Puzzle state
    currentPuzzle: PuzzleState | null;
    setCurrentPuzzle: (puzzle: PuzzleState | null) => void;
    activePuzzle: { synapseId: string; targetNeuronId: string; difficulty: number } | null;
    setActivePuzzle: (puzzle: { synapseId: string; targetNeuronId: string; difficulty: number } | null) => void;

    // Game state
    isGameOver: boolean;
    isVictory: boolean;
    setGameOver: (victory: boolean) => void;

    // Level progression
    currentLevel: number;
    setCurrentLevel: (level: number) => void;
    advanceLevel: () => void;
    showLevelTransition: boolean;
    pendingLevel: number | null;
    triggerLevelTransition: () => void;
    completeLevelTransition: () => void;

    // Camera
    cameraTarget: [number, number, number];
    setCameraTarget: (target: [number, number, number]) => void;

    // UI
    showTerminal: boolean;
    setShowTerminal: (show: boolean) => void;
    showDilemma: boolean;
    dilemmaData: unknown | null;
    setShowDilemma: (show: boolean, data?: unknown) => void;

    // Dilemma pause state (between levels)
    dilemmaInProgress: boolean;
    setDilemmaInProgress: (inProgress: boolean) => void;

    // Padlock code modal (shown at end of level 3)
    showPadlockCode: boolean;
    setShowPadlockCode: (show: boolean) => void;

    // AI Repair state
    aiRepairProgress: { neuronId: string; progress: number } | null;
    setAIRepairProgress: (data: { neuronId: string; progress: number } | null) => void;

    // AI Slowdown state
    aiSlowdownActive: boolean;
    aiSlowdownEndTime: number;
    setAISlowdown: (active: boolean, duration?: number) => void;

    // AI Corruption state (for Protector terminal)
    corruptionLevel: number; // 0-100
    setCorruptionLevel: (level: number) => void;
    addCorruption: (amount: number) => void;
    purgeCorruption: (amount: number) => void;

    // Messages
    messages: Array<{ id: string; text: string; type: 'info' | 'warning' | 'success' | 'error' }>;
    addMessage: (text: string, type: 'info' | 'warning' | 'success' | 'error') => void;
    removeMessage: (id: string) => void;

    // Reset
    reset: () => void;
}

const initialResources: ResourceState = {
    current: 30,
    maximum: 100,
    blockCost: 15,
};

export const useGameStore = create<GameState>((set, get) => ({
    // Role
    role: null,
    setRole: (role) => {
        // Configure NetworkManager with the role
        NetworkManager.getInstance().setRole(role);
        set({ role });
    },

    // Gamemaster control
    gameStarted: false,
    setGameStarted: (started) => set({ gameStarted: started }),
    aiEnabled: true,
    setAIEnabled: (enabled) => set({ aiEnabled: enabled }),

    // Network
    networkData: null,
    setNetworkData: (data) => set({ networkData: data }),

    // Explorer
    explorerPosition: null,
    explorerPath: [],
    setExplorerPosition: (neuronId) => set({ explorerPosition: neuronId }),
    addToExplorerPath: (neuronId) => set((state) => ({
        explorerPath: [...state.explorerPath, neuronId]
    })),

    // AI
    aiState: null,
    setAIState: (aiState) => set({ aiState }),
    updateAIPosition: (neuronId, progress) => set((state) => ({
        aiState: state.aiState ? { ...state.aiState, currentNeuronId: neuronId, moveProgress: progress } : null
    })),

    // Synapse
    updateSynapseState: (synapseId, newState) => set((state) => {
        if (!state.networkData) return {};
        const synapse = state.networkData.synapses[synapseId];
        if (!synapse) return {};
        return {
            networkData: {
                ...state.networkData,
                synapses: {
                    ...state.networkData.synapses,
                    [synapseId]: { ...synapse, state: newState }
                }
            }
        };
    }),
    unlockSynapse: (synapseId) => set((state) => {
        if (!state.networkData) return {};
        const synapse = state.networkData.synapses[synapseId];
        if (!synapse) return {};
        return {
            networkData: {
                ...state.networkData,
                synapses: {
                    ...state.networkData.synapses,
                    [synapseId]: { ...synapse, isUnlocked: true }
                }
            }
        };
    }),

    // Hacking state (Protector)
    selectedSynapseId: null,
    isHacking: false,
    setSelectedSynapse: (synapseId) => set({ selectedSynapseId: synapseId }),
    setIsHacking: (hacking) => set({ isHacking: hacking }),

    // Neuron
    activateNeuron: (neuronId) => set((state) => {
        if (!state.networkData) return {};
        const neuron = state.networkData.neurons[neuronId];
        if (!neuron) return {};
        return {
            networkData: {
                ...state.networkData,
                neurons: {
                    ...state.networkData.neurons,
                    [neuronId]: { ...neuron, isActivated: true }
                }
            }
        };
    }),
    blockNeuron: (neuronId) => set((state) => {
        if (!state.networkData) return {};
        const neuron = state.networkData.neurons[neuronId];
        if (!neuron) return {};
        return {
            networkData: {
                ...state.networkData,
                neurons: {
                    ...state.networkData.neurons,
                    [neuronId]: { ...neuron, isBlocked: true }
                }
            }
        };
    }),
    unblockNeuron: (neuronId) => set((state) => {
        if (!state.networkData) return {};
        const neuron = state.networkData.neurons[neuronId];
        if (!neuron) return {};
        return {
            networkData: {
                ...state.networkData,
                neurons: {
                    ...state.networkData.neurons,
                    [neuronId]: { ...neuron, isBlocked: false }
                }
            }
        };
    }),

    // Resources
    resources: initialResources,
    setResources: (resources) => set({ resources }),
    spendResources: (amount) => {
        const { resources } = get();
        if (resources.current >= amount) {
            set({ resources: { ...resources, current: resources.current - amount } });
            return true;
        }
        return false;
    },
    addResources: (amount) => set((state) => ({
        resources: {
            ...state.resources,
            current: Math.min(state.resources.maximum, state.resources.current + amount)
        }
    })),

    // Puzzle
    currentPuzzle: null,
    setCurrentPuzzle: (puzzle) => set({ currentPuzzle: puzzle }),
    activePuzzle: null,
    setActivePuzzle: (puzzle) => set({ activePuzzle: puzzle }),

    // Game state
    isGameOver: false,
    isVictory: false,
    setGameOver: (victory) => set({ isGameOver: true, isVictory: victory }),

    // Level progression
    currentLevel: 1,
    showLevelTransition: false,
    pendingLevel: null,
    setCurrentLevel: (level) => set({ currentLevel: level }),

    // Trigger level transition animation (called when reaching core)
    triggerLevelTransition: () => set((state) => {
        const nextLevel = state.currentLevel + 1;
        if (nextLevel > 3) {
            // Game complete - victory!
            return { isGameOver: true, isVictory: true };
        }
        return {
            showLevelTransition: true,
            pendingLevel: nextLevel,
        };
    }),

    // Complete level transition (called when animation ends)
    completeLevelTransition: () => set((state) => {
        if (!state.pendingLevel || !state.networkData) {
            return { showLevelTransition: false, pendingLevel: null };
        }

        const entryId = state.networkData.entryNeuronId;

        // Reset all synapses to dormant and locked (except first main path synapse)
        const resetSynapses: Record<string, typeof state.networkData.synapses[string]> = {};
        for (const [id, synapse] of Object.entries(state.networkData.synapses)) {
            // First main path synapse is unlocked, decorative synapses stay unlocked
            const isFirstMainSynapse = id === 's_0';
            const isDecorativeSynapse = id.startsWith('s_deco_');
            resetSynapses[id] = {
                ...synapse,
                state: SynapseState.DORMANT,
                isUnlocked: isFirstMainSynapse || isDecorativeSynapse,
            };
        }

        // Reset all neurons (deactivate, unblock) except entry
        const resetNeurons: Record<string, typeof state.networkData.neurons[string]> = {};
        for (const [id, neuron] of Object.entries(state.networkData.neurons)) {
            resetNeurons[id] = {
                ...neuron,
                isActivated: id === entryId,
                isBlocked: false,
            };
        }

        return {
            currentLevel: state.pendingLevel,
            showLevelTransition: false,
            pendingLevel: null,
            explorerPosition: entryId,
            explorerPath: [entryId],
            activePuzzle: null,
            currentPuzzle: null,
            networkData: {
                ...state.networkData,
                neurons: resetNeurons,
                synapses: resetSynapses,
            },
        };
    }),

    // Legacy advanceLevel (now just triggers transition)
    advanceLevel: () => {
        useGameStore.getState().triggerLevelTransition();
    },

    // Camera
    cameraTarget: [0, 0, 0],
    setCameraTarget: (target) => set({ cameraTarget: target }),

    // UI
    showTerminal: false,
    setShowTerminal: (show) => set({ showTerminal: show }),
    showDilemma: false,
    dilemmaData: null,
    setShowDilemma: (show, data) => set({ showDilemma: show, dilemmaData: data || null }),

    // Dilemma pause state (between levels)
    dilemmaInProgress: false,
    setDilemmaInProgress: (inProgress) => set({ dilemmaInProgress: inProgress }),

    // Padlock code modal (shown at end of level 3)
    showPadlockCode: false,
    setShowPadlockCode: (show) => set({ showPadlockCode: show }),

    // AI Repair state
    aiRepairProgress: null,
    setAIRepairProgress: (data) => set({ aiRepairProgress: data }),

    // AI Slowdown state
    aiSlowdownActive: false,
    aiSlowdownEndTime: 0,
    setAISlowdown: (active, duration = 5000) => {
        if (active) {
            const endTime = Date.now() + duration;
            set({ aiSlowdownActive: true, aiSlowdownEndTime: endTime });
            // Auto-disable after duration
            setTimeout(() => {
                const state = useGameStore.getState();
                if (state.aiSlowdownEndTime === endTime) {
                    set({ aiSlowdownActive: false, aiSlowdownEndTime: 0 });
                    useGameStore.getState().addMessage('Ralentissement IA terminé', 'info');
                }
            }, duration);
        } else {
            set({ aiSlowdownActive: false, aiSlowdownEndTime: 0 });
        }
    },

    // AI Corruption state
    corruptionLevel: 0,
    setCorruptionLevel: (level) => set({ corruptionLevel: Math.max(0, Math.min(100, level)) }),
    addCorruption: (amount) => set((state) => ({
        corruptionLevel: Math.min(100, state.corruptionLevel + amount)
    })),
    purgeCorruption: (amount) => set((state) => ({
        corruptionLevel: Math.max(0, state.corruptionLevel - amount)
    })),

    // Messages
    messages: [],
    addMessage: (text, type) => {
        const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
            messages: [...state.messages, { id, text, type }]
        }));
        // Auto-remove after 3 seconds
        setTimeout(() => {
            get().removeMessage(id);
        }, 3000);
    },
    removeMessage: (id) => set((state) => ({
        messages: state.messages.filter((m) => m.id !== id)
    })),

    // Reset
    reset: () => set({
        role: null,
        gameStarted: false,
        aiEnabled: true,
        networkData: null,
        explorerPosition: null,
        explorerPath: [],
        aiState: null,
        resources: initialResources,
        currentPuzzle: null,
        activePuzzle: null,
        isGameOver: false,
        isVictory: false,
        currentLevel: 1,
        showLevelTransition: false,
        pendingLevel: null,
        cameraTarget: [0, 0, 0],
        showTerminal: false,
        showDilemma: false,
        dilemmaData: null,
        dilemmaInProgress: false,
        showPadlockCode: false,
        aiRepairProgress: null,
        aiSlowdownActive: false,
        aiSlowdownEndTime: 0,
        corruptionLevel: 0,
        messages: [],
        selectedSynapseId: null,
        isHacking: false,
    }),
}));
