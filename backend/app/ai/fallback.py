"""Rule-based understanding of chat messages, used when no LLM is configured or it fails.

Handles English, Hindi (Devanagari) and Hinglish for the common cases: yes/no, numbers
("2.5 lakh", "₹2,50,000", "65 saal"), option answers, "don't know", and a few facts in
free text ("meri maa 65 ki hain, kisan hain, UP mein"). Deliberately conservative: when
unsure it extracts nothing and the assistant asks again.
"""

from __future__ import annotations

import re
from typing import Any

from app.i18n import ENUM_LABELS
from app.models import enum_options, field_kind

TOKEN = re.compile(r"[a-z0-9ऀ-ॿ]+")
DEVANAGARI = re.compile(r"[ऀ-ॿ]")
END = r"(?=[\s,.!?;:)]|$)"

YES = {"yes", "y", "yeah", "yep", "haan", "haa", "han", "ha", "hanji", "ji", "jee", "true", "sure",
       "bilkul", "correct", "हाँ", "हां", "हा", "जी", "बिल्कुल"}
# "is/are": only a yes in a short reply ("hai", "card hai"), never inside a longer sentence.
WEAK_YES = {"hai", "hain", "है", "हैं"}
NO = {"no", "n", "nope", "nahi", "nahin", "nhi", "nai", "na", "naa", "not", "false", "never", "नहीं", "नही", "ना", "न"}
DONT_KNOW = ("pata nahi", "nahi pata", "pta nahi", "don't know", "dont know", "do not know", "not sure", "no idea",
             "skip", "malum nahi", "maloom nahi", "पता नहीं", "नहीं पता", "मालूम नहीं", "छोड़ें", "छोड़ो")
HINGLISH = {"hai", "hain", "mein", "meri", "mera", "mere", "kya", "nahi", "haan", "ki", "ka", "ke", "aur", "hu", "hoon",
            "kaise", "kitna", "saal", "beti", "beta", "maa", "papa", "kisan", "padhai", "naukri", "chahiye", "bhi",
            "ko", "se", "karta", "karti", "raha", "rahi", "lakh", "ji", "yojana"}
GREETINGS = {"hi", "hello", "hey", "namaste", "namaskar", "hii", "नमस्ते", "नमस्कार", "हेलो"}
QUESTION_WORDS = {"how", "what", "which", "when", "where", "why", "kaise", "kya", "kaun", "kab", "kahan", "kyun",
                  "kitna", "kitni", "kahaan", "documents", "document", "apply", "कैसे", "क्या", "कौन", "कब", "कहाँ",
                  "कितना", "दस्तावेज़", "आवेदन"}

# Extra words for enum answers, on top of the English/Hindi option labels.
ENUM_SYNONYMS: dict[str, dict[str, set[str]]] = {
    "gender": {
        "female": {"f", "woman", "women", "lady", "girl", "mahila", "ladki", "aurat", "stree", "महिला", "लड़की", "औरत", "स्त्री"},
        "male": {"m", "man", "men", "boy", "ladka", "purush", "aadmi", "पुरुष", "लड़का", "आदमी"},
    },
    "category": {
        "general": {"gen", "general", "open", "unreserved", "सामान्य", "जनरल"},
        "obc": {"obc", "ओबीसी"},
        "sc": {"sc", "एससी"},
        "st": {"st", "adivasi", "tribal", "एसटी", "आदिवासी"},
    },
    "course_level": {
        "school": {"school", "class", "11th", "12th", "स्कूल"},
        "iti": {"iti", "आईटीआई"},
        "diploma": {"diploma", "polytechnic", "डिप्लोमा", "पॉलिटेक्निक"},
        "undergraduate": {"btech", "be", "bsc", "ba", "bcom", "bba", "bca", "mbbs", "llb", "graduation", "degree",
                          "ug", "college", "ग्रेजुएशन", "बीटेक", "बीए"},
        "postgraduate": {"mtech", "msc", "ma", "mcom", "mba", "mca", "pg", "postgraduate", "पोस्टग्रेजुएशन", "एमबीए"},
        "phd": {"phd", "पीएचडी"},
    },
    "highest_qualification": {
        "none": {"illiterate", "anpadh", "अनपढ़"},
        "class_8": {"8th", "8"},
        "class_10": {"10th", "10", "matric", "highschool", "दसवीं"},
        "class_12": {"12th", "12", "inter", "intermediate", "बारहवीं"},
        "iti": {"iti", "आईटीआई"},
        "diploma": {"diploma", "polytechnic", "डिप्लोमा"},
        "graduate": {"graduate", "graduation", "btech", "bsc", "ba", "bcom", "degree", "ग्रेजुएट", "ग्रेजुएशन"},
        "postgraduate": {"postgraduate", "pg", "mtech", "msc", "ma", "mba", "mcom", "पोस्टग्रेजुएट"},
    },
    "business_status": {
        "none": {"no", "nahi", "none", "नहीं"},
        "planning_new": {"new", "start", "starting", "shuru", "naya", "plan", "planning", "नया", "शुरू"},
        "running": {"running", "already", "existing", "chala", "chalata", "chalati", "chal", "चला", "चलाते"},
    },
}

