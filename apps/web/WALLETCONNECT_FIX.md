# Fix: WalletConnect "The source has not been authorized yet"

## Problème

Erreur dans Sentry :
```
The source https://app-swappilot.xyz/ has not been authorized yet
```

## Cause

Le domaine `app-swappilot.xyz` n'est pas dans la liste des origines autorisées (allowlist) dans WalletConnect Cloud.

## Solution (5 minutes)

### 1. Accède au dashboard WalletConnect

Ouvre : **https://cloud.walletconnect.com/app**

### 2. Connecte-toi et sélectionne ton projet

- Si tu n'as pas de compte : crée-en un (gratuit)
- Si tu as déjà un projet SwapPilot : sélectionne-le
- Sinon, crée un nouveau projet (note le `PROJECT_ID`)

### 3. Configure les origines autorisées

Dans les paramètres du projet :
1. Cherche **"Allowlist"** ou **"Allowed Origins"**
2. Ajoute ces origines :
   ```
   https://app-swappilot.xyz
   http://localhost:3000
   http://127.0.0.1:3000
   ```
3. Sauvegarde

> **Note** : Les changements prennent jusqu'à **15 minutes** pour s'appliquer.

### 4. Configure la variable d'environnement (si manquante)

Si `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` n'est pas défini dans Vercel/Fly.io :

**Vercel** :
```bash
Settings → Environment Variables
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=TON_PROJECT_ID_ICI
```

**Fly.io** (apps/web) :
```bash
fly secrets set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=TON_PROJECT_ID_ICI -a swappilot-web
```

**Local (.env.local)** :
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=TON_PROJECT_ID_ICI
```

### 5. Redéploie

- **Vercel** : Push sur GitHub (auto-deploy)
- **Fly.io** : `fly deploy -a swappilot-web`

## Vérification

1. Ouvre https://app-swappilot.xyz/swap
2. Ouvre DevTools → Console
3. Clique sur "Connect Wallet" → sélectionne "WalletConnect"
4. L'erreur ne devrait plus apparaître dans Sentry

## Ressources

- Dashboard : https://cloud.walletconnect.com/app
- Docs : https://docs.walletconnect.network/
