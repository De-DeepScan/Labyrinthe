import { Scene } from "phaser";
import { EventBus } from "../EventBus";

// Standard Galactic Alphabet (Minecraft enchanting table style)
const GALACTIC_CHARS = "ᔑᒷᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ ̣⚍⍊∴ ̇/||⨅";

// Terminal commands that the player must type (multi-word, longer commands)
const COMMANDS = [
    // Three word commands
    { cmd: "run deep scan", description: "Scan approfondi" },
    { cmd: "init secure mode", description: "Mode sécurisé" },
    { cmd: "start backup now", description: "Backup immédiat" },
    { cmd: "load neural core", description: "Charger le core" },
    { cmd: "sync all nodes", description: "Sync tous les noeuds" },
    { cmd: "purge ai cache", description: "Purger cache IA" },
    { cmd: "reset network stack", description: "Reset réseau" },
    { cmd: "enable stealth mode", description: "Mode furtif" },
    { cmd: "disable threat detection", description: "Désactiver détection" },
    { cmd: "run memory dump", description: "Dump mémoire" },
    // Four word commands
    { cmd: "init secure boot sequence", description: "Séquence boot sécurisé" },
    { cmd: "run full system scan", description: "Scan système complet" },
    { cmd: "execute emergency shutdown protocol", description: "Arrêt d'urgence" },
    { cmd: "start encrypted data transfer", description: "Transfert crypté" },
    { cmd: "load advanced firewall rules", description: "Règles pare-feu avancées" },
    { cmd: "sync remote backup server", description: "Sync serveur backup" },
    { cmd: "purge all cached data", description: "Purger toutes données" },
    { cmd: "reset all network connections", description: "Reset toutes connexions" },
    { cmd: "enable quantum encryption mode", description: "Encryption quantique" },
    { cmd: "disable external access points", description: "Désactiver accès externes" },
    { cmd: "run neural pathway analysis", description: "Analyse neuronale" },
    { cmd: "init cortex defense system", description: "Système défense cortex" },
    // Five word commands
    { cmd: "execute full system memory purge", description: "Purge mémoire complète" },
    { cmd: "init advanced threat detection protocol", description: "Protocole détection avancée" },
    { cmd: "run deep neural network scan", description: "Scan réseau neuronal" },
    { cmd: "start secure data encryption sequence", description: "Séquence encryption sécurisée" },
    { cmd: "load emergency recovery backup system", description: "Système backup urgence" },
    { cmd: "sync all distributed node clusters", description: "Sync clusters distribués" },
    { cmd: "reset primary firewall defense matrix", description: "Reset matrice défense" },
    { cmd: "enable maximum security lockdown mode", description: "Mode verrouillage maximum" },
    // Six word commands
    { cmd: "init full spectrum threat analysis protocol", description: "Analyse menaces spectre complet" },
    { cmd: "run complete neural pathway integrity check", description: "Vérification intégrité neuronale" },
    { cmd: "execute advanced quantum encryption key rotation", description: "Rotation clés quantiques" },
    { cmd: "start emergency distributed backup sync sequence", description: "Séquence sync backup urgence" },
];

