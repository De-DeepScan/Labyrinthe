import { useState, useCallback, useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/gameStore';

interface CommandResult {
    command: string;
    output: string;
    type: 'success' | 'error' | 'info' | 'hack';
}

// Hack commands to type - varying lengths for different rewards
const HACK_COMMANDS = [
    // Short commands (5-10 chars) - 3-5 resources
    'sudo rm -rf',
    'ping host',
    'cat /etc',
    'ls -la',
    'chmod 777',
    'grep -r',
    'kill -9',
    'netstat',
    // Medium commands (11-18 chars) - 6-10 resources
    'nmap -sV target',
    'ssh root@server',
    'tcpdump -i eth0',
    'iptables -F',
    'systemctl stop',
    'docker exec -it',
    'curl -X POST',
    // Longer commands (19-25 chars) - 11-15 resources
    'openssl enc -aes256',
    'tar -xzvf backup.gz',
    'mysql -u root -p db',
    'find / -name passwd',
];

// Matrix-style random commands for visual effect
const MATRIX_COMMANDS = [
    'exec 0x7f4a2b decrypt --force',
    'bypass firewall.node[127]',
    'inject payload.bin >> mem',
    'ssh -X root@192.168.1.1',
    'nmap -sS -O 10.0.0.0/24',
    'crack hash:5f4dcc3b5aa765',
    'dump credentials.db',
    'exploit CVE-2024-1234',
    'overflow buffer[0xff]',
    'trace route::hidden',
    'decrypt AES-256 key.pem',
    'fork process 0xDEADBEEF',
    'scan ports 1-65535',
    'spoof MAC aa:bb:cc:dd',
    'inject SQL; DROP TABLE',
    'reverse shell /bin/bash',
    'escalate privileges sudo',
    'patch kernel module.ko',
    'compile exploit.c -o pwn',
    'brute force admin@sys',
    'sniff packets eth0',
    'clone disk /dev/sda',
    'wipe logs /var/log/*',
    'tunnel vpn::secure',
    'mitm attack gateway',
];

function getRandomHackCommand(): string {
    return HACK_COMMANDS[Math.floor(Math.random() * HACK_COMMANDS.length)];
}

function generateMatrixLine(): CommandResult {
    const cmd = MATRIX_COMMANDS[Math.floor(Math.random() * MATRIX_COMMANDS.length)];
    const status = Math.random() > 0.3 ? 'OK' : Math.random() > 0.5 ? 'DONE' : 'PASS';
    return {
        command: '',
        output: `[${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}] ${cmd} ... ${status}`,
        type: 'hack',
    };
}

function calculateReward(commandLength: number): number {
    if (commandLength <= 10) return 3 + Math.floor(Math.random() * 3);
    if (commandLength <= 18) return 6 + Math.floor(Math.random() * 5);
    return 11 + Math.floor(Math.random() * 5);
}

export function TerminalOverlay() {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<CommandResult[]>([
        { command: '', output: 'TERMINAL PROTECTEUR v1.0', type: 'info' },
        { command: '', output: 'Tapez "help" pour voir les commandes disponibles.', type: 'info' },
    ]);
    const [hackMode, setHackMode] = useState(false);
    const [currentHackCommand, setCurrentHackCommand] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    const setShowTerminal = useGameStore((state) => state.setShowTerminal);
    const resources = useGameStore((state) => state.resources);
    const addResources = useGameStore((state) => state.addResources);
    const networkData = useGameStore((state) => state.networkData);
    const aiState = useGameStore((state) => state.aiState);
    const explorerPosition = useGameStore((state) => state.explorerPosition);
    const aiSlowdownActive = useGameStore((state) => state.aiSlowdownActive);
    const setAISlowdown = useGameStore((state) => state.setAISlowdown);

    // Auto-scroll to bottom
    useEffect(() => {
        if (historyRef.current) {
            historyRef.current.scrollTop = historyRef.current.scrollHeight;
        }
    }, [history]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Ref to track active matrix animation interval
    const matrixIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Stop any running matrix animation
    const stopMatrixAnimation = useCallback(() => {
        if (matrixIntervalRef.current) {
            clearInterval(matrixIntervalRef.current);
            matrixIntervalRef.current = null;
        }
    }, []);

    // Start matrix line animation
    const startMatrixAnimation = useCallback((lineCount: number, onComplete?: () => void) => {
        stopMatrixAnimation();
        let count = 0;
        matrixIntervalRef.current = setInterval(() => {
            setHistory(prev => [...prev, generateMatrixLine()]);
            count++;
            if (count >= lineCount) {
                stopMatrixAnimation();
                onComplete?.();
            }
        }, 50); // 50ms between each line
    }, [stopMatrixAnimation]);

    const startHackMode = useCallback(() => {
        const cmd = getRandomHackCommand();
        setCurrentHackCommand(cmd);
        setHackMode(true);

        // Add initial message
        setHistory(prev => [
            ...prev,
            { command: 'hack', output: '=== INITIALISATION HACK ===', type: 'info' },
        ]);

        // Animate 30 lines then show command
        startMatrixAnimation(30, () => {
            setHistory(prev => [
                ...prev,
                { command: '', output: '', type: 'info' },
                { command: '', output: `>>> ${cmd} <<<`, type: 'hack' },
            ]);
        });
    }, [startMatrixAnimation]);

    const processHackInput = useCallback((input: string) => {
        if (input.trim().toLowerCase() === currentHackCommand.toLowerCase()) {
            const reward = calculateReward(currentHackCommand.length);
            addResources(reward);

            // Apply slowdown if not already active
            if (!aiSlowdownActive) {
                setAISlowdown(true, 5000);
                setHistory(prev => [
                    ...prev,
                    { command: input, output: `HACK RÉUSSI ! +${reward} | IA -30% (5s)`, type: 'success' },
                ]);
                useGameStore.getState().addMessage(`Hack réussi ! +${reward} ressources, IA ralentie`, 'success');
            } else {
                setHistory(prev => [
                    ...prev,
                    { command: input, output: `HACK RÉUSSI ! +${reward}`, type: 'success' },
                ]);
                useGameStore.getState().addMessage(`Hack réussi ! +${reward} ressources`, 'success');
            }

            // Generate new command for next hack
            const newCmd = getRandomHackCommand();
            setCurrentHackCommand(newCmd);

            // Animate 12 lines then show next command
            startMatrixAnimation(12, () => {
                setHistory(prev => [
                    ...prev,
                    { command: '', output: `>>> ${newCmd} <<<`, type: 'hack' },
                ]);
            });
        } else {
            setHistory(prev => [
                ...prev,
                { command: input, output: `ERREUR: ${currentHackCommand}`, type: 'error' },
            ]);
        }
    }, [currentHackCommand, addResources, aiSlowdownActive, setAISlowdown, startMatrixAnimation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopMatrixAnimation();
    }, [stopMatrixAnimation]);

    const executeCommand = useCallback((cmd: string) => {
        // If in hack mode, process as hack input
        if (hackMode) {
            if (cmd.trim().toLowerCase() === 'exit' || cmd.trim().toLowerCase() === 'quit') {
                stopMatrixAnimation();
                setHackMode(false);
                setHistory(prev => [...prev, { command: cmd, output: 'Mode hack désactivé.', type: 'info' }]);
                return;
            }
            processHackInput(cmd);
            return;
        }

        const parts = cmd.trim().toLowerCase().split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        let output = '';
        let type: 'success' | 'error' | 'info' | 'hack' = 'info';

        switch (command) {
            case 'help':
                output = `Commandes disponibles:
  help            - Affiche cette aide
  status          - Affiche l'état du système
  resources       - Affiche les ressources
  scan            - Analyse le réseau
  hack            - Mode hack: tapez des commandes pour
                    gagner des ressources et ralentir l'IA
  locate ai       - Localise l'IA
  locate explorer - Localise l'explorateur
  clear           - Efface le terminal
  exit            - Ferme le terminal`;
                break;

            case 'status':
                const blockedCount = networkData
                    ? Object.values(networkData.neurons).filter(n => n.isBlocked).length
                    : 0;
                const totalNeurons = networkData ? Object.keys(networkData.neurons).length : 0;
                output = `=== STATUS SYSTÈME ===
Neurones totaux: ${totalNeurons}
Neurones bloqués: ${blockedCount}
Ressources: ${resources.current}/${resources.maximum}
IA connectée: ${aiState ? 'OUI' : 'NON'}
Explorateur détecté: ${explorerPosition ? 'OUI' : 'NON'}
Ralentissement IA: ${aiSlowdownActive ? 'ACTIF' : 'INACTIF'}`;
                type = 'success';
                break;

            case 'resources':
                output = `Ressources: ${resources.current}/${resources.maximum}
Coût de blocage: ${resources.blockCost}`;
                type = 'info';
                break;

            case 'scan':
                if (!networkData) {
                    output = 'ERREUR: Réseau non initialisé';
                    type = 'error';
                } else {
                    const neurons = Object.values(networkData.neurons);
                    const entry = neurons.find(n => n.type === 'entry');
                    const core = neurons.find(n => n.type === 'core');
                    const junctions = neurons.filter(n => n.type === 'junction').length;
                    output = `=== SCAN RÉSEAU ===
Entrée: ${entry?.id || 'N/A'}
Noyau: ${core?.id || 'N/A'}
Jonctions: ${junctions}
Synapses: ${Object.keys(networkData.synapses).length}`;
                    type = 'success';
                }
                break;

            case 'hack':
                startHackMode();
                return;

            case 'locate':
                if (args[0] === 'ai') {
                    if (aiState && networkData) {
                        const aiNeuron = networkData.neurons[aiState.currentNeuronId];
                        output = `Position IA: ${aiState.currentNeuronId}
Coordonnées: (${aiNeuron?.x.toFixed(1)}, ${aiNeuron?.y.toFixed(1)}, ${aiNeuron?.z.toFixed(1)})`;
                        type = 'success';
                    } else {
                        output = 'ERREUR: IA non localisée';
                        type = 'error';
                    }
                } else if (args[0] === 'explorer') {
                    if (explorerPosition && networkData) {
                        const expNeuron = networkData.neurons[explorerPosition];
                        output = `Position Explorateur: ${explorerPosition}
Coordonnées: (${expNeuron?.x.toFixed(1)}, ${expNeuron?.y.toFixed(1)}, ${expNeuron?.z.toFixed(1)})`;
                        type = 'success';
                    } else {
                        output = 'ERREUR: Explorateur non localisé';
                        type = 'error';
                    }
                } else {
                    output = 'Usage: locate ai | locate explorer';
                    type = 'error';
                }
                break;

            case 'clear':
                setHistory([]);
                return;

            case 'exit':
                setShowTerminal(false);
                return;

            case '':
                return;

            default:
                output = `Commande inconnue: ${command}. Tapez "help" pour l'aide.`;
                type = 'error';
        }

        setHistory(prev => [...prev, { command: cmd, output, type }]);
    }, [networkData, resources, aiState, explorerPosition, aiSlowdownActive, setShowTerminal, hackMode, processHackInput, startHackMode, stopMatrixAnimation]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeCommand(input);
        setInput('');
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            maxWidth: '90vw',
            height: '450px',
            background: 'rgba(0, 10, 20, 0.98)',
            border: '2px solid #00d4aa',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1500,
            boxShadow: '0 0 30px rgba(0, 212, 170, 0.3)',
        }}>
            {/* Header */}
            <div style={{
                padding: '8px 16px',
                background: 'rgba(0, 212, 170, 0.2)',
                borderBottom: '1px solid #00d4aa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <span style={{
                    color: '#00d4aa',
                    fontFamily: 'Courier New, monospace',
                    fontSize: 14,
                }}>
                    {hackMode ? 'HACK MODE - "exit" pour quitter' : 'TERMINAL PROTECTEUR'}
                </span>
                <button
                    onClick={() => setShowTerminal(false)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#ff3366',
                        cursor: 'pointer',
                        fontSize: 18,
                        padding: '0 8px',
                    }}
                >
                    X
                </button>
            </div>

            {/* History */}
            <div
                ref={historyRef}
                style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: 16,
                    fontFamily: 'Courier New, monospace',
                    fontSize: 13,
                }}
            >
                {history.map((item, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                        {item.command && (
                            <div style={{ color: '#00d4aa' }}>
                                {'>'} {item.command}
                            </div>
                        )}
                        <div style={{
                            color: item.type === 'error' ? '#ff3366' :
                                   item.type === 'success' ? '#00ff88' :
                                   item.type === 'hack' ? '#00ff00' : '#888',
                            whiteSpace: 'pre-wrap',
                            marginLeft: item.command ? 16 : 0,
                            fontWeight: item.type === 'hack' ? 'bold' : 'normal',
                            fontSize: item.type === 'hack' ? 14 : 13,
                            opacity: item.type === 'hack' ? 0.9 : 1,
                        }}>
                            {item.output}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} style={{
                padding: '8px 16px',
                borderTop: '1px solid #00d4aa',
                display: 'flex',
                alignItems: 'center',
            }}>
                <span style={{ color: '#00d4aa', marginRight: 8 }}>{'>'}</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: '#00d4aa',
                        fontFamily: 'Courier New, monospace',
                        fontSize: 13,
                        outline: 'none',
                    }}
                    placeholder={hackMode ? 'Tapez la commande...' : 'Entrez une commande...'}
                    autoFocus
                />
            </form>
        </div>
    );
}
