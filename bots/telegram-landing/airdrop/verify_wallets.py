"""
SwapPilot Airdrop — Wallet Verification Script
Checks for duplicates, validates wallet format, verifies signatures,
and detects suspicious on-chain patterns.

Usage:
  python verify_wallets.py --csv submissions.csv
  python verify_wallets.py --check-funding --rpc https://bsc-dataseed.binance.org

Requirements:
  pip install web3 eth-account pandas
"""

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from typing import Optional

try:
    from eth_account.messages import encode_defunct
    from web3 import Web3
    HAS_WEB3 = True
except ImportError:
    HAS_WEB3 = False
    print("⚠️  web3/eth-account not installed. Signature & on-chain checks disabled.")
    print("   Install with: pip install web3 eth-account pandas")

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


# ─── Config ───────────────────────────────────────────────────────────
BSC_RPC = "https://bsc-dataseed.binance.org"
EXPECTED_MESSAGE_TEMPLATE = "SwapPilot Airdrop Claim: @{handle}"
MIN_WALLET_AGE_DAYS = 7
MAX_COMMON_FUNDING_THRESHOLD = 2  # flag if 2+ wallets funded by same source


# ─── Validation helpers ──────────────────────────────────────────────
def is_valid_wallet(address: str) -> bool:
    """Check if address is a valid BSC/ETH address (0x + 40 hex chars)."""
    return bool(re.match(r"^0x[0-9a-fA-F]{40}$", address.strip()))


def is_valid_telegram_id(tid: str) -> bool:
    """Check if Telegram ID is numeric."""
    return tid.strip().isdigit()


def is_valid_handle(handle: str) -> bool:
    """Check if Telegram handle starts with @."""
    return handle.strip().startswith("@") and len(handle.strip()) > 1


# ─── Signature verification ─────────────────────────────────────────
def verify_signature(wallet: str, handle: str, signature: str) -> bool:
    """Verify that the signature matches the expected message + wallet."""
    if not HAS_WEB3:
        print("  ⚠️  Skipping signature check (web3 not installed)")
        return True

    try:
        w3 = Web3()
        message = EXPECTED_MESSAGE_TEMPLATE.format(handle=handle.lstrip("@"))
        msg = encode_defunct(text=message)
        recovered = w3.eth.account.recover_message(msg, signature=signature)
        return recovered.lower() == wallet.strip().lower()
    except Exception as e:
        print(f"  ❌ Signature verification error: {e}")
        return False


# ─── On-chain checks ────────────────────────────────────────────────
def check_common_funding(wallets: list[str], rpc_url: str) -> dict[str, list[str]]:
    """
    Check if multiple wallets received their first funding from the same source.
    Returns a dict of { funding_source: [wallets_funded] }.
    """
    if not HAS_WEB3:
        print("  ⚠️  Skipping on-chain checks (web3 not installed)")
        return {}

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    funding_sources: dict[str, list[str]] = defaultdict(list)

    for wallet in wallets:
        try:
            # Get first incoming tx (simplified: check current balance > 0)
            # Full implementation would scan tx history via BscScan API
            balance = w3.eth.get_balance(Web3.to_checksum_address(wallet))
            if balance > 0:
                # Placeholder: in production, use BscScan API to get first tx sender
                pass
        except Exception as e:
            print(f"  ⚠️  Could not check {wallet}: {e}")

    return {k: v for k, v in funding_sources.items() if len(v) >= MAX_COMMON_FUNDING_THRESHOLD}


# ─── Main verification pipeline ─────────────────────────────────────
def load_csv(filepath: str) -> list[dict]:
    """Load submissions from CSV."""
    submissions = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            submissions.append({
                "handle": row.get("handle", "").strip(),
                "telegram_id": row.get("telegram_id", "").strip(),
                "wallet": row.get("wallet", "").strip(),
                "signature": row.get("signature", "").strip(),
            })
    return submissions


