"""Outgoing messages: OTP codes and new-scheme alerts.

Two senders:
- console (default): prints the message to the server log. For development and testing.
- WhatsApp Cloud API: used when WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set.
  Business-initiated WhatsApp messages must use templates approved in Meta Business Manager:
    WHATSAPP_OTP_TEMPLATE   (authentication category; one body parameter: the code)
    WHATSAPP_ALERT_TEMPLATE (utility category; body parameters: scheme name, benefit, link)
  Meta charges per message for these, so this part is not free.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

log = logging.getLogger("schemesetu.messaging")


@dataclass
class SendResult:
    ok: bool
    channel: str
    detail: str = ""


def _whatsapp_template(to: str, template: str, lang: str, params: list[str], *, otp_button: bool = False) -> SendResult:
    s = get_settings()
    components: list[dict] = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}]
    if otp_button:  # authentication templates carry the code in a copy-code button too
        components.append({"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": params[0]}]})
    payload = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "template",
        "template": {"name": template, "language": {"code": "hi" if lang == "hi" else "en"}, "components": components},
    }
    url = f"https://graph.facebook.com/{s.whatsapp_api_version}/{s.whatsapp_phone_number_id}/messages"
    try:
        res = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {s.whatsapp_token}"}, timeout=15)
    except httpx.HTTPError as e:
        log.warning("WhatsApp send failed: %s", e)
        return SendResult(False, "whatsapp", str(e))
    if res.status_code >= 400:
        log.warning("WhatsApp API %s: %s", res.status_code, res.text[:300])
        return SendResult(False, "whatsapp", f"HTTP {res.status_code}")
    return SendResult(True, "whatsapp")


def send_otp(phone: str, code: str, lang: str = "en") -> SendResult:
    s = get_settings()
    if s.whatsapp_enabled:
        return _whatsapp_template(phone, s.whatsapp_otp_template, lang, [code], otp_button=True)
    log.warning("[console] OTP for %s: %s", phone, code)
    print(f"[SchemeSetu] OTP for {phone}: {code}", flush=True)
    return SendResult(True, "console")


def send_scheme_alert(phone: str, scheme_name: str, benefit: str, link: str, lang: str = "en") -> SendResult:
    s = get_settings()
    if s.whatsapp_enabled:
        return _whatsapp_template(phone, s.whatsapp_alert_template, lang, [scheme_name, benefit, link])
    print(f"[SchemeSetu] WhatsApp alert to {phone}: {scheme_name} | {benefit} | {link}", flush=True)
    return SendResult(True, "console")