FINISHED_WORDS = {"graduate", "graduated", "pass", "passed", "complete", "completed", "finished", "पास"}
JOB_WORDS = {"job", "naukri", "employed", "working", "नौकरी"}
TECHNICAL_COURSE_WORDS = {"polytechnic", "btech", "engineering", "pharmacy", "bpharm", "mba", "mca", "architecture",
                          "barch", "पॉलिटेक्निक", "बीटेक", "इंजीनियरिंग"}
AMBIGUOUS_COURSE_WORDS = {"ma", "ba", "be", "pg", "ug", "class", "school", "11th", "12th", "degree", "college"}
COURSE_TO_QUALIFICATION = {"iti": "iti", "diploma": "diploma", "undergraduate": "graduate", "postgraduate": "postgraduate", "phd": "postgraduate"}

STATES = {
    "uttar pradesh": "Uttar Pradesh", "madhya pradesh": "Madhya Pradesh", "bihar": "Bihar", "rajasthan": "Rajasthan",
    "maharashtra": "Maharashtra", "delhi": "Delhi", "punjab": "Punjab", "haryana": "Haryana", "gujarat": "Gujarat",
    "west bengal": "West Bengal", "bengal": "West Bengal", "tamil nadu": "Tamil Nadu", "karnataka": "Karnataka",
    "kerala": "Kerala", "odisha": "Odisha", "jharkhand": "Jharkhand", "chhattisgarh": "Chhattisgarh",
    "uttarakhand": "Uttarakhand", "himachal": "Himachal Pradesh", "assam": "Assam", "telangana": "Telangana",
    "andhra": "Andhra Pradesh", "kashmir": "Jammu and Kashmir", "goa": "Goa",
    "उत्तर प्रदेश": "Uttar Pradesh", "बिहार": "Bihar", "राजस्थान": "Rajasthan", "मध्य प्रदेश": "Madhya Pradesh",
    "दिल्ली": "Delhi", "महाराष्ट्र": "Maharashtra",
}
STATE_ABBR = {"UP": "Uttar Pradesh", "MP": "Madhya Pradesh"}

NUMBER = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lacs?|लाख|crores?|cr|करोड़|k|thousand|hazaa?r|हज़ार|हजार)?", re.I)
UNIT = {"lakh": 1e5, "lakhs": 1e5, "lac": 1e5, "lacs": 1e5, "लाख": 1e5, "crore": 1e7, "crores": 1e7, "cr": 1e7,
        "करोड़": 1e7, "k": 1e3, "thousand": 1e3, "hazar": 1e3, "hazaar": 1e3, "हज़ार": 1e3, "हजार": 1e3}
MONTHLY = ("month", "monthly", "mahina", "mahine", "mahinay", "per month", "महीना", "महीने", "मासिक", "प्रति माह")
INCOME_WORDS = ("income", "aay", "aamdani", "amdani", "kamai", "kamaai", "salary", "kamata", "kamati", "earning",
                "आय", "आमदनी", "कमाई", "तनख्वाह", "वेतन")


def tokens(text: str) -> list[str]:
    return TOKEN.findall(text.lower())


def detect_language(text: str) -> str:
    if DEVANAGARI.search(text):
        return "hi"
    return "hinglish" if any(t in HINGLISH for t in tokens(text)) else "en"


def is_dont_know(text: str) -> bool:
    low = text.lower()
    return any(p in low for p in DONT_KNOW)


def parse_yes_no(text: str) -> bool | None:
    """A yes/no answer, or None when the message isn't clearly one."""
    toks = tokens(text)
    if not toks:
        return None
    if toks[0] in NO or (len(toks) <= 8 and any(t in NO for t in toks)):
        return False
    if toks[0] in YES or (len(toks) <= 6 and any(t in YES for t in toks)):
        return True
    if len(toks) <= 3 and any(t in WEAK_YES for t in toks):
        return True
    return None


