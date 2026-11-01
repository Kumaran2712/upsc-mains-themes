"""Build the 'PYQs of the day' schedule: 10 Prelims + 2 Mains for each day.

Usage: python3 tools/build_daily.py
Reads data/prelims.json and src/data/site.json, writes src/data/daily.json.
The schedule is fixed (seeded), so everyone sees the same set on the same day.
Prelims sets mix subjects; the two Mains questions come from different papers.
"""
import json, random
from collections import defaultdict, deque

SEED = 2026
EPOCH = '2026-11-01'   # day 0 (IST)
PER_DAY = 10

pre = json.load(open('data/prelims.json'))['questions']
site = json.load(open('src/data/site.json'))

# ---- Prelims: usable = has a year and an answer, not dropped by UPSC
usable = [q for q in pre if q['year'] and q['answer'] and not q['dropped']]
rng = random.Random(SEED)
by_sub = defaultdict(list)
for q in usable:
    by_sub[q['subject']].append(q['id'])
for ids in by_sub.values():
    rng.shuffle(ids)
# round-robin over subjects, weighted by size so large subjects don't run out last
queues = {s: deque(ids) for s, ids in by_sub.items()}
order = []
while any(queues.values()):
    # pick the subject with the most remaining questions relative to its size
    s = max((s for s in queues if queues[s]), key=lambda s: len(queues[s]) / len(by_sub[s]) + rng.random() * 1e-6)
    order.append(queues[s].popleft())
psets = [order[i:i + PER_DAY] for i in range(0, len(order), PER_DAY)]
if len(psets[-1]) < PER_DAY and len(psets) > 1:      # top up the short last set from the first
    psets[-1] += [i for i in psets[0] if i not in psets[-1]][:PER_DAY - len(psets[-1])]

# ---- Mains: two a day from different papers
mains = [(q['id'], q['paper']) for t in site['themes'] for q in t['questions']]
rng.shuffle(mains)
pq = {p: deque(i for i, pp in mains if pp == p) for p in ('GS1', 'GS2', 'GS3')}
pairs, cycle = [], [('GS1', 'GS2'), ('GS3', 'GS1'), ('GS2', 'GS3')]
k = 0
while sum(len(v) for v in pq.values()) >= 2:
    a, b = cycle[k % 3]; k += 1
    if not pq[a] or not pq[b]:
        rest = [p for p in pq if pq[p]]
        if len(rest) == 1:
            a = b = rest[0]
        else:
            a, b = sorted(rest, key=lambda p: -len(pq[p]))[:2]
    x = pq[a].popleft()
    if not pq[b]:
        break
    pairs.append([x, pq[b].popleft()])

json.dump({'epoch': EPOCH, 'prelims': psets, 'mains': pairs}, open('src/data/daily.json', 'w'), separators=(',', ':'))
print(f'prelims: {len(usable)} usable → {len(psets)} days; mains: {len(mains)} → {len(pairs)} days')
assert all(len(s) == PER_DAY for s in psets), 'short prelims set'
assert len({i for s in psets for i in s}) == len(usable), 'prelims question missing from schedule'
