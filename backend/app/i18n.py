"""Bilingual (English / Hindi) labels and value formatting.

Used by the rules engine to build failed reasons, and later by the API to phrase
follow-up questions. Keep every user-facing string here in both languages.
"""

from __future__ import annotations

from typing import Any, Literal

Lang = Literal["en", "hi"]

FIELD_LABELS: dict[str, tuple[str, str]] = {
    "beneficiary_relation": ("Applying for", "किसके लिए"),
    "age": ("Age", "उम्र"),
    "gender": ("Gender", "लिंग"),
    "state": ("State", "राज्य"),
    "annual_income": ("Annual family income", "परिवार की सालाना आय"),
    "category": ("Social category", "सामाजिक वर्ग"),
    "is_farmer": ("Farmer", "किसान"),
    "owns_cultivable_land": ("Owns cultivable land", "खेती की ज़मीन अपने नाम"),
    "is_bpl": ("BPL household", "बीपीएल परिवार"),
    "is_student": ("Student", "छात्र/छात्रा"),
    "is_post_matric_student": ("Studying after Class 10", "कक्षा 10 के बाद की पढ़ाई"),
    "is_income_tax_payer": ("Pays income tax", "आयकर भरते हैं"),
    "is_govt_employee": ("Government employee", "सरकारी कर्मचारी"),
    "has_lpg_connection": ("Has LPG connection", "एलपीजी कनेक्शन है"),
    "has_bank_account": ("Has bank account", "बैंक खाता है"),
    "has_daughter_under_10": ("Has daughter under 10", "10 साल से कम उम्र की बेटी"),
    "course_level": ("Studying now", "अभी की पढ़ाई"),
    "is_final_year": ("In final year", "अंतिम वर्ष में"),
    "is_technical_course": ("AICTE-approved technical course", "एआईसीटीई मान्य तकनीकी कोर्स"),
    "class12_top20": ("Top 20% in Class 12 board", "कक्षा 12 बोर्ड में शीर्ष 20%"),
    "gets_other_scholarship": ("Gets another scholarship", "दूसरी छात्रवृत्ति मिलती है"),
    "admitted_to_qhei": ("Merit admission to a top institution", "शीर्ष संस्थान में मेरिट से प्रवेश"),
    "highest_qualification": ("Highest education completed", "सबसे ऊँची पूरी की गई पढ़ाई"),
    "is_employed_full_time": ("Has a full-time job", "पूर्णकालिक नौकरी है"),
    "family_has_govt_employee": ("Family member in a permanent government job", "परिवार में स्थायी सरकारी कर्मचारी"),
    "is_unorganised_worker": ("Unorganised-sector worker", "असंगठित क्षेत्र के कामगार"),
    "has_epf_esic_nps": ("Covered by EPF, ESIC or NPS", "EPF, ESIC या NPS के सदस्य"),
    "business_status": ("Business", "व्यवसाय"),
    "is_street_vendor": ("Street vendor", "रेहड़ी-पटरी विक्रेता"),
    "is_new_dpiit_startup": ("New DPIIT-recognised startup", "नया DPIIT मान्य स्टार्टअप"),
    "is_minority": ("Minority community", "अल्पसंख्यक समुदाय"),
    "has_disability": ("Disability of 40% or more", "40% या अधिक दिव्यांगता"),
    "is_pregnant_or_new_mother": ("Pregnant or new mother", "गर्भवती या नई माँ"),
    "is_small_marginal_farmer": ("Farmland of 2 hectares or less", "2 हेक्टेयर या कम खेती की ज़मीन"),
    "lives_in_urban_area": ("Lives in a town or city", "शहर या कस्बे में रहते हैं"),
    "owns_pucca_house": ("Family owns a pucca house", "परिवार का पक्का मकान है"),
}

