"""Chat assistant: generative AI for language, the rules engine for decisions.

One turn:
  1. understand  — LLM (or the rule-based fallback) turns the message into profile fields,
                   or recognises a question about a scheme
  2. validate    — every field goes through the Profile model; unknown keys (e.g. ID numbers) are dropped
  3. decide      — the deterministic rules engine evaluates schemes and picks the next question
  4. reply       — LLM writes the reply from those facts only (or a bilingual template does)

The server is stateless: the client sends the profile so far and gets the updated one back.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.ai import fallback
from app.ai.llm import LLMError, chat_json, chat_text, model_name
from app.i18n import FIELD_LABELS, KIND_LABELS, field_label, field_question, format_value
from app.models import RULE_FIELDS, LocalizedText, Profile, Scheme, SchemeResult, enum_options, field_kind
from app.schemes import get_scheme, get_schemes, get_topic
from app.services.rules_engine import evaluate_all, missing_fields_across, rank_results

log = logging.getLogger("schemesetu.assistant")
router = APIRouter(prefix="/api")

Language = Literal["en", "hi", "hinglish"]
EXTRACTABLE = (*RULE_FIELDS, "beneficiary_relation")


# --------------------------------------------------------------------------- schemas


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    lang: Literal["en", "hi"] = "en"
    topic: str | None = None
    profile: Profile = Field(default_factory=Profile)
    skipped: list[str] = []
    pending_field: str | None = None
    history: list[ChatTurn] = Field(default=[], max_length=12)
    voice: bool = Field(default=False, description="The reply will be spoken aloud (voice mode)")

    @field_validator("skipped")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        return [f for f in v if f in RULE_FIELDS]

    @field_validator("pending_field")
    @classmethod
    def _pending(cls, v: str | None) -> str | None:
        return v if v in RULE_FIELDS else None


class Understood(BaseModel):
    field: str
    label: LocalizedText
    value: LocalizedText


class Decided(BaseModel):
    scheme_id: str
    name: LocalizedText
    status: Literal["eligible", "not_eligible"]


class ChatResponse(BaseModel):
    reply: str
    language: Language
    profile: Profile
    skipped: list[str]
    pending_field: str | None
    understood: list[Understood]
    decided: list[Decided] = Field(description="Schemes this message moved from 'needs info' to a decision")
    schemes: list[str] = Field(description="Schemes the user asked about")
    results: list[SchemeResult]
    summary: dict[str, int]
    ai_mode: Literal["llm", "basic"]
    model: str | None


class ChatStatus(BaseModel):
    ai_mode: Literal["llm", "basic"]
    model: str | None


# --------------------------------------------------------------------------- understanding


def _field_catalogue() -> str:
    lines = []
    for f in EXTRACTABLE:
        kind = field_kind(f) if f in RULE_FIELDS else "str"
        label = FIELD_LABELS.get(f, (f, f))[0]
        if kind == "enum":
            kind = "one of " + "|".join(enum_options(f))
        elif kind == "int":
            kind = "integer (rupees per year)" if f == "annual_income" else "integer"
        lines.append(f"- {f} ({kind}): {label}")
    return "\n".join(lines)


EXTRACT_SYSTEM = """You read chat messages for SchemeSetu, an Indian government-scheme eligibility helper.
Users write in English, Hindi (Devanagari) or Hinglish (Hindi in Latin letters).
The facts are about the APPLICANT: the person the benefit is for (the user, or e.g. their mother).

Return ONLY a JSON object:
{"intent": "info" | "question" | "dont_know" | "chat",
 "fields": {<field>: <value>, ...}}

Rules:
- "fields": only facts the user clearly states, or a direct answer to the pending question. Never guess.
- Use exactly these field names and value types:
{fields}
- Money is an integer in rupees per year: "2.5 lakh" = 250000. Monthly income x 12.
- A daughter's or other family member's age is NOT the applicant's age.
- Who the applicant is: "meri maa"/"my mother" -> beneficiary_relation "mother", gender "female";
  "papa"/"father" -> "father", "male"; "meri wife pregnant hai" -> the wife is the applicant (gender "female").
- Studying a course (BTech, diploma, "padh raha hoon") -> is_student true and course_level.
  Finished it ("pass kar liya", "graduate") -> highest_qualification instead.
