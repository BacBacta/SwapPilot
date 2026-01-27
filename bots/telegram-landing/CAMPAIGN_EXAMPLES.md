# Exemples de liens campagne

## Format recommandé
```
t.me/TON_BOT?start=CAMPAIGN_ID
```

`CAMPAIGN_ID` apparaîtra dans la colonne `meta` de la table `events` (clé `start_param`).

## Exemples par source

### Telegram Ads
```
t.me/SwapPilotBot?start=ads_telegram_fr_A1
t.me/SwapPilotBot?start=ads_telegram_us_lookalike_v2
t.me/SwapPilotBot?start=ads_telegram_crypto_retarget
```

### Meta (Facebook/Instagram)
```
t.me/SwapPilotBot?start=ads_meta_fr_defi_v1
t.me/SwapPilotBot?start=ads_insta_us_carousel_v3
```

### Twitter (X)
```
t.me/SwapPilotBot?start=ads_x_sponsored_crypto
```

### Partenariats KOL
```
t.me/SwapPilotBot?start=kol_cryptoinfluencer
t.me/SwapPilotBot?start=partner_defi_channel_xyz
```

### Tweets / Posts organiques
```
t.me/SwapPilotBot?start=organic_twitter_announce
t.me/SwapPilotBot?start=reddit_defi_post
```

## Convention de nommage suggérée

```
<source>_<geo>_<audience>_<version>
```

**Exemples :**
- `ads_telegram_fr_defi_v1`
- `kol_cryptowhale_promo`
- `organic_reddit_bnb`

## Test d'une campagne (local)

```powershell
# Génère un lien
$botUsername = "SwapPilotBot"  # Remplace par ton bot
$campaign = "test_local_001"
$link = "https://t.me/$botUsername?start=$campaign"

Write-Host "Test link: $link" -ForegroundColor Green
Start-Process $link

# Vérifie dans la DB
.\.venv\Scripts\python.exe -c @"
import sqlite3, json
db = sqlite3.connect('swappilot.db')
rows = db.execute(\"SELECT event, meta FROM events WHERE meta LIKE '%$campaign%' ORDER BY ts DESC LIMIT 5\").fetchall()
for r in rows: print(f'{r[0]:20s} {json.loads(r[1])}')
"@
```

## Tracking côté Telegram Ads

Quand tu crées une pub sur Telegram Ads, utilise **des liens différents par variante** pour mesurer quelle créa convertit le mieux :

- Variante A (image statique) : `?start=ads_tg_A1_static`
- Variante B (carrousel) : `?start=ads_tg_A1_carousel`
- Variante C (vidéo) : `?start=ads_tg_A1_video`

Ensuite compare dans la DB :

```sql
SELECT 
  json_extract(meta, '$.start_param') as campaign,
  COUNT(*) as conversions
FROM events
WHERE event = 'verify_result' 
  AND json_extract(meta, '$.channel') = 1
  AND json_extract(meta, '$.start_param') LIKE 'ads_tg_A1_%'
GROUP BY campaign;
```
