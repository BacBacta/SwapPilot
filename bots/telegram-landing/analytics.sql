-- Analytics queries for Telegram Landing Bot
-- Run with: sqlite3 swappilot.db < analytics.sql
-- Or: .\.venv\Scripts\python.exe -c "import sqlite3; db=sqlite3.connect('swappilot.db'); print(db.execute(open('analytics.sql').read()).fetchall())"

-- ========================================
-- Vue d'ensemble (tous événements)
-- ========================================
SELECT 
  event,
  COUNT(*) as count
FROM events
GROUP BY event
ORDER BY count DESC;

-- ========================================
-- Funnel par campagne (conversions)
-- ========================================
SELECT 
  json_extract(meta, '$.start_param') as campaign,
  COUNT(CASE WHEN event = 'start' THEN 1 END) as starts,
  COUNT(CASE WHEN event = 'landing_shown' THEN 1 END) as landings,
  COUNT(CASE WHEN event = 'tap_channel' THEN 1 END) as taps_channel,
  COUNT(CASE WHEN event = 'tap_group' THEN 1 END) as taps_group,
  COUNT(CASE WHEN event = 'verify_click' THEN 1 END) as verify_attempts,
  COUNT(CASE WHEN event = 'verify_result' AND json_extract(meta, '$.channel') = 1 THEN 1 END) as channel_joins_verified,
  COUNT(CASE WHEN event = 'verify_result' AND json_extract(meta, '$.group') = 1 THEN 1 END) as group_joins_verified,
  ROUND(
    100.0 * COUNT(CASE WHEN event = 'verify_result' AND json_extract(meta, '$.channel') = 1 THEN 1 END) 
    / NULLIF(COUNT(CASE WHEN event = 'start' THEN 1 END), 0),
    2
  ) as conversion_rate_pct
FROM events
WHERE json_extract(meta, '$.start_param') != ''
GROUP BY campaign
ORDER BY starts DESC;

-- ========================================
-- Vérifications échouées (false negatives possibles)
-- ========================================
SELECT 
  json_extract(meta, '$.chat') as chat,
  COUNT(*) as failed_checks
FROM events
WHERE event = 'check_membership_failed'
GROUP BY chat;

-- ========================================
-- Activité par heure (dernières 24h)
-- ========================================
SELECT 
  strftime('%Y-%m-%d %H:00', ts, 'unixepoch', 'localtime') as hour,
  COUNT(*) as events
FROM events
WHERE ts > (strftime('%s', 'now') - 86400)
GROUP BY hour
ORDER BY hour DESC;

-- ========================================
-- Top 5 campagnes (par join confirmé)
-- ========================================
SELECT 
  json_extract(meta, '$.start_param') as campaign,
  COUNT(*) as verified_joins
FROM events
WHERE event = 'verify_result' 
  AND json_extract(meta, '$.channel') = 1
GROUP BY campaign
ORDER BY verified_joins DESC
LIMIT 5;