- "berozgar", "unemployed", "no job", "naukri nahi" -> is_employed_full_time false.
- Serving or retired government, railway, defence or PSU staff -> is_govt_employee true.
- Wants to open a shop or business -> business_status "planning_new"; already runs one -> "running".
- state: the full state name ("UP" -> "Uttar Pradesh").
- "intent": "info" if they give facts about the applicant (including answering the pending question);
  "question" if they ask anything (about a scheme, or general things like what BPL means or how to get a certificate);
  "dont_know" if they don't know the answer to the pending question;
  "chat" for greetings, thanks, or "I want to ask something" without a question yet.
  A question that merely mentions a fact ("what is BPL?") is a question, not that fact.
- Never output ID numbers (Aadhaar, PAN, bank account, phone), names or addresses."""


def _llm_understand(req: ChatRequest) -> tuple[str, dict[str, Any], list[str], Language]:
    system = EXTRACT_SYSTEM.replace("{fields}", _field_catalogue())
    pending = req.pending_field
    user = json.dumps(
        {
            "pending_question": field_question(pending, "en") if pending else None,
            "pending_field": pending,
            "known_profile": req.profile.model_dump(exclude_none=True),
            "recent_chat": [t.model_dump() for t in req.history[-6:]],
            "message": req.message,
        },
        ensure_ascii=False,
    )
    data = chat_json(system, user)
    intent = data.get("intent") if data.get("intent") in ("info", "question", "dont_know", "chat") else "chat"
    llm_fields = data.get("fields") if isinstance(data.get("fields"), dict) else {}
    # The rule-based parser is precise on the phrasings it knows; the LLM covers everything else.
    basic_intent, basic_fields, _, _ = _basic_understand(req)
    fields = {**(basic_fields if basic_intent == "info" else {}), **_validated(llm_fields)}
    if intent in ("chat", "question") and basic_intent == "info" and not llm_fields:
        intent = "info"
    # Scheme names are matched locally: cheaper than listing every scheme in the prompt.
    scheme_ids = find_schemes(req.message, names_only=True) if intent == "question" else []
    language: Language = fallback.detect_language(req.message)  # type: ignore[assignment]
    return intent, fields, scheme_ids, language


# Facts specific enough to trust even inside a question ("meri maa 65 ki hai, koi yojana hai?").
STRONG_FACTS = {"age", "annual_income", "beneficiary_relation", "category", "course_level", "highest_qualification",
                "has_daughter_under_10"}


def _basic_understand(req: ChatRequest) -> tuple[str, dict[str, Any], list[str], Language]:
    text = req.message
    language: Language = fallback.detect_language(text)  # type: ignore[assignment]
    if req.pending_field and fallback.is_dont_know(text):
        return "dont_know", {}, [], language
    if fallback.wants_to_ask(text) or fallback.is_greeting(text):
        return "chat", {}, [], language
    fields = fallback.extract_free_text(text)
    question = fallback.looks_like_question(text)
    # "BPL kya hota hai?" asks about BPL; it doesn't say the family is BPL.
    if question and not fields.keys() & STRONG_FACTS:
        return "question", {}, find_schemes(text, names_only=True), language
    if req.pending_field and req.pending_field not in fields and not question:
        value = fallback.answer_pending(req.pending_field, text)
        if value is not None:
            fields[req.pending_field] = value
    if fields:
        return "info", fields, [], language
    return "other", {}, [], language


# Words in many scheme names that don't identify one scheme ("pension yojana" asks about a kind, not APY).
GENERIC_NAME_WORDS = {"yojana", "yojna", "scheme", "schemes", "loan", "loans", "pradhan", "mantri", "national", "students", "student",
                      "for", "the", "and", "liye", "kaun", "kaunsi", "konsi", "hain", "hai", "kya", "yojanaen", "योजना",
                      "योजनाएँ", "प्रधानमंत्री", "राष्ट्रीय"}


def find_schemes(text: str, limit: int = 2, names_only: bool = False) -> list[str]:
    """Keyword match of a question against scheme names (and, unless names_only, their kinds)."""
    toks = fallback.tokens(text)
    ignore = fallback.QUESTION_WORDS | (GENERIC_NAME_WORDS | fallback.KIND_WORD_SET if names_only else set())
    words = [w for w in toks if len(w) > 2 and w not in ignore]
    pairs = [a + b for a, b in zip(toks, toks[1:]) if not (a in ignore and b in ignore)]  # "pm kisan" -> "pmkisan"
    scored = []
    for s in get_schemes():
        acronyms = " ".join(re.findall(r"\(([^)]+)\)", s.name))
        names = f"{s.name} {s.name_hi} {s.id.replace('_', ' ')} {acronyms}".lower()
        hay = names if names_only else f"{names} {' '.join(KIND_LABELS[s.kind])}".lower()
        hay_compact = hay.replace("-", "").replace(" ", "")
        score = sum(1 for w in words if w in hay or w in hay_compact)
        score += sum(2 for pair in pairs if len(pair) > 4 and pair in hay_compact.split("(")[0])
        if score:
            scored.append((score, s.id))
    return [sid for _, sid in sorted(scored, key=lambda x: -x[0])[:limit]]


def _canonical_state(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    v = value.strip()
    return fallback.STATE_ABBR.get(v.upper()) or fallback.STATES.get(v.lower()) or v


def _validated(fields: dict[str, Any]) -> dict[str, Any]:
    """Keep only known fields whose values pass the Profile model, one at a time."""
    clean: dict[str, Any] = {}
    for key, value in fields.items():
        if key not in EXTRACTABLE or value is None:
            continue
        if key == "state":
            value = _canonical_state(value)
        try:
            parsed = Profile(**{key: value})
        except ValidationError:
            continue
        if getattr(parsed, key) is not None:
            clean[key] = getattr(parsed, key)
    return clean


# --------------------------------------------------------------------------- replying


def _loc(pair: tuple[str, str]) -> LocalizedText:
    return LocalizedText(en=pair[0], hi=pair[1])


def _benefit_and_notes(scheme_id: str, lang: str) -> dict[str, str]:
    s = get_scheme(scheme_id)
    out = {"benefit": s.benefit.hi if lang == "hi" else s.benefit.en, "official_website": s.source_url}
    if s.notes:
        out["good_to_know"] = s.notes.hi if lang == "hi" else s.notes.en
    return out


def _plain(text: str) -> str:
    """The chat shows plain text: drop markdown emphasis and headings if the model adds them."""
    text = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: m.group(1) or m.group(2), text)
    return re.sub(r"(?m)^#{1,6}\s*", "", text).strip()


def _scheme_facts(s: Scheme, lang: str) -> dict[str, Any]:
    hi = lang == "hi"
    return {
        "name": s.name_hi if hi else s.name,
        "benefit": s.benefit.hi if hi else s.benefit.en,
        "documents": [d.hi if hi else d.en for d in s.documents],
        "conditions": [r.description_hi if hi else r.description for r in s.rules],
        "good_to_know": (s.notes.hi if hi else s.notes.en) if s.notes else None,
        "official_website": s.source_url,
    }


REPLY_SYSTEM = """You are SchemeSetu's assistant: a friendly helper for people in India looking for government schemes.
Reply in {language}, conversationally. Be concise: usually 2 to 5 sentences, under 100 words. Plain text only:
no markdown, no bold, no headings; a short numbered list is fine when giving steps.