def parse_amount(text: str) -> int | None:
    for m in NUMBER.finditer(text):
        raw, unit = m.group(1).replace(",", ""), (m.group(2) or "").lower()
        try:
            value = float(raw)
        except ValueError:
            continue
        value *= UNIT.get(unit, 1)
        return int(round(value))
    return None


def parse_enum(field: str, text: str) -> str | None:
    low = text.lower().strip()
    toks = set(tokens(text))
    for value in enum_options(field):
        labels = {lbl.lower() for lbl in ENUM_LABELS.get(field, {}).get(value, ())}
        if low == value or low in labels or any(lbl and lbl in low for lbl in labels if len(lbl) > 3):
            return value
    for value, words in ENUM_SYNONYMS.get(field, {}).items():
        if toks & words:
            return value
    return None


def answer_pending(field: str, text: str) -> Any:
    """Interpret the message as an answer to the question we just asked."""
    kind = field_kind(field)
    if kind == "bool":
        return parse_yes_no(text)
    if kind == "int":
        value = parse_amount(text)
        if value is not None and field == "annual_income" and any(w in text.lower() for w in MONTHLY):
            value *= 12
        return value
    if kind == "enum":
        return parse_enum(field, text)
    return text.strip() or None


def _flag(toks: list[str], words: set[str]) -> bool | None:
    """True if a word appears, False if it's negated right after ("kisan nahi") or before ("not a farmer")."""
    for i, t in enumerate(toks):
        if t in words:
            after = toks[i + 1 : i + 3]
            before = toks[max(0, i - 2) : i]
            if any(x in NO for x in after) or any(x in {"not", "no", "na"} for x in before):
                return False
            return True
    return None


