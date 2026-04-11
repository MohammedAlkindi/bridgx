import time
from decimal import Decimal
from typing import Any, Dict, Optional

import requests as _requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator

from .libs import provider

app = FastAPI(title="Provider API")

# BTC/USD price cache: (price_usd, fetched_at_epoch)
_btc_price_cache: Optional[tuple] = None
_BTC_PRICE_CACHE_TTL_S = 60  # refresh at most once per minute

AVALANCHE_CHAIN_ID = 43114

# Known token addresses and decimals keyed by (SYMBOL_UPPER, chain_id).
# When a symbol+chain combo is absent, resolution falls back to Avalanche.
_KNOWN_TOKENS: Dict[tuple, tuple] = {
    ("USDC",   43114): ("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", 6),
    ("BTCB",   43114): ("0x152b9d0FdC40C096757F570A51E494bd4b943E50", 8),
    ("WBTC.E", 43114): ("0x50b7545627a5162f82a992c33b87adc75187b218", 8),
    ("USDC",    8453): ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6),
    ("CBBTC",   8453): ("0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8),
    ("WBTC",    8453): ("0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", 8),
    ("TBTC",    8453): ("0x236aa50979d5f3de3bd1eeb40e81137f22ab794b", 18),
    ("USDC",   42161): ("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6),
    ("WBTC",   42161): ("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", 8),
}


def _lookup_token(symbol: str, chain_id: int) -> Optional[tuple]:
    """Return (address, decimals) for a known token, falling back to Avalanche."""
    result = _KNOWN_TOKENS.get((symbol.upper(), chain_id))
    if result is None:
        result = _KNOWN_TOKENS.get((symbol.upper(), AVALANCHE_CHAIN_ID))
    return result


class TokenPayload(BaseModel):
    address: Optional[str] = Field(default=None, description="Token contract address")
    symbol: Optional[str] = Field(default=None, description="Token symbol for registry lookup")
    chain_id: int = Field(..., description="Chain ID")
    decimals: Optional[int] = Field(default=None, description="Token decimals")

    @model_validator(mode="after")
    def resolve_missing_fields(self) -> "TokenPayload":
        """Fill in address/decimals from the known-token registry when omitted."""
        if self.address is None or self.decimals is None:
            if self.symbol is None:
                raise ValueError(
                    "Either 'address' (with 'decimals') or 'symbol' must be provided"
                )
            resolved = _lookup_token(self.symbol, self.chain_id)
            if resolved is None:
                raise ValueError(
                    f"Unknown token '{self.symbol}' on chain {self.chain_id} "
                    "(Avalanche fallback also not found); "
                    "provide 'address' and 'decimals' explicitly"
                )
            if self.address is None:
                self.address = resolved[0]
            if self.decimals is None:
                self.decimals = resolved[1]
        return self


class QuoteRequest(BaseModel):
    amount_in: Decimal = Field(..., description="Amount of input token")
    token_in: TokenPayload
    token_out: TokenPayload
    wallet_address: Optional[str] = Field(default=None, description="User wallet address")
    slippage_perc: float = Field(default=0.1, description="Max slippage percent")


class AssembleRequest(BaseModel):
    quote: Dict[str, Any]
    wallet_address: str = Field(..., description="User wallet address")


class OutputAmountRequest(BaseModel):
    amount_in: Decimal = Field(..., description="Amount of input token")
    token_in: TokenPayload       # BTC on source network
    token_med_in: TokenPayload   # USDC on source network
    token_med_out: TokenPayload  # USDC on destination network
    token_out: TokenPayload      # BTC on destination network
    wallet_address: Optional[str] = Field(default=None, description="User wallet address")
    slippage_perc: float = Field(default=0.1, description="Max slippage percent")


@app.post("/quote", response_model=float)
def quote(request: QuoteRequest) -> float:
    quote_data = provider.get_quote(
        amount_in=request.amount_in,
        token_in=request.token_in,
        token_out=request.token_out,
        wallet_address=request.wallet_address,
        slippage_perc=request.slippage_perc,
    )
    if quote_data is None:
        raise HTTPException(status_code=502, detail="Provider quote failed")
    return float(quote_data["outAmounts"][0]) / 10**request.token_out.decimals


@app.post("/assemble", response_model=str)
def assemble(request: AssembleRequest) -> str:
    tx = provider.assemble(
        quote=request.quote,
        wallet_address=request.wallet_address,
    )
    if tx is None:
        raise HTTPException(status_code=502, detail="Provider assemble failed")
    data = tx.get("data")
    if data is None:
        raise HTTPException(status_code=502, detail="Provider assemble data missing")
    return data


@app.post("/output-amount", response_model=float)
def output_amount(request: OutputAmountRequest) -> float:
    quote1 = provider.get_quote(
        amount_in=request.amount_in,
        token_in=request.token_in,
        token_out=request.token_med_in,
        wallet_address=request.wallet_address,
        slippage_perc=request.slippage_perc,
    )
    if quote1 is None:
        raise HTTPException(status_code=502, detail="Provider quote 1 failed")
    out_amounts_1 = quote1.get("outAmounts")
    if not out_amounts_1:
        raise HTTPException(status_code=502, detail="Provider quote 1 missing outAmounts")
    amount_out_med = float(out_amounts_1[0]) / 10**request.token_med_in.decimals

    quote2 = provider.get_quote(
        amount_in=amount_out_med,
        token_in=request.token_med_out,
        token_out=request.token_out,
        wallet_address=request.wallet_address,
        slippage_perc=request.slippage_perc,
    )
    if quote2 is None:
        raise HTTPException(status_code=502, detail="Provider quote 2 failed")
    out_amounts_2 = quote2.get("outAmounts")
    if not out_amounts_2:
        raise HTTPException(status_code=502, detail="Provider quote 2 missing outAmounts")
    return float(out_amounts_2[0]) / 10**request.token_out.decimals


@app.get("/btc-price")
def btc_price() -> Dict[str, float]:
    """Return the current BTC/USD price, cached for up to 60 seconds."""
    global _btc_price_cache
    now = time.time()
    if _btc_price_cache is not None and now - _btc_price_cache[1] < _BTC_PRICE_CACHE_TTL_S:
        return {"usd": _btc_price_cache[0]}
    try:
        response = _requests.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": "bitcoin", "vs_currencies": "usd"},
            timeout=5,
        )
        if response.status_code == 200:
            price = float(response.json()["bitcoin"]["usd"])
            _btc_price_cache = (price, now)
            return {"usd": price}
    except Exception:
        pass
    if _btc_price_cache is not None:
        return {"usd": _btc_price_cache[0]}
    raise HTTPException(status_code=502, detail="Failed to fetch BTC price")
