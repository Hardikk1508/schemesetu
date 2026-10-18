"""Runtime settings, read from the environment (and backend/.env if present).

Everything has a safe development default, so the app runs with no configuration:
SQLite database, OTPs and WhatsApp messages printed to the console, and the chat
assistant using the built-in parser until an LLM key is set.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Existing environment variables win over .env, so tests and deployments stay in control.
load_dotenv(BACKEND_DIR / ".env", override=False)


def _test_numbers(raw: str) -> dict[str, str]:
    """ "9999999999:123456,9999999998:654321" -> {"+919999999999": "123456", ...}"""
    out: dict[str, str] = {}
    for item in filter(None, (x.strip() for x in raw.split(","))):
        number, _, code = item.partition(":")
        digits = "".join(c for c in number if c.isdigit())[-10:]
        if len(digits) == 10 and code.isdigit() and len(code) == 6:
            out[f"+91{digits}"] = code
    return out


@dataclass(frozen=True)
class Settings:
    env: str
    database_url: str
    secret_key: str
    # LLM (any OpenAI-compatible API; Groq's free tier by default)
    llm_api_key: str
    llm_base_url: str
    llm_model: str
    llm_reply_model: str  # may differ from llm_model; on Groq each model has its own rate limit
    llm_timeout: float
    # Messaging
    whatsapp_token: str
    whatsapp_phone_number_id: str
    whatsapp_api_version: str
    whatsapp_otp_template: str
    whatsapp_alert_template: str
    # Fictional numbers with a fixed code, for testing without SMS/WhatsApp (like Firebase test numbers).
    otp_test_numbers: dict[str, str]

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.llm_api_key)

    @property
    def whatsapp_enabled(self) -> bool:
        return bool(self.whatsapp_token and self.whatsapp_phone_number_id)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env = os.environ.get("SCHEMESETU_ENV", "development").strip().lower()
    storage = BACKEND_DIR / "storage"
    secret = os.environ.get("SECRET_KEY", "")
    if not secret:
        if env == "production":
            raise RuntimeError("SECRET_KEY must be set in production")
        secret = secrets.token_hex(32)  # dev: OTPs in flight don't survive a restart, which is fine
    whatsapp_token = os.environ.get("WHATSAPP_TOKEN", "")
    return Settings(
        env=env,
        database_url=os.environ.get("DATABASE_URL") or f"sqlite:///{storage / 'schemesetu.db'}",
        secret_key=secret,
        llm_api_key=os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY", ""),
        llm_base_url=(os.environ.get("LLM_BASE_URL") or "https://api.groq.com/openai/v1").rstrip("/"),
        llm_model=os.environ.get("LLM_MODEL") or "openai/gpt-oss-20b",
        llm_reply_model=os.environ.get("LLM_REPLY_MODEL") or os.environ.get("LLM_MODEL") or "openai/gpt-oss-20b",
        llm_timeout=float(os.environ.get("LLM_TIMEOUT") or 25),
        whatsapp_token=whatsapp_token,
        whatsapp_phone_number_id=os.environ.get("WHATSAPP_PHONE_NUMBER_ID", ""),
        whatsapp_api_version=os.environ.get("WHATSAPP_API_VERSION") or "v21.0",
        whatsapp_otp_template=os.environ.get("WHATSAPP_OTP_TEMPLATE") or "schemesetu_otp",
        whatsapp_alert_template=os.environ.get("WHATSAPP_ALERT_TEMPLATE") or "schemesetu_new_scheme",
        otp_test_numbers=_test_numbers(os.environ.get("OTP_TEST_NUMBERS", "")),
    )
