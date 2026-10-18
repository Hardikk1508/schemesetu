"""HTTP API for the SchemeSetu frontend.

A thin layer over the rules engine: no eligibility logic lives here.

Run (from backend/):
    uvicorn app.api:app --reload
"""

from __future__ import annotations

from typing import Literal

from collections import Counter
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import get_args

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app import accounts
from app.ai import assistant
from app.db import init_db
from app.i18n import ENUM_LABELS, FIELD_HINTS, FIELD_LABELS, FIELD_UNITS, KIND_LABELS, field_question
from app.models import (
    RULE_FIELDS,
    Kind,
    LocalizedText,
    Profile,
    Scheme,
    SchemeResult,
    Topic,
    enum_options,
    field_kind,
)
from app.schemes import data_note, get_scheme, get_schemes, get_topic, get_topics
from app.services.rules_engine import evaluate_all, missing_fields_across, rank_results

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


app = FastAPI(title="SchemeSetu API", version="0.2.0", lifespan=lifespan)
app.include_router(accounts.router)
app.include_router(assistant.router)


# --------------------------------------------------------------------------- schemas


class FieldOption(BaseModel):
    value: str
    label: LocalizedText


class FieldMeta(BaseModel):
    """Everything the frontend needs to ask about one profile field."""

    field: str
    kind: Literal["bool", "int", "enum", "str"]
    label: LocalizedText
    question: LocalizedText
    hint: LocalizedText | None = None
    options: list[FieldOption] = []
    min: int | None = None
    max: int | None = None
    unit: Literal["inr", "years"] | None = None


class KindInfo(BaseModel):
    kind: Kind
    label: LocalizedText


class KindCount(KindInfo):
    count: int


class TopicSummary(Topic):
    scheme_count: int
    kinds: list[KindCount] = Field(description="Kinds of scheme in this topic, most common first")


class SchemesResponse(BaseModel):
    data_note: str
    schemes: list[Scheme]


class EligibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: Profile = Field(default_factory=Profile)
    skipped: list[str] = Field(default=[], description="Fields the user chose not to answer; never suggested again")
    topic: str | None = Field(default=None, description="Only check schemes in this topic")

    @field_validator("skipped")
    @classmethod
    def _known_fields(cls, v: list[str]) -> list[str]:
        unknown = sorted(set(v) - set(RULE_FIELDS))
        if unknown:
            raise ValueError(f"unknown field(s): {unknown}")
        return v


class EligibilitySummary(BaseModel):
    eligible: int
    needs_info: int
    not_eligible: int


class EligibilityResponse(BaseModel):
    results: list[SchemeResult]
    next_fields: list[str] = Field(description="Unanswered fields, most useful first")
    summary: EligibilitySummary
    data_note: str


# --------------------------------------------------------------------------- helpers


def _localized(pair: tuple[str, str]) -> LocalizedText:
    return LocalizedText(en=pair[0], hi=pair[1])


def _bounds(field: str) -> tuple[int | None, int | None]:
    lo = hi = None
    for constraint in Profile.model_fields[field].metadata:
        lo = getattr(constraint, "ge", lo)
        hi = getattr(constraint, "le", hi)
    return lo, hi


def kind_info(kind: str) -> KindInfo:
    return KindInfo(kind=kind, label=_localized(KIND_LABELS[kind]))


def topic_summary(topic: Topic) -> TopicSummary:
    schemes = get_schemes(topic.id)
    counts = Counter(s.kind for s in schemes)
    return TopicSummary(
        **topic.model_dump(),
        scheme_count=len(schemes),
        kinds=[KindCount(**kind_info(k).model_dump(), count=n) for k, n in counts.most_common()],
    )


def _known_topic(topic_id: str | None) -> str | None:
    if topic_id is None:
        return None
    try:
        return get_topic(topic_id).id
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown topic id: {topic_id}") from None


def field_meta(field: str) -> FieldMeta:
    kind = field_kind(field)
    options = [
        FieldOption(value=v, label=_localized(ENUM_LABELS.get(field, {}).get(v, (v, v))))
        for v in enum_options(field)
    ]
    lo, hi = _bounds(field) if kind == "int" else (None, None)
    return FieldMeta(
        field=field,
        kind=kind,
        label=_localized(FIELD_LABELS.get(field, (field, field))),
        question=LocalizedText(en=field_question(field, "en"), hi=field_question(field, "hi")),
        hint=_localized(FIELD_HINTS[field]) if field in FIELD_HINTS else None,
        options=options,
        min=lo,
        max=hi,
        unit=FIELD_UNITS.get(field),
    )


# --------------------------------------------------------------------------- routes


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/topics", response_model=list[TopicSummary])
def list_topics() -> list[TopicSummary]:
    return [topic_summary(t) for t in get_topics()]


@app.get("/api/topics/{topic_id}", response_model=TopicSummary)
def read_topic(topic_id: str) -> TopicSummary:
    return topic_summary(get_topic(_known_topic(topic_id)))


@app.get("/api/kinds", response_model=list[KindInfo])
def list_kinds() -> list[KindInfo]:
    return [kind_info(k) for k in get_args(Kind)]


@app.get("/api/schemes", response_model=SchemesResponse)
def list_schemes(topic: str | None = None) -> SchemesResponse:
    return SchemesResponse(data_note=data_note(), schemes=get_schemes(_known_topic(topic)))


@app.get("/api/schemes/{scheme_id}", response_model=Scheme)
def read_scheme(scheme_id: str) -> Scheme:
    try:
        return get_scheme(scheme_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"unknown scheme id: {scheme_id}") from None


@app.get("/api/fields", response_model=list[FieldMeta])
def list_fields() -> list[FieldMeta]:
    return [field_meta(f) for f in RULE_FIELDS]


@app.post("/api/eligibility", response_model=EligibilityResponse)
def check_eligibility(req: EligibilityRequest) -> EligibilityResponse:
    results = rank_results(evaluate_all(req.profile, get_schemes(_known_topic(req.topic))))
    skipped = set(req.skipped)
    return EligibilityResponse(
        results=results,
        next_fields=[f for f in missing_fields_across(results) if f not in skipped],
        summary=EligibilitySummary(
            eligible=sum(r.status == "eligible" for r in results),
            needs_info=sum(r.status == "needs_info" for r in results),
            not_eligible=sum(r.status == "not_eligible" for r in results),
        ),
        data_note=data_note(),
    )
