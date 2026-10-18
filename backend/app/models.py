"""Pydantic models shared across the SchemeSetu backend.

Privacy by design: `Profile` has NO field for Aadhaar or any other ID number.
Because `extra="ignore"` is set, anything an LLM or OCR step returns outside the
declared fields (e.g. "aadhaar_number") is silently dropped before it can reach the
rules engine or the database.
"""

from __future__ import annotations

from typing import Any, Literal, get_args, get_origin

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Gender = Literal["female", "male", "other"]
Category = Literal["general", "obc", "sc", "st"]
CourseLevel = Literal["school", "iti", "diploma", "undergraduate", "postgraduate", "phd"]
Qualification = Literal["none", "class_8", "class_10", "class_12", "iti", "diploma", "graduate", "postgraduate"]
BusinessStatus = Literal["none", "planning_new", "running"]
Kind = Literal[
    "scholarship",
    "internship",
    "apprenticeship",
    "skill_training",
    "education_loan",
    "business_loan",
    "startup_funding",
    "income_support",
    "pension",
    "insurance",
    "health_cover",
    "savings",
    "housing",
    "household",
    "maternity",
]
Op = Literal["eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in"]
RuleOutcome = Literal["pass", "fail", "unknown"]
SchemeStatus = Literal["eligible", "not_eligible", "needs_info"]

ORDER_OPS = ("gt", "gte", "lt", "lte")
LIST_OPS = ("in", "not_in")


class LocalizedText(BaseModel):
    en: str = Field(min_length=1)
    hi: str = Field(min_length=1)


# --------------------------------------------------------------------------- profile


class Profile(BaseModel):
    """Structured citizen profile. Every field is optional: None means "not known yet"."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    beneficiary_relation: str | None = Field(
        default=None, description='Who the benefit is for: "self", "mother", ... (informational only)'
    )
    age: int | None = Field(default=None, ge=0, le=120)
    gender: Gender | None = None
    state: str | None = None
    annual_income: int | None = Field(default=None, ge=0, description="Annual family income in INR")
    category: Category | None = None
    is_farmer: bool | None = None
    owns_cultivable_land: bool | None = None
    is_bpl: bool | None = None
    is_student: bool | None = None
    is_post_matric_student: bool | None = None
    is_income_tax_payer: bool | None = None
    is_govt_employee: bool | None = None
    has_lpg_connection: bool | None = None
    has_bank_account: bool | None = None
    has_daughter_under_10: bool | None = None
    # education
    course_level: CourseLevel | None = Field(default=None, description="What the person is studying now")
    is_final_year: bool | None = None
    is_technical_course: bool | None = Field(default=None, description="AICTE-approved technical course")
    class12_top20: bool | None = Field(default=None, description="Above the 80th percentile of their Class 12 board")
    gets_other_scholarship: bool | None = None
    admitted_to_qhei: bool | None = Field(default=None, description="Merit admission to a notified top institution")
    highest_qualification: Qualification | None = None
    # work and business
    is_employed_full_time: bool | None = None
    family_has_govt_employee: bool | None = None
    is_unorganised_worker: bool | None = None
    has_epf_esic_nps: bool | None = None
    business_status: BusinessStatus | None = None
    is_street_vendor: bool | None = None
    is_new_dpiit_startup: bool | None = None
    # family and home
    is_minority: bool | None = Field(default=None, description="Muslim, Christian, Sikh, Buddhist, Jain or Parsi")
    has_disability: bool | None = Field(default=None, description="Certified disability of 40% or more")
    is_pregnant_or_new_mother: bool | None = None
    is_small_marginal_farmer: bool | None = Field(default=None, description="Farmland of 2 hectares or less")
    lives_in_urban_area: bool | None = None
    owns_pucca_house: bool | None = None

    @field_validator("gender", "category", "course_level", "highest_qualification", "business_status", mode="before")
    @classmethod
    def _lowercase_enums(cls, v: Any) -> Any:
        return v.strip().lower() if isinstance(v, str) else v

    def merged_with(self, other: "Profile") -> "Profile":
        """New profile where every non-null field of `other` overrides this one."""
        data = self.model_dump()
        data.update(other.model_dump(exclude_none=True))
        return Profile(**data)

    def known_fields(self) -> list[str]:
        return [k for k, v in self.model_dump().items() if v is not None]


NON_RULE_FIELDS = {"beneficiary_relation"}
RULE_FIELDS: tuple[str, ...] = tuple(f for f in Profile.model_fields if f not in NON_RULE_FIELDS)


def field_kind(field: str) -> Literal["bool", "int", "enum", "str"]:
    """Base type of a Profile field, ignoring Optional."""
    annotation = Profile.model_fields[field].annotation
    args = [a for a in get_args(annotation) if a is not type(None)] or [annotation]
    base = args[0]
    if base is bool:
        return "bool"
    if base is int:
        return "int"
    if get_origin(base) is Literal:
        return "enum"
    return "str"


def enum_options(field: str) -> tuple[str, ...]:
    annotation = Profile.model_fields[field].annotation
    for a in get_args(annotation):
        if get_origin(a) is Literal:
            return get_args(a)
    return ()


def _value_matches_kind(field: str, value: Any) -> bool:
    kind = field_kind(field)
    if kind == "bool":
        return isinstance(value, bool)
    if kind == "int":
        return isinstance(value, int) and not isinstance(value, bool)
    if kind == "enum":
        return value in enum_options(field)
    return isinstance(value, str)


# --------------------------------------------------------------------------- schemes


class Topic(BaseModel):
    """A browsing group such as "Students & youth". A scheme can sit in several topics."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9_]+$")
    name: LocalizedText
    description: LocalizedText
    icon: str = Field(min_length=1, description="Icon name the frontend maps to a glyph")


