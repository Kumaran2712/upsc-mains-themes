"""Build src/data/site.json from data/questions.yaml, data/syllabus.yaml and the theme map in tools/.

Usage: python3 tools/build_site_data.py
Theme map: tools/theme_map.json (questions by repo ID). Prep notes: tools/guide*.py.
Question text is read from the repo as-is (only trailing PDF-compilation junk is stripped).
"""
import collections, json, os, re, sys
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT = os.path.join(HERE, "..", "src", "data", "site.json")

G = {}
for f in ["guide1", "guide2", "guide3", "guide4", "guide5"]:
    exec(open(os.path.join(HERE, f + ".py")).read().replace("G = {}", ""))
# Theme map: each theme lists its questions by repo question ID.
C = json.load(open(os.path.join(HERE, "theme_map.json")))
# Polity pilot: study order, wider titles, full-syllabus coverage, Prelims links.
sys.path.insert(0, HERE)
import polity_pilot as PP
for k, v in PP.GUIDE.items():
    G[k] = v
for t in C:
    t["title"] = PP.RETITLE.get(t["key"], t["title"])
# Theme URLs never change once published, even when a title changes.
FROZEN = json.load(open(os.path.join(HERE, "theme_slugs.json")))
PRE = json.load(open(os.path.join(DATA, "prelims.json")))["questions"]
PRE_BY = {q["id"]: q for q in PRE}
bad = [i for i in PP.PRELIMS if i not in PRE_BY]
if bad:
    sys.exit(f"tools/polity_pilot.py PRELIMS has unknown IDs: {bad}")
# Roadmap: ordered stages for newcomers; every theme exactly once.
ROADMAP = json.load(open(os.path.join(HERE, "roadmap.json")))
_order = [k for s in ROADMAP for k in s["themes"]]
if sorted(_order) != sorted(t["key"] for t in C) or len(_order) != len(set(_order)):
    sys.exit("tools/roadmap.json must list every theme exactly once.")
STEP = {k: i + 1 for i, k in enumerate(_order)}
STAGE = {k: si + 1 for si, s in enumerate(ROADMAP) for k in s["themes"]}
PREREQS = json.load(open(os.path.join(HERE, "roadmap_prereqs.json")))["prerequisites"]

syllabus = {s["id"]: s["text"] for s in yaml.safe_load(open(os.path.join(DATA, "syllabus.yaml")))}
questions = yaml.safe_load(open(os.path.join(DATA, "questions.yaml")))
qbyid = {q["id"]: q for q in questions}
mapped = [i for t in C for i in t["questions"]]
unmapped = [q["id"] for q in questions if q["id"] not in set(mapped)]
missing = [i for i in mapped if i not in qbyid]
dupes = [i for i in set(mapped) if mapped.count(i) > 1]
if unmapped or missing or dupes:
    sys.exit(f"Theme map out of sync with data/questions.yaml.\n  Not in any theme: {unmapped}\n  In map but not in questions.yaml: {missing}\n  In two themes: {dupes}")

def clean(t):
    t = " ".join(str(t).split())
    return re.sub(r"\s*PDF Refernece URL:.*$", "", t).strip()

def slugify(s, words=9):
    s = s.lower().replace("&", " and ").replace("–", " ").replace("—", " ")
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    parts = [w for w in s.split() if w]
    return "-".join(parts[:words])

DIRECTIVES = ["Examine", "Discuss", "Analyse", "Analyze", "Evaluate", "Explain", "Comment", "Elucidate", "Elaborate",
              "Describe", "Justify", "Substantiate", "Assess", "Compare", "Distinguish", "Enumerate", "Illustrate",
              "Highlight", "Trace", "Account for", "Argue", "Identify", "Bring out", "Suggest", "Do you agree",
              "Do you think", "How far", "To what extent", "Mention", "Why", "Critically"]

def directives(text):
    tl = text.lower()
    out = []
    for d in DIRECTIVES:
        if d.lower() in tl:
            k = "Analyse" if d == "Analyze" else d
            if k not in out:
                out.append(k)
    return out

num = {t["key"]: i + 1 for i, t in enumerate(C)}
clusters = []
for t in C:
    if t["cluster"] not in clusters:
        clusters.append(t["cluster"])
cluster_slug = {c: slugify(c, 6) for c in clusters}

