"""Minimal client for any OpenAI-compatible chat API (Groq by default; also Ollama, OpenAI, OpenRouter).

Configure with LLM_API_KEY (or GROQ_API_KEY), LLM_BASE_URL and LLM_MODEL. Every caller must
handle LLMError and fall back to the rule-based path, so the app never depends on the LLM.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger("schemesetu.llm")


class LLMError(Exception):
    pass


def _post(messages: list[dict[str, str]], *, model: str, json_mode: bool, max_tokens: int) -> str:
    s = get_settings()
    if not s.llm_enabled:
        raise LLMError("no LLM configured")
    body: dict[str, Any] = {"model": model, "messages": messages, "temperature": 0.1, "max_tokens": max_tokens}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if "gpt-oss" in model:
        body["reasoning_effort"] = "low"  # these are reasoning models; keep latency down
    try:
        res = httpx.post(
            f"{s.llm_base_url}/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {s.llm_api_key}"},
            timeout=s.llm_timeout,
        )
    except httpx.HTTPError as e:
        raise LLMError(f"request failed: {e}") from e
    if res.status_code == 429:
        raise LLMError("HTTP 429 rate limited")  # callers fall back at once rather than make the user wait
    if res.status_code >= 400:
        log.warning("LLM API %s: %s", res.status_code, res.text[:300])
        raise LLMError(f"HTTP {res.status_code}")
    try:
        content = res.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError) as e:
        raise LLMError("unexpected response shape") from e
    if not content.strip():
        raise LLMError("empty response")
    return content


# Output budgets. They count towards per-minute token limits, so keep them tight; gpt-oss
# reasoning (effort "low") usually takes well under 200 tokens.
EXTRACT_MAX_TOKENS = 700
REPLY_MAX_TOKENS = 600


def chat_json(system: str, user: str, *, max_tokens: int = EXTRACT_MAX_TOKENS) -> dict[str, Any]:
    """Understanding step, on LLM_MODEL."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    content = _post(messages, model=get_settings().llm_model, json_mode=True, max_tokens=max_tokens)
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())  # tolerate fenced output
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise LLMError("response was not JSON") from e
    if not isinstance(data, dict):
        raise LLMError("response was not a JSON object")
    return data


def chat_text(system: str, user: str, *, max_tokens: int = REPLY_MAX_TOKENS) -> str:
    """Reply step, on LLM_REPLY_MODEL."""
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    return _post(messages, model=get_settings().llm_reply_model, json_mode=False, max_tokens=max_tokens).strip()


def model_name() -> str | None:
    """The model users read (the reply model), or None when no LLM is configured."""
    s = get_settings()
    return s.llm_reply_model if s.llm_enabled else None
