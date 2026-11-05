"""Polity: study order, full-syllabus coverage and Prelims PYQ links.

Read by tools/build_site_data.py and tools/build_roadmap.py.
- CHAIN: the order a beginner studies Polity in (standard-book chapter order).
- NEW_THEMES: foundation themes Mains rarely asks alone but Prelims and every later theme need.
- RETITLE: wider titles for themes whose old title only named what Mains asked. URLs stay the same.
- COVER: per theme, NCERT basics, standard-book chapters, Bare Act, and the full syllabus split into
  sections. Each item may carry a regex; the build counts matching Prelims and Mains PYQs.
- PRELIMS: Prelims question ID -> theme key (polity questions and a few that sit in other themes).
"""

CONST = "https://legislative.gov.in/constitution-of-india/"
INDIACODE = "https://www.indiacode.nic.in/"
ICAW = "NCERT Class 11 · Indian Constitution at Work"
PT = "NCERT Class 11 · Political Theory"
PII = "NCERT Class 12 · Politics in India since Independence"
DP10 = "NCERT Class 10 · Democratic Politics II"
BOOK = "M. Laxmikanth, Indian Polity"

# Study order. Tier-1 themes first (Foundations stage), then tier 2 (Building blocks), then tier 3.
CHAIN = {
    "polity": ["constbasics", "making", "preamble", "union", "rights", "speech", "ucc", "basicstructure",
               "coopfed", "executive", "parliament", "speaker", "committees", "governor", "judiciary",
               "activism", "constmorality", "tribunals", "specialprov", "fiscalfed", "localgov", "elections",
               "cag", "bodies", "otherprov", "comparative", "parties", "pressure", "regulators", "envconst"],
}
TIER = {  # roadmap tier for every Polity chain theme (overrides tools/build_roadmap.py)
    **{k: 1 for k in CHAIN["polity"][:15]},
    **{k: 2 for k in CHAIN["polity"][15:29]},
    "envconst": 3,
}

NEW_THEMES = [
    dict(key="constbasics", cluster="Constitution & Polity",
         title="Constitution basics: constitutionalism, rule of law, liberty, equality, the State & types of majority"),
    dict(key="union", cluster="Constitution & Polity", title="Union & its territory, citizenship (Art 1–11)"),
    dict(key="bodies", cluster="Constitution & Polity",
         title="Constitutional, statutory & executive bodies: UPSC, NCSC–NCST–NCBC, NHRC, CIC, CVC, Lokpal, NITI Aayog"),
    dict(key="otherprov", cluster="Constitution & Polity", title="Parts, Schedules, official language & other provisions"),
]

RETITLE = {
    "making": "Historical underpinnings & making of the Constitution: Regulating Act 1773 to the Constituent Assembly",
    "rights": "Fundamental Rights (Art 12–35): equality, freedoms, life & liberty, writs",
    "ucc": "DPSP, Fundamental Duties & Uniform Civil Code",
    "basicstructure": "Amending power, basic structure & Ninth Schedule",
    "coopfed": "Federalism & Centre–State relations: cooperative, competitive & confrontational",
    "executive": "Union executive: President, PM & Council of Ministers, ordinances & pardon",
    "parliament": "Parliament & state legislatures: structure, procedure, budget, accountability",
    "governor": "Governor, state executive, President's Rule & emergency provisions",
    "judiciary": "Supreme Court & High Courts: jurisdiction, appointments & independence",
    "activism": "Judicial review, activism, PIL & separation of powers",
    "tribunals": "Tribunals, legal aid, Lok Adalats & criminal justice basics",
    "specialprov": "Special provisions: J&K, Delhi & UTs, Art 371, Fifth & Sixth Schedules",
}

# (what UPSC asks, Mains focus list, answer-writing pointers) for the new themes
GUIDE = {
    "constbasics": (
        "Mains rarely asks these ideas on their own, but Prelims does almost every year: what a constitutional government is, "
        "what rule of law and liberty mean, how rights relate to duties. Every later Polity theme assumes you know them, "
        "and the types of majority come back in amendments, impeachment and removal questions.",
        ["Define constitutionalism and limited government in one line each", "Rule of law (Dicey) and how Art 14 carries it",
         "Liberty, equality and rights: positive vs negative liberty, formal vs substantive equality",
         "Which majority applies where: amendment, impeachment, removal of the Vice-President or Speaker, Art 249 resolution"],
        ["Use these definitions as the opening line of GS2 answers on rights, courts or Parliament",
         "Quote one Article for each concept (Art 13, 14, 21, 368) so the answer stays constitutional, not just theoretical"]),
    "union": (
        "Prelims asks how states are formed and renamed under Art 2–4, how a person gets or loses citizenship, and the history of "
        "particular states. Mains comes at it through state reorganisation, CAA and the debate over smaller states.",
        ["Art 3: Parliament's power, the President's recommendation, state views not binding",
         "Why an Art 3 law is not an amendment under Art 368", "Citizenship at commencement (Art 5–8) and the Citizenship Act 1955",
         "CAA 2019 and OCI: what they change and the debate"],
        ["For reorganisation questions, pair Art 3 with the SRC 1953–56 and one recent case (Telangana 2014, J&K 2019)",
         "For citizenship, separate the constitutional part (Art 5–11) from the statutory part (Citizenship Act)"]),
    "bodies": (
        "Prelims tests which bodies are constitutional, statutory or executive, who appoints and removes their heads, and what "
        "they can and cannot do. Mains asks whether commissions are effective or just recommendatory.",
        ["Constitutional vs statutory vs executive: one table for all bodies",
         "Appointment and removal of the heads (UPSC, ECI, CAG, NHRC, CIC, CVC, Lokpal)",
         "Recommendatory vs binding powers", "NITI Aayog vs the Planning Commission"],
        ["Start with the legal basis (Article or Act) in one line; it shows the body's strength",
         "End with reform ideas from the 2nd ARC or the relevant committee"]),
    "otherprov": (
        "Prelims regularly asks which Part or Schedule contains a provision, which languages are in the Eighth Schedule and how "
        "the Constitution names itself. These are pure recall questions and easy marks once you have one table.",
        ["The 22 Parts and 12 Schedules: one line each", "Official language provisions (Art 343–351) and the Eighth Schedule",
         "Art 300A property, Art 311 safeguards for civil servants, Part IXB co-operative societies"],
        ["Use the Schedule or Part number when it is the point of the question; otherwise cite the Article"]),
}

def S(*items):
    """Shorthand: items are (text, regex), (text, regex, [extra PYQ ids]) or plain text.
    Extra ids count questions the regex can't see (answer only in the options, or filed under a linked theme)."""
    return [(i + ([],) if len(i) == 2 else i) if isinstance(i, tuple) else (i, None, []) for i in items]

