import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests as _requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field, model_validator
from web3 import Web3
from web3.exceptions import TransactionNotFound
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware

from .libs import provider
from .libs import quote_store
from .libs import swap_intent_store

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

_backend_env = Path(__file__).resolve().parent / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env, override=True)
else:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)

logger = logging.getLogger("uvicorn.error")

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
    ("WETH",   43114): ("0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", 18),
    ("USDC",    8453): ("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6),
    ("CBBTC",   8453): ("0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8),
    ("WBTC",    8453): ("0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", 8),
    ("TBTC",    8453): ("0x236aa50979d5f3de3bd1eeb40e81137f22ab794b", 18),
    ("WETH",    8453): ("0x4200000000000000000000000000000000000006", 18),
    ("USDC",   42161): ("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6),
    ("WBTC",   42161): ("0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", 8),
    ("WETH",   42161): ("0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18),
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

_SOURCE_EXECUTOR_ADDRESSES: Dict[int, str] = {
    43114: os.getenv(
        "SOURCE_EXECUTOR_AVALANCHE",
        "0xeC20cbb6C99e4b8b78cbd81b27Ce0B7aaD222A2d",
    ),
}

_DESTINATION_EXECUTOR_ADDRESSES: Dict[int, Optional[str]] = {
    8453: os.getenv("DESTINATION_EXECUTOR_BASE"),
    42161: os.getenv("DESTINATION_EXECUTOR_ARBITRUM"),
}

_CCTP_MAX_FEE = int(os.getenv("CCTP_MAX_FEE", "0"))
_CCTP_MIN_FINALITY_THRESHOLD = int(os.getenv("CCTP_MIN_FINALITY_THRESHOLD", "1000"))
_CCTP_HOOK_DATA = os.getenv("CCTP_HOOK_DATA", "0x01")
_CCTP_DESTINATION_CALLER = os.getenv(
    "CCTP_DESTINATION_CALLER",
    "0x0000000000000000000000000000000000000000",
)
_DESTINATION_RELEASE_GAS = int(os.getenv("DESTINATION_RELEASE_GAS", "200000"))
_RELEASE_DELAY_CHECKS = int(os.getenv("RELEASE_DELAY_CHECKS", "3"))
_RELEASE_CHECKS_TTL_S = int(os.getenv("RELEASE_CHECKS_TTL_S", "3600"))
_RECEIVE_RECEIPT_ATTEMPTS = int(os.getenv("RECEIVE_RECEIPT_ATTEMPTS", "2"))
_RECEIVE_RECEIPT_INTERVAL_S = int(os.getenv("RECEIVE_RECEIPT_INTERVAL_S", "2"))
_RELEASE_RECEIPT_ATTEMPTS = int(os.getenv("RELEASE_RECEIPT_ATTEMPTS", "2"))
_RELEASE_RECEIPT_INTERVAL_S = int(os.getenv("RELEASE_RECEIPT_INTERVAL_S", "2"))
_ATTESTATION_STATE: Dict[str, Dict[str, Any]] = {}

_RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY") or os.getenv("DEPLOYER_PRIVATE_KEY")
_IRIS_BASE_URL = "https://iris-api.circle.com/attestations"
_IRIS_MESSAGES_URL = "https://iris-api.circle.com/v2/messages"
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


def _address_to_bytes32(address: str) -> bytes:
    raw = Web3.to_bytes(hexstr=address)
    return raw.rjust(32, b"\x00")


def _encode_contract_call(contract: Any, fn_name: str, args: list) -> str:
    if hasattr(contract, "encodeABI"):
        return contract.encodeABI(fn_name=fn_name, args=args)
    return contract.encode_abi(fn_name, args=args)


def _parse_message_for_release(message: Any) -> tuple[str, str, str, int, int]:
    message_bytes = Web3.to_bytes(hexstr=message) if isinstance(message, str) else bytes(message)
    if len(message_bytes) < 148:
        raise HTTPException(status_code=500, detail="Message too short for CCTP parsing")

    nonce = Web3.to_hex(message_bytes[12:44])
    message_body = message_bytes[148:]
    if len(message_body) < 228:
        raise HTTPException(status_code=500, detail="Message body too short for burn parsing")

    mint_recipient_bytes = message_body[36:68]
    mint_recipient = Web3.to_checksum_address(mint_recipient_bytes[-20:])

    amount = int.from_bytes(message_body[68:100], "big")
    fee_executed = int.from_bytes(message_body[164:196], "big")

    hook_data = message_body[228:]
    if len(hook_data) < 32:
        raise HTTPException(status_code=500, detail="Hook data missing in burn message")
    recipient = Web3.to_checksum_address(hook_data[-20:])

    return nonce, mint_recipient, recipient, amount, fee_executed


def _get_attestation_state(message_hash: str) -> Dict[str, Any]:
    now = time.time()
    state = _ATTESTATION_STATE.get(message_hash)
    if state and now - state.get("updated_at", 0) > _RELEASE_CHECKS_TTL_S:
        state = None
    if state is None:
        state = {
            "checks": 0,
            "destination_tx_hash": None,
            "release_tx_hash": None,
            "release_failures": 0,
            "swap_tx_hash": None,
            "swap_failures": 0,
            "swap_checks": 0,
            "received": False,
            "updated_at": now,
        }
        _ATTESTATION_STATE[message_hash] = state
    state["updated_at"] = now
    return state


def _get_receipt_with_retries(
    w3: Web3,
    tx_hash: str,
    attempts: int,
    interval_s: int,
) -> Optional[Dict[str, Any]]:
    for _ in range(max(1, attempts)):
        try:
            return w3.eth.get_transaction_receipt(tx_hash)
        except TransactionNotFound:
            time.sleep(max(0, interval_s))
    return None


_ERC20_ABI: List[Dict[str, Any]] = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    }
]

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
    {
        "inputs": [{"internalType": "bytes32", "name": "nonce", "type": "bytes32"}],
        "name": "usedNonces",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

_SOURCE_EXECUTOR_ABI: List[Dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "address", "name": "inputToken", "type": "address"},
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "bytes", "name": "odosData", "type": "bytes"},
            {"internalType": "uint32", "name": "destinationDomain", "type": "uint32"},
            {"internalType": "bytes32", "name": "mintRecipient", "type": "bytes32"},
            {"internalType": "bytes32", "name": "destinationCaller", "type": "bytes32"},
            {"internalType": "uint256", "name": "maxFee", "type": "uint256"},
            {"internalType": "uint32", "name": "minFinalityThreshold", "type": "uint32"},
            {"internalType": "bytes", "name": "hookData", "type": "bytes"},
        ],
        "name": "executeSwapAndBurn",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    }
]

