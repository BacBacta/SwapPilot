"""
SwapPilot Airdrop — Generate Multisend CSV for BSC
Takes the verified wallet list and generates a CSV ready for Safe/multisend.

Usage:
  python generate_multisend.py --input airdrop_verified.csv --amount 1000 --decimals 18 --output multisend.csv

Requirements:
  pip install pandas (optional, works without)
"""

import argparse
import csv


def generate_multisend(input_file: str, token_address: str, amount: float, decimals: int, output_file: str):
    """Generate a multisend CSV from verified wallets."""

    # Amount in base units (wei-like)
    amount_base = int(amount * (10 ** decimals))

    wallets = []
    with open(input_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            wallet = row.get("wallet", "").strip()
            if wallet:
                wallets.append(wallet)

    print(f"Generating multisend for {len(wallets)} wallets")
    print(f"Token: {token_address}")
    print(f"Amount per wallet: {amount} ({amount_base} base units)")
    print(f"Total tokens: {amount * len(wallets)}")
    print()

    # Format 1: Simple CSV (address, amount) — works with most multisend tools
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["token_address", "receiver", "amount"])
        for wallet in wallets:
            writer.writerow([token_address, wallet, amount_base])

    print(f"✅ Multisend CSV saved to: {output_file}")
    print()

    # Format 2: Safe Transaction Builder JSON
    safe_file = output_file.replace(".csv", "_safe.json")
    safe_txs = []
    for wallet in wallets:
        safe_txs.append({
            "to": token_address,
            "value": "0",
            "data": None,  # In production: encode transfer(wallet, amount_base)
            "contractMethod": {
                "name": "transfer",
                "inputs": [
                    {"name": "to", "type": "address", "value": wallet},
                    {"name": "amount", "type": "uint256", "value": str(amount_base)},
                ],
            },
        })

    import json
    safe_batch = {
        "version": "1.0",
        "chainId": "56",  # BSC mainnet
        "meta": {
            "name": "SwapPilot Airdrop — Top 50",
            "description": f"Airdrop {amount} $PILOT to {len(wallets)} wallets",
        },
        "transactions": safe_txs,
    }

    with open(safe_file, "w", encoding="utf-8") as f:
        json.dump(safe_batch, f, indent=2)

    print(f"✅ Safe Transaction Builder JSON saved to: {safe_file}")


def main():
    parser = argparse.ArgumentParser(description="SwapPilot Airdrop — Multisend CSV Generator")
    parser.add_argument("--input", required=True, help="Verified wallets CSV (from verify_wallets.py)")
    parser.add_argument("--token", required=True, help="$PILOT token contract address on BSC")
    parser.add_argument("--amount", type=float, required=True, help="Amount of $PILOT per wallet (human-readable)")
    parser.add_argument("--decimals", type=int, default=18, help="Token decimals (default: 18)")
    parser.add_argument("--output", default="multisend.csv", help="Output CSV file")
    args = parser.parse_args()

    generate_multisend(args.input, args.token, args.amount, args.decimals, args.output)


if __name__ == "__main__":
    main()