COVER = {
"constbasics": dict(
    ncert=[(PT, "Ch 1 Political Theory: An Introduction; Ch 2 Freedom; Ch 3 Equality; Ch 5 Rights"), (ICAW, "Ch 1 Constitution: Why and How?")],
    book=["Salient Features of the Constitution", "Parliament (voting in the Houses)"],
    bare=[("Art 13, 14 and 368", CONST)],
    sections=[
        ("What a constitution does", S(
            ("Functions: sets up the organs of the State, limits their power, guarantees rights", r"purpose of the .?constitution|chief purpose"),
            ("Constitutionalism and constitutional (limited) government", r"constitutional government|constitutionalism"),
            ("Constitution vs ordinary law vs ordinance vs rules; what 'law' means in Art 13", r"meaning of the term .?law|relationship between law and liberty"),
        )),
        ("Political ideas UPSC tests", S(
            ("Rule of law (Dicey): limited power, equality before law, rights from courts", r"rule of law"),
            ("Liberty: negative and positive; best safeguards of liberty in a democracy", r"\bliberty\b"),
            ("Equality: formal vs substantive, absence of privileges", r"\bequality in society|implications of equality"),
            ("Rights and duties: rights as claims against the State", r"rights are|rights and duties", ["P2017-049", "P2017-045"]),
            ("The State: population, territory, government, sovereignty", r"defines the term .?state"),
            ("Democracy and ideologies: virtues of democracy, Gandhism and Marxism, liberal democracy", r"democracy.s superior|gandhism|marxism|liberal democracy"),
        )),
        ("Types of majority", S(
            ("Simple majority: ordinary bills, money bills, no-confidence and adjournment motions", r"simple majority"),
            ("Absolute majority: more than half of total membership (part of the special majority)", r"absolute majority"),
            ("Effective majority: removal of the Vice-President (Art 67b), Speaker and Deputy Speaker (Art 94c)", r"effective majority", ["P2024-044"]),
            ("Special majority under Art 368: majority of total membership and two-thirds present and voting; also judges' removal, Art 352", r"special majority|two.thirds", ["P2022-051", "P2019-053"]),
            ("Art 249 and Art 312: two-thirds of Rajya Sabha members present and voting", r"article 249|resolution to that effect", ["P2016-043"]),
            ("Impeachment of the President (Art 61): two-thirds of the total membership of each House", None),
        )),
    ]),
"making": dict(
    ncert=[(ICAW, "Ch 1 Constitution: Why and How?")],
    book=["Historical Background", "Making of the Constitution"],
    bare=[("Art 393–395 (short title, commencement, repeals)", CONST)],
    sections=[
        ("Company rule, 1773–1857", S(
            ("Regulating Act 1773: Governor-General of Bengal, Supreme Court at Calcutta", r"regulating act"),
            ("Pitt's India Act 1784: Board of Control, dual government", r"pitt"),
            ("Charter Acts 1793, 1813 (trade monopoly ended except tea and China), 1833 (Governor-General of India), 1853", r"charter act|governor general of india"),
        )),
        ("Crown rule, 1858–1935", S(
            ("Government of India Act 1858: Crown takes over, Secretary of State", r"act of 1858|\b1858\b"),
            ("Indian Councils Acts 1861, 1892, 1909 (separate electorates)", r"councils act|morley|\b1909\b"),
            ("Government of India Act 1919: dyarchy in provinces, bicameral centre", r"\b1919\b|dyarchy|diarchy"),
            ("Simon Commission 1927 and the Nehru Report", r"simon commission|nehru report"),
            ("Government of India Act 1935: All-India federation, provincial autonomy, dyarchy at centre, three lists, Federal Court", r"\b1935\b"),
        )),
        ("The Constituent Assembly, 1946–50", S(
            ("Cripps 1942 and Cabinet Mission 1946: how the Assembly was formed", r"cripps|cabinet mission"),
            ("Objectives Resolution, committees and the Drafting Committee (Ambedkar)", r"objectives? resolution|drafting committee"),
            ("Adoption on 26 Nov 1949 (Constitution Day) and commencement on 26 Jan 1950", r"constitution day|26th november"),
            ("Indian Independence Act 1947 and dominion status", r"independence act|dominion"),
            ("Sources of the Constitution: GoI Act 1935, UK, US, Ireland, Canada and others", r"borrow|sources of the"),
        )),
    ]),
"preamble": dict(
    ncert=[(ICAW, "Ch 10 The Philosophy of the Constitution; Ch 9 Constitution as a Living Document")],
    book=["Salient Features of the Constitution", "Preamble of the Constitution"],
    bare=[("Preamble; Constitution (42nd Amendment) Act 1976", CONST)],
    sections=[
        ("Salient features", S(
            ("Lengthiest written constitution, partly rigid and partly flexible", r"salient features|features of the constitution"),
            ("Federal system with a unitary bias, parliamentary government, single citizenship", None),
            ("Independent integrated judiciary, universal adult franchise, emergency provisions", None),
        )),
        ("The Preamble", S(
            ("Source of authority: 'We, the people of India'", r"we,? the people"),
            ("Nature of the State: sovereign, socialist, secular, democratic, republic", r"sovereign|socialist|secular|republic"),
            ("Objectives: justice (social, economic, political), liberty, equality, fraternity", r"economic justice|fraternity|objectives?.{0,30}preamble|preamble.{0,40}objective"),
            ("Is the Preamble part of the Constitution? Berubari (1960), Kesavananda (1973), LIC (1995)", r"preamble to the constitution of india is|part of the constitution"),
            ("42nd Amendment added socialist, secular, integrity; SC upheld them in 2024", r"42nd"),
            ("India's status on 26 Jan 1950: a sovereign democratic republic", r"constitutional status of india"),
        )),
        ("The 'living' Constitution", S(
            ("Mind of the makers: Preamble, Objectives Resolution", r"mind of the makers"),
            ("Change by amendment and by judicial interpretation", r"living"),
        )),
    ]),
"union": dict(
    ncert=[(PT, "Ch 6 Citizenship"), (ICAW, "Ch 7 Federalism (the Union and the states)")],
    book=["Union and its Territory", "Citizenship"],
    bare=[("Part I (Art 1–4) and Part II (Art 5–11)", CONST), ("Citizenship Act 1955", INDIACODE)],
    sections=[
        ("Union and its territory (Art 1–4)", S(
            ("Art 1: 'India, that is Bharat, shall be a Union of States'; territory of India", r"union of states|\bbharat\b"),
            ("Art 2 and 3: admitting and forming states; President's recommendation; state's view not binding", r"new states?|formation of|reorgani[sz]"),
            ("Art 4: such laws are not amendments under Art 368", None),
            ("How states were formed: SRC 1953–56, Nagaland 1963, Telangana 2014, J&K reorganisation 2019", r"came into existence|nagaland|telangana|part .?c.? state|centrally administered"),
        )),
        ("Citizenship (Art 5–11) and the Citizenship Act 1955", S(
            ("Citizenship at commencement (Art 5–8); voluntary foreign citizenship ends it (Art 9)", r"citizen by birth|head of state"),
            ("Acquiring citizenship: birth, descent, registration, naturalisation, territory", r"naturali[sz]|registration"),
            ("Losing it: renunciation, termination, deprivation", r"deprived|renunci"),
            ("Single citizenship and domicile", r"single citizenship|one citizenship|domicile"),
            ("Citizenship (Amendment) Act 2019 and Overseas Citizens of India", r"citizenship \(amendment\)|\bcaa\b|overseas citizen"),
        )),
    ]),
"rights": dict(
    ncert=[(ICAW, "Ch 2 Rights in the Indian Constitution"), (PT, "Ch 5 Rights")],
    book=["Fundamental Rights"],
    bare=[("Part III (Art 12–35)", CONST)],
    sections=[
        ("General provisions (Art 12–13)", S(
            ("Art 12: what counts as 'the State'", r"article 12\b"),
            ("Art 13: laws inconsistent with Fundamental Rights; what 'law' includes", r"article 13\b|term .?law"),
        )),
        ("Right to equality (Art 14–18)", S(
            ("Art 14: equality before law and equal protection; reasonable classification; arbitrariness", r"article 14\b|equality before|unguided|equal protection"),
            ("Art 15 and 16: no discrimination; reservations 15(4), 15(5), 15(6), 16(4), 16(4A), 16(6); Art 335", r"article 1[56]\b|16 ?\(4\)|article 335|reservation"),
            ("Art 17: untouchability abolished", r"untouchab"),
            ("Art 18: titles abolished; Bharat Ratna and Padma awards are not titles", r"article 18|bharat ratna|titles"),
        )),
        ("Right to freedom (Art 19–22)", S(
            ("Art 19: six freedoms and reasonable restrictions (see the speech theme)", r"article 19\b|freedom of movement|19 ?\(1\)"),
            ("Art 20: no ex post facto law, double jeopardy or self-incrimination", r"article 20\b|double jeopardy|self.incrimination"),
            ("Art 21: life and personal liberty; due process (Maneka Gandhi 1978)", r"article 21\b|personal liberty|due process"),
            ("Privacy as part of Art 21 (Puttaswamy 2017) and the Aadhaar judgment (2018)", r"privacy|aadhaar"),
            ("Right to marry (Hadiya), dignity, livelihood, environment, speedy trial", r"marry|dignity|livelihood"),
            ("Art 21A: education for children aged 6–14", r"21 ?a\b|right to education"),
            ("Art 22: arrest and preventive detention", r"article 22|preventive detention"),
        )),
        ("Exploitation, religion, culture (Art 23–30)", S(
            ("Art 23–24: no trafficking or forced labour; no child labour in hazardous work", r"exploitation|forced labour|traffic|employment of children"),
            ("Art 25–28: freedom of religion; essential religious practices", r"article 2[5-8]\b|freedom of religion|essential religious"),
            ("Art 29–30: minorities' cultural and educational rights", r"article (29|30)\b|minorit"),
        )),
        ("Property, remedies and limits (Art 31–35)", S(
            ("Right to property: removed by the 44th Amendment; now a legal right under Art 300A", r"right to property|300 ?a"),
            ("Art 32 and 226: writs (habeas corpus, mandamus, prohibition, certiorari, quo warranto)", r"\bwrit|mandamus|habeas|certiorari|quo warranto|article 32\b"),
            ("Art 33–35: limits for armed forces; martial law", r"article 3[3-5]\b|martial law"),
        )),
        ("Rights in recent judgments and laws", S(
            ("Transgender persons: NALSA (2014) and the 2019 Act", r"transgender"),
            ("Fundamental Rights and the UDHR; FRs vs DPSP", r"universal declaration|human rights"),
        )),
    ]),
"speech": dict(
    ncert=[(ICAW, "Ch 2 Rights in the Indian Constitution")],
    book=["Fundamental Rights (Art 19)"],
    bare=[("Art 19(1)(a) and 19(2)", CONST)],
    sections=[
        ("Scope of Art 19(1)(a)", S(
            ("Press, information, silence, commercial speech, the internet (Anuradha Bhasin 2020)", r"19 ?\(1\) ?\(a\)|freedom of (speech|press)|internet"),
        )),
        ("Restrictions under Art 19(2)", S(
            ("Grounds: sovereignty and integrity, security, friendly relations, public order, decency, contempt, defamation, incitement", r"19 ?\(2\)|reasonable restriction|defamation"),
            ("Sedition: S.124A, Kedar Nath (1962), the 2022 stay, BNS 2023", r"sedition|124 ?a"),
        )),
        ("Cases and current issues", S(
            ("Shreya Singhal (2015): Section 66A struck down", r"66 ?a|shreya"),
            ("Hate speech, film certification, social media rules", r"hate speech|film|social media"),
        )),
    ]),
"ucc": dict(
    ncert=[(ICAW, "Ch 2 Rights in the Indian Constitution (Directive Principles)")],
    book=["Directive Principles of State Policy", "Fundamental Duties"],
    bare=[("Part IV (Art 36–51) and Part IVA (Art 51A)", CONST)],
    sections=[
        ("Nature of the Directive Principles", S(
            ("Not enforceable by courts (Art 37) but fundamental in governance", r"fundamental (for|in) the governance|enforceable by|part iv"),
            ("Ideal of the welfare state; borrowed from the Irish Constitution", r"welfare state"),
            ("They limit and guide legislative and executive action", r"limitations? upon|influence the making"),
        )),
        ("The principles", S(
            ("Socialist: Art 38, 39 (no concentration of wealth), 41, 42, 43, 47", r"concentration of wealth|living wage|equal pay"),
            ("Gandhian: Art 40 (panchayats), 43, 46, 47, 48", r"article 40\b"),
            ("Liberal-intellectual: Art 44 (UCC), 45, 48A, 49, 50 (separate judiciary), 51 (international peace)", r"international peace|separation of (the )?judiciary"),
            ("Added later: 42nd (39f, 39A, 43A, 48A), 44th (38(2)), 86th (45), 97th (43B)", r"added to the directive|42nd amendment"),
        )),
        ("Fundamental Rights vs Directive Principles", S(
            ("Champakam Dorairajan, Golaknath, 25th Amendment (Art 31C), Kesavananda, Minerva Mills", r"31 ?c|minerva|conflict"),
        )),
        ("Fundamental Duties (Art 51A)", S(
            ("Eleven duties; added by the 42nd Amendment (Swaran Singh Committee), the 11th by the 86th", r"fundamental dut|51 ?a|swaran singh"),
            ("Not enforceable by courts; Parliament can enforce them by law; Verma Committee", r"composite culture|sovereignty,? unity and integrity|correlative"),
        )),
        ("Uniform Civil Code and extra-constitutional bodies", S(
            ("Art 44: Constituent Assembly debate, Goa, Uttarakhand UCC 2024, Law Commission view", r"uniform civil code|article 44\b"),
            ("Khap panchayats and honour killings (Shakti Vahini 2018)", r"khap|honou?r"),
        )),
    ]),
"basicstructure": dict(
    ncert=[(ICAW, "Ch 9 Constitution as a Living Document")],
    book=["Amendment of the Constitution", "Basic Structure of the Constitution"],
    bare=[("Art 368 (Part XX); Ninth Schedule; Art 31A–31C", CONST)],
    sections=[
        ("Procedure under Art 368", S(
            ("Bill only in Parliament (either House), by a minister or private member; no prior presidential sanction", r"initiated|prior recommendation"),
            ("Special majority in each House separately; no joint sitting; President must assent (24th Amendment)", r"amendment bill|obligatory|assent"),
            ("State ratification by half the states for federal provisions (President's election, Union and state executive power, courts, Seventh Schedule, Art 368 itself)", r"ratif"),
            ("Three kinds: simple majority outside Art 368, special majority, special majority plus ratification", r"simple majority|kinds of amendment"),
        )),
        ("Basic structure doctrine", S(
            ("Shankari Prasad (1951), Golaknath (1967), 24th Amendment, Kesavananda Bharati (1973)", r"golak|kesavananda|shankari"),
            ("Indira Gandhi v Raj Narain (1975), 42nd Amendment Art 368(4)–(5), Minerva Mills (1980)", r"raj narain|minerva|placing the election"),
            ("Elements the courts have named: supremacy of the Constitution, secularism, federalism, judicial review, free elections", r"basic structure"),
            ("Amendments struck down: 39th (part), 99th (NJAC, 2015)", r"99th|struck down"),
        )),
        ("Ninth Schedule", S(
            ("1st Amendment 1951 (Nehru), Art 31B; I.R. Coelho (2007): laws added after 24 April 1973 can be reviewed", r"ninth schedule|9th schedule|31 ?b|coelho"),
        )),
        ("Amendments worth knowing", S(
            ("1st, 7th, 24th, 42nd, 44th, 52nd, 61st, 73rd, 74th, 86th, 101st (GST), 103rd (EWS), 106th (women's reservation)", r"\b(1st|7th|24th|44th|52nd|61st|86th|101st|103rd|106th) amendment"),
        )),
    ]),
"coopfed": dict(
    ncert=[(ICAW, "Ch 7 Federalism"), (DP10, "Ch 2 Federalism")],
    book=["Federal System", "Centre–State Relations", "Inter-State Relations"],
    bare=[("Part XI (Art 245–263); Seventh Schedule; Art 301–307", CONST)],
    sections=[
        ("Federal system", S(
            ("Federal features: two governments, division of powers, written and rigid constitution, independent judiciary", r"federal (character|features?)|feature of indian federalism|federal in character"),
            ("Unitary features: strong centre, Art 3, emergency, single constitution and citizenship, All-India Services, Governor", r"unitary"),
        )),
        ("Legislative relations (Art 245–255)", S(
            ("Seventh Schedule: Union, State and Concurrent Lists; residuary power with Parliament (Art 248)", r"seventh schedule|union list|state list|concurrent|residuary|state subject|union subject"),
            ("Parliament on State List subjects: Art 249 (national interest), 250 (emergency), 252 (two or more states), 253 (treaties)", r"national interest|international treat|article 25[0-3]\b"),
        )),
        ("Administrative relations (Art 256–263)", S(
            ("Centre's directions to states; duty to protect states (Art 355)", r"article 355|internal disturbance|directions?"),
            ("All-India Services; Union agencies (CBI consent)", r"\bcbi\b|consent"),
        )),
        ("Inter-state relations", S(
            ("River water disputes (Art 262); Inter-State Council (Art 263); Zonal Councils; North Eastern Council", r"inter.?state|zonal council|north eastern council"),
            ("Freedom of trade and commerce (Art 301–307); full faith and credit", r"trade and commerce"),
        )),
        ("Reform reports and current debates", S(
            ("Sarkaria (1988), Punchhi (2010), Rajamannar (Tamil Nadu)", r"sarkaria|punchhi|rajamannar"),
            ("Cooperative, competitive and confrontational federalism: NITI Aayog, GST Council, COVID-era laws", r"cooperative|competitive|confrontational"),
        )),
    ]),
"executive": dict(
    ncert=[(ICAW, "Ch 4 Executive")],
    book=["Parliamentary System", "President", "Vice-President", "Prime Minister", "Central Council of Ministers", "Cabinet Committees"],
    bare=[("Part V, Chapter I (Art 52–78); Art 123", CONST)],
    sections=[
        ("Parliamentary system", S(
            ("Nominal and real executive, collective responsibility, dual membership, PM's leadership", r"parliamentary (system|government|democracy|form)|cabinet form"),
            ("Why India chose it over the presidential system", r"presidential (system|form)"),
        )),
        ("President", S(
            ("Election (Art 54–55): electoral college, value of votes; nominated members cannot vote", r"election of the president|electoral college|value of (the )?vote"),
            ("Term, qualifications, impeachment (Art 61), election disputes (Art 71)", r"impeach|election of the president of india is declared void|postponed"),
            ("Powers: executive, legislative, financial, judicial, diplomatic, military; veto types", r"\bveto|summon a session|executive power of the union"),
        )),
        ("Vice-President", S(
            ("Election by both Houses (nominated members included); removal by Rajya Sabha resolution (Art 67b)", r"vice.?president"),
        )),
        ("Prime Minister and Council of Ministers", S(
            ("Art 74 aid and advice; Art 75 collective responsibility; ministers hold office at the President's pleasure", r"council of ministers|collective(ly)? respons|pleasure of the president"),
            ("91st Amendment: ministers capped at 15% of the Lok Sabha; ranks are not in the Constitution", r"15 ?per ?cent|four ranks"),
            ("PM's duties (Art 78); business rules (Art 77); Cabinet Secretariat", r"cabinet secretariat|convenient transaction|communicate to the president"),
        )),
        ("Ordinances and pardon", S(
            ("Ordinance (Art 123): when Parliament is not in session, six weeks; D.C. Wadhwa, Krishna Kumar Singh", r"ordinance"),
            ("Pardon (Art 72): pardon, commutation, remission, respite, reprieve; on advice; limited judicial review", r"pardon|clemency|remission|commut"),
        )),
    ]),
"parliament": dict(
    ncert=[(ICAW, "Ch 5 Legislature")],
    book=["Parliament", "Parliamentary Forums", "State Legislature"],
    bare=[("Part V, Chapter II (Art 79–122); Part VI, Chapter III (Art 168–212)", CONST)],
    sections=[
        ("Composition and membership", S(
            ("Lok Sabha (Art 81) and Rajya Sabha (Art 80); nominated members", r"composition|nominated member"),
            ("Qualifications and disqualification (Art 102); office of profit", r"office of profit|disqualification act"),
        )),
        ("Sessions", S(
            ("Summoning (no more than six months between sessions), adjournment, prorogation, dissolution", r"summon|prorog|sine die|\bsessions? of\b"),
            ("Which bills lapse on dissolution", r"lapse"),
            ("Joint sitting (Art 108)", r"joint sitting"),
        )),
        ("Making laws", S(
            ("Ordinary bills and private members' bills", r"private member"),
            ("Money bills (Art 110): Speaker certifies; Rajya Sabha can only recommend, within 14 days", r"money bill"),
            ("Financial bills (Art 117)", r"financial bill"),
        )),
        ("Budget in Parliament", S(
            ("Annual Financial Statement (Art 112); demands for grants only on the President's recommendation (Art 113)", r"annual financial statement|demands? for grants?"),
            ("Consolidated Fund (Art 266), Contingency Fund (Art 267), appropriation, vote on account, cut motions", r"consolidated fund|contingency fund|appropriation|cut motion"),
        )),
        ("Holding the government to account", S(
            ("Question hour: starred, unstarred and short-notice questions; zero hour", r"question hour|starred|zero hour|supplementary"),
            ("Motions: adjournment, no-confidence (Lok Sabha only, not in the Constitution), censure, calling attention", r"no.?confidence|adjournment motion|censure|calling attention"),
            ("Lok Sabha vs Rajya Sabha: equal and exclusive powers", r"equal powers|exclusive power"),
            ("Parliamentary privileges (Art 105), MPLADS, Leader of the Opposition", r"privilege|mplad|leader of (the )?opposition"),
        )),
        ("State legislatures", S(
            ("Legislative Councils (Art 169, at most a third of the Assembly); Governor's address", r"legislative council|legislative assembly"),
        )),
    ]),
"speaker": dict(
    ncert=[(ICAW, "Ch 5 Legislature")],
    book=["Parliament (presiding officers)", "Anti-Defection Law"],
    bare=[("Art 89–98, 178–187; Tenth Schedule", CONST)],
    sections=[
        ("Presiding officers", S(
            ("Speaker and Deputy Speaker: election, removal (14 days' notice, effective majority), stays in office until the new House meets", r"speaker"),
            ("Chairman and Deputy Chairman of the Rajya Sabha; pro tem Speaker", r"chairman|pro.?tem"),
        )),
        ("Anti-defection law (Tenth Schedule)", S(
            ("52nd Amendment 1985 and 91st Amendment 2003; grounds: giving up membership, defying the whip", r"anti.?defection|tenth schedule|10th schedule|defection"),
            ("Exception for a two-thirds merger; nominated members get six months to join a party", r"merger|nominated legislator"),
            ("Presiding officer decides; Kihoto Hollohan (1992); Keisham Meghachandra (2020) on timelines", r"time.?frame|kihoto"),
        )),
    ]),
"committees": dict(
    ncert=[(ICAW, "Ch 5 Legislature")],
    book=["Parliamentary Committees"],
    bare=[("Art 118 (rules of procedure)", CONST)],
    sections=[
        ("Financial committees", S(
            ("Public Accounts Committee: 22 members (15 LS, 7 RS), examines CAG reports", r"public accounts"),
            ("Estimates Committee: 30 Lok Sabha members, the largest committee", r"estimates|largest committee"),
            ("Committee on Public Undertakings", r"public undertakings"),
        )),
        ("Standing committees", S(
            ("Department-related standing committees (since 1993)", r"department.?related|standing committee"),
            ("Subordinate legislation, ethics, privileges, welfare of SCs and STs", r"subordinate legislation|ethics committee|welfare of scheduled"),
        )),
        ("Ad hoc committees", S(
            ("Select committees and joint parliamentary committees", r"ad hoc|select committee|joint parliamentary"),
        )),
    ]),
"governor": dict(
    ncert=[(ICAW, "Ch 4 Executive; Ch 7 Federalism")],
    book=["Governor", "Chief Minister", "State Council of Ministers", "Emergency Provisions"],
    bare=[("Art 153–167, 200–201, 213, 361; Part XVIII (Art 352–360)", CONST)],
    sections=[
        ("Governor", S(
            ("Appointment, term at the President's pleasure, one Governor for two or more states", r"same person cannot be appointed|appointed as governor"),
            ("Immunities (Art 361)", r"criminal proceedings|answerable to any court"),
            ("Discretion: constitutional and situational (Art 163)", r"discretion"),
            ("Bills: assent, withhold, return, reserve for the President (Art 200–201); SC timelines", r"reserv|assent"),
        )),
        ("State executive", S(
            ("Chief Minister, state Council of Ministers, Chief Secretary", r"chief minister|chief secretary|minister in a state"),
        )),
        ("Emergency provisions", S(
            ("National emergency (Art 352): grounds, 44th Amendment safeguards, effect on rights (Art 358–359)", r"national emergency|article 352|article 35[89]"),
            ("President's Rule (Art 356): approval, duration, S.R. Bommai (1994), effects on the Assembly and local bodies", r"president.?s rule|article 356|bommai"),
            ("Financial emergency (Art 360)", r"financial emergency|article 360"),
        )),
        ("Reform reports", S(
            ("Sarkaria and Punchhi on the Governor's role", r"sarkaria|punchhi|eminent person"),
        )),
    ]),
"judiciary": dict(
    ncert=[(ICAW, "Ch 6 Judiciary")],
    book=["Supreme Court", "High Court", "Subordinate Courts"],
    bare=[("Art 124–147, 214–237", CONST)],
    sections=[
        ("Organisation and appointments", S(
            ("Number of judges fixed by Parliament (Art 124(1))", r"number of judges"),
            ("Collegium: Three Judges cases; NJAC (99th Amendment) struck down in 2015", r"collegium|njac|99th|appointment of judges"),
            ("Removal of judges (Art 124(4)) and the Judges (Inquiry) Act 1968", r"impeach|incapacity|judges \(inquiry\)"),
            ("Retired and ad hoc judges (Art 127–128)", r"retired judge|ad hoc judge"),
        )),
        ("Jurisdiction", S(
            ("Original (Art 131, Centre–state disputes), writ (Art 32), appellate, advisory (Art 143)", r"original jurisdiction|dispute between the cent|advisory"),
            ("Complete justice (Art 142); review and curative petitions", r"article 142|review its own"),
            ("Court of record and contempt (Art 129, 215); Contempt of Courts Act 1971", r"contempt"),
        )),
        ("High Courts and lower courts", S(
            ("High Courts: Art 226 writs, powers over lower courts", r"high court"),
            ("Bar Councils and the Advocates Act", r"bar council|advocates"),
        )),
        ("Independence", S(
            ("Security of tenure, salaries charged on the Consolidated Fund, separation from the executive (Art 50)", r"independence of (the )?judiciary|custodian"),
        )),
    ]),
"activism": dict(
    ncert=[(ICAW, "Ch 6 Judiciary")],
    book=["Judicial Review", "Judicial Activism", "Public Interest Litigation"],
    bare=[("Art 13, 32, 226, 142", CONST)],
    sections=[
        ("Judicial review", S(
            ("Meaning and basis (Art 13, 32, 226); review of constitutional amendments", r"judicial review|constitutionally invalid|called into question"),
        )),
        ("Activism and restraint", S(
            ("Separation of powers vs checks and balances; overreach", r"separation of powers|overreach|activism"),
            ("Judicial legislation: Vishaka guidelines, euthanasia cases", r"vishaka|euthanasia|guidelines"),
        )),
        ("Public interest litigation", S(
            ("Origins (S.P. Gupta, Hussainara Khatoon), relaxed locus standi, misuse", r"public interest litigation|\bpil\b|public.minded"),
        )),
    ]),
"tribunals": dict(
    ncert=[(ICAW, "Ch 6 Judiciary")],
    book=["Tribunals", "Lok Adalats and Other Courts", "National Legal Services Authority"],
    bare=[("Art 39A, 323A, 323B", CONST), ("Legal Services Authorities Act 1987; Gram Nyayalayas Act 2008", INDIACODE)],
    sections=[
        ("Tribunals", S(
            ("Art 323A and 323B (42nd Amendment); L. Chandra Kumar (1997); Tribunal Reforms Act 2021", r"tribunal"),
        )),
        ("Legal aid and alternative forums", S(
            ("Art 39A; NALSA; who gets free legal aid", r"legal services|free legal"),
            ("Lok Adalats, Gram Nyayalayas, arbitration and mediation", r"lok adalat|gram nyayalaya|arbitration|mediat"),
        )),
        ("Criminal justice basics", S(
            ("FIR and Zero FIR under the BNSS 2023; police and judicial custody", r"\bfir\b|custody"),
            ("Bail, parole and furlough; prisons are a state subject (Prisons Act 1894)", r"parole|prison|bail"),
            ("New criminal laws (BNS, BNSS, BSA) and other Acts such as the Official Secrets Act", r"bharatiya|official secrets"),
        )),
    ]),
"specialprov": dict(
    ncert=[(ICAW, "Ch 7 Federalism (special provisions)")],
    book=["Union Territories", "Scheduled and Tribal Areas", "Special Provisions for Some States", "Jammu and Kashmir"],
    bare=[("Art 239–244A, 370, 371–371J; Fifth and Sixth Schedules", CONST)],
    sections=[
        ("Jammu and Kashmir", S(
            ("Art 370 and 35A, the 2019 changes and the Reorganisation Act; SC judgment of 2023", r"article 370|35 ?a|jammu|kashmir"),
        )),
        ("Union Territories and Delhi", S(
            ("Art 239, 239AA (69th Amendment); NCT of Delhi cases 2018 and 2023", r"union territor|239|delhi|lt\.? governor"),
        )),
        ("Special provisions for states (Art 371–371J)", S(
            ("Maharashtra and Gujarat, Nagaland (371A), Assam, Manipur, Sikkim, Mizoram, Arunachal, Goa, Karnataka and others", r"\b371"),
        )),
        ("Scheduled and tribal areas", S(
            ("Fifth Schedule: areas declared by the President, Tribes Advisory Council, Governor's powers; Samatha (1997) on tribal land", r"fifth schedule|scheduled areas?|tribal land"),
            ("Sixth Schedule: Assam, Meghalaya, Tripura, Mizoram; autonomous district councils", r"sixth schedule|tribal areas"),
            ("Scheduled Tribes (Art 342): notified by the President, list differs by state", r"scheduled tribe"),
        )),
    ]),
"fiscalfed": dict(
    ncert=[(ICAW, "Ch 7 Federalism")],
    book=["Centre–State Relations (financial)", "Finance Commission", "Goods and Services Tax Council"],
    bare=[("Part XII (Art 264–293); Art 279A, 280", CONST)],
    sections=[
        ("Sharing taxes", S(
            ("Divisible pool (Art 270); cesses and surcharges stay outside it", r"divisible pool|cess|surcharge|net proceeds"),
            ("Grants: Art 275 (statutory) and Art 282 (discretionary)", r"grant"),
            ("State borrowing (Art 293); FRBM", r"borrow|frbm"),
        )),
        ("Finance Commission", S(
            ("Art 280: chair and four members every five years; devolution and grants", r"finance commission"),
            ("14th (42%), 15th (41%) and their criteria; the 16th FC", r"fourteenth|fifteenth|14th|15th|16th|horizontal"),
        )),
        ("GST", S(
            ("101st Amendment, GST Council (Art 279A), compensation to states", r"\bgst\b|goods and services tax"),
        )),
    ]),
"localgov": dict(
    ncert=[(ICAW, "Ch 8 Local Governments")],
    book=["Panchayati Raj", "Municipalities"],
    bare=[("Part IX (Art 243–243O), Part IXA (Art 243P–243ZG); Eleventh and Twelfth Schedules", CONST), ("PESA 1996", INDIACODE)],
    sections=[
        ("Evolution", S(
            ("Balwant Rai Mehta (1957), Ashok Mehta (1977), G.V.K. Rao, L.M. Singhvi; Art 40", r"balwant|ashok mehta|singhvi|democratic decentrali"),
        )),
        ("73rd Amendment: Panchayats", S(
            ("Gram Sabha; three tiers (no intermediate tier where population is under 20 lakh); direct elections", r"gram sabha|intermediate"),
            ("Reservation (at least a third for women), five-year term, minimum age 21", r"minimum age|reconstituted|premature"),
            ("State Election Commission (243K) and State Finance Commission (243I, set up by the Governor)", r"state election commission|financial position of panchayats"),
            ("Eleventh Schedule: 29 subjects", r"eleventh schedule"),
        )),
        ("74th Amendment: Municipalities", S(
            ("Nagar panchayat, municipal council, municipal corporation; ward committees; Twelfth Schedule (18 subjects)", r"municipal|74th"),
            ("District and Metropolitan Planning Committees", r"planning committee"),
        )),
        ("Scheduled Areas and capacity", S(
            ("PESA 1996: gram sabha powers in Fifth Schedule areas", r"pesa|extension to scheduled"),
            ("Funds, functions, functionaries; own revenue; Rashtriya Gram Swaraj Abhiyan", r"3 ?fs|own revenue|gram swaraj|functionaries"),
        )),
    ]),
"elections": dict(
    ncert=[(ICAW, "Ch 3 Election and Representation")],
    book=["Election Commission", "Elections", "Electoral Reforms", "Delimitation Commission"],
    bare=[("Part XV (Art 324–329)", CONST), ("Representation of the People Acts 1950 and 1951", INDIACODE)],
    sections=[
        ("Election Commission", S(
            ("Art 324; multi-member since 1993; removal of the CEC; 2023 Act on appointments", r"election commission|chief election commissioner"),
            ("Recognition of parties and symbols; disputes over splits and mergers", r"recogni[sz]ed political|splits?|symbol"),
        )),
        ("Voting and representation", S(
            ("Universal adult franchise (Art 326); the right to vote is statutory", r"right to vote"),
            ("First-past-the-post; no minimum vote share to win", r"50 per ?cent of the votes|first.past"),
            ("Delimitation (Art 82, 170); commissions of 1952, 1963, 1973, 2002", r"delimitation"),
        )),
        ("Representation of the People Act 1951", S(
            ("Nomination, disqualification on conviction (Lily Thomas 2013), election petitions in High Courts", r"nomination|convicted|election petition|representation of (the )?people act"),
        )),
        ("Electoral reforms", S(
            ("Model Code of Conduct, EVMs and VVPAT, NOTA", r"model code|\bevm|vvpat|nota\b"),
            ("Electoral bonds (struck down 2024), One Nation One Election (Kovind Committee)", r"electoral bond|simultaneous|one nation"),
            ("Women's reservation: Nari Shakti Vandan Adhiniyam (106th Amendment)", r"nari shakti|106th|women.s reservation"),
        )),
    ]),
"cag": dict(
    ncert=[(ICAW, "Ch 4 Executive")],
    book=["Comptroller and Auditor General of India", "Attorney General and Solicitor General", "Advocate General of the State"],
    bare=[("Art 76, 148–151, 165", CONST)],
    sections=[
        ("Comptroller and Auditor General", S(
            ("Appointment and removal like an SC judge; six years or 65; CAG (DPC) Act 1971", r"comptroller|\bcag\b"),
            ("Regularity, propriety and performance audit; reports go to the President, then the PAC", r"audit"),
        )),
        ("Law officers", S(
            ("Attorney General (Art 76): can speak and take part in Parliament and its committees, cannot vote (Art 88)", r"attorney general"),
            ("Solicitor General (not a constitutional office); Advocate General of a state (Art 165)", r"solicitor general|advocate general"),
        )),
    ]),
"bodies": dict(
    ncert=[(ICAW, "Ch 4 Executive (independent bodies)")],
    book=["Union Public Service Commission", "National Commission for SCs", "National Commission for STs",
          "National Commission for BCs", "National Human Rights Commission", "Central Information Commission",
          "Central Vigilance Commission", "Lokpal and Lokayuktas", "NITI Aayog"],
    bare=[("Art 263, 280, 315–323, 338–338B, 350B", CONST), ("PHRA 1993, RTI Act 2005, CVC Act 2003, Lokpal Act 2013", INDIACODE)],
    sections=[
        ("Constitutional bodies", S(
            ("ECI (324), UPSC and SPSCs (315), Finance Commission (280), GST Council (279A), CAG (148)", r"constitutional bod|find mention in the constitution|as per the provisions"),
            ("NCSC (338), NCST (338A), NCBC (338B, 102nd Amendment 2018), Special Officer for Linguistic Minorities (350B)", r"backward classes|scheduled castes"),
            ("UPSC: composition, removal, functions, what it does not advise on", r"public service commission"),
        )),
        ("Statutory bodies", S(
            ("NHRC and SHRCs (Protection of Human Rights Act 1993)", r"human rights commission"),
            ("Central Information Commission (RTI Act), Central Vigilance Commission, Lokpal (2013)", r"information commission|vigilance|lokpal"),
            ("Others: NCW, NCPCR, consumer commissions", r"consumer disputes|commission for women"),
        )),
        ("Executive bodies", S(
            ("NITI Aayog (2015); the Planning Commission and National Development Council it replaced", r"niti|national development council|planning commission"),
            ("Law Commission, National Security Council, Zonal Councils (statutory), Inter-State Council (Art 263)", r"law commission|national security council|zonal"),
            ("Other government bodies and boards (CEIB, SFIO, commodity boards)", r"organisations? under the government|statutory body"),
        )),
    ]),
"otherprov": dict(
    ncert=[(ICAW, "Ch 1 Constitution: Why and How?")],
    book=["Official Language", "Public Services", "Rights and Liabilities of the Government", "Co-operative Societies"],
    bare=[("Parts XIV and XVII; Art 300, 300A, 308–323, 343–351, 393–395", CONST)],
    sections=[
        ("Parts and Schedules", S(
            ("The 22 Parts: which Part has what (IX panchayats, IXA municipalities, XVIII emergency, XX amendment)", r"\bpart (ix|x|xviii|xx)\b|given in part"),
            ("The 12 Schedules: what each one lists", r"which (one )?of the schedules|schedule of the constitution"),
            ("Short title, commencement and repeals (Art 393–395)", r"officially called|indian independence act"),
        )),
        ("Official language (Part XVII)", S(
            ("Art 343–351: Hindi in Devanagari, languages of states, courts, mother-tongue instruction", r"official language"),
            ("Eighth Schedule: 22 languages; 71st (Konkani, Manipuri, Nepali) and 92nd (Bodo, Dogri, Maithili, Santhali) Amendments", r"eighth schedule|8th schedule|konkani"),
        )),
        ("Services and the government", S(
            ("Art 308–323: services; Art 311 safeguards; Art 312 All-India Services", r"all.?india service|article 31[12]\b"),
            ("Art 300 (suits by and against the government), Art 300A (property)", r"article 300\b"),
            ("Part IXB co-operative societies (97th Amendment)", r"co.?operative societ"),
        )),
    ]),
}
# Themes that keep their existing Mains-led notes but get book and NCERT pointers
for k, ncert, book in [
    ("constmorality", [(ICAW, "Ch 10 The Philosophy of the Constitution")], ["Basic Structure of the Constitution (constitutional morality in judgments)"]),
    ("comparative", [(ICAW, "Ch 4 Executive (parliamentary vs presidential)")], ["Salient Features of the Constitution (borrowed features)", "Parliamentary System"]),
    ("parties", [(PII, "Ch 2 Era of One-party Dominance"), (DP10, "Political Parties")], ["Political Parties"]),
    ("pressure", [(DP10, "Political Parties (pressure groups)")], ["Pressure Groups"]),
    ("regulators", [], ["(no chapter; use the Act that sets up each regulator)"]),
    ("envconst", [], ["Fundamental Rights (Art 21)", "Directive Principles (Art 48A)", "Fundamental Duties (Art 51A(g))"]),
]:
    COVER[k] = dict(ncert=ncert, book=book, bare=[], sections=[])