FIELD_QUESTIONS: dict[str, tuple[str, str]] = {
    "age": ("How old is the person applying?", "आवेदक की उम्र कितनी है?"),
    "gender": ("What is the applicant's gender?", "आवेदक का लिंग क्या है?"),
    "state": ("Which state does the applicant live in?", "आवेदक किस राज्य में रहते हैं?"),
    "annual_income": ("What is the family's total income in a year?", "परिवार की कुल सालाना आय कितनी है?"),
    "category": ("Which social category does the applicant belong to?", "आवेदक किस सामाजिक वर्ग से हैं?"),
    "is_farmer": ("Does the family earn its living from farming?", "क्या परिवार की आजीविका खेती से चलती है?"),
    "owns_cultivable_land": (
        "Is farmland recorded in the family's name?",
        "क्या खेती की ज़मीन परिवार के नाम पर दर्ज है?",
    ),
    "is_bpl": ("Is the household below the poverty line (BPL)?", "क्या परिवार गरीबी रेखा से नीचे (बीपीएल) है?"),
    "is_student": ("Is the applicant studying right now?", "क्या आवेदक अभी पढ़ाई कर रहे हैं?"),
    "is_post_matric_student": (
        "Is the applicant studying beyond Class 10?",
        "क्या आवेदक कक्षा 10 के बाद की पढ़ाई कर रहे हैं?",
    ),
    "is_income_tax_payer": (
        "Did anyone in the family pay income tax last year?",
        "क्या पिछले साल परिवार में किसी ने आयकर भरा था?",
    ),
    "is_govt_employee": (
        "Is the applicant a serving or retired government employee?",
        "क्या आवेदक सरकारी कर्मचारी हैं (कार्यरत या सेवानिवृत्त)?",
    ),
    "has_lpg_connection": (
        "Does the household already have an LPG gas connection?",
        "क्या घर में पहले से एलपीजी गैस कनेक्शन है?",
    ),
    "has_bank_account": (
        "Does the applicant have a bank or post office account?",
        "क्या आवेदक का बैंक या डाकघर में खाता है?",
    ),
    "has_daughter_under_10": (
        "Is there a daughter in the family younger than 10?",
        "क्या परिवार में 10 साल से कम उम्र की बेटी है?",
    ),
    "course_level": ("What is the applicant studying right now?", "आवेदक अभी क्या पढ़ रहे हैं?"),
    "is_final_year": (
        "Is the applicant in the final year of their degree?",
        "क्या आवेदक अपनी डिग्री के अंतिम वर्ष में हैं?",
    ),
    "is_technical_course": (
        "Is the course approved by AICTE (engineering, pharmacy, architecture, management and similar)?",
        "क्या कोर्स एआईसीटीई से मान्य है (इंजीनियरिंग, फ़ार्मेसी, आर्किटेक्चर, मैनेजमेंट जैसे)?",
    ),
    "class12_top20": (
        "Did the applicant score in the top 20% of their Class 12 board (above the 80th percentile)?",
        "क्या आवेदक कक्षा 12 बोर्ड में शीर्ष 20% (80वें पर्सेंटाइल से ऊपर) में थे?",
    ),
    "gets_other_scholarship": (
        "Does the applicant already get another scholarship?",
        "क्या आवेदक को पहले से कोई दूसरी छात्रवृत्ति मिलती है?",
    ),
    "admitted_to_qhei": (
        "Has the applicant got merit admission to a top-ranked institution (NIRF top 100 or a central government institution)?",
        "क्या आवेदक को किसी शीर्ष संस्थान (NIRF टॉप 100 या केंद्र सरकार का संस्थान) में मेरिट से प्रवेश मिला है?",
    ),
    "highest_qualification": (
        "What is the highest level of education the applicant has completed?",
        "आवेदक ने सबसे ऊँची कौन-सी पढ़ाई पूरी की है?",
    ),
    "is_employed_full_time": (
        "Does the applicant have a full-time job right now?",
        "क्या आवेदक के पास अभी पूर्णकालिक नौकरी है?",
    ),
    "family_has_govt_employee": (
        "Is anyone in the family a permanent government employee?",
        "क्या परिवार में कोई स्थायी सरकारी कर्मचारी है?",
    ),
    "is_unorganised_worker": (
        "Does the applicant work in the unorganised sector?",
        "क्या आवेदक असंगठित क्षेत्र में काम करते हैं?",
    ),
    "has_epf_esic_nps": (
        "Is the applicant a member of EPF, ESIC or NPS?",
        "क्या आवेदक EPF, ESIC या NPS के सदस्य हैं?",
    ),
    "business_status": (
        "Is the applicant starting or running a business?",
        "क्या आवेदक कोई व्यवसाय शुरू कर रहे हैं या चला रहे हैं?",
    ),
    "is_street_vendor": (
        "Is the applicant a street vendor in a town or city?",
        "क्या आवेदक शहर या कस्बे में रेहड़ी-पटरी विक्रेता हैं?",
    ),
    "is_new_dpiit_startup": (
        "Does the applicant have a DPIIT-recognised startup that is less than 2 years old?",
        "क्या आवेदक का 2 साल से कम पुराना, DPIIT मान्य स्टार्टअप है?",
    ),
    "is_minority": (
        "Does the applicant belong to a minority community (Muslim, Christian, Sikh, Buddhist, Jain or Parsi)?",
        "क्या आवेदक अल्पसंख्यक समुदाय (मुस्लिम, ईसाई, सिख, बौद्ध, जैन या पारसी) से हैं?",
    ),
    "has_disability": (
        "Does the applicant have a certified disability of 40% or more?",
        "क्या आवेदक को 40% या उससे अधिक की प्रमाणित दिव्यांगता है?",
    ),
    "is_pregnant_or_new_mother": (
        "Is the applicant pregnant, or has she given birth recently?",
        "क्या आवेदक गर्भवती हैं, या हाल ही में बच्चे को जन्म दिया है?",
    ),
    "is_small_marginal_farmer": (
        "Is the family's farmland 2 hectares (about 5 acres) or less?",
        "क्या परिवार की खेती की ज़मीन 2 हेक्टेयर (लगभग 5 एकड़) या उससे कम है?",
    ),
    "lives_in_urban_area": (
        "Does the family live in a town or city?",
        "क्या परिवार शहर या कस्बे में रहता है?",
    ),
    "owns_pucca_house": (
        "Does the family own a pucca (permanent) house anywhere in India?",
        "क्या परिवार के पास भारत में कहीं भी पक्का मकान है?",
    ),
}