_DESTINATION_EXECUTOR_ABI: List[Dict[str, Any]] = [
    {
        "inputs": [],
        "name": "relayer",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "bytes", "name": "odosData", "type": "bytes"},
            {"internalType": "address", "name": "outputToken", "type": "address"},
            {"internalType": "address", "name": "recipient", "type": "address"},
        ],
        "name": "executeSwapAndTransfer",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "releaseUsdc",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
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


class SwapIntentRequest(BaseModel):
    source_tx_hash: str = Field(..., description="Source chain transaction hash")
    destination_chain: str = Field(..., description="Destination chain name")
    recipient: str = Field(..., description="Destination recipient address")
    token_address: str = Field(..., description="Destination token address")
    token_decimals: int = Field(..., ge=0, le=36)


class SwapIntentResponse(BaseModel):
    status: str


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
    message_hash: Optional[str] = Field(default=None, serialization_alias="messageHash")
    destination_tx_hash: Optional[str] = Field(default=None, serialization_alias="destinationTxHash")
    release_tx_hash: Optional[str] = Field(default=None, serialization_alias="releaseTxHash")
    attestation_source: Optional[str] = Field(default=None, serialization_alias="attestationSource")
    attestation_status: Optional[str] = Field(default=None, serialization_alias="attestationStatus")
    release_status: Optional[str] = Field(default=None, serialization_alias="releaseStatus")
    release_balance: Optional[str] = Field(default=None, serialization_alias="releaseBalance")
    release_needed: Optional[str] = Field(default=None, serialization_alias="releaseNeeded")
    swap_tx_hash: Optional[str] = Field(default=None, serialization_alias="swapTxHash")
    swap_status: Optional[str] = Field(default=None, serialization_alias="swapStatus")


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
    try:
        src_chain_id = _resolve_chain_id(request.sourceChain)
        dst_chain_id = _resolve_chain_id(request.destinationChain)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    src_token = _lookup_token(request.sourceToken, src_chain_id)
    dst_token = _lookup_token(request.destinationToken, dst_chain_id)
    src_usdc = _lookup_token("USDC", src_chain_id)
    dst_usdc = _lookup_token("USDC", dst_chain_id)

    if not all([src_token, dst_token, src_usdc, dst_usdc]):
        raise HTTPException(status_code=500, detail="Token configuration error for requested chains")

    amount_in = Decimal(request.amountSats) / Decimal(10**8)

    token_in = TokenPayload(address=src_token[0], decimals=src_token[1], chain_id=src_chain_id)
    token_med_in = TokenPayload(address=src_usdc[0], decimals=src_usdc[1], chain_id=src_chain_id)
    token_med_out = TokenPayload(address=dst_usdc[0], decimals=dst_usdc[1], chain_id=dst_chain_id)
    token_out = TokenPayload(address=dst_token[0], decimals=dst_token[1], chain_id=dst_chain_id)

    quote_id = str(uuid.uuid4())

    source_executor = _SOURCE_EXECUTOR_ADDRESSES.get(src_chain_id)
    if not source_executor:
        raise HTTPException(status_code=400, detail="SourceExecutor not configured for source chain")

    quote1 = provider.get_quote(
        amount_in=amount_in,
        token_in=token_in,
        token_out=token_med_in,
        wallet_address=source_executor,
        slippage_perc=0.1,
    )
    if quote1 is None:
        raise HTTPException(status_code=502, detail="Provider quote (leg 1) failed")
    out_amounts_1 = quote1.get("outAmounts")
    if not out_amounts_1:
        raise HTTPException(status_code=502, detail="Provider quote (leg 1) missing outAmounts")
    amount_out_usdc = float(out_amounts_1[0]) / 10**token_med_in.decimals
    input_amount_base = int(amount_in * Decimal(10) ** token_in.decimals)

    quote_store.save_quote(
        quote_id,
        quote1,
        {
            "input_token": token_in.address,
            "input_decimals": token_in.decimals,
            "input_amount_base": input_amount_base,
            "source_chain_id": src_chain_id,
            "destination_chain_id": dst_chain_id,
        },
    )

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

    quote_payload = stored_quote.get("quote") if isinstance(stored_quote, dict) else stored_quote
    meta = stored_quote.get("meta", {}) if isinstance(stored_quote, dict) else {}

    input_token = meta.get("input_token")
    input_amount_base = meta.get("input_amount_base")
    source_chain_id = meta.get("source_chain_id")
    destination_chain_id = meta.get("destination_chain_id")
    if not all([input_token, input_amount_base, source_chain_id, destination_chain_id]):
        raise HTTPException(status_code=400, detail="Stored quote metadata missing; refresh the quote")

    source_executor = _SOURCE_EXECUTOR_ADDRESSES.get(int(source_chain_id))
    if not source_executor:
        raise HTTPException(status_code=400, detail="SourceExecutor not configured for source chain")
    destination_domain = _CCTP_DOMAIN_IDS.get(int(destination_chain_id))
    if destination_domain is None:
        raise HTTPException(status_code=400, detail="Destination domain not configured")

    try:
        user_recipient = Web3.to_checksum_address(request.wallet_address)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid wallet address")

    destination_executor = _DESTINATION_EXECUTOR_ADDRESSES.get(int(destination_chain_id))
    if not destination_executor:
        raise HTTPException(status_code=400, detail="DestinationExecutor not configured for destination chain")

    tx = provider.assemble(
        quote=quote_payload,
        wallet_address=source_executor,
    )
    if tx is None:
        raise HTTPException(status_code=502, detail="Provider assemble failed")
    transaction = tx.get("transaction")
    if transaction is None:
        raise HTTPException(status_code=502, detail="Provider assemble transaction missing")
    odos_data = transaction.get("data")
    if not odos_data:
        raise HTTPException(status_code=502, detail="Provider assemble data missing")

    source_w3 = _get_web3(int(source_chain_id))
    source_executor_checksum = Web3.to_checksum_address(source_executor)
    executor_contract = source_w3.eth.contract(
        address=source_executor_checksum,
        abi=_SOURCE_EXECUTOR_ABI,
    )
    args = [
        Web3.to_checksum_address(input_token),
        int(input_amount_base),
        Web3.to_bytes(hexstr=odos_data),
        int(destination_domain),
        _address_to_bytes32(Web3.to_checksum_address(destination_executor)),
        _address_to_bytes32(_CCTP_DESTINATION_CALLER),
        _CCTP_MAX_FEE,
        _CCTP_MIN_FINALITY_THRESHOLD,
        _address_to_bytes32(user_recipient),
    ]
    data = _encode_contract_call(executor_contract, "executeSwapAndBurn", args)

    return {
        "to": source_executor_checksum,
        "data": data,
        "value": 0,
        "chainId": int(source_chain_id),
    }


