from pathlib import Path
import json
from dataclasses import dataclass, field
from web3 import Web3
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware

AVALANCHE_CHAIN_ID = 43114
BASE_CHAIN_ID = 8453
ARBITRUM_CHAIN_ID = 42161

@dataclass
class Token:
    address: str | None = None
    symbol: str | None = None
    name: str | None = None
    decimals: int = field(init=False)
    chain_id: int = None
    chain_name: str = None
    rpc_url: str | None = None
    w3: Web3 = field(init=False, repr=False)


    def __post_init__(self):
        if self.address is None:
            return

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
            raise Exception(f"This chain {chain_id} is not implemented")

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if self.chain_id in [AVALANCHE_CHAIN_ID]:
            self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self.decimals = self._get_decimals()
        if not self.symbol:
            self.symbol = self.get_symbol()
        if not self.name:
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

usdc_avalanche = Token(address="0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", chain_id=AVALANCHE_CHAIN_ID)
btcb_avalanche = Token(address="0x152b9d0FdC40C096757F570A51E494bd4b943E50", chain_id=AVALANCHE_CHAIN_ID)
wbtce_avalanche = Token(address="0x50b7545627a5162f82a992c33b87adc75187b218", chain_id=AVALANCHE_CHAIN_ID)

usdc_base = Token(address="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", chain_id=BASE_CHAIN_ID)
cbbtc_base = Token(address="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", chain_id=BASE_CHAIN_ID)
wbtc_base = Token(address="0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", chain_id=BASE_CHAIN_ID)
tbtc_base = Token(address="0x236aa50979d5f3de3bd1eeb40e81137f22ab794b", chain_id=BASE_CHAIN_ID)

usdc_arbitrum = Token(address="0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chain_id=ARBITRUM_CHAIN_ID)
wbtc_arbitrum = Token(address="0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", chain_id=ARBITRUM_CHAIN_ID)