FIELD_HINTS: dict[str, tuple[str, str]] = {
    "age": ("In completed years.", "पूरे हुए सालों में।"),
    "annual_income": (
        "Add up what every family member earns in a year, in rupees.",
        "परिवार के सभी सदस्यों की साल भर की कमाई जोड़कर, रुपयों में।",
    ),
    "is_bpl": (
        "Usually means the family has a BPL or Antyodaya ration card.",
        "आमतौर पर इसका मतलब है कि परिवार के पास बीपीएल या अंत्योदय राशन कार्ड है।",
    ),
    "is_post_matric_student": (
        "Class 11, 12, college, ITI, diploma and similar courses count.",
        "कक्षा 11, 12, कॉलेज, आईटीआई, डिप्लोमा जैसे कोर्स गिने जाते हैं।",
    ),
    "is_income_tax_payer": (
        "Paying income tax means filing a return with tax due, not just having a PAN card.",
        "आयकर भरने का मतलब है टैक्स के साथ रिटर्न भरना, सिर्फ़ पैन कार्ड होना नहीं।",
    ),
    "class12_top20": (
        "Your board publishes the cut-off. If you're not sure, skip this.",
        "आपका बोर्ड इसकी कट-ऑफ़ जारी करता है। पक्का न हो तो इसे छोड़ दें।",
    ),
    "is_unorganised_worker": (
        "For example daily-wage, domestic, construction, farm labour, street vending or home-based work.",
        "जैसे दिहाड़ी, घरेलू काम, निर्माण, खेतिहर मज़दूरी, रेहड़ी-पटरी या घर से किया जाने वाला काम।",
    ),
    "has_epf_esic_nps": (
        "These are usually deducted from the salary of formal-sector jobs.",
        "ये आमतौर पर संगठित क्षेत्र की नौकरी की तनख़्वाह से कटते हैं।",
    ),
    "is_new_dpiit_startup": (
        "Startups get DPIIT recognition on the Startup India portal.",
        "स्टार्टअप को DPIIT मान्यता स्टार्टअप इंडिया पोर्टल पर मिलती है।",
    ),
    "owns_pucca_house": (
        "A pucca house has permanent walls and roof (brick, concrete), not mud or thatch.",
        "पक्के मकान की दीवारें और छत स्थायी (ईंट, कंक्रीट) होती हैं, मिट्टी या छप्पर की नहीं।",
    ),
}

ENUM_LABELS: dict[str, dict[str, tuple[str, str]]] = {
    "gender": {
        "female": ("Female", "महिला"),
        "male": ("Male", "पुरुष"),
        "other": ("Other", "अन्य"),
    },
    "category": {
        "general": ("General", "सामान्य"),
        "obc": ("OBC", "अन्य पिछड़ा वर्ग (OBC)"),
        "sc": ("SC", "अनुसूचित जाति (SC)"),
        "st": ("ST", "अनुसूचित जनजाति (ST)"),
    },
    "course_level": {
        "school": ("School", "स्कूल"),
        "iti": ("ITI", "आईटीआई"),
        "diploma": ("Diploma / polytechnic", "डिप्लोमा / पॉलिटेक्निक"),
        "undergraduate": ("Graduation (BA, BSc, BCom, BTech…)", "ग्रेजुएशन (BA, BSc, BCom, BTech…)"),
        "postgraduate": ("Post-graduation (MA, MSc, MTech, MBA…)", "पोस्ट-ग्रेजुएशन (MA, MSc, MTech, MBA…)"),
        "phd": ("PhD", "पीएचडी"),
    },
    "highest_qualification": {
        "none": ("Below Class 8", "कक्षा 8 से कम"),
        "class_8": ("Class 8", "कक्षा 8"),
        "class_10": ("Class 10", "कक्षा 10"),
        "class_12": ("Class 12", "कक्षा 12"),
        "iti": ("ITI", "आईटीआई"),
        "diploma": ("Diploma", "डिप्लोमा"),
        "graduate": ("Graduate degree", "ग्रेजुएशन"),
        "postgraduate": ("Post-graduate degree", "पोस्ट-ग्रेजुएशन"),
    },
    "business_status": {
        "none": ("No", "नहीं"),
        "planning_new": ("Starting a new business", "नया व्यवसाय शुरू कर रहे हैं"),
        "running": ("Already running a business", "पहले से व्यवसाय चला रहे हैं"),
    },
}