// Random terminal output templates
const OUTPUT_TEMPLATES = [
    "Initializing {module}...",
    "Loading {file}.dll",
    "Connecting to node {id}...",
    "Processing request #{num}",
    "Scanning port {port}...",
    "Encrypting channel {channel}",
    "Memory allocated: {mem}KB",
    "Thread {thread} started",
    "Firewall rule updated: {rule}",
    "Network packet intercepted: {packet}",
    "Decryption key: {key}",
    "Synapse connection: {synapse}",
    "Neural pathway: {path}",
    "Signal strength: {signal}%",
    "Bandwidth: {bandwidth}MB/s",
    "[OK] {process} completed",
    "[INFO] {info}",
    "[WARN] {warning}",
    "[ERROR] Connection refused: {ip}",
    "[ERROR] Timeout on port {port}",
    "[ERROR] Access denied: {perm}",
    "[ERROR] Checksum mismatch: {hex}",
    "[ERROR] Memory corruption at {trace}",
    "[ERROR] Stack overflow in thread {thread}",
    "[ERROR] Segmentation fault: {hex}",
    "[ERROR] Invalid pointer: 0x{hex}",
    "[ERROR] Buffer underflow: {module}",
    "[ERROR] Null reference exception",
    "[FATAL] Kernel panic: {syscall}",
    "[FATAL] System halt imminent",
    ">>> {command}",
    "0x{hex}: {data}",
    "Routing table updated: {rule}",
    "Handshake complete with node {id}",
    "Checksum verified: {hex}",
    "Buffer overflow detected in sector {num}",
    "Quantum state: {state}",
    "Neural link established: {synapse}",
    "Cortex mapping: {percent}%",
    "Synapse latency: {latency}ms",
    "Neuron cluster {id} online",
    "Axon transmission rate: {rate}bps",
    "Dendrite response: {response}",
    "Plasticity index: {index}",
    "Cognitive load: {load}%",
    "Memory fragment recovered: {fragment}",
    "Executing subprocess {pid}...",
    "Stack trace: {trace}",
    "Heap allocation: {heap}KB",
    "Cache hit ratio: {ratio}%",
    "I/O operation pending: {io}",
    "Disk sector {sector} accessed",
    "Registry key modified: {key}",
    "System call intercepted: {syscall}",
    "Kernel module loaded: {module}",
    "Driver initialized: {driver}",
    "Interrupt handler: IRQ{irq}",
    "DMA transfer complete: {dma}",
    "PCI device enumerated: {pci}",
    "USB endpoint: {usb}",
    "Network interface {nic} up",
    "ARP entry added: {arp}",
    "DNS resolved: {dns}",
    "TCP connection: {tcp}",
    "UDP datagram: {udp}",
    "ICMP echo reply: {icmp}",
    "TLS handshake: {tls}",
    "Certificate verified: {cert}",
    "Session token: {token}",
    "Authentication: {auth}",
    "Permission granted: {perm}",
];

type GamePhase = "idle" | "typing" | "processing" | "success" | "fail";

interface TerminalState {
    isActive: boolean;
    currentCommand: string;
    resourceReward: number;
}

/**
 * Manages the Terminal mini-game for the Protector
 * Player types commands to earn resources
 */
export class TerminalManager {
    private scene: Scene;
    private state: TerminalState | null = null;
    private phase: GamePhase = "idle";

    private container?: Phaser.GameObjects.Container;
    private outputContainer?: Phaser.GameObjects.Container;
    private outputTexts: Phaser.GameObjects.Text[] = [];
    private inputText?: Phaser.GameObjects.Text;
    private commandText?: Phaser.GameObjects.Text;
    private statusText?: Phaser.GameObjects.Text;
    private rewardText?: Phaser.GameObjects.Text;
    private cursor?: Phaser.GameObjects.Rectangle;
    private cursorTween?: Phaser.Tweens.Tween;

    private currentInput: string = "";
    private maxOutputLines: number = 15;

    // Callbacks
    private onCompleteCallback?: (resourcesEarned: number) => void;
    private onFailCallback?: () => void;

    // Keyboard listener
    private keyboardListener?: (event: KeyboardEvent) => void;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Start the Terminal mini-game
     */
    startGame(): void {
        const command = this.getRandomCommand();

        this.state = {
            isActive: true,
            currentCommand: command.cmd,
            resourceReward: this.calculateRewardFromCommand(command.cmd),
        };

        this.phase = "idle";
        this.currentInput = "";
        this.showUI();
        this.setupKeyboardInput();
    }

    /**
     * Get a random command for the player to type
     */
    private getRandomCommand(): { cmd: string; description: string } {
        return COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    }