You are given the user's message, the recent chat, and FACTS from SchemeSetu's rules engine.
1. First respond directly to what the user said or asked.
   - About a specific scheme: use "scheme_data" only, copying amounts exactly. Do not mention months, dates or
     timings unless scheme_data states them. If it doesn't contain what they asked (dates, helpline numbers),
     say SchemeSetu doesn't have that detail and give the scheme's official website.
   - If "reference" is given, base your answer on it.
   - If "schemes_in_topic" or "schemes_of_this_kind" is given, the user wants a list: name those schemes (grouped by
     kind if helpful) and offer to check which fit. Don't add schemes that aren't listed.
   - Other general questions (certificates, documents, how to apply in general): answer briefly from general
     knowledge and suggest confirming at the official office or website. If you are not sure, say so.
     Never guess what an abbreviation stands for, and never invent dates, amounts, rules or links.
   - Greetings, thanks, or "I want to ask something": respond naturally and invite their question.
2. NEVER say or imply someone is eligible or not eligible for a scheme unless the facts list it
   ("newly_likely_eligible", "newly_not_eligible"). Never invent scheme names.
3. If facts include "understood", confirm it in a few words. If facts include "newly_likely_eligible", mention those
   schemes by name with their benefit as given (don't add to it). If facts include "next_question", end with that question, phrased naturally (only one question).
   If there is no "next_question", do not ask the user for any personal details."""

VOICE_STYLE = """

This reply will be SPOKEN aloud by a voice assistant. Talk like a person on a phone call: 1 to 3 short sentences,
no lists, no symbols, no links or URLs (say "the official website" instead). If listing schemes, name at most
three and say how many more there are. Name newly likely-eligible schemes; don't talk about schemes that were
ruled out unless the user asks."""

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi (Devanagari script)", "hinglish": "Hinglish (Hindi in Latin letters, like the user)"}


MONTHS = ("january", "february", "march", "april", "june", "july", "august", "september", "october", "november",
          "december", "janvari", "farvari", "aprail", "julai", "agast", "sitambar", "aktubar", "navambar", "disambar",
          "जनवरी", "फ़रवरी", "फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर")


def _unsupported_specifics(reply: str, facts: dict[str, Any]) -> list[str]:
    """Months, years or rupee amounts in a scheme answer that the scheme data doesn't contain."""
    source = json.dumps(facts, ensure_ascii=False).lower()
    low = reply.lower()
    bad = [m for m in MONTHS if re.search(rf"(?<![a-z]){m}(?![a-z])", low) and m not in source]
    bad += [y for y in re.findall(r"\b(?:19|20)\d{2}\b", low) if y not in source]
    digits_in_source = re.sub(r"[,\s]", "", source)
    bad += [a for a in re.findall(r"₹\s?[\d,]+", reply) if re.sub(r"[₹,\s]", "", a) not in digits_in_source]
    return bad


def _template_reply(lang: str, facts: dict[str, Any]) -> str:
    hi = lang == "hi"
    parts: list[str] = []
    if facts.get("schemes_in_topic"):
        group = facts["schemes_in_topic"]
        names = ", ".join(x["name"] for x in group["schemes"])
        parts.append(
            f"SchemeSetu में '{group['topic']}' के लिए {len(group['schemes'])} योजनाएँ हैं: {names}। आवेदक के बारे में बताइए, मैं जाँच दूँगा कि कौन-सी मेल खाती हैं।" if hi
            else f"SchemeSetu has {len(group['schemes'])} schemes under '{group['topic']}': {names}. Tell me about the applicant and I'll check which ones fit."
        )
    if facts.get("schemes_of_this_kind"):
        group = facts["schemes_of_this_kind"]
        names = ", ".join(x["name"] for x in group["schemes"][:8])
        parts.append(
            f"SchemeSetu में {group['kind']} की ये योजनाएँ हैं: {names}। आवेदक के बारे में बताइए (उम्र, पढ़ाई, परिवार की आय, वर्ग), मैं जाँच दूँगा कि कौन-सी मेल खाती हैं।" if hi
            else f"Here are the {group['kind'].lower()} on SchemeSetu: {names}. Tell me about the applicant (age, studies, family income, category) and I'll check which ones fit."
        )
    if facts.get("answer_from_scheme_data"):
        for s in facts["answer_from_scheme_data"]:
            docs = ", ".join(s["documents"])
            if hi:
                parts.append(f"{s['name']}: {s['benefit']} ज़रूरी दस्तावेज़: {docs}। आधिकारिक वेबसाइट: {s['official_website']}")
            else:
                parts.append(f"{s['name']}: {s['benefit']} Documents: {docs}. Official website: {s['official_website']}")
    elif facts.get("glossary_answer"):
        parts.append(facts["glossary_answer"])
    elif facts.get("question_not_found"):
        parts.append(
            "इसका जवाब अभी मेरे पास नहीं है। मैं SchemeSetu की किसी भी योजना के बारे में बता सकता हूँ (नाम लिखें, जैसे 'पीएम किसान'), "
            "बीपीएल या आय प्रमाण पत्र जैसे शब्द समझा सकता हूँ, या जाँच सकता हूँ कि आप किन योजनाओं के पात्र हैं।" if hi
            else "I don't have an answer for that yet. I can explain any scheme on SchemeSetu (try its name, like 'PM Kisan'), "
            "common terms like BPL or income certificate, or check which schemes fit you."
        )
    if facts.get("wants_to_ask"):
        parts.append("ज़रूर! योजनाओं के बारे में कुछ भी पूछिए: कौन आवेदन कर सकता है, कौन-से दस्तावेज़ चाहिए, या आवेदन कैसे करें।" if hi
                     else "Sure! Ask me anything about government schemes: who can apply, which documents you need, or how to apply.")
    if facts.get("greeting"):
        parts.append("नमस्ते! आवेदक के बारे में बताइए, जैसे 'मेरी माँ 65 साल की हैं और किसान हैं'।" if hi
                     else "Namaste! Tell me about the person applying, for example 'my mother is 65 and a farmer in UP'.")
    if facts.get("understood"):
        parts.append(("समझ गया: " if hi else "Got it: ") + ", ".join(facts["understood"]) + ("।" if hi else "."))
    if facts.get("skipped"):
        parts.append("ठीक है, इसे छोड़ते हैं।" if hi else "No problem, let's skip that.")
    if facts.get("newly_likely_eligible"):
        names = ", ".join(s["name"] for s in facts["newly_likely_eligible"])
        parts.append(f"✅ आप इनके पात्र हो सकते हैं: {names}।" if hi else f"✅ You may qualify for: {names}.")
    if facts.get("newly_not_eligible"):
        ruled_out = [s["name"] for s in facts["newly_not_eligible"]]
        names = ", ".join(ruled_out[:3])
        more = len(ruled_out) - 3
        if more > 0:
            names += f" और {more} अन्य" if hi else f" and {more} more"
        parts.append(f"इनके पात्र नहीं: {names}।" if hi else f"Not eligible for: {names}.")
    if facts.get("did_not_understand"):
        parts.append("माफ़ कीजिए, मैं समझ नहीं पाया।" if hi else "Sorry, I didn't catch that.")
    if facts.get("next_question"):
        q = facts["next_question"]
        if facts.get("answer_options"):
            q += " (" + " / ".join(facts["answer_options"]) + ")"
        parts.append(q)
    elif facts.get("all_checked"):
        n = facts.get("eligible_total", 0)
        parts.append(f"सब जाँच हो गई। आप {n} योजनाओं के पात्र हो सकते हैं; पूरे नतीजे साथ में देखें।" if hi
                     else f"That's everything. You may qualify for {n} scheme(s); see the full results alongside.")
    return " ".join(parts)


# --------------------------------------------------------------------------- the turn


def _simple_turn(req: ChatRequest) -> bool:
    """A tap or short answer to the pending question ("Yes", "2.5 lakh", an option, "don't know").
    The basic parser handles these reliably, so they skip the LLM: faster, and kinder to free-tier limits."""
    text = req.message
    if fallback.is_greeting(text):
        return True
    if not req.pending_field or fallback.looks_like_question(text):
        return False
    if fallback.is_dont_know(text):
        return True
    return len(fallback.tokens(text)) <= 6 and fallback.answer_pending(req.pending_field, text) is not None


@router.get("/chat/status", response_model=ChatStatus)
def chat_status() -> ChatStatus:
    model = model_name()
    return ChatStatus(ai_mode="llm" if model else "basic", model=model)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    topic = req.topic
    if topic is not None:
        try:
            get_topic(topic)
        except KeyError:
            topic = None
    schemes = get_schemes(topic)

    ai_mode: Literal["llm", "basic"] = "basic"
    if _simple_turn(req):
        intent, raw_fields, scheme_ids, language = _basic_understand(req)
    else:
        try:
            intent, raw_fields, scheme_ids, language = _llm_understand(req)
            ai_mode = "llm"
        except LLMError as e:
            if model_name():
                log.warning("LLM understanding failed, using basic parser: %s", e)
            intent, raw_fields, scheme_ids, language = _basic_understand(req)

    fields = _validated(raw_fields)
    skipped = [f for f in req.skipped if f not in fields]
    if intent == "dont_know" and req.pending_field and req.pending_field not in fields:
        skipped.append(req.pending_field)

    before = {r.scheme_id: r.status for r in evaluate_all(req.profile, schemes)}
    profile = req.profile.merged_with(Profile(**fields))
    results = rank_results(evaluate_all(profile, schemes))
    next_field = next((f for f in missing_fields_across(results) if f not in skipped), None)

    decided = [
        Decided(scheme_id=r.scheme_id, name=LocalizedText(en=r.name, hi=r.name_hi), status=r.status)
        for r in results
        if before.get(r.scheme_id) == "needs_info" and r.status in ("eligible", "not_eligible")
    ]

    # Facts for the reply, in the reply's language ("hinglish" uses English source text).
    lang = "hi" if language == "hi" else "en"
    facts: dict[str, Any] = {
        "user_message": req.message,
        "understood": [f"{field_label(k, lang)}: {format_value(k, v, lang)}" for k, v in fields.items() if k != "state"],
        "skipped": intent == "dont_know",
        "newly_likely_eligible": [
            {"name": d.name.hi if lang == "hi" else d.name.en, **_benefit_and_notes(d.scheme_id, lang)}
            for d in decided
            if d.status == "eligible"
        ],
        "newly_not_eligible": [{"name": d.name.hi if lang == "hi" else d.name.en} for d in decided if d.status == "not_eligible"],
        "eligible_total": sum(r.status == "eligible" for r in results),
        "still_to_check": sum(r.status == "needs_info" for r in results),
        "all_checked": next_field is None,
    }
    asking = intent in ("question", "chat")
    if intent == "question":
        kind = fallback.kind_asked(req.message) if not scheme_ids else None
        if scheme_ids:
            facts["answer_from_scheme_data"] = [_scheme_facts(get_scheme(i), lang) for i in scheme_ids]
        elif ai_mode == "basic" and (glossary := fallback.glossary_answer(req.message, lang)):
            facts["glossary_answer"] = glossary
        elif kind:
            facts["schemes_of_this_kind"] = {
                "kind": KIND_LABELS[kind][lang == "hi"],
                "schemes": [
                    {"name": s.name_hi if lang == "hi" else s.name, "benefit": s.benefit.hi if lang == "hi" else s.benefit.en}
                    for s in schemes if s.kind == kind
                ],
            }
        elif topic_id := fallback.topic_asked(req.message):
            topic = get_topic(topic_id)
            facts["schemes_in_topic"] = {
                "topic": topic.name.hi if lang == "hi" else topic.name.en,
                "schemes": [
                    {"name": s.name_hi if lang == "hi" else s.name, "kind": KIND_LABELS[s.kind][lang == "hi"]}
                    for s in get_schemes(topic_id)
                ],
            }
        elif ai_mode == "llm":
            facts["general_question"] = True
            if reference := fallback.glossary_answer(req.message, lang):
                facts["reference"] = reference  # vetted text, so the model rephrases instead of recalling
        else:
            facts["question_not_found"] = True
    elif intent == "chat":
        facts["greeting" if fallback.is_greeting(req.message) else "wants_to_ask"] = True
    elif intent == "other" and not fields:
        facts["did_not_understand"] = True
    if next_field and not asking:
        facts["next_question"] = field_question(next_field, lang)
        kind = field_kind(next_field)
        if kind == "bool":
            facts["answer_options"] = ["हाँ", "नहीं"] if lang == "hi" else ["yes", "no"]

    reply = ""
    if ai_mode == "llm":
        try:
            context = {"recent_chat": [t.model_dump() for t in req.history[-6:]], **facts}
            system = REPLY_SYSTEM.replace("{language}", LANGUAGE_NAMES[language]) + (VOICE_STYLE if req.voice else "")
            reply = chat_text(system, json.dumps(context, ensure_ascii=False))
            reply = _plain(reply)
            if facts.get("answer_from_scheme_data") and (bad := _unsupported_specifics(reply, facts)):
                log.warning("LLM reply stated details not in the scheme data %s; using the template", bad)
                reply = ""
        except LLMError as e:
            log.warning("LLM reply failed, using template: %s", e)
    if not reply:
        reply = _template_reply(lang, facts)

    return ChatResponse(
        reply=reply,
        language=language,
        profile=profile,
        skipped=skipped,
        pending_field=req.pending_field if asking else next_field,
        understood=[
            Understood(
                field=k,
                label=_loc(FIELD_LABELS.get(k, (k, k))),
                value=LocalizedText(en=format_value(k, v, "en"), hi=format_value(k, v, "hi")),
            )
            for k, v in fields.items()
        ],
        decided=decided,
        schemes=scheme_ids,
        results=results,
        summary={s: sum(r.status == s for r in results) for s in ("eligible", "needs_info", "not_eligible")},
        ai_mode=ai_mode,
        model=model_name() if ai_mode == "llm" else None,
    )
