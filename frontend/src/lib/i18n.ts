// UI strings. Scheme text, questions and field labels come from the backend
// (backend/app/i18n.py and schemes.json); everything else lives here, in both languages.

import type { Lang } from "./locales";
import type { LocalizedText, SchemeStatus } from "./types";

const en = {
  brand: "SchemeSetu",
  tagline: "Your bridge to government schemes",
  nav: {
    home: "Home",
    topics: "Topics",
    check: "Check eligibility",
    schemes: "Schemes",
    language: "Language",
    login: "Log in",
    account: "My account",
    menu: "Menu",
    closeMenu: "Close menu",
  },

  home: {
    eyebrow: "Government schemes, in plain words",
    title: "Find the schemes you are entitled to.",
    body: "Answer a few simple questions. SchemeSetu checks each scheme's rules and shows where you qualify, what is still missing, and which documents to keep ready.",
    trust: [
      "We never ask for Aadhaar or any ID number",
      "Every result shows the rule behind it",
      "Works in English and हिंदी",
    ],
    schemesHeading: "Schemes we check today",
    schemesSub: (n: number) => `${n} central government schemes, each with its rules and official source.`,
    howTitle: "How SchemeSetu works",
    howSub: "Generative AI understands you. A rules engine decides. Every answer shows its source.",
    steps: [
      { title: "Tell us about yourself", body: "Type, tap or speak in English, हिंदी or Hinglish. No forms, no ID numbers." },
      { title: "We check the official rules", body: "Each scheme's eligibility rules are checked one by one. The AI never decides who qualifies." },
      { title: "Know what you get and what to bring", body: "See the benefit, the documents to keep ready and the official link to apply." },
    ],
    topicsHeading: "Find schemes by topic",
    topicsSub: "Pick what matters to you. Each topic groups its schemes by type: scholarships, internships, loans and more.",
  },

  topic: {
    count: (n: number) => (n === 1 ? "1 scheme" : `${n} schemes`),
    explore: "Explore",
    checkCta: "Check what I qualify for",
    allTopics: "All topics",
    checking: "Checking",
    everything: "All schemes",
  },

  search: {
    label: "Search schemes",
    open: "Search",
    placeholder: "Search: scholarship, internship, pension, loan…",
    loading: "Loading schemes…",
    none: (q: string) => `No schemes match “${q}”.`,
    tryWords: "Try a simpler word, like scholarship, job, pension, loan or kisan.",
    seeAll: (n: number) => (n === 1 ? "See the result" : `See all ${n} results`),
    quick: ["Scholarship", "Internship", "Pension", "Business loan", "Housing"],
    popular: "Popular:",
    results: (n: number) => (n === 1 ? "1 scheme" : `${n} schemes`),
    clear: "Clear",
    all: "All",
    reset: "Show all schemes",
    shortcut: "Press / to search",
    close: "Close search",
  },

  assistant: {
    title: "Ask SchemeSetu",
    subtitle: "Tell me about the person applying, in your own words: English, हिंदी or Hinglish.",
    aiOn: (model: string) => `AI: ${model}`,
    aiOff: "Basic mode: add an AI key for smarter answers",
    welcome:
      "Namaste! Tell me about the person who needs help, in your own words. For example: “My mother is 65 and a farmer in UP”. I'll ask only what's needed and show which schemes fit.",
    starters: [
      "Meri maa 65 ki hain, kisan hain, UP mein",
      "I'm a 21-year-old BTech student, family income 3 lakh",
      "मैं 35 साल की महिला हूँ, ठेला लगाती हूँ",
      "PM Kisan ke liye kaun se documents chahiye?",
    ],
    placeholder: "Type your message…",
    send: "Send",
    listen: "Speak",
    listening: "Listening…",
    dontKnow: "Don't know",
    understood: "Understood",
    thinking: "Thinking…",
    error: "Couldn't reach the server. Please try again.",
    seeResults: "See full results",
    newChat: "New chat",
    you: "You",
    bot: "SchemeSetu",
    launcher: "Ask SchemeSetu AI",
    launcherShort: "Ask AI",
    voice: "Voice",
    voiceTitle: "Voice mode",
    listeningLong: "Listening… speak now",
    thinkingLong: "Thinking…",
    speakingLong: "Speaking… tap the circle to interrupt",
    paused: "Tap the circle and speak",
    endVoice: "End voice mode",
    micBlocked: "Microphone access is blocked. Allow it for this site in your browser settings, then try again.",
    voiceGreeting: "Hi! I'm listening. Tell me about the person who needs help.",
    voiceHint: "Speak in English or Hinglish. For Hindi, switch the site to हिंदी.",
    readAloud: "Read aloud",
    stopReading: "Stop reading",
    heroTitle: "Ask SchemeSetu AI",
    heroSub: "Describe your situation in English, हिंदी or Hinglish",
    heroGreeting: "Namaste! Tell me about the person who needs help, and I'll find the schemes that fit.",
    heroExamples: [
      "Meri maa 65 ki hain, kisan hain, UP mein",
      "I'm a 21-year-old BTech student, family income 3 lakh",
      "मैं 35 साल की महिला हूँ, ठेला लगाती हूँ",
      "Want to start a small shop, I'm SC, age 28",
    ],
  },

  auth: {
    title: "Log in with your phone",
    subtitle: "Save your answers and get a WhatsApp message when a new scheme you may qualify for is added.",
    phone: "Mobile number",
    sendCode: "Send code",
    code: "6-digit code",
    verify: "Verify and log in",
    codeSentTo: (phone: string) => `We sent a code to ${phone}.`,
    resendIn: (s: number) => `Resend code in ${s}s`,
    resend: "Resend code",
    changeNumber: "Change number",
    privacy: "We only store your phone number and the answers you choose to save. You can delete them any time.",
    title2: "Log in to SchemeSetu",
    tabOtp: "Mobile OTP",
    tabPassword: "Password",
    signIn: "Log in",
    createAccount: "Create account",
    username: "Username",
    usernameHint: "3–32 letters, numbers, dots or underscores",
    password: "Password",
    passwordHint: "At least 8 characters, with letters and numbers",
    confirmPassword: "Confirm password",
    mismatch: "The passwords don't match.",
    show: "Show password",
    hide: "Hide password",
    noAccount: "New here?",
    haveAccount: "Already have an account?",
    passwordPrivacy: "Your password is stored only as a secure hash. We never see or store the password itself.",
    addPhoneTitle: "Add your phone number",
    addPhoneBody: "Verify your number to get WhatsApp alerts for new schemes.",
    wrongCreds: "Wrong username or password.",
    usernameTaken: "That username is taken. Try another.",
    phoneTaken: "This number is already linked to another account.",
    tooMany: "Too many wrong attempts. Try again in 15 minutes.",
    invalid: "Check the username and password rules below the boxes.",
  },

  account: {
    title: "My account",
    phone: "Phone",
    savedAnswers: "Saved answers",
    savedCount: (n: number, when: string) => `${n} answers saved · updated ${when}`,
    noneSaved: "No answers saved yet. Answer a few questions and they're saved here automatically.",
    continue: "Continue checking",
    alertsTitle: "WhatsApp alerts for new schemes",
    alertsBody:
      "When a new scheme is added and your saved answers show you may qualify, we'll send one WhatsApp message to this number. You can turn this off any time.",
    alertsOn: "Alerts on",
    alertsOff: "Alerts off",
    logout: "Log out",
    delete: "Delete my account and data",
    confirmDelete: "Delete your account, saved answers and alert settings? This can't be undone.",
    loginToSave: "Log in to save your answers and get WhatsApp alerts",
    username: "Username",
    needPhone: "WhatsApp alerts need a phone number.",
    addPhone: "Add phone number",
    saved: "Saved to your account",
  },

  status: {
    eligible: "Likely eligible",
    needs_info: "Need more details",
    not_eligible: "Not eligible",
  } satisfies Record<SchemeStatus, string>,

  checker: {
    questionOf: (n: number) => `Question ${n}`,
    upToMore: (n: number) => (n === 1 ? "last one" : `up to ${n - 1} more after this`),
    yes: "Yes",
    no: "No",
    next: "Continue",
    skip: "I don't know, skip",
    back: "Back",
    seeResults: "See results now",
    cancelEdit: "Cancel",
    numberPlaceholder: "Type a number",
    numberInvalid: "Please enter a whole number.",
    outOfRange: (min: number | null, max: number | null) =>
      min !== null && max !== null
        ? `Please enter a number from ${min} to ${max}.`
        : min !== null
          ? `Please enter ${min} or more.`
          : `Please enter ${max} or less.`,
    textPlaceholder: "Type your answer",
    years: "years",
    decided: (d: number, t: number) => `${d} of ${t} schemes decided`,
    liveHeading: "Your schemes so far",
    checking: "Checking…",
    error: "We couldn't reach the server. Please check your connection and try again.",
    retry: "Try again",
    privacy: "Your answers stay in this browser tab. We never ask for ID numbers.",
  },

  results: {
    heading: (n: number, moreToAsk: boolean) =>
      n === 0
        ? moreToAsk
          ? "No scheme matches yet"
          : "None of these schemes match"
        : n === 1
          ? "You may qualify for 1 scheme"
          : `You may qualify for ${n} schemes`,
    basedOn: (n: number) => (n === 1 ? "Based on 1 answer." : `Based on ${n} answers.`),
    zeroHint: "Answering the remaining questions may still change this.",
    moreToCheck: (q: number, s: number) =>
      `Answer ${q === 1 ? "1 more question" : `up to ${q} more questions`} to check ${s === 1 ? "1 more scheme" : `${s} more schemes`}.`,
    keepGoing: "Keep answering",
    startOver: "Start over",
    sections: {
      eligible: "Likely eligible",
      needs_info: "Need more details",
      not_eligible: "Not eligible",
    } satisfies Record<SchemeStatus, string>,
    benefit: "What you get",
    documents: "Documents to keep ready",
    official: "Official website",
    weNeed: "To decide, we still need:",
    answer: "Answer",
    whyNot: "Why not",
    conditions: (passed: number, total: number) => `See all conditions (${passed} of ${total} met)`,
    anyOneOf: "Any one of these:",
    yours: "yours",
    unverified: "Unverified sample rules",
    details: "Scheme details",
    yourAnswers: "Your answers",
    change: "Change",
    skipped: "Skipped",
    noAnswers: "You haven't answered anything yet.",
  },

  scheme: {
    allSchemes: "All schemes",
    level: { central: "Central government", state: "State government" },
    benefit: "Benefit",
    whoCanApply: "Who can apply",
    allOf: "All of these conditions must be met:",
    anyOf: "At least one of these:",
    documents: "Documents needed",
    source: "Official source",
    rule: "Rule",
    checkCta: "Check if you qualify",
    verifiedOn: (date: string) => `Rules verified on ${date}`,
    notVerified: "Rules not yet verified against the latest official guidelines",
    goodToKnow: "Good to know",
    listedUnder: "Listed under",
  },

  dataNote: {
    title: "About this data",
    body: "These rules are simplified from public scheme pages and have not yet been verified against the latest official guidelines. Always confirm on the official website before you apply.",
  },

  footer: {
    disclaimer:
      "SchemeSetu is an independent helper, not a government website. Final eligibility is decided by the scheme authority. Always apply through the official portal.",
  },

  errors: {
    title: "Something went wrong",
    body: "We couldn't load this page. The SchemeSetu server may be down.",
    retry: "Try again",
    notFoundTitle: "Page not found",
    notFoundBody: "We couldn't find what you were looking for.",
    home: "Go to home page",
  },
};