    /**
     * Calculate reward based on command length (number of words)
     * More words = more reward, max 12
     */
    private calculateRewardFromCommand(cmd: string): number {
        const wordCount = cmd.split(" ").length;
        // 3 words = 6, 4 words = 8, 5 words = 10, 6 words = 12
        return Math.min(12, wordCount * 2);
    }

    /**
     * Show the Terminal UI
     */
    private showUI(): void {
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;

        // Create container - fixed to camera so it stays centered
        this.container = this.scene.add.container(centerX, centerY);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000); // High depth to be on top of everything

        // Background overlay
        const overlay = this.scene.add.rectangle(
            0,
            0,
            this.scene.cameras.main.width * 2,
            this.scene.cameras.main.height * 2,
            0x000000,
            0.85
        );
        overlay.setInteractive();
        this.container.add(overlay);

        // Terminal panel (dark green CRT style)
        const panelWidth = 600;
        const panelHeight = 500;
        const panel = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x0a1a0a);
        panel.setStrokeStyle(4, 0x00ff00);
        this.container.add(panel);

        // Terminal header
        const header = this.scene.add.rectangle(0, -panelHeight / 2 + 25, panelWidth - 4, 48, 0x002200);
        this.container.add(header);

        const title = this.scene.add.text(-panelWidth / 2 + 20, -panelHeight / 2 + 15, "TERMINAL v2.1 - PROTECTOR ACCESS", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: "#00ff00",
        });
        this.container.add(title);

        // Close button
        this.createCloseButton(panelWidth, panelHeight);

        // Output area
        const outputAreaY = -panelHeight / 2 + 70;
        const outputAreaHeight = 280;

        const outputBg = this.scene.add.rectangle(0, outputAreaY + outputAreaHeight / 2, panelWidth - 40, outputAreaHeight, 0x001100);
        outputBg.setStrokeStyle(1, 0x004400);
        this.container.add(outputBg);

        // Output container (for scrolling text)
        this.outputContainer = this.scene.add.container(0, outputAreaY + 10);
        this.container.add(this.outputContainer);

        // Create mask for output area - fixed to camera like the container
        const maskShape = this.scene.make.graphics({ x: centerX, y: centerY });
        maskShape.setScrollFactor(0);
        maskShape.fillRect(-panelWidth / 2 + 20, outputAreaY, panelWidth - 40, outputAreaHeight);
        const mask = maskShape.createGeometryMask();
        this.outputContainer.setMask(mask);

        // Command to type
        const commandY = outputAreaY + outputAreaHeight + 30;
        const commandLabel = this.scene.add.text(-panelWidth / 2 + 30, commandY, "COMMANDE:", {
            fontFamily: "Courier New, monospace",
            fontSize: "14px",
            color: "#888888",
        });
        this.container.add(commandLabel);

        this.commandText = this.scene.add.text(-panelWidth / 2 + 130, commandY, this.state?.currentCommand || "", {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#ffff00",
        });
        this.container.add(this.commandText);

        // Reward display (right side)
        this.rewardText = this.scene.add.text(panelWidth / 2 - 30, commandY, `+${this.state?.resourceReward || 0}`, {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#48bb78",
        }).setOrigin(1, 0);
        this.container.add(this.rewardText);

        // Input area
        const inputY = commandY + 40;
        const inputBg = this.scene.add.rectangle(0, inputY, panelWidth - 40, 35, 0x002200);
        inputBg.setStrokeStyle(2, 0x00ff00);
        this.container.add(inputBg);

        const prompt = this.scene.add.text(-panelWidth / 2 + 30, inputY - 8, ">", {
            fontFamily: "Courier New, monospace",
            fontSize: "20px",
            color: "#00ff00",
        });
        this.container.add(prompt);

        this.inputText = this.scene.add.text(-panelWidth / 2 + 50, inputY - 8, "", {
            fontFamily: "Courier New, monospace",
            fontSize: "18px",
            color: "#00ff00",
        });
        this.container.add(this.inputText);

        // Blinking cursor
        this.cursor = this.scene.add.rectangle(-panelWidth / 2 + 50, inputY, 10, 20, 0x00ff00);
        this.container.add(this.cursor);
        this.cursorTween = this.scene.tweens.add({
            targets: this.cursor,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1,
        });

        // Status text
        const statusY = inputY + 40;
        this.statusText = this.scene.add.text(0, statusY, "Tapez la commande ci-dessus et appuyez sur Entrée", {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: "#888888",
        }).setOrigin(0.5);
        this.container.add(this.statusText);

        // Initial output
        this.addOutput("Système initialisé...", false);
        this.addOutput("En attente de commande...", false);
        this.addOutput("", false);

        // Entrance animation
        this.container.setScale(0.9);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: "Power2",
        });

        this.phase = "typing";

        // Notify that terminal is opened (to disable movements)
        EventBus.emit("terminal-opened");
    }

    /**
     * Create close button
     */
    private createCloseButton(panelWidth: number, panelHeight: number): void {
        if (!this.container) return;

        const closeBtn = this.scene.add.container(panelWidth / 2 - 25, -panelHeight / 2 + 25);

        const bg = this.scene.add.circle(0, 0, 15, 0x880000);
        bg.setStrokeStyle(2, 0xff0000);
        const text = this.scene.add.text(0, 0, "X", {
            fontFamily: "Courier New, monospace",
            fontSize: "16px",
            color: "#ff0000",
        }).setOrigin(0.5);

        closeBtn.add([bg, text]);
        this.container.add(closeBtn);

        bg.setInteractive({ useHandCursor: true });
        bg.on("pointerover", () => bg.setScale(1.1));
        bg.on("pointerout", () => bg.setScale(1));
        bg.on("pointerdown", () => this.hideUI());
    }

    /**
     * Setup keyboard input
     */
    private setupKeyboardInput(): void {
        this.keyboardListener = (event: KeyboardEvent) => {
            if (this.phase !== "typing") return;

            if (event.key === "Enter") {
                this.submitCommand();
            } else if (event.key === "Backspace") {
                this.currentInput = this.currentInput.slice(0, -1);
                this.updateInputDisplay();
            } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
                // Accept lowercase letters and spaces for multi-word commands
                const char = event.key.toLowerCase();
                if (/[a-z ]/.test(char)) {
                    // Prevent multiple consecutive spaces
                    if (char === " " && this.currentInput.endsWith(" ")) {
                        return;
                    }
                    this.currentInput += char;
                    this.updateInputDisplay();
                }
            }
        };

        window.addEventListener("keydown", this.keyboardListener);
    }

    /**
     * Update the input display
     */
    private updateInputDisplay(): void {
        if (!this.inputText || !this.cursor) return;

        this.inputText.setText(this.currentInput);

        // Move cursor to end of text
        const textWidth = this.inputText.width;
        this.cursor.x = this.inputText.x + textWidth + 5;

        // Highlight matching characters
        if (this.state) {
            const cmd = this.state.currentCommand;
            let color = "#00ff00"; // Green for correct

            for (let i = 0; i < this.currentInput.length; i++) {
                if (i >= cmd.length || this.currentInput[i] !== cmd[i]) {
                    color = "#ff0000"; // Red if wrong
                    break;
                }
            }

            this.inputText.setColor(color);
        }
    }

    /**
     * Submit the current command
     */
    private submitCommand(): void {
        if (!this.state || this.phase !== "typing") return;

        const input = this.currentInput.toLowerCase().trim();
        const expected = this.state.currentCommand.toLowerCase();

        this.addOutput(`> ${input}`, false);

        if (input === expected) {
            this.onCommandSuccess();
        } else {
            this.onCommandFail();
        }
    }

    /**
     * Handle successful command
     */
    private onCommandSuccess(): void {
        if (!this.state) return;

        this.phase = "processing";
        this.addOutput("", false);
        this.addOutput("Commande acceptée. Traitement en cours...", false);

        // Generate random terminal output
        this.generateTerminalOutput(() => {
            if (!this.state) return;

            this.phase = "success";
            const reward = this.state.resourceReward;

            this.addOutput("", false);
            this.addOutput("[SUCCESS] Opération terminée avec succès!", false);
            this.addOutput(`[REWARD] +${reward} ressources`, false);

            if (this.statusText) {
                this.statusText.setText("Succès! Nouvelle commande...");
                this.statusText.setColor("#00ff00");
            }

            EventBus.emit("terminal-success", { reward });
            this.onCompleteCallback?.(reward);

            // Give a new command after success
            this.scene.time.delayedCall(1500, () => {
                this.giveNewCommand();
            });
        });
    }

    /**
     * Handle failed command
     */
    private onCommandFail(): void {
        if (!this.state) return;

        this.phase = "fail";
        this.addOutput("", false);
        this.addOutput("[ERROR] Commande non reconnue!", false);
        this.addOutput("[RETRY] Nouvelle commande générée...", false);

        if (this.statusText) {
            this.statusText.setText("Erreur! Nouvelle commande...");
            this.statusText.setColor("#ff0000");
        }

        EventBus.emit("terminal-failed");
        this.onFailCallback?.();

        // Give a new command after delay
        this.scene.time.delayedCall(1500, () => {
            this.giveNewCommand();
        });
    }

    // Terminal output colors
    private static readonly OUTPUT_COLORS = {
        normal: ["#00ff00", "#00cc00", "#33ff33"],           // Greens
        galactic: ["#aa44ff", "#ff44aa", "#44aaff", "#ffaa44"], // Purple, Pink, Cyan, Orange
        warning: ["#ffff00", "#ffcc00"],                      // Yellows
        error: ["#ff4444", "#ff6666"],                        // Reds
        info: ["#44ffff", "#66ffff"],                         // Cyans
    };

    /**
     * Generate random terminal output with some galactic characters
     */
    private generateTerminalOutput(onComplete: () => void): void {
        const numLines = 15 + Math.floor(Math.random() * 20); // 15-35 lines
        let lineIndex = 0;

        const addNextLine = () => {
            if (lineIndex >= numLines) {
                onComplete();
                return;
            }

            const useGalactic = Math.random() < 0.25; // 25% chance of galactic text
            const line = useGalactic
                ? this.generateGalacticLine()
                : this.generateNormalLine();

            // Determine color based on content type
            let colorType: "normal" | "galactic" | "warning" | "error" | "info" = "normal";
            if (useGalactic) {
                colorType = "galactic";
            } else if (line.includes("[WARN]")) {
                colorType = "warning";
            } else if (line.includes("[ERROR]") || line.includes("[FATAL]") || line.includes("overflow") || line.includes("fault") || line.includes("panic")) {
                colorType = "error";
            } else if (line.includes("[INFO]") || line.includes("[OK]")) {
                colorType = "info";
            }

            this.addOutputWithColor(line, colorType);
            lineIndex++;

            // Faster output for more dynamic feel
            this.scene.time.delayedCall(30 + Math.random() * 70, addNextLine);
        };

        addNextLine();
    }

    /**
     * Generate a normal terminal output line
     */
    private generateNormalLine(): string {
        const template = OUTPUT_TEMPLATES[Math.floor(Math.random() * OUTPUT_TEMPLATES.length)];

        return template
            .replace("{module}", this.randomWord())
            .replace("{file}", this.randomWord())
            .replace("{id}", String(Math.floor(Math.random() * 999)))
            .replace("{num}", String(Math.floor(Math.random() * 99999)))
            .replace("{port}", String(1000 + Math.floor(Math.random() * 9000)))
            .replace("{channel}", String(Math.floor(Math.random() * 16)))
            .replace("{mem}", String(Math.floor(Math.random() * 65536)))
            .replace("{thread}", String(Math.floor(Math.random() * 32)))
            .replace("{rule}", `RULE_${Math.floor(Math.random() * 100)}`)
            .replace("{packet}", `0x${this.randomHex(4)}`)
            .replace("{key}", this.randomHex(16))
            .replace("{synapse}", `SYN_${this.randomHex(4)}`)
            .replace("{path}", `N${Math.floor(Math.random() * 50)}-N${Math.floor(Math.random() * 50)}`)
            .replace("{signal}", String(Math.floor(Math.random() * 100)))
            .replace("{bandwidth}", String(Math.floor(Math.random() * 1000)))
            .replace("{process}", this.randomWord())
            .replace("{info}", this.randomWord() + " " + this.randomWord())
            .replace("{warning}", this.randomWord() + " detected")
            .replace("{command}", this.randomWord())
            .replace("{hex}", this.randomHex(8))
            .replace("{data}", this.randomHex(12))
            .replace("{state}", ["STABLE", "FLUCTUATING", "ENTANGLED", "COLLAPSED"][Math.floor(Math.random() * 4)])
            .replace("{percent}", String(Math.floor(Math.random() * 100)))
            .replace("{latency}", String(Math.floor(Math.random() * 500)))
            .replace("{rate}", String(Math.floor(Math.random() * 10000)))
            .replace("{response}", ["POSITIVE", "NEGATIVE", "NEUTRAL", "INHIBITED"][Math.floor(Math.random() * 4)])
            .replace("{index}", (Math.random() * 2).toFixed(3))
            .replace("{load}", String(Math.floor(Math.random() * 100)))
            .replace("{fragment}", this.randomHex(8))
            .replace("{pid}", String(Math.floor(Math.random() * 65535)))
            .replace("{trace}", `0x${this.randomHex(8)}`)
            .replace("{heap}", String(Math.floor(Math.random() * 262144)))
            .replace("{ratio}", String(Math.floor(Math.random() * 100)))
            .replace("{io}", this.randomWord())
            .replace("{sector}", String(Math.floor(Math.random() * 999999)))
            .replace("{syscall}", this.randomWord())
            .replace("{driver}", this.randomWord())
            .replace("{irq}", String(Math.floor(Math.random() * 16)))
            .replace("{dma}", `CH${Math.floor(Math.random() * 8)}`)
            .replace("{pci}", `${Math.floor(Math.random() * 16)}:${Math.floor(Math.random() * 32)}.${Math.floor(Math.random() * 8)}`)
            .replace("{usb}", `EP${Math.floor(Math.random() * 16)}`)
            .replace("{nic}", `eth${Math.floor(Math.random() * 4)}`)
            .replace("{arp}", `${this.randomIP()} -> ${this.randomMAC()}`)
            .replace("{dns}", `${this.randomWord()}.neural.net`)
            .replace("{tcp}", `${this.randomIP()}:${Math.floor(Math.random() * 65535)}`)
            .replace("{udp}", `${this.randomIP()}:${Math.floor(Math.random() * 65535)}`)
            .replace("{icmp}", `${this.randomIP()} ttl=${Math.floor(Math.random() * 128)}`)
            .replace("{tls}", ["TLS1.2", "TLS1.3"][Math.floor(Math.random() * 2)])
            .replace("{cert}", this.randomHex(16))
            .replace("{token}", this.randomHex(32))
            .replace("{auth}", ["GRANTED", "PENDING", "VERIFIED"][Math.floor(Math.random() * 3)])
            .replace("{perm}", ["READ", "WRITE", "EXECUTE", "ADMIN"][Math.floor(Math.random() * 4)])
            .replace("{ip}", this.randomIP());
    }

    /**
     * Generate random IP address
     */
    private randomIP(): string {
        return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    }

    /**
     * Generate random MAC address
     */
    private randomMAC(): string {
        const hex = () => this.randomHex(2);
        return `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
    }

    /**
     * Generate a line with galactic/enchanting table characters
     */
    private generateGalacticLine(): string {
        const length = 20 + Math.floor(Math.random() * 30);
        let line = "";

        for (let i = 0; i < length; i++) {
            if (Math.random() < 0.1) {
                line += " ";
            } else {
                line += GALACTIC_CHARS[Math.floor(Math.random() * GALACTIC_CHARS.length)];
            }
        }

        return line;
    }

    /**
     * Generate a random word
     */
    private randomWord(): string {
        const words = [
            "system", "core", "neural", "synapse", "network", "data",
            "process", "thread", "buffer", "cache", "memory", "signal",
            "firewall", "proxy", "socket", "stream", "handler", "module",
            "kernel", "driver", "service", "daemon", "protocol", "cipher"
        ];
        return words[Math.floor(Math.random() * words.length)];
    }

    /**
     * Generate random hex string
     */
    private randomHex(length: number): string {
        const chars = "0123456789ABCDEF";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }

    /**
     * Add a line to the terminal output (legacy method for compatibility)
     */
    private addOutput(text: string, isGalactic: boolean): void {
        this.addOutputWithColor(text, isGalactic ? "galactic" : "normal");
    }

    /**
     * Add a line to the terminal output with specific color type
     */
    private addOutputWithColor(text: string, colorType: "normal" | "galactic" | "warning" | "error" | "info"): void {
        if (!this.outputContainer) return;

        const colors = TerminalManager.OUTPUT_COLORS[colorType];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const y = this.outputTexts.length * 18;

        const textObj = this.scene.add.text(-270, y, text, {
            fontFamily: "Courier New, monospace",
            fontSize: "12px",
            color: color,
        });

        this.outputTexts.push(textObj);
        this.outputContainer.add(textObj);

        // Auto-scroll if too many lines
        if (this.outputTexts.length > this.maxOutputLines) {
            const scrollAmount = (this.outputTexts.length - this.maxOutputLines) * 18;
            this.outputContainer.y = -70 + 10 - scrollAmount;
        }
    }

    /**
     * Give a new command after a failed attempt
     */
    private giveNewCommand(): void {
        if (!this.state) return;

        const newCommand = this.getRandomCommand();
        this.state.currentCommand = newCommand.cmd;
        this.state.resourceReward = this.calculateRewardFromCommand(newCommand.cmd);

        this.currentInput = "";
        this.updateInputDisplay();

        if (this.commandText) {
            this.commandText.setText(this.state.currentCommand);
        }
        if (this.rewardText) {
            this.rewardText.setText(`+${this.state.resourceReward}`);
        }
        if (this.statusText) {
            this.statusText.setText("Tapez la commande et appuyez sur Entrée");
            this.statusText.setColor("#888888");
        }

        this.addOutput("", false);
        this.addOutput("Nouvelle commande assignée...", false);
        this.addOutput("En attente de saisie...", false);

        this.phase = "typing";
    }

    /**
     * Hide the UI
     */
    hideUI(): void {
        if (!this.container) return;

        this.removeKeyboardInput();

        this.scene.tweens.add({
            targets: this.container,
            scale: 0.9,
            alpha: 0,
            duration: 150,
            onComplete: () => {
                this.cleanup();
                // Notify that terminal is closed (to re-enable movements)
                EventBus.emit("terminal-closed");
            },
        });
    }

    /**
     * Remove keyboard input listener
     */
    private removeKeyboardInput(): void {
        if (this.keyboardListener) {
            window.removeEventListener("keydown", this.keyboardListener);
            this.keyboardListener = undefined;
        }
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        this.removeKeyboardInput();
        this.cursorTween?.stop();
        this.outputTexts = [];
        this.container?.destroy();
        this.container = undefined;
        this.outputContainer = undefined;
        this.state = null;
        this.phase = "idle";
        this.currentInput = "";
    }

    /**
     * Check if game is active
     */
    isActive(): boolean {
        return this.state?.isActive || false;
    }

    /**
     * Set callbacks
     */
    onComplete(callback: (resourcesEarned: number) => void): void {
        this.onCompleteCallback = callback;
    }

    onGameFail(callback: () => void): void {
        this.onFailCallback = callback;
    }

    /**
     * Destroy the manager
     */
    destroy(): void {
        this.cleanup();
    }
}