class Rule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    field: str
    op: Op
    value: Any
    description: str = Field(min_length=1)
    description_hi: str = Field(min_length=1)
    clause: str = Field(min_length=1)
    source_url: str | None = None  # overrides the scheme-level source when set
    group: str | None = None  # rules sharing a group are ORed

    @model_validator(mode="after")
    def _check_field_op_value(self) -> "Rule":
        if self.field not in RULE_FIELDS:
            raise ValueError(f"rule {self.id}: unknown profile field '{self.field}'")
        kind = field_kind(self.field)
        if self.op in ORDER_OPS and kind != "int":
            raise ValueError(f"rule {self.id}: '{self.op}' needs a numeric field, '{self.field}' is {kind}")
        if self.op in LIST_OPS:
            if not isinstance(self.value, list) or not self.value:
                raise ValueError(f"rule {self.id}: '{self.op}' needs a non-empty list value")
            values = self.value
        else:
            values = [self.value]
        for v in values:
            if not _value_matches_kind(self.field, v):
                raise ValueError(f"rule {self.id}: value {v!r} does not fit field '{self.field}' ({kind})")
        return self


class Scheme(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9_]+$")
    name: str = Field(min_length=1)
    name_hi: str = Field(min_length=1)
    level: Literal["central", "state"] = "central"
    ministry: str = Field(min_length=1)
    ministry_hi: str | None = None
    topics: list[str] = Field(min_length=1)
    kind: Kind
    benefit: LocalizedText
    documents: list[LocalizedText] = Field(min_length=1)
    notes: LocalizedText | None = Field(default=None, description="Caveats shown with the scheme, e.g. rules to confirm")
    source_url: str = Field(pattern=r"^https://")
    rules: list[Rule] = Field(min_length=1)
    verified: bool = False
    last_verified: str | None = None

    @model_validator(mode="after")
    def _check_rules(self) -> "Scheme":
        ids = [r.id for r in self.rules]
        dupes = {i for i in ids if ids.count(i) > 1}
        if dupes:
            raise ValueError(f"scheme {self.id}: duplicate rule ids {sorted(dupes)}")
        groups: dict[str, int] = {}
        for r in self.rules:
            if r.group:
                groups[r.group] = groups.get(r.group, 0) + 1
        lonely = [g for g, n in groups.items() if n < 2]
        if lonely:
            raise ValueError(f"scheme {self.id}: OR-group(s) {lonely} have only one rule; drop the group")
        return self


# --------------------------------------------------------------------------- results


class RuleResult(BaseModel):
    rule_id: str
    field: str
    op: Op
    expected: Any
    actual: Any
    outcome: RuleOutcome
    description: str
    description_hi: str
    clause: str
    source_url: str
    group: str | None = None


class SchemeResult(BaseModel):
    scheme_id: str
    name: str
    name_hi: str
    topics: list[str]
    kind: Kind
    status: SchemeStatus
    rule_results: list[RuleResult]
    passed_count: int
    total_rules: int
    missing_fields: list[str]
    failed_reasons: list[LocalizedText]
    benefit: LocalizedText
    documents: list[LocalizedText]
    notes: LocalizedText | None
    source_url: str
    verified: bool
    last_verified: str | None