def extract_free_text(text: str) -> dict[str, Any]:
    """Facts stated in a free sentence. Only clear, positive statements."""
    out: dict[str, Any] = {}
    low = text.lower()
    work = low

    # A daughter's age is not the applicant's age: handle and remove it first.
    m = re.search(r"(beti|daughter|बेटी)\D{0,15}?(\d{1,2})", work)
    if m:
        out["has_daughter_under_10"] = int(m.group(2)) < 10
        work = work[: m.start()] + work[m.end() :]

    m = (
        re.search(rf"(\d{{1,3}})\s*(?:years?|yrs?|yr|saal|sal|varsh|baras|वर्ष|साल|ki|ka|ke|की|का|के){END}", work)
        or re.search(r"(?:age|umar|umra|उम्र|आयु)\s*(?:is|hai|:)?\s*(\d{1,3})", work)
        # "I am 24", "I'm 24", "main 24 ..." (but not "I am 2 lakh ...")
        or re.search(r"(?:\bi am|\bi'm|\bim|\bmain|\bmai|मैं)\s+(\d{1,2})(?!\s*(?:lakh|lac|k\b|thousand|%|hazar|लाख))\b", work)
    )
    if m and 0 <= int(m.group(1)) <= 120:
        out["age"] = int(m.group(1))

    toks = tokens(work)
    tokset = set(toks)
    if tokset & {"maa", "mother", "mummy", "mom", "amma", "maan", "माँ", "मां", "माता"}:
        out["beneficiary_relation"], out["gender"] = "mother", "female"
    elif tokset & {"papa", "father", "pita", "dad", "pitaji", "पिता", "पापा"}:
        out["beneficiary_relation"], out["gender"] = "father", "male"
    elif tokset & {"behen", "bahen", "behan", "sister", "बहन"}:
        out["beneficiary_relation"], out["gender"] = "sister", "female"
    elif tokset & {"bhai", "brother", "भाई"}:
        out["beneficiary_relation"], out["gender"] = "brother", "male"
    elif tokset & {"wife", "patni", "biwi", "पत्नी"}:
        out["beneficiary_relation"], out["gender"] = "wife", "female"
    elif tokset & {"husband", "pati", "पति"}:
        out["beneficiary_relation"], out["gender"] = "husband", "male"
    for value in ("female", "male"):
        if tokset & ENUM_SYNONYMS["gender"][value] - {"f", "m"}:
            out.setdefault("gender", value)

    for field, words in {
        "is_farmer": {"kisan", "farmer", "kheti", "kisaan", "किसान", "खेती"},
        "is_student": {"student", "padhai", "padhta", "padhti", "studying", "छात्र", "छात्रा", "पढ़ाई"},
        "is_bpl": {"bpl", "बीपीएल"},
        "is_pregnant_or_new_mother": {"pregnant", "garbhvati", "गर्भवती"},
        "is_street_vendor": {"thela", "rehdi", "rehri", "vendor", "ठेला", "रेहड़ी"},
        "has_disability": {"viklang", "divyang", "disabled", "disability", "दिव्यांग", "विकलांग"},
        "is_minority": {"muslim", "christian", "sikh", "buddhist", "jain", "parsi", "मुस्लिम", "ईसाई", "सिख", "बौद्ध", "जैन", "पारसी"},
    }.items():
        value = _flag(toks, words)
        if value is not None:
            out[field] = value
    if "garibi rekha" in low or "गरीबी रेखा" in low:
        out.setdefault("is_bpl", True)
    if out.get("is_pregnant_or_new_mother"):
        out.setdefault("gender", "female")
    # Only a clear "no job" counts; a bare mention of a job ("looking for a job") is too ambiguous.
    if tokset & {"unemployed", "berozgar", "बेरोज़गार", "बेरोजगार"} or _flag(toks, JOB_WORDS) is False:
        out["is_employed_full_time"] = False
    if out.get("is_minority") is None and tokset & {"hindu", "हिंदू"}:
        out["is_minority"] = False

    category = parse_enum("category", " ".join(t for t in toks if t in {"obc", "sc", "st", "general", "ओबीसी", "एससी", "एसटी", "सामान्य"}))
    if category:
        out["category"] = category

    # Free text only trusts unambiguous course names ("ma"/"ba" are also everyday words).
    course = next((v for v, words in ENUM_SYNONYMS["course_level"].items() if tokset & (words - AMBIGUOUS_COURSE_WORDS)), None)
    if course and course != "school":
        finished = bool(tokset & FINISHED_WORDS) or any(w in low for w in ("kar chuk", "ho gaya", "ho gayi", "kiya hai"))
        if finished:
            out["highest_qualification"] = COURSE_TO_QUALIFICATION[course]
        else:
            out["course_level"] = course
            out.setdefault("is_student", True)
    if tokset & TECHNICAL_COURSE_WORDS:
        out.setdefault("is_technical_course", True)  # AICTE-approved: engineering, polytechnic, pharmacy, MBA, MCA

    m = re.search(r"\b(8th|10th|12th|matric|inter|intermediate|दसवीं|बारहवीं)\s*(?:pass|passed|kiya|पास)", work)
    if m and "highest_qualification" not in out:
        out["highest_qualification"] = parse_enum("highest_qualification", m.group(1))

    if any(w in low for w in INCOME_WORDS):
        amount_text = low[min(low.find(w) for w in INCOME_WORDS if w in low) :]
        amount = parse_amount(amount_text)
        if amount is not None and amount >= 1000:
            out["annual_income"] = amount * 12 if any(w in low for w in MONTHLY) else amount

    for name, canonical in STATES.items():
        if name in low:
            out["state"] = canonical
            break
    else:
        for abbr, canonical in STATE_ABBR.items():
            if re.search(rf"\b{abbr}\b", text):
                out["state"] = canonical
    return out


WANTS_TO_ASK = ("puchna hai", "poochna hai", "puchhna hai", "puchna chahta", "puchna chahti", "poochna chahta",
                "sawal hai", "ek sawal", "question hai", "i have a question", "want to ask", "can i ask", "kuch aur",
                "khuch aur", "something else", "पूछना है", "पूछना चाहता", "पूछना चाहती", "सवाल है", "कुछ और")


def wants_to_ask(text: str) -> bool:
    """The user wants to ask something rather than answer ("kuch aur puchna hai")."""
    low = text.lower()
    return any(p in low for p in WANTS_TO_ASK)


