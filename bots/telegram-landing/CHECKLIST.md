# Checklist de mise en production

Coche chaque étape au fur et à mesure.

## Sécurité (OBLIGATOIRE)

- [ ] Révoque le token exposé via [@BotFather](https://t.me/BotFather) :
  - Envoie `/revoke`
  - Sélectionne ton bot
  - Confirme
- [ ] Génère un nouveau token :
  - Envoie `/newtoken` à BotFather
  - Copie le nouveau token

## Configuration locale

- [ ] Crée `.env` propre en UTF-8 :
  ```powershell
  cd "C:\Users\Oxfam\Downloads\SwapPilot-main\SwapPilot-main\SwapPilot\bots\telegram-landing"
  
  .\setup-env.ps1 -BotToken "TON_NOUVEAU_TOKEN" -ChannelUsername "SwapPilot_Official"
  ```

- [ ] Teste en local :
  ```powershell
  .\.venv\Scripts\python.exe .\swappilot_bot.py
  ```

- [ ] Ouvre `t.me/TON_BOT?start=test` et vérifie que tu vois le message d'accueil

## Configuration Telegram (OBLIGATOIRE pour Verify)

- [ ] Ajoute le bot comme **admin du canal** :
  1. Ouvre ton canal (@SwapPilot_Official) sur Telegram
  2. Menu → Administrateurs → Ajouter un administrateur
  3. Recherche ton bot
  4. Accorde uniquement : **"Voir les messages"**
  5. Enregistre

- [ ] (Optionnel) Si tu veux vérifier le groupe, ajoute aussi le bot comme membre/admin du groupe

- [ ] Teste "Verify" :
  - Rejoins le canal
  - Clique "Verify" dans le bot
  - Tu dois voir ✅ pour le canal

## Déploiement H24 (choisis UNE option)

### Option A : Fly.io (recommandé, gratuit)

- [ ] Installe flyctl : https://fly.io/docs/hands-on/install-flyctl/
- [ ] Login :
  ```bash
  fly auth login
  ```
- [ ] Crée l'app :
  ```bash
  cd bots/telegram-landing
  fly apps create swappilot-bot
  ```
- [ ] Configure les secrets :
  ```bash
  fly secrets set BOT_TOKEN="TON_NOUVEAU_TOKEN" CHANNEL_USERNAME="SwapPilot_Official"
  ```
- [ ] Déploie :
  ```bash
  fly deploy
  ```
- [ ] Vérifie les logs :
  ```bash
  fly logs
  ```

### Option B : VPS (DigitalOcean, Hetzner, etc.)

- [ ] SSH vers ton VPS
- [ ] Clone le repo :
  ```bash
  git clone https://github.com/BacBacta/SwapPilot.git
  cd SwapPilot/bots/telegram-landing
  ```
- [ ] Setup Python :
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
- [ ] Crée `.env` :
  ```bash
  nano .env
  # (colle BOT_TOKEN=... et CHANNEL_USERNAME=...)
  ```
- [ ] Teste :
  ```bash
  python swappilot_bot.py
  ```
- [ ] Daemonize (systemd) — voir DEPLOYMENT.md

## Campagnes Ads

- [ ] Crée un lien test : `t.me/TON_BOT?start=test_001`
- [ ] Teste le funnel complet (start → tap channel → verify)
- [ ] Vérifie dans `swappilot.db` que les événements sont loggés
- [ ] Lance ta première campagne Telegram Ads avec `?start=ads_telegram_fr_v1`

## Mesure & Pilotage

- [ ] Installe DB Browser for SQLite : https://sqlitebrowser.org/
- [ ] Ouvre `swappilot.db` et vérifie la table `events`
- [ ] Lance les requêtes SQL de `analytics.sql` pour voir les conversions par campagne

## Merge dans main

- [ ] Ouvre la PR : https://github.com/BacBacta/SwapPilot/pull/new/feat/telegram-landing-bot
- [ ] Review le code
- [ ] Merge dans `main`
