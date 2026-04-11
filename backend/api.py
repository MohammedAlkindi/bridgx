import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import requests as _requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from web3 import Web3
from web3.exceptions import TransactionNotFound
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware

from .libs import provider
from .libs import quote_store

app = FastAPI(title="Provider API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# BTC/USD price cache: (price_usd, fetched_at_epoch)
_btc_price_cache: Optional[tuple] = None
_BTC_PRICE_CACHE_TTL_S = 60  # refresh at most once per minute
_TOKEN_PRICE_CACHE: Dict[tuple, tuple] = {}
_TOKEN_PRICE_CACHE_TTL_S = 60

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

# Per-chain config for the bridge quote endpoint.
# Maps frontend chain name -> (chain_id, btc_symbol, usdc_symbol)
_BRIDGE_CHAIN_CONFIG: Dict[str, tuple] = {
    "avalanche": (43114, "BTCB", "USDC"),
    "base":      (8453,  "CBBTC", "USDC"),
    "arbitrum":  (42161, "WBTC",  "USDC"),
}

_NETWORKS: List[Dict[str, Any]] = [
    {"name": "avalanche", "chain_id": 43114, "label": "Avalanche"},
    {"name": "base", "chain_id": 8453, "label": "Base"},
    {"name": "arbitrum", "chain_id": 42161, "label": "Arbitrum"},
]

_CHAIN_RPC_URLS: Dict[int, str] = {
    43114: "https://api.avax.network/ext/bc/C/rpc",
    8453: "https://base-rpc.publicnode.com",
    42161: "https://arb1.arbitrum.io/rpc",
}

_CCTP_MESSAGE_TRANSMITTERS: Dict[int, str] = {
    43114: os.getenv("AVALANCHE_MESSAGE_TRANSMITTER", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"),
    8453: os.getenv("BASE_MESSAGE_TRANSMITTER", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"),
    42161: os.getenv("ARBITRUM_MESSAGE_TRANSMITTER", "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"),
}

_CCTP_DOMAIN_IDS: Dict[int, int] = {
    43114: 1,  # Avalanche
    8453: 6,   # Base
    42161: 3,  # Arbitrum
}

_RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY") or os.getenv("DEPLOYER_PRIVATE_KEY")
_IRIS_BASE_URL = "https://iris-api.circle.com/attestations"
_ATTESTATION_POLL_ATTEMPTS = int(os.getenv("ATTESTATION_POLL_ATTEMPTS", "60"))
_ATTESTATION_POLL_INTERVAL_S = int(os.getenv("ATTESTATION_POLL_INTERVAL_S", "5"))


def _lookup_token(symbol: str, chain_id: int) -> Optional[tuple]:
    """Return (address, decimals) for a known token, falling back to Avalanche."""
    result = _KNOWN_TOKENS.get((symbol.upper(), chain_id))
    if result is None:
        result = _KNOWN_TOKENS.get((symbol.upper(), AVALANCHE_CHAIN_ID))
    return result


def _resolve_chain_id(chain: str | int) -> int:
    if isinstance(chain, int):
        return chain
    for entry in _NETWORKS:
        if entry["name"] == chain:
            return entry["chain_id"]
    raise HTTPException(status_code=400, detail=f"Unsupported chain: {chain}")


def _get_web3(chain_id: int) -> Web3:
    rpc_url = _CHAIN_RPC_URLS.get(chain_id)
    if rpc_url is None:
        raise HTTPException(status_code=400, detail=f"Unsupported chain id: {chain_id}")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if chain_id == AVALANCHE_CHAIN_ID:
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


def _serialize_receipt(receipt: Any) -> Dict[str, Any]:
    return json.loads(Web3.to_json(receipt))


_MESSAGE_TRANSMITTER_ABI: List[Dict[str, Any]] = [
    {
        "anonymous": False,
        "inputs": [
            {
                "indexed": False,
                "internalType": "bytes",
                "name": "message",
                "type": "bytes",
            }
        ],
        "name": "MessageSent",
        "type": "event",
    },
    {
        "inputs": [
            {"internalType": "bytes", "name": "message", "type": "bytes"},
            {"internalType": "bytes", "name": "attestation", "type": "bytes"},
        ],
        "name": "receiveMessage",
        "outputs": [{"internalType": "bool", "name": "success", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


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


class TokenInfo(BaseModel):
    address: str
    symbol: Optional[str] = None
    name: Optional[str] = None
    decimals: int
    chain_id: int
    chain_name: Optional[str] = None


class NetworkInfo(BaseModel):
    name: str
    chain_id: int
    label: str


class TokenBalanceResponse(BaseModel):
    balance: str


class QuoteRequest(BaseModel):
    sourceChain: str = Field(..., description="Source chain name (e.g. 'base')")
    destinationChain: str = Field(..., description="Destination chain name (e.g. 'arbitrum')")
    sourceToken: str = Field(default="BTC", description="Source token symbol")
    destinationToken: str = Field(default="BTC", description="Destination token symbol")
    amountSats: str = Field(..., description="Amount in satoshis (string)")
    walletAddress: str = Field(..., description="User wallet address")


class QuoteResponse(BaseModel):
    quoteId: str
    sourceChain: str
    destinationChain: str
    sourceAmountSats: str
    destinationAmountSats: str
    estimatedDurationSec: int
    routeExpiresAt: str


class ProviderQuoteRequest(BaseModel):
    amount_in: Decimal = Field(..., description="Amount of input token")
    token_in: TokenPayload
    token_out: TokenPayload
    wallet_address: Optional[str] = Field(default=None, description="User wallet address")
    slippage_perc: float = Field(default=0.1, description="Max slippage percent")


class TokenPriceRequest(BaseModel):
    token_address: str = Field(..., description="Token contract address")
    chain_id: int = Field(..., description="Chain ID")


class AssembleRequest(BaseModel):
    quote_id: str = Field(..., description="Stored Odos quote id")
    wallet_address: str = Field(..., description="User wallet address")


class OutputAmountRequest(BaseModel):
    amount_in: Decimal = Field(..., description="Amount of input token")
    token_in: TokenPayload       # BTC on source network
    token_med_in: TokenPayload   # USDC on source network
    token_med_out: TokenPayload  # USDC on destination network
    token_out: TokenPayload      # BTC on destination network
    wallet_address: Optional[str] = Field(default=None, description="User wallet address")
    slippage_perc: float = Field(default=0.1, description="Max slippage percent")


class AttestationRequest(BaseModel):
    source_tx_hash: str = Field(..., description="Source chain transaction hash")
    source_chain: str = Field(..., description="Source chain name")
    destination_chain: str = Field(..., description="Destination chain name")
    poll_attempts: int = Field(default=_ATTESTATION_POLL_ATTEMPTS, ge=1, le=600)
    poll_interval_s: int = Field(default=_ATTESTATION_POLL_INTERVAL_S, ge=1, le=60)


class AttestationResponse(BaseModel):
    status: str
    message_hash: str
    destination_tx_hash: Optional[str] = None


class ReceiptRequest(BaseModel):
    tx_hash: str = Field(..., description="Transaction hash on destination chain")
    chain: str = Field(..., description="Destination chain name")


class ReceiptResponse(BaseModel):
    status: str
    tx_hash: str
    receipt: Optional[Dict[str, Any]] = None


def _load_tokens():
    from .libs import token as token_lib

    return token_lib.TOKENS


@app.post("/quote", response_model=QuoteResponse)
def quote(request: QuoteRequest) -> QuoteResponse:
    src_config = _BRIDGE_CHAIN_CONFIG.get(request.sourceChain)
    dst_config = _BRIDGE_CHAIN_CONFIG.get(request.destinationChain)
    if src_config is None:
        raise HTTPException(status_code=400, detail=f"Unsupported source chain: {request.sourceChain}")
    if dst_config is None:
        raise HTTPException(status_code=400, detail=f"Unsupported destination chain: {request.destinationChain}")

    src_chain_id, src_btc_symbol, src_usdc_symbol = src_config
    dst_chain_id, dst_btc_symbol, dst_usdc_symbol = dst_config

    src_btc = _lookup_token(src_btc_symbol, src_chain_id)
    src_usdc = _lookup_token(src_usdc_symbol, src_chain_id)
    dst_usdc = _lookup_token(dst_usdc_symbol, dst_chain_id)
    dst_btc = _lookup_token(dst_btc_symbol, dst_chain_id)

    if not all([src_btc, src_usdc, dst_usdc, dst_btc]):
        raise HTTPException(status_code=500, detail="Token configuration error for requested chains")

    amount_in = Decimal(request.amountSats) / Decimal(10**8)

    token_in = TokenPayload(address=src_btc[0], decimals=src_btc[1], chain_id=src_chain_id)
    token_med_in = TokenPayload(address=src_usdc[0], decimals=src_usdc[1], chain_id=src_chain_id)
    token_med_out = TokenPayload(address=dst_usdc[0], decimals=dst_usdc[1], chain_id=dst_chain_id)
    token_out = TokenPayload(address=dst_btc[0], decimals=dst_btc[1], chain_id=dst_chain_id)

    quote_id = str(uuid.uuid4())

    quote1 = provider.get_quote(
        amount_in=amount_in,
        token_in=token_in,
        token_out=token_med_in,
        wallet_address=request.walletAddress,
        slippage_perc=0.1,
    )
    if quote1 is None:
        raise HTTPException(status_code=502, detail="Provider quote (leg 1) failed")
    out_amounts_1 = quote1.get("outAmounts")
    if not out_amounts_1:
        raise HTTPException(status_code=502, detail="Provider quote (leg 1) missing outAmounts")
    amount_out_usdc = float(out_amounts_1[0]) / 10**token_med_in.decimals

    quote_store.save_quote(quote_id, quote1)

    quote2 = provider.get_quote(
        amount_in=Decimal(str(amount_out_usdc)),
        token_in=token_med_out,
        token_out=token_out,
        wallet_address=request.walletAddress,
        slippage_perc=0.1,
    )
    if quote2 is None:
        raise HTTPException(status_code=502, detail="Provider quote (leg 2) failed")
    out_amounts_2 = quote2.get("outAmounts")
    if not out_amounts_2:
        raise HTTPException(status_code=502, detail="Provider quote (leg 2) missing outAmounts")

    destination_btc = float(out_amounts_2[0]) / 10**token_out.decimals
    destination_sats = str(int(destination_btc * 10**8))

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

    return QuoteResponse(
        quoteId=quote_id,
        sourceChain=request.sourceChain,
        destinationChain=request.destinationChain,
        sourceAmountSats=request.amountSats,
        destinationAmountSats=destination_sats,
        estimatedDurationSec=90,
        routeExpiresAt=expires_at.isoformat(),
    )


@app.post("/provider/quote", response_model=float)
def provider_quote(request: ProviderQuoteRequest) -> float:
    """Low-level single-hop quote against the Odos provider."""
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


@app.get("/tokens", response_model=List[TokenInfo])
def get_tokens() -> List[TokenInfo]:
    try:
        tokens = _load_tokens()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to load tokens: {exc}")

    results: List[TokenInfo] = []
    for token in tokens:
        if token.address is None or token.decimals is None or token.chain_id is None:
            raise HTTPException(status_code=502, detail="Invalid token data")
        results.append(
            TokenInfo(
                address=token.address,
                symbol=getattr(token, "symbol", None),
                name=getattr(token, "name", None),
                decimals=token.decimals,
                chain_id=token.chain_id,
                chain_name=getattr(token, "chain_name", None),
            )
        )

    return results


@app.get("/networks", response_model=List[NetworkInfo])
def get_networks() -> List[NetworkInfo]:
    return [NetworkInfo(**network) for network in _NETWORKS]


@app.get("/token-balance", response_model=TokenBalanceResponse)
def token_balance(token_address: str, wallet_address: str, chain_id: int) -> TokenBalanceResponse:
    rpc_url = _CHAIN_RPC_URLS.get(chain_id)
    if rpc_url is None:
        raise HTTPException(status_code=400, detail="Unsupported chain_id")

    data = "0x70a08231" + wallet_address.lower().replace("0x", "").rjust(64, "0")
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {
                "to": token_address,
                "data": data,
            },
            "latest",
        ],
    }

    try:
        response = _requests.post(rpc_url, json=payload, timeout=10)
        response.raise_for_status()
        body = response.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Token balance fetch failed: {exc}")

    if "error" in body:
        raise HTTPException(status_code=502, detail="Token balance fetch failed")

    result = body.get("result")
    if not isinstance(result, str):
        raise HTTPException(status_code=502, detail="Token balance invalid response")

    try:
        balance = str(int(result, 16))
    except Exception:
        raise HTTPException(status_code=502, detail="Token balance parse failed")

    return TokenBalanceResponse(balance=balance)


def _fetch_token_price(token_address: str, chain_id: int) -> float:
    key = (chain_id, token_address.lower())
    now = time.time()
    cached = _TOKEN_PRICE_CACHE.get(key)
    if cached is not None and now - cached[1] < _TOKEN_PRICE_CACHE_TTL_S:
        return cached[0]

    price = provider.get_token_price(
        token_address=token_address,
        chain_id=chain_id,
    )
    if price is None:
        if cached is not None:
            return cached[0]
        raise HTTPException(status_code=502, detail="Provider token price failed")
    try:
        price_value = float(price)
    except (TypeError, ValueError):
        if cached is not None:
            return cached[0]
        raise HTTPException(status_code=502, detail="Provider token price invalid")

    _TOKEN_PRICE_CACHE[key] = (price_value, now)
    return price_value


@app.post("/provider/token-price", response_model=float)
def provider_token_price(request: TokenPriceRequest) -> float:
    """Return the USD price for the given token."""
    return _fetch_token_price(
        token_address=request.token_address,
        chain_id=request.chain_id,
    )


@app.post("/token-price", response_model=float)
def token_price_post(request: TokenPriceRequest) -> float:
    """Return the USD price for any ERC20 token (POST)."""
    return _fetch_token_price(
        token_address=request.token_address,
        chain_id=request.chain_id,
    )


@app.get("/token-price", response_model=float)
def token_price_get(token_address: str, chain_id: int) -> float:
    """Return the USD price for any ERC20 token (GET)."""
    return _fetch_token_price(
        token_address=token_address,
        chain_id=chain_id,
    )


@app.post("/assemble", response_model=Dict[str, Any])
def assemble(request: AssembleRequest) -> Dict[str, Any]:
    stored_quote = quote_store.get_quote(request.quote_id)
    if stored_quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    tx = provider.assemble(
        quote=stored_quote,
        wallet_address=request.wallet_address,
    )
    if tx is None:
        raise HTTPException(status_code=502, detail="Provider assemble failed")
    transaction = tx.get("transaction")
    if transaction is None:
        raise HTTPException(status_code=502, detail="Provider assemble transaction missing")
    return transaction


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


@app.post("/attestation", response_model=AttestationResponse)
def attestation(request: AttestationRequest) -> AttestationResponse:
    if not _RELAYER_PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="Relayer private key not configured")

    source_chain_id = _resolve_chain_id(request.source_chain)
    destination_chain_id = _resolve_chain_id(request.destination_chain)

    source_w3 = _get_web3(source_chain_id)
    transmitter_address = _CCTP_MESSAGE_TRANSMITTERS.get(source_chain_id)
    if not transmitter_address:
        raise HTTPException(status_code=400, detail="MessageTransmitter not configured for source chain")

    try:
        receipt = source_w3.eth.get_transaction_receipt(request.source_tx_hash)
    except TransactionNotFound:
        raise HTTPException(status_code=404, detail="Source transaction not found")

    transmitter = source_w3.eth.contract(
        address=Web3.to_checksum_address(transmitter_address),
        abi=_MESSAGE_TRANSMITTER_ABI,
    )
    try:
        from web3.logs import DISCARD

        message_events = transmitter.events.MessageSent().process_receipt(receipt, errors=DISCARD)
    except Exception:
        message_events = transmitter.events.MessageSent().process_receipt(receipt)

    if not message_events:
        raise HTTPException(status_code=502, detail="MessageSent event not found in receipt")

    message = message_events[0]["args"]["message"]
    message_hash = Web3.keccak(message).hex()
    if not message_hash.startswith("0x"):
        message_hash = f"0x{message_hash}"

    attestation_value = None
    for _ in range(request.poll_attempts):
        resp = _requests.get(f"{_IRIS_BASE_URL}/{message_hash}", timeout=30)
        if resp.status_code == 404:
            time.sleep(request.poll_interval_s)
            continue
        if resp.status_code == 429:
            time.sleep(request.poll_interval_s)
            continue
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "complete":
            attestation_value = data.get("attestation")
            break
        time.sleep(request.poll_interval_s)

    if attestation_value is None:
        return AttestationResponse(status="pending", message_hash=message_hash)

    dest_transmitter_address = _CCTP_MESSAGE_TRANSMITTERS.get(destination_chain_id)
    if not dest_transmitter_address:
        raise HTTPException(status_code=400, detail="MessageTransmitter not configured for destination chain")

    dest_w3 = _get_web3(destination_chain_id)
    relayer = dest_w3.eth.account.from_key(_RELAYER_PRIVATE_KEY)

    dest_transmitter = dest_w3.eth.contract(
        address=Web3.to_checksum_address(dest_transmitter_address),
        abi=_MESSAGE_TRANSMITTER_ABI,
    )
    attestation_bytes = Web3.to_bytes(hexstr=attestation_value)
    receive_fn = dest_transmitter.functions.receiveMessage(message, attestation_bytes)

    gas_estimate = receive_fn.estimate_gas({"from": relayer.address})
    latest_block = dest_w3.eth.get_block("latest")
    priority_fee = dest_w3.eth.max_priority_fee
    base_fee = latest_block.get("baseFeePerGas")

    tx_params: Dict[str, Any] = {
        "from": relayer.address,
        "nonce": dest_w3.eth.get_transaction_count(relayer.address),
        "chainId": destination_chain_id,
        "gas": int(gas_estimate * 1.2),
    }
    if base_fee is not None:
        tx_params["maxPriorityFeePerGas"] = priority_fee
        tx_params["maxFeePerGas"] = base_fee * 2 + priority_fee
    else:
        tx_params["gasPrice"] = dest_w3.eth.gas_price

    receive_tx = receive_fn.build_transaction(tx_params)
    signed_tx = relayer.sign_transaction(receive_tx)
    destination_tx_hash = dest_w3.eth.send_raw_transaction(signed_tx.raw_transaction).hex()

    return AttestationResponse(
        status="complete",
        message_hash=message_hash,
        destination_tx_hash=destination_tx_hash,
    )


@app.post("/receipt", response_model=ReceiptResponse)
def receipt(request: ReceiptRequest) -> ReceiptResponse:
    chain_id = _resolve_chain_id(request.chain)
    w3 = _get_web3(chain_id)
    try:
        tx_receipt = w3.eth.get_transaction_receipt(request.tx_hash)
    except TransactionNotFound:
        return ReceiptResponse(status="pending", tx_hash=request.tx_hash)
    status = "confirmed" if tx_receipt.get("status") == 1 else "failed"
    return ReceiptResponse(
        status=status,
        tx_hash=request.tx_hash,
        receipt=_serialize_receipt(tx_receipt),
    )
