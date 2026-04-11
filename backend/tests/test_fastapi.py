from pathlib import Path
import sys
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
for path in (BACKEND_DIR, ROOT_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from backend.fastapi import app


client = TestClient(app)


def quote_payload() -> dict:
    return {
        "amount_in": "1.0",
        "token_in": {"address": "0x1", "chain_id": 43114, "decimals": 8},
        "token_out": {"address": "0x2", "chain_id": 43114, "decimals": 6},
        "wallet_address": None,
        "slippage_perc": 0.1,
    }


def output_amount_payload() -> dict:
    return {
        "amount_in": "0.1",
        "token_in": {"address": "0x1", "chain_id": 43114, "decimals": 8},
        "token_med_in": {"address": "0x2", "chain_id": 43114, "decimals": 6},
        "token_med_out": {"address": "0x3", "chain_id": 8453, "decimals": 6},
        "token_out": {"address": "0x4", "chain_id": 8453, "decimals": 8},
        "wallet_address": None,
        "slippage_perc": 0.1,
    }


def test_quote_ok() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.return_value = {"outAmounts": ["1000000"]}
        response = client.post("/quote", json=quote_payload())
    assert response.status_code == 200
    assert response.json() == pytest.approx(1.0)


def test_quote_provider_fail() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.return_value = None
        response = client.post("/quote", json=quote_payload())
    assert response.status_code == 502


def test_assemble_ok() -> None:
    payload = {
        "quote": {"pathId": "abc"},
        "wallet_address": "0x0000000000000000000000000000000000000000",
    }
    with patch("backend.fastapi.provider.assemble") as mock_assemble:
        mock_assemble.return_value = {"data": "0xdeadbeef"}
        response = client.post("/assemble", json=payload)
    assert response.status_code == 200
    assert response.json() == "0xdeadbeef"


def test_assemble_missing_data() -> None:
    payload = {
        "quote": {"pathId": "abc"},
        "wallet_address": "0x0000000000000000000000000000000000000000",
    }
    with patch("backend.fastapi.provider.assemble") as mock_assemble:
        mock_assemble.return_value = {}
        response = client.post("/assemble", json=payload)
    assert response.status_code == 502


def test_output_amount_ok() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.side_effect = [
            {"outAmounts": ["2000000"]},
            {"outAmounts": ["100000000"]},
        ]
        response = client.post("/output-amount", json=output_amount_payload())
    assert response.status_code == 200
    assert response.json() == pytest.approx(1.0)


def test_output_amount_quote1_fail() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.return_value = None
        response = client.post("/output-amount", json=output_amount_payload())
    assert response.status_code == 502


def test_output_amount_quote1_missing_outamounts() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.return_value = {"outAmounts": []}
        response = client.post("/output-amount", json=output_amount_payload())
    assert response.status_code == 502


def test_output_amount_quote2_fail() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.side_effect = [
            {"outAmounts": ["2000000"]},
            None,
        ]
        response = client.post("/output-amount", json=output_amount_payload())
    assert response.status_code == 502


def test_output_amount_quote2_missing_outamounts() -> None:
    with patch("backend.fastapi.provider.get_quote") as mock_get_quote:
        mock_get_quote.side_effect = [
            {"outAmounts": ["2000000"]},
            {"outAmounts": []},
        ]
        response = client.post("/output-amount", json=output_amount_payload())
    assert response.status_code == 502


def test_quote_validation_missing_token_out() -> None:
    payload = quote_payload()
    payload.pop("token_out")
    response = client.post("/quote", json=payload)
    assert response.status_code == 422


def test_quote_validation_bad_decimals() -> None:
    payload = quote_payload()
    payload["token_in"]["decimals"] = "nope"
    response = client.post("/quote", json=payload)
    assert response.status_code == 422


def test_assemble_validation_missing_wallet_address() -> None:
    payload = {"quote": {"pathId": "abc"}}
    response = client.post("/assemble", json=payload)
    assert response.status_code == 422


def test_output_amount_validation_missing_med_out() -> None:
    payload = output_amount_payload()
    payload.pop("token_med_out")
    response = client.post("/output-amount", json=payload)
    assert response.status_code == 422


def test_output_amount_validation_bad_amount() -> None:
    payload = output_amount_payload()
    payload["amount_in"] = "not-a-number"
    response = client.post("/output-amount", json=payload)
    assert response.status_code == 422


def test_quote_validation_missing_token_in_address() -> None:
    payload = quote_payload()
    payload["token_in"].pop("address")
    response = client.post("/quote", json=payload)
    assert response.status_code == 422


def test_quote_validation_bad_chain_id_type() -> None:
    payload = quote_payload()
    payload["token_out"]["chain_id"] = "not-a-number"
    response = client.post("/quote", json=payload)
    assert response.status_code == 422


def test_output_amount_validation_missing_token_out_address() -> None:
    payload = output_amount_payload()
    payload["token_out"].pop("address")
    response = client.post("/output-amount", json=payload)
    assert response.status_code == 422


def test_output_amount_validation_bad_chain_id_type() -> None:
    payload = output_amount_payload()
    payload["token_med_out"]["chain_id"] = "not-a-number"
    response = client.post("/output-amount", json=payload)
    assert response.status_code == 422