RELATION_LABELS: dict[str, tuple[str, str]] = {
    "self": ("Self", "स्वयं"),
    "mother": ("Mother", "माँ"),
    "father": ("Father", "पिता"),
    "wife": ("Wife", "पत्नी"),
    "husband": ("Husband", "पति"),
    "daughter": ("Daughter", "बेटी"),
    "son": ("Son", "बेटा"),
    "sister": ("Sister", "बहन"),
    "brother": ("Brother", "भाई"),
    "grandmother": ("Grandmother", "दादी/नानी"),
    "grandfather": ("Grandfather", "दादा/नाना"),
}

KIND_LABELS: dict[str, tuple[str, str]] = {
    "scholarship": ("Scholarships", "छात्रवृत्ति"),
    "internship": ("Internships", "इंटर्नशिप"),
    "apprenticeship": ("Apprenticeships", "अप्रेंटिसशिप"),
    "skill_training": ("Skill training", "कौशल प्रशिक्षण"),
    "education_loan": ("Education loans", "शिक्षा ऋण"),
    "business_loan": ("Business loans", "व्यवसाय ऋण"),
    "startup_funding": ("Startup funding", "स्टार्टअप फ़ंडिंग"),
    "income_support": ("Income support", "आय सहायता"),
    "pension": ("Pensions", "पेंशन"),
    "insurance": ("Insurance", "बीमा"),
    "health_cover": ("Health cover", "स्वास्थ्य सुरक्षा"),
    "savings": ("Savings", "बचत"),
    "housing": ("Housing", "आवास"),
    "household": ("Household support", "घरेलू सहायता"),
    "maternity": ("Maternity support", "मातृत्व सहायता"),
}

BOOL_LABELS: dict[bool, tuple[str, str]] = {True: ("Yes", "हाँ"), False: ("No", "नहीं")}
NOT_KNOWN: tuple[str, str] = ("not known", "पता नहीं")

MONEY_FIELDS = {"annual_income"}
FIELD_UNITS: dict[str, Literal["inr", "years"]] = {"annual_income": "inr", "age": "years"}


def _pick(pair: tuple[str, str], lang: Lang) -> str:
    return pair[1] if lang == "hi" else pair[0]


def format_inr(amount: int) -> str:
    """Indian digit grouping: 250000 -> '₹2,50,000'."""
    s = str(abs(int(amount)))
    if len(s) <= 3:
        grouped = s
    else:
        last3, rest = s[-3:], s[:-3]
        parts: list[str] = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        grouped = ",".join(parts + [last3])
    return ("-₹" if amount < 0 else "₹") + grouped


def field_label(field: str, lang: Lang = "en") -> str:
    return _pick(FIELD_LABELS.get(field, (field, field)), lang)


def field_question(field: str, lang: Lang = "en") -> str:
    """The follow-up question for a field; falls back to its label."""
    return _pick(FIELD_QUESTIONS.get(field, FIELD_LABELS.get(field, (field, field))), lang)


def format_value(field: str, value: Any, lang: Lang = "en") -> str:
    if value is None:
        return _pick(NOT_KNOWN, lang)
    if isinstance(value, bool):
        return _pick(BOOL_LABELS[value], lang)
    if field in MONEY_FIELDS and isinstance(value, int):
        return format_inr(value)
    if FIELD_UNITS.get(field) == "years" and isinstance(value, int):
        return f"{value} वर्ष" if lang == "hi" else f"{value} years"
    if field == "beneficiary_relation" and isinstance(value, str) and value.lower() in RELATION_LABELS:
        return _pick(RELATION_LABELS[value.lower()], lang)
    if field in ENUM_LABELS and value in ENUM_LABELS[field]:
        return _pick(ENUM_LABELS[field][value], lang)
    return str(value)
