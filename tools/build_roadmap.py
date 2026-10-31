"""Build tools/roadmap.json as a prerequisite-first order.

Every theme comes after the themes it needs (its "linked themes" plus the
"also needs" links on its questions). Where themes need each other in a circle,
the circle is broken at the edge pointing to the less foundational theme (higher
tier, then later in the preferred order); that edge becomes "comes back later".
Stages are tiers of how foundational a theme is; a theme's prerequisites are always in its own or an earlier stage.
"""
import heapq, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
M = {t["key"]: t for t in json.load(open(os.path.join(HERE, "theme_map.json")))}

# How foundational each theme is (1 = core concepts ... 5 = integrated). Order inside a
# tier is the preferred study order when nothing else decides it.
TIERS = {
 1: ["making","preamble","rights","speech","basicstructure","parliament","executive","judiciary","governor","coopfed",
     "revolutions","industrialrev","brexpansion","coloneco","colonadmin","revolt","reform","earlynat","gandhi","ideologies","finalphase",
     "worldwars","decolon",
     "diversity","family","caste","tribal","population",
     "tectonics","atmosphere","monsoon","oceans",
     "growth","budget","inflation","employment"],
 2: ["ucc","constmorality","activism","cag","committees","speaker","elections","localgov","fiscalfed","specialprov",
     "tribunals","regulators","pressure","parties","comparative",
     "statesreorg","consolidation","planning","earlyfp","womenhist",
     "migration","urbsoc","newurban","globsoc","techsoc","secularism","communalism","regionalism","gender","sexratio","ageing",
     "dmframe","landslides","quakes","cyclones","cloudburst","coastal","glaciers","polar",
     "fininc","digieco","poverty","manufacturing","fdi","infra",
     "harappan","vedic","sources","buddhistart","temple","sculpture","bhakti","patronage"],
 3: ["mining","oil","industryloc","landdeg","water","greenrev","irrigation","groundwater","riverlink",
     "cropping","agrimarket","agritech","subsidies","pds","foodproc","landreform","allied",
     "inclusive","transport","smartcity",
     "policy","civilsoc","shg","anticorrupt","citizen","egov","dbt","civilservices","health","education","skills",
     "affirmative","disability","commissions","children","hunger",
     "forests","wetlands","fragile","airpoll","riverpoll","waste","eia","envconst","urbfloods"],
 4: ["womenpol","womeneco","pandemic","climateimpact","climateregime","renewables","energysec","nuclear",
     "neighbourhood","pakistan","china","indopacific","greatpower","westasia","centralasia","africa","groupings","diaspora","un","wto",
     "space","aitech","biotech","healthtech","ipr","sciday"],
 5: ["lwe","northeast","terror","terrorfin","organised","border","maritime","cyber","dataprot","socialmedia","forces"],
}
tier = {k: t for t, ks in TIERS.items() for k in ks}
pref = {k: i for i, k in enumerate(k for t in sorted(TIERS) for k in TIERS[t])}
assert sorted(tier) == sorted(M), ("tier list mismatch", set(M) ^ set(tier))
rank = lambda k: (tier[k], pref[k])

need_all = {k: (set(M[k]["links"]) | {x for v in M[k]["also"].values() for x in v}) - {k} for k in M}
# A basic theme never requires an advanced one: links to a higher tier are "comes back later", not prerequisites.
need = {k: {x for x in need_all[k] if tier[x] <= tier[k]} for k in M}
upward = [(k, x) for k in M for x in need_all[k] if tier[x] > tier[k]]

# Break circles inside a tier at the edge pointing to the later theme in the preferred order.
dropped = []
sys.setrecursionlimit(10000)
def find_cycle():
    color, stack = {}, []
    def dfs(v):
        color[v] = 1; stack.append(v)
        for w in sorted(need[v], key=rank):
            if color.get(w) == 1:
                return stack[stack.index(w):] + [w]
            if not color.get(w):
                c = dfs(w)
                if c: return c
        color[v] = 2; stack.pop(); return None
    for v in sorted(M, key=rank):
        if not color.get(v):
            c = dfs(v)
            if c: return c
    return None
while True:
    cyc = find_cycle()
    if not cyc: break
    u, v = max(zip(cyc, cyc[1:]), key=lambda e: rank(e[1]))
    need[u].discard(v); dropped.append((u, v))

# Order: tier by tier; inside a tier, prerequisites first, otherwise the preferred order.
order, done = [], set()
for t in sorted(TIERS):
    left = set(TIERS[t]); heap = []
    def push_ready():
        for k in list(left):
            if need[k] <= done:
                heapq.heappush(heap, (pref[k], k)); left.discard(k)
    push_ready()
    while heap:
        _, k = heapq.heappop(heap); order.append(k); done.add(k); push_ready()
    assert not left, left
pos = {k: i for i, k in enumerate(order)}
assert all(pos[x] < pos[k] for k in M for x in need[k])

STAGES = {
 1: ("Foundations", "Core concepts every later theme uses: the Constitution and Parliament, modern history, basic physical geography, Indian society, and economy basics like growth and budgets."),
 2: ("Building blocks", "Institutions, elections, federal finance, social issues, hazards, banking and industry. Each needs only Foundations and earlier steps here."),
 3: ("Applied themes", "Agriculture, water, governance, welfare, health, education and environment, built on the two stages above."),
 4: ("Integrated themes", "International relations, climate and energy, women in politics and the economy, and science and technology, which pull from everything before."),
 5: ("Internal security", "Draws on polity, society, IR and technology, so it comes last."),
}
stages = [dict(name=STAGES[t][0], why=STAGES[t][1], themes=[k for k in order if tier[k] == t]) for t in sorted(TIERS)]
json.dump(stages, open(os.path.join(HERE, "roadmap.json"), "w"), indent=1)
json.dump(dict(prerequisites={k: sorted(need[k], key=lambda x: pos[x]) for k in order}), open(os.path.join(HERE, "roadmap_prereqs.json"), "w"), indent=1)
print("stages:", [(s["name"], len(s["themes"])) for s in stages])
print("true prerequisites (always earlier):", sum(len(v) for v in need.values()))
print("links to more advanced themes -> 'comes back later':", len(upward))
print("circular same-tier links -> 'comes back later':", len(dropped), dropped)