@app.post("/swap-intent", response_model=SwapIntentResponse)
def swap_intent(request: SwapIntentRequest) -> SwapIntentResponse:
    try:
        destination_chain_id = _resolve_chain_id(request.destination_chain)
        recipient = Web3.to_checksum_address(request.recipient)
        token_address = Web3.to_checksum_address(request.token_address)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid swap intent: {exc}") from exc

    swap_intent_store.save_intent(
        request.source_tx_hash,
        {
            "destination_chain_id": destination_chain_id,
            "recipient": recipient,
            "token_address": token_address,
            "token_decimals": int(request.token_decimals),
        },
    )
    return SwapIntentResponse(status="ok")


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
    logger.info(
        "Attestation request: source_tx=%s source_chain=%s dest_chain=%s",
        request.source_tx_hash,
        request.source_chain,
        request.destination_chain,
    )
    try:
        attestation_source = "fallback"
        attestation_status = None
        attestation_message = None
        attestation_value = None
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
            logger.info("Source transaction not yet mined")
            return AttestationResponse(status="pending")

        logger.info("Source receipt obtained: block=%s", receipt.get("blockNumber"))
        if receipt.get("status") == 0:
            raise HTTPException(status_code=400, detail="Source transaction reverted")

        transmitter = source_w3.eth.contract(
            address=Web3.to_checksum_address(transmitter_address),
            abi=_MESSAGE_TRANSMITTER_ABI,
        )
        try:
            v2_resp = _requests.get(
                f"{_IRIS_MESSAGES_URL}/{_CCTP_DOMAIN_IDS[source_chain_id]}",
                params={"transactionHash": request.source_tx_hash},
                timeout=30,
            )
            if v2_resp.status_code == 200:
                v2_payload = v2_resp.json()
                messages = v2_payload.get("messages") if isinstance(v2_payload, dict) else []
                if isinstance(messages, list):
                    for item in messages:
                        if not isinstance(item, dict):
                            continue
                        decoded = item.get("decodedMessage") or {}
                        if isinstance(decoded, dict):
                            try:
                                if int(decoded.get("destinationDomain")) != _CCTP_DOMAIN_IDS[destination_chain_id]:
                                    continue
                            except Exception:
                                continue
                        msg_hex = item.get("message")
                        att_hex = item.get("attestation")
                        if (
                            isinstance(msg_hex, str)
                            and msg_hex.startswith("0x")
                            and isinstance(att_hex, str)
                            and att_hex.startswith("0x")
                            and len(att_hex) > 2
                        ):
                            attestation_source = "v2"
                            attestation_status = item.get("status")
                            attestation_message = msg_hex
                            attestation_value = att_hex
                            break
        except Exception:
            attestation_message = None

        if attestation_message is None:
            try:
                from web3.logs import DISCARD

                message_events = transmitter.events.MessageSent().process_receipt(receipt, errors=DISCARD)
            except Exception:
                message_events = transmitter.events.MessageSent().process_receipt(receipt)

            if not message_events:
                raise HTTPException(status_code=502, detail="MessageSent event not found in receipt")

            message = message_events[0]["args"]["message"]
        else:
            message = attestation_message
        nonce, mint_recipient, release_recipient, amount, fee_executed = _parse_message_for_release(message)
        if amount <= fee_executed:
            raise HTTPException(status_code=400, detail="Invalid burn amount for release")

        message_bytes = Web3.to_bytes(hexstr=message) if isinstance(message, str) else bytes(message)
        message_hash = Web3.keccak(message_bytes).hex()
        if not message_hash.startswith("0x"):
            message_hash = f"0x{message_hash}"
        logger.info("Message hash: %s", message_hash)

        if attestation_value is None:
            for attempt in range(request.poll_attempts):
                resp = _requests.get(f"{_IRIS_BASE_URL}/{message_hash}", timeout=30)
                if resp.status_code == 404:
                    attestation_status = "not_ready"
                    logger.info("Attestation not ready (404) attempt=%s", attempt + 1)
                    time.sleep(request.poll_interval_s)
                    continue
                if resp.status_code == 429:
                    attestation_status = "rate_limited"
                    logger.info("Attestation rate-limited (429) attempt=%s", attempt + 1)
                    time.sleep(request.poll_interval_s)
                    continue
                resp.raise_for_status()
                data = resp.json()
                attestation_status = data.get("status")
                if data.get("status") == "complete":
                    attestation_value = data.get("attestation")
                    break
                logger.info("Attestation status=%s attempt=%s", data.get("status"), attempt + 1)
                time.sleep(request.poll_interval_s)

        if attestation_value is None:
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
            )

        dest_transmitter_address = _CCTP_MESSAGE_TRANSMITTERS.get(destination_chain_id)
        if not dest_transmitter_address:
            raise HTTPException(status_code=400, detail="MessageTransmitter not configured for destination chain")

        dest_w3 = _get_web3(destination_chain_id)
        relayer = dest_w3.eth.account.from_key(_RELAYER_PRIVATE_KEY)

        state = _get_attestation_state(message_hash)

        dest_transmitter = dest_w3.eth.contract(
            address=Web3.to_checksum_address(dest_transmitter_address),
            abi=_MESSAGE_TRANSMITTER_ABI,
        )

        destination_executor = _DESTINATION_EXECUTOR_ADDRESSES.get(destination_chain_id)
        if not destination_executor:
            raise HTTPException(status_code=400, detail="DestinationExecutor not configured for destination chain")

        destination_executor_checksum = Web3.to_checksum_address(destination_executor)
        if destination_executor_checksum.lower() != mint_recipient.lower():
            raise HTTPException(status_code=400, detail="Mint recipient does not match DestinationExecutor")

        latest_block = dest_w3.eth.get_block("latest")
        priority_fee = dest_w3.eth.max_priority_fee
        base_fee = latest_block.get("baseFeePerGas")
        amount_to_release = amount - fee_executed

        try:
            nonce_used = dest_transmitter.functions.usedNonces(Web3.to_bytes(hexstr=nonce)).call() != 0
        except Exception:
            nonce_used = state.get("received", False)

        destination_tx_hash = state.get("destination_tx_hash")
        receive_confirmed = False
        if destination_tx_hash:
            receipt = _get_receipt_with_retries(
                dest_w3,
                destination_tx_hash,
                _RECEIVE_RECEIPT_ATTEMPTS,
                _RECEIVE_RECEIPT_INTERVAL_S,
            )
            if receipt and receipt.get("status") == 1:
                receive_confirmed = True
            elif receipt and receipt.get("status") == 0:
                state["destination_tx_hash"] = None
                state["received"] = False
                destination_tx_hash = None
            elif nonce_used:
                receive_confirmed = True
            else:
                return AttestationResponse(
                    status="pending",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    release_status="waiting_receive",
                )

        if not receive_confirmed:
            if nonce_used:
                receive_confirmed = True
            else:
                attestation_bytes = Web3.to_bytes(hexstr=attestation_value)
                receive_fn = dest_transmitter.functions.receiveMessage(message, attestation_bytes)
                gas_estimate = receive_fn.estimate_gas({"from": relayer.address})

                base_nonce = dest_w3.eth.get_transaction_count(relayer.address, "pending")
                tx_params: Dict[str, Any] = {
                    "from": relayer.address,
                    "nonce": base_nonce,
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
                logger.info("receiveMessage tx sent: %s", destination_tx_hash)
                state["destination_tx_hash"] = destination_tx_hash
                state["received"] = True
                return AttestationResponse(
                    status="pending",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    release_status="waiting_receive",
                )

        intent = swap_intent_store.get_intent(request.source_tx_hash)
        if intent is None:
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                release_status="missing_intent",
            )

        if int(intent.get("destination_chain_id", destination_chain_id)) != destination_chain_id:
            raise HTTPException(status_code=400, detail="Swap intent chain mismatch")

        intent_recipient = Web3.to_checksum_address(intent["recipient"])
        if intent_recipient.lower() != release_recipient.lower():
            raise HTTPException(status_code=400, detail="Swap intent recipient mismatch")

        destination_token = Web3.to_checksum_address(intent["token_address"])
        destination_decimals = int(intent["token_decimals"])

        usdc_info = _lookup_token("USDC", destination_chain_id)
        if not usdc_info:
            raise HTTPException(status_code=500, detail="USDC not configured for destination chain")
        usdc_contract = dest_w3.eth.contract(
            address=Web3.to_checksum_address(usdc_info[0]),
            abi=_ERC20_ABI,
        )
        release_balance = int(usdc_contract.functions.balanceOf(destination_executor_checksum).call())
        if release_balance < amount_to_release:
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                release_status="awaiting_balance",
                release_balance=str(release_balance),
                release_needed=str(amount_to_release),
            )

        release_contract = dest_w3.eth.contract(
            address=destination_executor_checksum,
            abi=_DESTINATION_EXECUTOR_ABI,
        )
        contract_relayer = release_contract.functions.relayer().call()
        if Web3.to_checksum_address(contract_relayer) != relayer.address:
            raise HTTPException(
                status_code=400,
                detail=(
                    "DestinationExecutor relayer mismatch: "
                    f"contract={contract_relayer} backend={relayer.address}"
                ),
            )

        if destination_token.lower() == Web3.to_checksum_address(usdc_info[0]).lower():
            release_tx_hash = state.get("release_tx_hash")
            release_failures = int(state.get("release_failures", 0))
            if release_tx_hash:
                release_receipt = _get_receipt_with_retries(
                    dest_w3,
                    release_tx_hash,
                    _RELEASE_RECEIPT_ATTEMPTS,
                    _RELEASE_RECEIPT_INTERVAL_S,
                )
                if release_receipt and release_receipt.get("status") == 1:
                    return AttestationResponse(
                        status="complete",
                        message_hash=message_hash,
                        destination_tx_hash=destination_tx_hash,
                        release_tx_hash=release_tx_hash,
                        attestation_source=attestation_source,
                        attestation_status=attestation_status,
                        release_status="confirmed",
                    )
                if release_receipt and release_receipt.get("status") == 0:
                    state["release_failures"] = release_failures + 1
                    state["release_tx_hash"] = None
                    state["checks"] = 0
                    release_tx_hash = None
                else:
                    return AttestationResponse(
                        status="pending",
                        message_hash=message_hash,
                        destination_tx_hash=destination_tx_hash,
                        release_tx_hash=release_tx_hash,
                        attestation_source=attestation_source,
                        attestation_status=attestation_status,
                        release_status="pending",
                    )

            if release_failures > 0:
                state["checks"] = int(state.get("checks", 0)) + 1
                if state["checks"] % _RELEASE_DELAY_CHECKS != 0:
                    return AttestationResponse(
                        status="pending",
                        message_hash=message_hash,
                        destination_tx_hash=destination_tx_hash,
                        attestation_source=attestation_source,
                        attestation_status=attestation_status,
                        release_status="cooldown",
                    )

            try:
                release_data = _encode_contract_call(
                    release_contract,
                    "releaseUsdc",
                    [release_recipient, amount_to_release],
                )
                base_nonce = dest_w3.eth.get_transaction_count(relayer.address, "pending")
                release_tx_params: Dict[str, Any] = {
                    "from": relayer.address,
                    "to": destination_executor_checksum,
                    "data": release_data,
                    "nonce": base_nonce,
                    "chainId": destination_chain_id,
                    "gas": _DESTINATION_RELEASE_GAS,
                    "value": 0,
                }
                if base_fee is not None:
                    release_tx_params["maxPriorityFeePerGas"] = priority_fee
                    release_tx_params["maxFeePerGas"] = base_fee * 2 + priority_fee
                else:
                    release_tx_params["gasPrice"] = dest_w3.eth.gas_price

                release_signed = relayer.sign_transaction(release_tx_params)
                release_tx_hash = dest_w3.eth.send_raw_transaction(release_signed.raw_transaction).hex()
                logger.info("release usdc tx sent: %s", release_tx_hash)
                state["release_tx_hash"] = release_tx_hash
            except Exception as exc:
                state["release_failures"] = release_failures + 1
                state["checks"] = 0
                logger.info("release attempt failed: %s", exc)
                return AttestationResponse(
                    status="complete",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    release_status="failed",
                )

            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                release_tx_hash=release_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                release_status="submitted",
            )

        swap_tx_hash = state.get("swap_tx_hash")
        swap_failures = int(state.get("swap_failures", 0))
        if swap_tx_hash:
            swap_receipt = _get_receipt_with_retries(
                dest_w3,
                swap_tx_hash,
                _RELEASE_RECEIPT_ATTEMPTS,
                _RELEASE_RECEIPT_INTERVAL_S,
            )
            if swap_receipt and swap_receipt.get("status") == 1:
                return AttestationResponse(
                    status="complete",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    swap_tx_hash=swap_tx_hash,
                    swap_status="confirmed",
                )
            if swap_receipt and swap_receipt.get("status") == 0:
                state["swap_failures"] = swap_failures + 1
                state["swap_tx_hash"] = None
                state["swap_checks"] = 0
                swap_tx_hash = None
            else:
                return AttestationResponse(
                    status="pending",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    swap_tx_hash=swap_tx_hash,
                    swap_status="pending",
                )

        if swap_failures > 0:
            state["swap_checks"] = int(state.get("swap_checks", 0)) + 1
            if state["swap_checks"] % _RELEASE_DELAY_CHECKS != 0:
                return AttestationResponse(
                    status="pending",
                    message_hash=message_hash,
                    destination_tx_hash=destination_tx_hash,
                    attestation_source=attestation_source,
                    attestation_status=attestation_status,
                    swap_status="cooldown",
                )

        amount_in = Decimal(amount_to_release) / Decimal(10**usdc_info[1])
        quote = provider.get_quote(
            amount_in=amount_in,
            token_in=TokenPayload(address=usdc_info[0], decimals=usdc_info[1], chain_id=destination_chain_id),
            token_out=TokenPayload(address=destination_token, decimals=destination_decimals, chain_id=destination_chain_id),
            wallet_address=destination_executor_checksum,
            slippage_perc=0.1,
        )
        if quote is None:
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                swap_status="quote_failed",
            )

        assembled = provider.assemble(quote=quote, wallet_address=destination_executor_checksum)
        if assembled is None or not assembled.get("transaction"):
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                swap_status="assemble_failed",
            )
        odos_data = assembled["transaction"].get("data")
        if not odos_data:
            return AttestationResponse(
                status="pending",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                swap_status="assemble_missing_data",
            )

        try:
            swap_fn = release_contract.functions.executeSwapAndTransfer(
                int(amount_to_release),
                Web3.to_bytes(hexstr=odos_data),
                destination_token,
                release_recipient,
            )
            gas_estimate = swap_fn.estimate_gas({"from": relayer.address})
            base_nonce = dest_w3.eth.get_transaction_count(relayer.address, "pending")
            tx_params: Dict[str, Any] = {
                "from": relayer.address,
                "nonce": base_nonce,
                "chainId": destination_chain_id,
                "gas": int(gas_estimate * 1.2),
            }
            if base_fee is not None:
                tx_params["maxPriorityFeePerGas"] = priority_fee
                tx_params["maxFeePerGas"] = base_fee * 2 + priority_fee
            else:
                tx_params["gasPrice"] = dest_w3.eth.gas_price

            swap_tx = swap_fn.build_transaction(tx_params)
            signed_swap = relayer.sign_transaction(swap_tx)
            swap_tx_hash = dest_w3.eth.send_raw_transaction(signed_swap.raw_transaction).hex()
            logger.info("swap tx sent: %s", swap_tx_hash)
            state["swap_tx_hash"] = swap_tx_hash
        except Exception as exc:
            state["swap_failures"] = swap_failures + 1
            state["swap_checks"] = 0
            logger.info("swap attempt failed: %s", exc)
            return AttestationResponse(
                status="complete",
                message_hash=message_hash,
                destination_tx_hash=destination_tx_hash,
                attestation_source=attestation_source,
                attestation_status=attestation_status,
                swap_status="failed",
            )

        return AttestationResponse(
            status="pending",
            message_hash=message_hash,
            destination_tx_hash=destination_tx_hash,
            attestation_source=attestation_source,
            attestation_status=attestation_status,
            swap_tx_hash=swap_tx_hash,
            swap_status="submitted",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Attestation failed")
        raise HTTPException(status_code=500, detail=f"Attestation failed: {exc}")


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
