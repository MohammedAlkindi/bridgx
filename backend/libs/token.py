from pathlib import Path
import json
from dataclasses import dataclass, field

try:
    from web3 import Web3
    from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
except ImportError:  # pragma: no cover - optional dependency for API-only usage
    Web3 = None
    ExtraDataToPOAMiddleware = None

AVALANCHE_CHAIN_ID = 43114
BASE_CHAIN_ID = 8453
ARBITRUM_CHAIN_ID = 42161

@dataclass
class Token:
    address: str | None = None
    symbol: str | None = None
    name: str | None = None
    decimals: int | None = None
    chain_id: int | None = None
    chain_name: str = None
    rpc_url: str | None = None
    w3: "Web3 | None" = field(init=False, repr=False, default=None)


    def __post_init__(self):
        if self.address is None:
            return

        if Web3 is not None:
            self.address = Web3.to_checksum_address(self.address)

        if self.chain_id == AVALANCHE_CHAIN_ID:
            self.rpc_url = self.rpc_url or "https://api.avax.network/ext/bc/C/rpc"
            self.chain_name = "avalanche"
        elif self.chain_id == BASE_CHAIN_ID:
            self.rpc_url = self.rpc_url or "https://base-rpc.publicnode.com"
            self.chain_name = "base"
        elif self.chain_id == ARBITRUM_CHAIN_ID:
            self.rpc_url = self.rpc_url or "https://arb1.arbitrum.io/rpc"
            self.chain_name = "arbitrum"
        else:
            raise Exception(f"This chain {self.chain_id} is not implemented")

        if Web3 is None:
            if self.decimals is None:
                raise Exception("web3 is not installed; decimals must be provided")
            if not self.name and self.symbol:
                self.name = self.symbol.lower()
            return

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if self.chain_id in [AVALANCHE_CHAIN_ID] and ExtraDataToPOAMiddleware is not None:
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        if self.decimals is None:
            self.decimals = self._get_decimals()
        if not self.symbol:
            self.symbol = self.get_symbol()
        if not self.name and self.symbol:
            self.name = self.symbol.lower()

    def _get_decimals(self) -> int:
        """Internal method to fetch token decimals from the blockchain."""

        abi = [
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "type": "function",
            }
        ]
        contract = self.w3.eth.contract(address=self.address, abi=abi)
        return contract.functions.decimals().call()

    def get_symbol(self) -> str:
        """Return the token's on-chain symbol."""
        abi = [
            {
                "constant": True,
                "inputs": [],
                "name": "symbol",
                "outputs": [{"name": "", "type": "string"}],
                "type": "function",
            }
        ]
        contract = self.w3.eth.contract(address=self.address, abi=abi)
        return contract.functions.symbol().call()

weth_avalanche = Token(
    address="0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
    chain_id=AVALANCHE_CHAIN_ID,
    symbol="WETH",
    decimals=18,
)
btcb_avalanche = Token(
    address="0x152b9d0FdC40C096757F570A51E494bd4b943E50",
    chain_id=AVALANCHE_CHAIN_ID,
    symbol="BTCB",
    decimals=8,
)
wbtce_avalanche = Token(
    address="0x50b7545627a5162f82a992c33b87adc75187b218",
    chain_id=AVALANCHE_CHAIN_ID,
    symbol="WBTC.E",
    decimals=8,
)

weth_base = Token(
    address="0x4200000000000000000000000000000000000006",
    chain_id=BASE_CHAIN_ID,
    symbol="WETH",
    decimals=18,
)
cbbtc_base = Token(
    address="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    chain_id=BASE_CHAIN_ID,
    symbol="CBBTC",
    decimals=8,
)
wbtc_base = Token(
    address="0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
    chain_id=BASE_CHAIN_ID,
    symbol="WBTC",
    decimals=8,
)
tbtc_base = Token(
    address="0x236aa50979d5f3de3bd1eeb40e81137f22ab794b",
    chain_id=BASE_CHAIN_ID,
    symbol="TBTC",
    decimals=18,
)

weth_arbitrum = Token(
    address="0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    chain_id=ARBITRUM_CHAIN_ID,
    symbol="WETH",
    decimals=18,
)
wbtc_arbitrum = Token(
    address="0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    chain_id=ARBITRUM_CHAIN_ID,
    symbol="WBTC",
    decimals=8,
)

TOKENS = [
    weth_avalanche, btcb_avalanche, wbtce_avalanche,
    weth_base, cbbtc_base, wbtc_base, tbtc_base,
    weth_arbitrum, wbtc_arbitrum,
]