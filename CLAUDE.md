# CLAUDE.md — Mini-jeu React Vite (Digital Event 2026)

## Ce que tu dois savoir

Ce projet est un **mini-jeu** qui fait partie d'un escape game interactif. Il se connecte à un **backoffice gamemaster** via Socket.IO sur le réseau local (`192.168.10.1:3000`).

Tu n'as **rien à coder côté serveur**. Le serveur existe déjà sur une autre machine. Tu dois juste utiliser le SDK client fourni (`gamemaster-client.ts`).

## Stack

- React + Vite + TypeScript
- Socket.IO client (via le SDK fourni)

## Setup

```bash
npm add socket.io-client
```

Placer `gamemaster-client.ts` dans `src/`. L'importer avec :

```tsx
import { gamemaster } from "./gamemaster-client";
```

## Le SDK : `gamemaster-client.ts`

### `gamemaster.register(gameId, name, availableActions)`

Appeler **une seule fois** dans un `useEffect([], [])` du composant principal.

```tsx
useEffect(() => {
  gamemaster.register("mon-jeu", "Mon Jeu", [
    { id: "reset", label: "Réinitialiser" },
    { id: "hint", label: "Indice", params: ["level"] },
  ]);
}, []);
```

### `gamemaster.onCommand(callback)`

Écoute les commandes envoyées depuis le backoffice.

```tsx
gamemaster.onCommand(({ action, payload }) => {
  if (action === "reset") resetGame();
  if (action === "hint") showHint(payload.level as number);
});
```

### `gamemaster.updateState(state)`

Envoie l'état courant du jeu au backoffice.

```tsx
gamemaster.updateState({ solved: true, score: 100 });
```

### `gamemaster.sendEvent(name, data)`

Envoie un événement ponctuel au backoffice.

```tsx
gamemaster.sendEvent("game_won", { time: 45 });
```

### `gamemaster.onConnect(callback)` / `gamemaster.onDisconnect(callback)`

Pour réagir à la connexion/déconnexion.

## Pattern complet dans React Vite

```tsx
import { useEffect, useState } from "react";
import { gamemaster } from "./gamemaster-client";

function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 1. Register
    gamemaster.register("mon-jeu", "Mon Jeu", [
      { id: "reset", label: "Reset" },
    ]);

    // 2. Connexion
    gamemaster.onConnect(() => setConnected(true));
    gamemaster.onDisconnect(() => setConnected(false));

    // 3. Commandes
    gamemaster.onCommand(({ action, payload }) => {
      // Traiter la commande
    });
  }, []);

  return <div>{connected ? "🟢" : "🔴"} Mon Jeu</div>;
}

export default App;
```

## Règles importantes

1. **Un seul `register()`** dans un `useEffect([], [])`
2. **`availableActions`** = les boutons du gamemaster dans le dashboard
3. **`updateState()`** à chaque changement d'état significatif
4. **`sendEvent()`** pour les moments clés (victoire, blocage)
5. Le `gameId` doit être **unique** par mini-jeu sur le réseau
6. IP backoffice : `192.168.10.1:3000`

## Conventions

- Code en anglais
- UI en français
- Fichiers en kebab-case, composants React en PascalCase
- Package manager : npm
