## Telegram Landing Bot (SwapPilot)

Ce bot sert de **landing page Telegram** pour les publicités : Telegram Ads accepte une destination **bot/canal**, mais pas directement **un groupe**. Le bot redirige donc vers ton **canal** (objectif #1) et optionnellement vers ton **groupe**, tout en loggant un funnel simple dans SQLite.

### Où est stocké le code ?

Dans le repo SwapPilot, ici :

- `bots/telegram-landing/swappilot_bot.py`
- `bots/telegram-landing/requirements.txt`
- `bots/telegram-landing/.env.example`

### Setup (Windows / PowerShell)

Depuis la racine du repo :

```powershell
cd bots/telegram-landing
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
notepad .env
python .\swappilot_bot.py
```

### Variables d’environnement

- `BOT_TOKEN` (**obligatoire**)
- `CHANNEL_USERNAME` (**obligatoire**, sauf si tu fournis `CHANNEL_CHAT_ID`)
- `CHANNEL_CHAT_ID` (optionnel, recommandé si tu veux éviter les soucis de username)
- `GROUP_USERNAME` (optionnel)
- `GROUP_INVITE_LINK` (optionnel, pour un groupe privé)
- `GROUP_CHAT_ID` (optionnel, recommandé si tu veux une vraie vérif du groupe privé)
- `DB_PATH` (optionnel, défaut `swappilot.db`)

### Notes importantes (vérification)

- **Canal** : pour que `get_chat_member` soit fiable, le bot doit souvent être **admin** du canal.
- **Groupe privé** : un simple lien d’invite ne suffit pas pour auto-vérifier — il faut idéalement `GROUP_CHAT_ID` + bot présent dans le groupe.

