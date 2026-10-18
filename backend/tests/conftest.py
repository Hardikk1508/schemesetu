"""Test isolation: a throwaway SQLite database, no LLM, no WhatsApp. Set before the app is imported."""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="schemesetu-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["SCHEMESETU_ENV"] = "test"
os.environ["LLM_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["WHATSAPP_TOKEN"] = ""
os.environ["OTP_TEST_NUMBERS"] = "9999999999:123456"

from app.db import init_db  # noqa: E402

init_db()
