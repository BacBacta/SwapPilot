# Referral + Ownership Runbook (BSC Mainnet)

## 0) Prérequis

- Être dans `contracts/`
- Avoir un wallet deployer qui contrôle `FeeCollector.owner()`
- Avoir l'adresse du Safe cible

## 1) Préparer l'environnement

Créer/mettre à jour `contracts/.env`:

```dotenv
DEPLOYER_PRIVATE_KEY=<private_key_without_0x>
BSCSCAN_API_KEY=<optional>

NEW_OWNER_ADDRESS=<safe_address_0x...>
PILOT_TOKEN_ADDRESS=0xe3f77E20226fdc7BA85E495158615dEF83b48192
FEE_COLLECTOR_ADDRESS=0xEe841Def61326C116F92e71FceF8cb11FBC05034
REFERRAL_REWARDS_ADDRESS=

# Optional legacy only (keep empty unless intentionally using legacy pool)
LEGACY_REFERRAL_POOL_ADDRESS=
```

## 2) Vérifier l'état actuel on-chain

```bash
cd contracts
pnpm check:ownership
```

Attendu:
- `PILOTToken` owner = `0x000...000` (renoncé, non transférable)
- `FeeCollector` owner = wallet deployer actuel
- `ReferralRewards` sera `skipped` tant que non déployé

## 3) Déployer ReferralRewards (architecture active)

```bash
cd contracts
pnpm deploy:referral:rewards:bsc
```

Récupérer l'adresse affichée `ReferralRewards deployed to: 0x...`.

Mettre à jour ensuite `REFERRAL_REWARDS_ADDRESS` dans `contracts/.env`.

## 4) (Optionnel) Vérifier le contrat sur BscScan

```bash
cd contracts
pnpm verify --network bsc <REFERRAL_REWARDS_ADDRESS> 0xe3f77E20226fdc7BA85E495158615dEF83b48192
```

## 5) Provisionner ReferralRewards en PILOT

Transférer 50,000,000 PILOT vers `REFERRAL_REWARDS_ADDRESS` depuis le wallet détenteur des tokens.

Valeur brute (18 décimales):

```text
50000000000000000000000000
```

## 6) Configurer les distributeurs (API backend)

Depuis le owner de `ReferralRewards`, appeler:

```solidity
setDistributor(<api_backend_address>, true)
```

(à faire via BscScan Write Contract ou script dédié interne)

## 7) Re-vérifier l'ownership après déploiement referral

```bash
cd contracts
pnpm check:ownership
```

Attendu:
- `ReferralRewards` lisible avec un owner valide
- `FeeCollector` inchangé

## 8) Transférer l'ownership vers le Safe (immédiat)

```bash
cd contracts
pnpm transfer:ownership
```

Le script:
- soumet `transferOwnership(newOwner)` sur les contrats où le signer est owner
- imprime les payloads Safe `acceptOwnership()` pour les contrats `Ownable2Step`

## 9) Exécuter les tx Safe `acceptOwnership()`

Pour chaque contrat affiché par le script:
- `to`: adresse du contrat
- `value`: `0`
- `data`: calldata `acceptOwnership()`

Soumettre ces transactions dans l'UI Safe.

## 10) Vérification finale

```bash
cd contracts
pnpm check:ownership
```

Attendu:
- `FeeCollector.owner()` = `NEW_OWNER_ADDRESS`
- `ReferralRewards.owner()` = `NEW_OWNER_ADDRESS`
- `PILOTToken` reste `0x000...000`

## 11) Notes de sécurité

- `LEGACY_REFERRAL_POOL_ADDRESS` reste vide sauf besoin explicite du flux legacy BNB.
- Ne jamais committer de secrets (`DEPLOYER_PRIVATE_KEY`) dans le repo.
- Exécuter toutes les étapes en BSC mainnet uniquement si les adresses ont été revalidées avant chaque transaction.
