# ⚠️ RISQUES & PLAN DE CONTINGENCE

---

## 1️⃣ MATRICE DES RISQUES

| Risque | Probabilité | Impact | Score | Priorité |
|--------|-------------|--------|-------|----------|
| Bots/Farmers | Élevée | Moyen | 6 | 🔴 Haute |
| Faible participation | Moyenne | Élevé | 6 | 🔴 Haute |
| Handle Twitter invalide | Moyenne | Élevé | 6 | 🔴 Haute |
| App down | Faible | Élevé | 4 | 🟡 Moyenne |
| KOLs non réactifs | Moyenne | Moyen | 4 | 🟡 Moyenne |
| Budget dépassé | Faible | Moyen | 3 | 🟢 Basse |
| Concurrence | Moyenne | Faible | 3 | 🟢 Basse |

---

## 2️⃣ RISQUES & MITIGATIONS DÉTAILLÉES

### 🔴 RISQUE 1: Bots & Farmers

**Description:** Des bots ou "farmers" complètent les quests sans réel intérêt pour le projet, diluant la qualité de la communauté.

**Signes d'alerte:**
- Comptes Twitter < 30 jours
- 0 followers, 0 tweets
- Patterns de completion identiques
- Adresses wallet répétées

**Mitigation:**
| Action | Quand | Responsable |
|--------|-------|-------------|
| Quiz obligatoires | Toujours | Zealy config |
| Vérification manuelle top 100 | J7, J14, J21 | CM |
| Screenshot quests | Quests produit | Manuel |
| Minimum XP pour WL | Toujours | Règles |
| Blacklist adresses suspectes | Au cas par cas | Admin |

**Plan de contingence:**
- Si >20% suspects → Ajouter vérification captcha
- Si >30% suspects → Pause campagne, nettoyage

---

### 🔴 RISQUE 2: Faible Participation

**Description:** Le nombre de participants n'atteint pas les objectifs.

**Signes d'alerte:**
- <100 nouveaux/jour après J3
- Croissance < 10%/semaine
- Engagement Twitter < 0.5%

**Mitigation:**
| Action | Quand | Responsable |
|--------|-------|-------------|
| Budget KOL augmenté | Si alerte J5 | Marketing |
| Giveaway supplémentaire | Si alerte J7 | Marketing |
| Cross-promo partenaires | J10+ | BD |
| Boost payant Twitter | Si budget permet | Marketing |

**Plan de contingence:**
- Si <1,000 à J7 → Doubler budget KOL
- Si <2,500 à J14 → Giveaway exceptionnel $100
- Si <4,000 à J21 → Ajuster objectifs presale

---

### 🔴 RISQUE 3: Handle Twitter Invalide

**Description:** Galxe/Zealy ne reconnaissent pas le handle Twitter.

**Signes d'alerte:**
- Erreur "Twitter doesn't exist" sur Galxe
- Quests Twitter échouent

**Mitigation:**
| Action | Quand | Responsable |
|--------|-------|-------------|
| Vérifier handle avant lancement | J-1 | CM |
| Avoir compte backup | J-2 | CM |
| Tester toutes les intégrations | J-1 | Tech |

**Plan de contingence:**
- Si handle invalide → Créer nouveau compte immédiatement
- Si délai création → Lancer sans quests Twitter J1, ajouter J2-3

---

### 🟡 RISQUE 4: App Down

**Description:** L'app SwapPilot est inaccessible pendant la campagne.

**Signes d'alerte:**
- Erreurs 500/503
- Plaintes communauté

**Mitigation:**
| Action | Quand | Responsable |
|--------|-------|-------------|
| Monitoring uptime | Continu | Dev |
| Page status publique | Toujours | Dev |
| Communication proactive | Si down | CM |

**Plan de contingence:**
- Si down <2h → Communication TG "maintenance"
- Si down >2h → Pause quests screenshot, extension deadline
- Si down >24h → Refaire calendrier