export type Dictionary = typeof en;

const hi: Dictionary = {
  brand: "SchemeSetu",
  tagline: "सरकारी योजनाओं तक आपका सेतु",
  nav: {
    home: "होम",
    topics: "विषय",
    check: "पात्रता जाँचें",
    schemes: "योजनाएँ",
    language: "भाषा",
    login: "लॉग इन",
    account: "मेरा खाता",
    menu: "मेनू",
    closeMenu: "मेनू बंद करें",
  },

  home: {
    eyebrow: "सरकारी योजनाएँ, आसान भाषा में",
    title: "जानिए आप किन योजनाओं के हक़दार हैं।",
    body: "कुछ आसान सवालों के जवाब दीजिए। SchemeSetu हर योजना के नियम जाँचकर बताता है कि आप कहाँ पात्र हैं, कौन-सी जानकारी बाकी है, और कौन-से दस्तावेज़ तैयार रखने हैं।",
    trust: [
      "हम कभी आधार या कोई पहचान संख्या नहीं माँगते",
      "हर नतीजे के साथ उसका नियम दिखता है",
      "English और हिंदी दोनों में",
    ],
    schemesHeading: "अभी हम ये योजनाएँ जाँचते हैं",
    schemesSub: (n: number) => `केंद्र सरकार की ${n} योजनाएँ, हर एक के नियम और आधिकारिक स्रोत के साथ।`,
    howTitle: "SchemeSetu कैसे काम करता है",
    howSub: "जनरेटिव AI आपकी बात समझता है। नियम-इंजन फ़ैसला करता है। हर जवाब के साथ उसका स्रोत।",
    steps: [
      { title: "अपने बारे में बताइए", body: "हिंदी, English या Hinglish में लिखिए, टैप कीजिए या बोलिए। न फ़ॉर्म, न पहचान संख्या।" },
      { title: "हम आधिकारिक नियम जाँचते हैं", body: "हर योजना के पात्रता नियम एक-एक करके जाँचे जाते हैं। कौन पात्र है, यह AI तय नहीं करता।" },
      { title: "जानिए क्या मिलेगा और क्या ले जाना है", body: "लाभ, तैयार रखने वाले दस्तावेज़ और आवेदन का आधिकारिक लिंक देखिए।" },
    ],
    topicsHeading: "विषय के हिसाब से योजनाएँ खोजें",
    topicsSub: "जो आपके लिए ज़रूरी है वह चुनें। हर विषय में योजनाएँ प्रकार के हिसाब से हैं: छात्रवृत्ति, इंटर्नशिप, ऋण और भी बहुत कुछ।",
  },

  topic: {
    count: (n: number) => (n === 1 ? "1 योजना" : `${n} योजनाएँ`),
    explore: "देखें",
    checkCta: "देखें मैं किन योजनाओं के लिए पात्र हूँ",
    allTopics: "सभी विषय",
    checking: "जाँच",
    everything: "सभी योजनाएँ",
  },

  search: {
    label: "योजनाएँ खोजें",
    open: "खोजें",
    placeholder: "खोजें: छात्रवृत्ति, इंटर्नशिप, पेंशन, ऋण…",
    loading: "योजनाएँ लोड हो रही हैं…",
    none: (q: string) => `“${q}” से कोई योजना मेल नहीं खाती।`,
    tryWords: "कोई आसान शब्द आज़माएँ, जैसे छात्रवृत्ति, नौकरी, पेंशन, ऋण या किसान।",
    seeAll: (n: number) => (n === 1 ? "नतीजा देखें" : `सभी ${n} नतीजे देखें`),
    quick: ["छात्रवृत्ति", "इंटर्नशिप", "पेंशन", "व्यवसाय ऋण", "आवास"],
    popular: "लोकप्रिय:",
    results: (n: number) => (n === 1 ? "1 योजना" : `${n} योजनाएँ`),
    clear: "साफ़ करें",
    all: "सभी",
    reset: "सभी योजनाएँ दिखाएँ",
    shortcut: "खोजने के लिए / दबाएँ",
    close: "खोज बंद करें",
  },

  assistant: {
    title: "SchemeSetu से पूछें",
    subtitle: "आवेदक के बारे में अपने शब्दों में बताइए: हिंदी, English या Hinglish में।",
    aiOn: (model: string) => `AI: ${model}`,
    aiOff: "बेसिक मोड: बेहतर जवाबों के लिए AI key जोड़ें",
    welcome:
      "नमस्ते! जिसे मदद चाहिए, उसके बारे में अपने शब्दों में बताइए। जैसे: “मेरी माँ 65 साल की हैं और यूपी में किसान हैं”। मैं सिर्फ़ ज़रूरी सवाल पूछूँगा और बताऊँगा कि कौन-सी योजनाएँ मेल खाती हैं।",
    starters: [
      "मेरी माँ 65 साल की हैं और किसान हैं",
      "मैं 21 साल का BTech छात्र हूँ, परिवार की आय 3 लाख है",
      "मैं 35 साल की महिला हूँ, ठेला लगाती हूँ",
      "PM Kisan ke liye kaun se documents chahiye?",
    ],
    placeholder: "अपना संदेश लिखें…",
    send: "भेजें",
    listen: "बोलें",
    listening: "सुन रहा हूँ…",
    dontKnow: "पता नहीं",
    understood: "समझा",
    thinking: "सोच रहा हूँ…",
    error: "सर्वर से संपर्क नहीं हो पाया। कृपया दोबारा कोशिश करें।",
    seeResults: "पूरे नतीजे देखें",
    newChat: "नई बातचीत",
    you: "आप",
    bot: "SchemeSetu",
    launcher: "SchemeSetu AI से पूछें",
    launcherShort: "AI से पूछें",
    voice: "आवाज़",
    voiceTitle: "वॉइस मोड",
    listeningLong: "सुन रहा हूँ… अब बोलिए",
    thinkingLong: "सोच रहा हूँ…",
    speakingLong: "बोल रहा हूँ… रोकने के लिए गोले पर टैप करें",
    paused: "गोले पर टैप करके बोलिए",
    endVoice: "वॉइस मोड बंद करें",
    micBlocked: "माइक्रोफ़ोन की अनुमति बंद है। ब्राउज़र सेटिंग में इस साइट को अनुमति देकर फिर कोशिश करें।",
    voiceGreeting: "नमस्ते! मैं सुन रहा हूँ। जिसे मदद चाहिए, उसके बारे में बताइए।",
    voiceHint: "हिंदी में बोलिए। English या Hinglish के लिए साइट को English पर बदलें।",
    readAloud: "सुनें",
    stopReading: "सुनना रोकें",
    heroTitle: "SchemeSetu AI से पूछें",
    heroSub: "अपनी स्थिति हिंदी, English या Hinglish में बताइए",
    heroGreeting: "नमस्ते! जिसे मदद चाहिए, उसके बारे में बताइए, और मैं उनके लिए सही योजनाएँ ढूँढूँगा।",
    heroExamples: [
      "मेरी माँ 65 साल की हैं और किसान हैं",
      "मैं 21 साल का BTech छात्र हूँ, परिवार की आय 3 लाख है",
      "मैं 35 साल की महिला हूँ, ठेला लगाती हूँ",
      "Meri beti 8 saal ki hai, hum BPL hain",
    ],
  },

  auth: {
    title: "फ़ोन नंबर से लॉग इन करें",
    subtitle: "अपने जवाब सेव करें और कोई नई योजना जुड़ने पर, जिसके आप पात्र हो सकते हैं, WhatsApp पर संदेश पाएँ।",
    phone: "मोबाइल नंबर",
    sendCode: "कोड भेजें",
    code: "6 अंकों का कोड",
    verify: "पुष्टि करें और लॉग इन करें",
    codeSentTo: (phone: string) => `हमने ${phone} पर कोड भेजा है।`,
    resendIn: (s: number) => `${s} सेकंड में दोबारा भेजें`,
    resend: "कोड दोबारा भेजें",
    changeNumber: "नंबर बदलें",
    privacy: "हम सिर्फ़ आपका फ़ोन नंबर और आपके चुने हुए जवाब रखते हैं। आप इन्हें कभी भी मिटा सकते हैं।",
    title2: "SchemeSetu में लॉग इन करें",
    tabOtp: "मोबाइल OTP",
    tabPassword: "पासवर्ड",
    signIn: "लॉग इन",
    createAccount: "नया खाता बनाएँ",
    username: "यूज़रनेम",
    usernameHint: "3–32 अक्षर, अंक, डॉट या अंडरस्कोर",
    password: "पासवर्ड",
    passwordHint: "कम से कम 8 अक्षर, अक्षरों और अंकों के साथ",
    confirmPassword: "पासवर्ड दोबारा लिखें",
    mismatch: "दोनों पासवर्ड एक जैसे नहीं हैं।",
    show: "पासवर्ड दिखाएँ",
    hide: "पासवर्ड छिपाएँ",
    noAccount: "नए हैं?",
    haveAccount: "पहले से खाता है?",
    passwordPrivacy: "आपका पासवर्ड सिर्फ़ सुरक्षित हैश के रूप में रखा जाता है। हम असली पासवर्ड न देखते हैं, न रखते हैं।",
    addPhoneTitle: "अपना फ़ोन नंबर जोड़ें",
    addPhoneBody: "नई योजनाओं के WhatsApp संदेश पाने के लिए अपना नंबर सत्यापित करें।",
    wrongCreds: "यूज़रनेम या पासवर्ड गलत है।",
    usernameTaken: "यह यूज़रनेम पहले से लिया हुआ है। कोई दूसरा चुनें।",
    phoneTaken: "यह नंबर पहले से किसी दूसरे खाते से जुड़ा है।",
    tooMany: "बहुत बार गलत कोशिश हुई। 15 मिनट बाद फिर कोशिश करें।",
    invalid: "बॉक्स के नीचे दिए यूज़रनेम और पासवर्ड के नियम देखें।",
  },

  account: {
    title: "मेरा खाता",
    phone: "फ़ोन",
    savedAnswers: "सेव किए गए जवाब",
    savedCount: (n: number, when: string) => `${n} जवाब सेव · ${when} को अपडेट`,
    noneSaved: "अभी कोई जवाब सेव नहीं है। कुछ सवालों के जवाब दें, वे यहाँ अपने-आप सेव हो जाएँगे।",
    continue: "जाँच जारी रखें",
    alertsTitle: "नई योजनाओं के लिए WhatsApp संदेश",
    alertsBody:
      "जब कोई नई योजना जुड़ेगी और आपके सेव किए गए जवाबों के हिसाब से आप उसके पात्र हो सकते हैं, तो हम इस नंबर पर एक WhatsApp संदेश भेजेंगे। आप इसे कभी भी बंद कर सकते हैं।",
    alertsOn: "संदेश चालू",
    alertsOff: "संदेश बंद",
    logout: "लॉग आउट",
    delete: "मेरा खाता और डेटा मिटाएँ",
    confirmDelete: "अपना खाता, सेव किए गए जवाब और संदेश सेटिंग मिटाएँ? यह वापस नहीं होगा।",
    loginToSave: "जवाब सेव करने और WhatsApp संदेश पाने के लिए लॉग इन करें",
    username: "यूज़रनेम",
    needPhone: "WhatsApp संदेशों के लिए फ़ोन नंबर चाहिए।",
    addPhone: "फ़ोन नंबर जोड़ें",
    saved: "आपके खाते में सेव हो गया",
  },

  status: {
    eligible: "संभवतः पात्र",
    needs_info: "और जानकारी चाहिए",
    not_eligible: "पात्र नहीं",
  },

  checker: {
    questionOf: (n: number) => `सवाल ${n}`,
    upToMore: (n: number) => (n === 1 ? "आख़िरी सवाल" : `इसके बाद अधिकतम ${n - 1} और`),
    yes: "हाँ",
    no: "नहीं",
    next: "आगे बढ़ें",
    skip: "पता नहीं, छोड़ें",
    back: "पीछे",
    seeResults: "अभी नतीजे देखें",
    cancelEdit: "रद्द करें",
    numberPlaceholder: "संख्या लिखें",
    numberInvalid: "कृपया पूरी संख्या लिखें।",
    outOfRange: (min: number | null, max: number | null) =>
      min !== null && max !== null
        ? `कृपया ${min} से ${max} के बीच की संख्या लिखें।`
        : min !== null
          ? `कृपया ${min} या उससे ज़्यादा लिखें।`
          : `कृपया ${max} या उससे कम लिखें।`,
    textPlaceholder: "अपना जवाब लिखें",
    years: "वर्ष",
    decided: (d: number, t: number) => `${t} में से ${d} योजनाओं का फ़ैसला हो गया`,
    liveHeading: "अब तक आपकी योजनाएँ",
    checking: "जाँच हो रही है…",
    error: "सर्वर से संपर्क नहीं हो पाया। कृपया अपना इंटरनेट जाँचें और दोबारा कोशिश करें।",
    retry: "दोबारा कोशिश करें",
    privacy: "आपके जवाब इसी ब्राउज़र टैब में रहते हैं। हम कोई पहचान संख्या नहीं माँगते।",
  },

  results: {
    heading: (n: number, moreToAsk: boolean) =>
      n === 0
        ? moreToAsk
          ? "अभी कोई योजना मेल नहीं खाती"
          : "इनमें से कोई योजना मेल नहीं खाती"
        : n === 1
          ? "आप 1 योजना के पात्र हो सकते हैं"
          : `आप ${n} योजनाओं के पात्र हो सकते हैं`,
    basedOn: (n: number) => `${n} जवाबों के आधार पर।`,
    zeroHint: "बाकी सवालों के जवाब देने से नतीजा बदल सकता है।",
    moreToCheck: (q: number, s: number) =>
      `${s === 1 ? "1 और योजना" : `${s} और योजनाएँ`} जाँचने के लिए ${q === 1 ? "1 और सवाल" : `अधिकतम ${q} और सवालों`} का जवाब दें।`,
    keepGoing: "जवाब देना जारी रखें",
    startOver: "फिर से शुरू करें",
    sections: {
      eligible: "संभवतः पात्र",
      needs_info: "और जानकारी चाहिए",
      not_eligible: "पात्र नहीं",
    },
    benefit: "आपको क्या मिलेगा",
    documents: "ये दस्तावेज़ तैयार रखें",
    official: "आधिकारिक वेबसाइट",
    weNeed: "फ़ैसले के लिए यह जानकारी चाहिए:",
    answer: "जवाब दें",
    whyNot: "क्यों नहीं",
    conditions: (passed: number, total: number) => `सभी शर्तें देखें (${total} में से ${passed} पूरी)`,
    anyOneOf: "इनमें से कोई एक:",
    yours: "आपका",
    unverified: "असत्यापित नमूना नियम",
    details: "योजना का विवरण",
    yourAnswers: "आपके जवाब",
    change: "बदलें",
    skipped: "छोड़े गए",
    noAnswers: "आपने अभी तक कोई जवाब नहीं दिया है।",
  },

  scheme: {
    allSchemes: "सभी योजनाएँ",
    level: { central: "केंद्र सरकार", state: "राज्य सरकार" },
    benefit: "लाभ",
    whoCanApply: "कौन आवेदन कर सकता है",
    allOf: "ये सभी शर्तें पूरी होनी चाहिए:",
    anyOf: "इनमें से कम से कम एक:",
    documents: "ज़रूरी दस्तावेज़",
    source: "आधिकारिक स्रोत",
    rule: "नियम",
    checkCta: "जाँचें कि आप पात्र हैं या नहीं",
    verifiedOn: (date: string) => `नियम ${date} को सत्यापित किए गए`,
    notVerified: "नियम अभी नवीनतम आधिकारिक दिशानिर्देशों से सत्यापित नहीं हुए हैं",
    goodToKnow: "ध्यान दें",
    listedUnder: "इन विषयों में",
  },

  dataNote: {
    title: "इस डेटा के बारे में",
    body: "ये नियम योजनाओं के सार्वजनिक पन्नों से सरल करके लिखे गए हैं और अभी नवीनतम आधिकारिक दिशानिर्देशों से सत्यापित नहीं हुए हैं। आवेदन से पहले आधिकारिक वेबसाइट पर ज़रूर पुष्टि करें।",
  },

  footer: {
    disclaimer:
      "SchemeSetu एक स्वतंत्र सहायक है, सरकारी वेबसाइट नहीं। अंतिम पात्रता योजना का प्राधिकरण तय करता है। आवेदन हमेशा आधिकारिक पोर्टल से ही करें।",
  },

  errors: {
    title: "कुछ गड़बड़ हो गई",
    body: "यह पेज लोड नहीं हो पाया। हो सकता है SchemeSetu सर्वर बंद हो।",
    retry: "दोबारा कोशिश करें",
    notFoundTitle: "पेज नहीं मिला",
    notFoundBody: "आप जो ढूँढ रहे थे, वह हमें नहीं मिला।",
    home: "होम पेज पर जाएँ",
  },
};

const dictionaries: Record<Lang, Dictionary> = { en, hi };

export function getDictionary(lang: Lang): Dictionary {
  return dictionaries[lang];
}

export function pick(text: LocalizedText, lang: Lang): string {
  return text[lang];
}

export function schemeName(s: { name: string; name_hi: string }, lang: Lang): string {
  return lang === "hi" ? s.name_hi : s.name;
}

export function ruleText(r: { description: string; description_hi: string }, lang: Lang): string {
  return lang === "hi" ? r.description_hi : r.description;
}
