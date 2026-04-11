import os
import requests
from decimal import Decimal

TIMEOUT_S = 20

def get_quote(amount_in, token_in, token_out, wallet_address=None, slippage_perc=0.1):
    body = {
        "chainId": token_in.chain_id,
        "inputTokens": [
            {
                "tokenAddress": token_in.address,
                "amount": str(int(Decimal(str(amount_in)) * Decimal(10) ** token_in.decimals)),
            }
        ],
        "outputTokens": [
            {
                "tokenAddress": token_out.address,
                "proportion": 1
            }
        ],
        "userAddr": wallet_address,
        "slippageLimitPercent": slippage_perc,
        "compact": True,
        # "simple": False,
        "simple": True,
        "likeAsset": False,
        "disableRFQs": True,    
        # "source_black_list": ["Dexalot"],
    }
    
    response = requests.post(
        "https://api.odos.xyz/sor/quote/v3",
        json=body,
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT_S,
    )
    if response.status_code == 200:
        return response.json()
    else:
        ## todo: add proper logging here
        return None


def assemble(quote, wallet_address):
    body = {
        "userAddr": wallet_address, 
        "pathId": quote["pathId"], 
        "simulate": False,
    }

    headers = {"Content-Type": "application/json"}
    url = "https://api.odos.xyz/sor/assemble"

    response = requests.post(
        url=url, 
        headers=headers, 
        json=body, 
        timeout=TIMEOUT_S,
    )
    if response.status_code == 200:
        tx = response.json()
        tx["transaction"]["value"] = int(tx["transaction"]["value"])
        return tx
    else:
        ## todo: add proper logging here
        print(f"Failed to assemble tx:\n{str(response.json())}")
        return None

def get_token_price(token_address, chain_id):
    url = f"https://api.odos.xyz/pricing/token/{chain_id}/{token_address}"
    try:
        response = requests.get(url, timeout=TIMEOUT_S)
        response.raise_for_status()  # поднимет исключение при 4xx/5xx
        return response.json().get("price")
    except Exception as e:
        ## todo: add proper logging here
        print(f"Failed to get token price: {e}")
        return None
