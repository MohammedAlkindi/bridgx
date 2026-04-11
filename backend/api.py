from decimal import Decimal
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from libs import provider

app = FastAPI(title="Provider API")


class TokenPayload(BaseModel):
    address: str = Field(..., description="Token contract address")
    chain_id: int = Field(..., description="Chain ID")
    decimals: int = Field(..., description="Token decimals")


class QuoteRequest(BaseModel):
    amount_in: Decimal = Field(..., description="Amount of input token")
    token_in: TokenPayload
    token_out: TokenPayload
    wallet_address: Optional[str] = Field(default=None, description="User wallet address")
    slippage_perc: float = Field(default=0.1, description="Max slippage percent")


class AssembleRequest(BaseModel):
    quote: Dict[str, Any]
    wallet_address: str = Field(..., description="User wallet address")


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