# Short answers to common general questions, used when no LLM is configured.
GLOSSARY: list[tuple[set[str], tuple[str, ...], tuple[str, str]]] = [
    ({"bpl", "बीपीएल"}, ("garibi rekha", "गरीबी रेखा", "below poverty"), (
        "BPL means 'below poverty line'. States identify poor households through surveys and give them a BPL or "
        "Antyodaya (AAY) ration card. If your family has one, the answer is yes; your ration office or gram panchayat "
        "can confirm your status.",
        "बीपीएल का मतलब है 'गरीबी रेखा से नीचे'। राज्य सर्वे से गरीब परिवारों की पहचान करते हैं और उन्हें बीपीएल या "
        "अंत्योदय (AAY) राशन कार्ड देते हैं। अगर आपके परिवार के पास ऐसा कार्ड है, तो जवाब हाँ है; राशन कार्यालय या "
        "ग्राम पंचायत से पक्का कर सकते हैं।")),
    (set(), ("income certificate", "aay praman", "income praman", "आय प्रमाण"), (
        "An income certificate is issued by your state's revenue department (tehsil or SDM office), and in most states "
        "you can apply online on the e-District portal or at a CSC (Jan Seva Kendra). You usually need Aadhaar, a ration "
        "card and a self-declaration of income.",
        "आय प्रमाण पत्र राज्य का राजस्व विभाग (तहसील या SDM कार्यालय) बनाता है; ज़्यादातर राज्यों में ई-डिस्ट्रिक्ट पोर्टल या "
        "CSC (जन सेवा केंद्र) से ऑनलाइन आवेदन होता है। आमतौर पर आधार, राशन कार्ड और आय का स्व-घोषणा पत्र चाहिए।")),
    (set(), ("caste certificate", "jati praman", "जाति प्रमाण"), (
        "A caste certificate (SC/ST/OBC) is issued by the tehsil or SDM office; most states take applications online on "
        "the e-District portal or at a CSC. You usually need Aadhaar, proof of residence and a family member's caste "
        "certificate if available.",
        "जाति प्रमाण पत्र (SC/ST/OBC) तहसील या SDM कार्यालय बनाता है; ज़्यादातर राज्यों में ई-डिस्ट्रिक्ट पोर्टल या CSC से "
        "ऑनलाइन आवेदन होता है। आमतौर पर आधार, निवास प्रमाण और (अगर हो तो) परिवार के किसी सदस्य का जाति प्रमाण पत्र चाहिए।")),
    ({"nsp"}, ("scholarship portal", "scholarships.gov.in"), (
        "The National Scholarship Portal (scholarships.gov.in) is where students apply for most central and many state "
        "scholarships. You register once, fill one form, and your institution verifies it.",
        "नेशनल स्कॉलरशिप पोर्टल (scholarships.gov.in) पर ज़्यादातर केंद्रीय और कई राज्य छात्रवृत्तियों के लिए आवेदन होता है। "
        "एक बार रजिस्टर करके एक फ़ॉर्म भरें, फिर आपका संस्थान उसे सत्यापित करता है।")),
    ({"dbt"}, ("aadhaar seeding", "aadhaar link", "aadhar link", "direct benefit"), (
        "DBT (Direct Benefit Transfer) sends scheme money straight to your bank account. For it to work, the account "
        "must be linked (seeded) with Aadhaar and enabled for DBT; your bank branch can do this.",
        "DBT (डायरेक्ट बेनिफ़िट ट्रांसफ़र) योजना का पैसा सीधे बैंक खाते में भेजता है। इसके लिए खाता आधार से जुड़ा (सीडेड) और "
        "DBT के लिए चालू होना चाहिए; यह आपकी बैंक शाखा कर देती है।")),
    ({"csc"}, ("common service", "jan seva kendra", "जन सेवा केंद्र"), (
        "A CSC (Common Service Centre or Jan Seva Kendra) is a local centre run by a trained operator who can help you "
        "apply for certificates and schemes online for a small fee.",
        "CSC (कॉमन सर्विस सेंटर या जन सेवा केंद्र) एक स्थानीय केंद्र है जहाँ प्रशिक्षित संचालक कम शुल्क में प्रमाण पत्र और "
        "योजनाओं के लिए ऑनलाइन आवेदन में मदद करते हैं।")),
    ({"anganwadi", "आंगनवाड़ी"}, (), (
        "An Anganwadi centre is the local centre for mothers and young children. Pregnant women register there for "
        "maternity schemes like PMMVY, and children get nutrition and health check-ups.",
        "आंगनवाड़ी केंद्र माताओं और छोटे बच्चों का स्थानीय केंद्र है। गर्भवती महिलाएँ PMMVY जैसी मातृत्व योजनाओं के लिए "
        "वहाँ पंजीकरण कराती हैं, और बच्चों को पोषण और स्वास्थ्य जाँच मिलती है।")),
]