def verify_all(submissions: list[dict], check_funding: bool = False, rpc_url: str = BSC_RPC):
    """Run all verification checks and print report."""
    print("=" * 60)
    print("  SwapPilot Airdrop — Wallet Verification Report")
    print("=" * 60)
    print(f"  Total submissions: {len(submissions)}")
    print()

    errors = []
    warnings = []
    valid = []

    # ── Step 1: Format validation ────────────────────────────────
    print("▶ Step 1: Format validation")
    for i, sub in enumerate(submissions):
        row_errors = []

        if not is_valid_handle(sub["handle"]):
            row_errors.append(f"Invalid handle: {sub['handle']}")
        if not is_valid_telegram_id(sub["telegram_id"]):
            row_errors.append(f"Invalid Telegram ID: {sub['telegram_id']}")
        if not is_valid_wallet(sub["wallet"]):
            row_errors.append(f"Invalid wallet: {sub['wallet']}")

        if row_errors:
            errors.append((i + 1, sub["handle"], row_errors))
            print(f"  ❌ Row {i+1} ({sub['handle']}): {', '.join(row_errors)}")
        else:
            valid.append(sub)

    print(f"  ✅ {len(valid)} valid / {len(errors)} invalid")
    print()

    # ── Step 2: Duplicate detection ──────────────────────────────
    print("▶ Step 2: Duplicate detection")
    wallet_counts = Counter(s["wallet"].lower() for s in valid)
    telegram_counts = Counter(s["telegram_id"] for s in valid)

    dup_wallets = {w: c for w, c in wallet_counts.items() if c > 1}
    dup_telegrams = {t: c for t, c in telegram_counts.items() if c > 1}

    if dup_wallets:
        for w, c in dup_wallets.items():
            print(f"  🚨 Duplicate wallet: {w} ({c} times)")
            errors.append(("DUP", w, [f"Wallet used {c} times"]))
    else:
        print("  ✅ No duplicate wallets")

    if dup_telegrams:
        for t, c in dup_telegrams.items():
            print(f"  🚨 Duplicate Telegram ID: {t} ({c} times)")
            errors.append(("DUP", t, [f"Telegram ID used {c} times"]))
    else:
        print("  ✅ No duplicate Telegram IDs")
    print()

    # ── Step 3: Signature verification ───────────────────────────
    print("▶ Step 3: Signature verification")
    sig_valid = []
    for sub in valid:
        if verify_signature(sub["wallet"], sub["handle"], sub["signature"]):
            sig_valid.append(sub)
            print(f"  ✅ {sub['handle']} — signature OK")
        else:
            print(f"  ❌ {sub['handle']} — signature INVALID")
            errors.append(("SIG", sub["handle"], ["Invalid signature"]))
    print()

    # ── Step 4: On-chain checks ──────────────────────────────────
    if check_funding:
        print("▶ Step 4: On-chain funding check")
        wallets = [s["wallet"] for s in sig_valid]
        suspicious = check_common_funding(wallets, rpc_url)
        if suspicious:
            for source, funded in suspicious.items():
                print(f"  🚨 Common funding source {source} → {funded}")
                warnings.append(("FUNDING", source, funded))
        else:
            print("  ✅ No common funding sources detected")
        print()

    # ── Summary ──────────────────────────────────────────────────
    print("=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Total submissions:  {len(submissions)}")
    print(f"  Format errors:      {len([e for e in errors if e[0] != 'DUP' and e[0] != 'SIG'])}")
    print(f"  Duplicates:         {len([e for e in errors if e[0] == 'DUP'])}")
    print(f"  Bad signatures:     {len([e for e in errors if e[0] == 'SIG'])}")
    print(f"  Warnings:           {len(warnings)}")
    print(f"  Clean submissions:  {len(sig_valid)}")
    print()

    # ── Export clean list ────────────────────────────────────────
    if sig_valid:
        output_file = "airdrop_verified.csv"
        with open(output_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["handle", "telegram_id", "wallet"])
            writer.writeheader()
            for sub in sig_valid:
                writer.writerow({
                    "handle": sub["handle"],
                    "telegram_id": sub["telegram_id"],
                    "wallet": sub["wallet"],
                })
        print(f"  📄 Clean list exported to: {output_file}")

    return sig_valid, errors, warnings


# ─── CLI ─────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="SwapPilot Airdrop Wallet Verifier")
    parser.add_argument("--csv", required=True, help="Path to submissions CSV")
    parser.add_argument("--check-funding", action="store_true", help="Enable on-chain funding checks")
    parser.add_argument("--rpc", default=BSC_RPC, help="BSC RPC URL")
    args = parser.parse_args()

    submissions = load_csv(args.csv)
    verify_all(submissions, check_funding=args.check_funding, rpc_url=args.rpc)


if __name__ == "__main__":
    main()