slugs = dict(FROZEN)
for t in C:
    if t["key"] in slugs:
        continue
    s = slugify(t["title"].split(":")[0] if len(t["title"]) > 60 else t["title"])
    base, i = s, 2
    while s in slugs.values():
        s = f"{base}-{i}"; i += 1
    slugs[t["key"]] = s

def flat(b):
    if isinstance(b, str): return b
    if isinstance(b, dict): return " ".join(flat(v) for k, v in b.items() if k != "type")
    if isinstance(b, list): return " ".join(flat(x) for x in b)
    return ""
# Coverage counters look only at the theme's own questions: its tagged Prelims stems and its Mains questions.
def cover(key, own_pre, own_mains):
    c = PP.COVER.get(key)
    if not c:
        return None
    secs = []
    for head, items in c["sections"]:
        rows = []
        for text, rx, extra in items:
            p = m = None
            if rx:
                r = re.compile(rx, re.I)
                hp = {i for i, x in own_pre if r.search(x)} | {i for i in extra if i.startswith("P")}
                hm = {i for i, x in own_mains if r.search(x)} | {i for i in extra if not i.startswith("P")}
                p, m = len(hp), len(hm)
            rows.append(dict(t=text, p=p, m=m))
        secs.append(dict(h=head, items=rows))
    return dict(ncert=[dict(book=b, ch=ch) for b, ch in c["ncert"]], book=c["book"],
                bare=[dict(t=t, url=u) for t, u in c["bare"]], sections=secs)
pre_of = collections.defaultdict(list)
for qid, k in PP.PRELIMS.items():
    pre_of[k].append(qid)

themes = []
seen = set()
for t in C:
    qrows = []
    for qid in sorted(t["questions"], key=lambda i: (-qbyid[i]["year"], i)):
        q = qbyid[qid]
        seen.add(q["id"])
        text = clean(q["text"])
        qrows.append(dict(id=q["id"], paper=q["paper"], year=q["year"], marks=q["marks"], words=q.get("words"),
                          text=text, verified=bool(q.get("verified")),
                          also=[num[a] for a in t["also"].get(qid, [])]))
    papers = collections.Counter(r["paper"] for r in qrows)
    years = sorted({r["year"] for r in qrows})
    lines = []
    for r in qrows:
        for s in qbyid[r["id"]]["syllabus_lines"]:
            if s not in lines:
                lines.append(s)
    lines.sort(key=lambda s: (s.split("-")[0], int(s.split("-L")[1])))
    dc = collections.Counter(d for r in qrows for d in directives(r["text"]))
    asks, checklist, answer = G[t["key"]]
    themes.append(dict(
        n=num[t["key"]], key=t["key"], slug=slugs[t["key"]], title=t["title"],
        step=STEP[t["key"]], stage=STAGE[t["key"]],
        cluster=t["cluster"], clusterSlug=cluster_slug[t["cluster"]],
        papers={p: papers.get(p, 0) for p in ["GS1", "GS2", "GS3"]},
        cross=sum(1 for p in papers if papers[p]) > 1,
        count=len(qrows), years=years, recent=sum(1 for r in qrows if r["year"] >= 2024),
        syllabus=lines, links=[num[k] for k in t["links"]],
        prereqs=[num[k] for k in PREREQS[t["key"]]],
        related=sorted({num[k] for k in set(t["links"]) | {x for v in t["also"].values() for x in v}} - {num[t["key"]]}),
        directives=[[d, c] for d, c in dc.most_common(6)],
        asks=asks, checklist=checklist, answer=answer, questions=qrows,
        cover=cover(t["key"], [(i, flat(PRE_BY[i]["stem"])) for i in pre_of.get(t["key"], [])], [(r["id"], r["text"]) for r in qrows]),
        pre=sorted(pre_of.get(t["key"], []), key=lambda i: (-PRE_BY[i]["year"], i))))
assert len(seen) == len(questions), (len(seen), len(questions))

data = dict(
    themes=themes,
    clusters=[dict(name=c, slug=cluster_slug[c]) for c in clusters],
    stages=[dict(n=i + 1, name=s["name"], why=s["why"], themes=[num[k] for k in s["themes"]]) for i, s in enumerate(ROADMAP)],
    syllabus=[dict(id=k, text=v, paper=k.split("-")[0]) for k, v in syllabus.items()],
    source=dict(official="https://www.upsc.gov.in/examinations/previous-question-papers"),
)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
print(f"{len(themes)} themes, {len(seen)} questions, {len(syllabus)} syllabus lines -> {os.path.relpath(OUT)}")