# Everyday words for each kind of scheme (mirrors frontend/src/lib/search.ts).
KIND_WORDS: dict[str, set[str]] = {
    "scholarship": {"scholarship", "scholarships", "chhatravritti", "chatravriti", "vazifa", "wazifa", "छात्रवृत्ति"},
    "internship": {"internship", "internships", "intern", "इंटर्नशिप"},
    "apprenticeship": {"apprenticeship", "apprentice", "अप्रेंटिसशिप"},
    "skill_training": {"skill", "skills", "training", "kaushal", "कौशल", "प्रशिक्षण"},
    "education_loan": {"education loan", "study loan", "padhai loan", "शिक्षा ऋण"},
    "business_loan": {"business loan", "dukaan loan", "व्यवसाय ऋण"},
    "startup_funding": {"startup", "seed fund", "स्टार्टअप"},
    "pension": {"pension", "pensions", "पेंशन"},
    "insurance": {"insurance", "bima", "बीमा"},
    "housing": {"housing", "house", "ghar", "makan", "awas", "आवास", "घर", "मकान"},
    "maternity": {"maternity", "pregnancy", "pregnant", "मातृत्व"},
    "savings": {"savings", "bachat", "बचत"},
}


KIND_WORD_SET = {w for words in KIND_WORDS.values() for w in words if " " not in w}


LOAN_WORDS = {"loan", "loans", "rin", "karz", "karza", "ऋण", "लोन"}
BUSINESS_WORDS = {"business", "vyapar", "vyavsay", "dukaan", "dukan", "shop", "udyam", "व्यवसाय", "व्यापार", "दुकान"}
STUDY_WORDS = {"education", "study", "padhai", "college", "fees", "fee", "course", "पढ़ाई", "शिक्षा"}


def kind_asked(text: str) -> str | None:
    """The kind of scheme a question is about ("scholarship ke liye kaun apply kar sakta hai?")."""
    low, toks = text.lower(), set(tokens(text))
    if toks & LOAN_WORDS:
        if toks & BUSINESS_WORDS:
            return "business_loan"
        if toks & STUDY_WORDS:
            return "education_loan"
    for kind, words in KIND_WORDS.items():
        if any((w in low) if " " in w else (w in toks) for w in words):
            return kind
    return None


# Words for who a question is about ("vidyarthi ke liye saari schemes"), mapped to topic ids.
TOPIC_ASK_WORDS: dict[str, set[str]] = {
    "students": {"student", "students", "vidyarthi", "vidyarthiyon", "chhatra", "chatra", "college", "छात्र",
                 "छात्रों", "विद्यार्थी", "विद्यार्थियों"},
    "farmers": {"kisan", "kisano", "kisaan", "farmer", "farmers", "किसान", "किसानों"},
    "women": {"mahila", "mahilaon", "women", "woman", "ladkiyon", "betiyon", "महिला", "महिलाओं", "बेटियों"},
    "seniors": {"senior", "seniors", "budhe", "buzurg", "bujurg", "elderly", "वरिष्ठ", "बुजुर्ग", "बुज़ुर्ग"},
    "business": {"business", "vyapar", "vyapari", "dukandar", "startup", "व्यवसाय", "व्यापार"},
    "jobs": {"job", "jobs", "naukri", "rozgar", "berozgar", "नौकरी", "रोज़गार", "रोजगार"},
    "health": {"health", "hospital", "ilaj", "swasthya", "स्वास्थ्य", "इलाज"},
}


def topic_asked(text: str) -> str | None:
    toks = set(tokens(text))
    return next((topic for topic, words in TOPIC_ASK_WORDS.items() if toks & words), None)


def glossary_answer(text: str, lang: str) -> str | None:
    low, toks = text.lower(), set(tokens(text))
    for words, phrases, (en, hi) in GLOSSARY:
        if toks & words or any(p in low for p in phrases):
            return hi if lang == "hi" else en
    return None


# "Bata do", "tell me", "samjhao": requests for information, phrased without a question word.
REQUEST_WORDS = {"bata", "batao", "bataiye", "bataye", "batado", "samjhao", "samjhaiye", "explain", "tell", "list",
                 "बताओ", "बताइए", "बताएँ", "बता", "समझाओ", "समझाइए"}


def looks_like_question(text: str) -> bool:
    toks = tokens(text)
    return "?" in text or any(t in QUESTION_WORDS for t in toks[:3]) or any(t in REQUEST_WORDS for t in toks)


def is_greeting(text: str) -> bool:
    toks = tokens(text)
    return 0 < len(toks) <= 3 and toks[0] in GREETINGS