COVER["envconst"]["bare"] = [("Art 21, 48A, 51A(g)", CONST)]

# Prelims question -> theme (2013–2026). Includes a few that belong to non-Polity themes.
PRELIMS = {
 "P2013-055": "preamble", "P2013-056": "ucc", "P2013-057": "committees", "P2013-058": "executive", "P2013-059": "speaker",
 "P2013-060": "parliament", "P2013-061": "basicstructure", "P2013-062": "coopfed", "P2013-063": "executive", "P2013-064": "governor",
 "P2013-065": "localgov", "P2013-066": "tribal", "P2013-067": "cag", "P2013-068": "bodies", "P2013-069": "bodies", "P2013-070": "bodies",
 "P2013-071": "tribunals",
 "P2014-064": "constbasics", "P2014-065": "ucc", "P2014-066": "speaker", "P2014-067": "committees", "P2014-068": "parliament",
 "P2014-069": "executive", "P2014-070": "governor", "P2014-071": "executive", "P2014-072": "judiciary", "P2014-073": "judiciary",
 "P2014-087": "planning",
 "P2015-046": "ucc", "P2015-047": "ucc", "P2015-048": "specialprov", "P2015-049": "ucc", "P2015-050": "executive",
 "P2015-051": "parliament", "P2015-052": "parliament", "P2015-053": "parliament", "P2015-054": "executive", "P2015-055": "judiciary",
 "P2015-056": "localgov", "P2015-065": "budget", "P2015-069": "fiscalfed",
 "P2016-042": "parliament", "P2016-043": "coopfed", "P2016-044": "civilservices", "P2016-045": "localgov", "P2016-046": "tribunals",
 "P2016-057": "budget",
 "P2017-038": "constbasics", "P2017-039": "preamble", "P2017-040": "elections", "P2017-041": "rights", "P2017-042": "coopfed",
 "P2017-043": "ucc", "P2017-044": "preamble", "P2017-045": "rights", "P2017-046": "constbasics", "P2017-047": "ucc", "P2017-048": "ucc",
 "P2017-049": "constbasics", "P2017-050": "elections", "P2017-051": "executive", "P2017-052": "parliament", "P2017-053": "elections",
 "P2017-054": "governor", "P2017-055": "parliament", "P2017-056": "activism", "P2017-057": "localgov", "P2017-058": "elections",
 "P2018-047": "constbasics", "P2018-048": "constbasics", "P2018-049": "parliament", "P2018-050": "basicstructure",
 "P2018-051": "committees", "P2018-052": "rights", "P2018-053": "parliament", "P2018-054": "speaker", "P2018-055": "executive",
 "P2018-056": "governor", "P2018-057": "governor", "P2018-071": "budget",
 "P2019-002": "making", "P2019-046": "constbasics", "P2019-047": "specialprov", "P2019-048": "basicstructure", "P2019-049": "rights",
 "P2019-050": "parliament", "P2019-051": "parliament", "P2019-052": "governor", "P2019-053": "judiciary", "P2019-054": "basicstructure",
 "P2019-055": "judiciary", "P2019-056": "activism", "P2019-057": "regulators", "P2019-067": "regulators", "P2019-096": "tribal",
 "P2020-047": "constbasics", "P2020-048": "rights", "P2020-049": "rights", "P2020-050": "ucc", "P2020-051": "basicstructure",
 "P2020-052": "constbasics", "P2020-053": "preamble", "P2020-054": "ucc", "P2020-055": "budget", "P2020-056": "executive",
 "P2020-057": "elections", "P2020-058": "parliament", "P2020-059": "civilservices", "P2020-060": "parliament", "P2020-061": "ucc",
 "P2020-062": "parliament", "P2020-063": "rights", "P2020-064": "tribunals",
 "P2021-052": "comparative", "P2021-053": "constbasics", "P2021-054": "preamble", "P2021-055": "constbasics", "P2021-056": "ucc",
 "P2021-057": "rights", "P2021-058": "rights", "P2021-059": "union", "P2021-060": "constbasics", "P2021-061": "coopfed",
 "P2021-063": "rights", "P2021-064": "tribunals", "P2021-065": "tribunals", "P2021-066": "judiciary", "P2021-067": "civilservices",
 "P2021-068": "tribal", "P2021-069": "rights",
 "P2022-004": "making", "P2022-047": "specialprov", "P2022-048": "speaker", "P2022-049": "speaker", "P2022-050": "parliament",
 "P2022-051": "basicstructure", "P2022-052": "executive", "P2022-053": "rights", "P2022-054": "judiciary", "P2022-055": "judiciary",
 "P2022-058": "cag",
 "P2023-002": "making", "P2023-044": "making", "P2023-045": "rights", "P2023-046": "constbasics", "P2023-047": "rights",
 "P2023-048": "tribunals", "P2023-049": "specialprov", "P2023-050": "executive", "P2023-051": "executive", "P2023-053": "rights",
 "P2023-054": "tribunals", "P2023-055": "bodies", "P2023-065": "fiscalfed",
 "P2024-040": "committees", "P2024-041": "otherprov", "P2024-042": "coopfed", "P2024-043": "rights", "P2024-044": "speaker",
 "P2024-045": "parliament", "P2024-046": "parliament", "P2024-047": "elections", "P2024-048": "parliament", "P2024-049": "elections",
 "P2024-050": "otherprov", "P2024-051": "rights", "P2024-052": "specialprov", "P2024-053": "bodies",
 "P2025-040": "ucc", "P2025-041": "specialprov", "P2025-042": "union", "P2025-043": "basicstructure", "P2025-044": "speaker",
 "P2025-045": "speaker", "P2025-046": "governor", "P2025-047": "governor", "P2025-048": "executive", "P2025-049": "executive",
 "P2025-050": "localgov", "P2025-052": "anticorrupt", "P2025-053": "coopfed", "P2025-072": "fiscalfed",
 "P2026-039": "rights", "P2026-040": "otherprov", "P2026-041": "specialprov", "P2026-042": "parliament", "P2026-043": "committees",
 "P2026-044": "localgov", "P2026-048": "disability", "P2026-049": "tribunals", "P2026-050": "bodies",
}