---

### 🟡 RISQUE 5: KOLs Non Réactifs

**Description:** Les KOLs ne répondent pas ou annulent.

**Mitigation:**
| Action | Quand | Responsable |
|--------|-------|-------------|
| Contacter 3x plus de KOLs | J4 | Marketing |
| Follow-up après 48h | Systématique | Marketing |
| Liste de backup | Toujours | Marketing |
| Paiement après post | Toujours | Finance |

**Plan de contingence:**
- Si 0 KOL confirmé J7 → Augmenter offre $
- Si KOL annule → Activer backup immédiat
- Si 0 KOL disponible → Réallouer budget vers giveaways

---

### 🟢 RISQUE 6: Budget Dépassé

**Mitigation:**
| Action | Quand |
|--------|-------|
| Tracking quotidien | Toujours |
| Alertes à 50%, 75%, 90% | Automatique |
| Contingence $51 prévue | Disponible |

**Plan de contingence:**
- Si dépassement prévu → Réduire giveaway final
- Si dépassement réel → Utiliser contingence

---

## 3️⃣ PROTOCOLE DE CRISE

### Niveau 1 — Incident Mineur
- Impact: <10% de la campagne
- Exemples: Quest bug, post retardé
- Action: Fix immédiat, pas de communication publique
- Responsable: CM

### Niveau 2 — Incident Modéré
- Impact: 10-30% de la campagne
- Exemples: App down 2-6h, KOL problématique
- Action: Communication TG, ajustement calendrier
- Responsable: CM + Marketing Lead

### Niveau 3 — Incident Majeur
- Impact: >30% de la campagne
- Exemples: Hack, grosse controverse, app down >24h
- Action: Communication publique, pause campagne si nécessaire
- Responsable: Fondateur / Direction

---

## 4️⃣ COMMUNICATION DE CRISE

### Template Message (Incident Modéré)

```
📢 UPDATE

Hey Pilots!

We're experiencing [ISSUE] that's affecting [IMPACT].

What we're doing:
✅ [Action 1]
✅ [Action 2]

What this means for you:
• [Impact on quests]
• [Timeline for fix]

We'll update you in [TIMEFRAME].

Thanks for your patience! 🙏
```

### Template Message (Incident Majeur)

```
🚨 IMPORTANT ANNOUNCEMENT

Hey Pilots,

We need to address [ISSUE].

What happened:
[Brief explanation]

What we're doing:
1. [Action 1]
2. [Action 2]
3. [Action 3]

Impact on the campaign:
• [Change 1]
• [Change 2]

Next steps:
[Timeline and plan]

We apologize for any inconvenience and appreciate your understanding.

Questions? Reply below or DM us.

— SwapPilot Team
```

---

## 5️⃣ CHECKLIST ANTI-RISQUE

### Avant Lancement (J-1)
- [ ] Handle Twitter vérifié et fonctionnel
- [ ] App testée et stable
- [ ] Tous liens vérifiés
- [ ] 10+ KOLs contactés
- [ ] Budget validé
- [ ] Équipe briefée sur protocoles

### Pendant Campagne (Quotidien)
- [ ] Monitoring participants
- [ ] Vérification alertes
- [ ] Réponse aux problèmes <2h
- [ ] Budget tracking

### Points de Contrôle
- [ ] J3: Review bots/qualité
- [ ] J7: Review S1 + ajustements
- [ ] J14: Review S2 + ajustements
- [ ] J21: Snapshot + validation

---

## 6️⃣ CONTACTS D'URGENCE

| Rôle | Responsable | Contact |
|------|-------------|---------|
| CM Lead | [Nom] | [Contact] |
| Tech Lead | [Nom] | [Contact] |
| Marketing Lead | [Nom] | [Contact] |
| Fondateur | [Nom] | [Contact] |

### Escalation Path
```
CM → Marketing Lead → Fondateur
     ↘ Tech Lead (si tech issue)
```
