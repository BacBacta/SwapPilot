# Déploiement du Bot Telegram Landing

## 1. Configuration initiale

### Révoque et régénère le token
1. Ouvre [@BotFather](https://t.me/BotFather) sur Telegram
2. Envoie `/revoke` et sélectionne ton bot
3. Confirme la révocation
4. Envoie `/newtoken` pour obtenir un nouveau token

### Configure l'environnement (Windows/PowerShell)
```powershell
cd bots/telegram-landing

# Option A: Script automatique
.\setup-env.ps1 -BotToken "TON_TOKEN" -ChannelUsername "SwapPilot_Official"

# Option B: Manuel
@(
  "BOT_TOKEN=TON_TOKEN"
  "CHANNEL_USERNAME=SwapPilot_Official"
) | Set-Content -Path .env -Encoding utf8
```

## 2. Ajoute le bot comme admin du canal

**Obligatoire pour que "Verify" marche correctement**

1. Ouvre ton canal Telegram (@SwapPilot_Official)
2. Menu → Administrateurs → Ajouter un administrateur
3. Recherche ton bot (@TonBot)
4. Accorde les permissions :
   - ✅ **Voir les messages** (minimum requis)
   - ❌ Tous les autres droits peuvent rester désactivés

## 3. Test en local

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python .\swappilot_bot.py
```

Ouvre : `t.me/TonBot?start=test`

Tu dois voir :
- Message d'accueil avec 3 boutons
- "Verify" doit afficher ✅ après avoir rejoint le canal

## 4. Déploiement H24 (production)

### Option A : Fly.io (gratuit pour 1 bot)

```bash
# Install flyctl
# https://fly.io/docs/hands-on/install-flyctl/

cd bots/telegram-landing

# Login
fly auth login

# Create app
fly apps create swappilot-bot

# Set secrets
fly secrets set BOT_TOKEN="..." CHANNEL_USERNAME="SwapPilot_Official"

# Deploy
fly deploy
```

**Procfile** (à créer) :
```
worker: python swappilot_bot.py
```

**fly.toml** (à créer) :
```toml
app = "swappilot-bot"

[build]
  builder = "paketobuildpacks/builder:base"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20
```

### Option B : VPS (DigitalOcean, Hetzner, etc.)

```bash
# Sur le VPS (Ubuntu/Debian)
sudo apt update && sudo apt install python3 python3-pip python3-venv

# Clone repo
git clone https://github.com/BacBacta/SwapPilot.git
cd SwapPilot/bots/telegram-landing

# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure .env
nano .env
# (colle BOT_TOKEN=... et CHANNEL_USERNAME=...)

# Test
python swappilot_bot.py

# Daemonize with systemd
sudo nano /etc/systemd/system/swappilot-bot.service
```

**Service systemd** :
```ini
[Unit]
Description=SwapPilot Telegram Landing Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/SwapPilot/bots/telegram-landing
Environment="PATH=/home/ubuntu/SwapPilot/bots/telegram-landing/.venv/bin"
ExecStart=/home/ubuntu/SwapPilot/bots/telegram-landing/.venv/bin/python swappilot_bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable swappilot-bot
sudo systemctl start swappilot-bot
sudo systemctl status swappilot-bot
```

## 5. Campagnes Telegram Ads

### Format des liens
```
t.me/TonBot?start=ads_A1
t.me/TonBot?start=ads_meta_fr_v1
t.me/TonBot?start=kol_cryptotwitter
```

Le `start=...` est loggé dans `swappilot.db` → table `events` (colonne `meta`)

### Exemples de structure
- `ads_SOURCE_COUNTRY_CAMPAIGN_VERSION`
- `ads_telegram_fr_A1_v1`
- `ads_meta_us_lookalike_v2`
- `partner_KOLNAME`

## 6. Mesure des conversions

### Consulter la DB (local)
```powershell
# Install DB Browser for SQLite
# https://sqlitebrowser.org/

# Ou via PowerShell
.\.venv\Scripts\python.exe -c "import sqlite3; db=sqlite3.connect('swappilot.db'); print(db.execute('SELECT event, count(*) FROM events GROUP BY event').fetchall())"
```

### Requête SQL : conversions par campagne
```sql
SELECT 
  json_extract(meta, '$.start_param') as campaign,
  COUNT(CASE WHEN event = 'start' THEN 1 END) as starts,
  COUNT(CASE WHEN event = 'tap_channel' THEN 1 END) as taps_channel,
  COUNT(CASE WHEN event = 'verify_click' THEN 1 END) as verify_attempts,
  COUNT(CASE WHEN event = 'verify_result' AND json_extract(meta, '$.channel') = 1 THEN 1 END) as channel_joins
FROM events
WHERE json_extract(meta, '$.start_param') != ''
GROUP BY campaign
ORDER BY starts DESC;
```

## 7. Monitoring

### Logs (Fly.io)
```bash
fly logs
```

### Logs (VPS systemd)
```bash
sudo journalctl -u swappilot-bot -f
```

### Health check
Le bot log `getUpdates` toutes les ~10s → si tu ne vois aucun log pendant >30s, il est probablement crashé.
