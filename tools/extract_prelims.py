"""Extract Prelims GS Paper I PYQs + answer key from a topic-wise solved-papers PDF.

Usage: python3 tools/extract_prelims.py <pdf> <out.json>
Only the questions (UPSC's papers) and the answer letters are kept. Explanations are not copied.
The PDF itself is not committed to the repo.
"""
import json, os, re, sys
from collections import defaultdict, OrderedDict
import pdfplumber

SPLIT = 290            # x position separating the two columns
FOOT = 680             # words below this are the running footer
QNUM = re.compile(r'^(\d{1,3})\.$')
YEAR = re.compile(r'[\(\[]\s*(?:Asked in UPSC[- ]?Pre[- ]?)?(20(?:1[3-9]|2[0-6]))\s*[\)\]]')

# Sections from the book's contents (by page number printed in the PDF = index + 1)
SECTIONS = [  # (first page, section)
    (7, 'Modern India'), (32, 'Ancient India'), (47, 'Medieval India'), (56, 'Art & Culture'),
    (74, 'World Geography'), (95, 'Indian Geography'), (118, 'Environment & Ecology'),
    (164, 'Polity & Governance'), (212, 'International Relations'), (228, 'Economy'),
    (303, 'Science & Technology'), (340, 'Current Affairs & GK'),
]


def section_for(page_no, extra):
    s = None
    for p, name in SECTIONS + extra:
        if page_no >= p:
            s = name
    return s


def lines_of(words):
    """Group words into lines (by top), keep x positions."""
    words = sorted(words, key=lambda w: (round(w['top']), w['x0']))
    out = []
    for w in words:
        if out and abs(out[-1]['top'] - w['top']) < 3.5:
            out[-1]['words'].append(w)
        else:
            out.append({'top': w['top'], 'words': [w]})
    for l in out:
        l['words'].sort(key=lambda w: w['x0'])
        l['x0'] = l['words'][0]['x0']
        # split into cells on big gaps (tables)
        cells, cur = [], [l['words'][0]]
        for a, b in zip(l['words'], l['words'][1:]):
            if b['x0'] - a['x1'] > 14:
                cells.append(cur); cur = [b]
            else:
                cur.append(b)
        cells.append(cur)
        l['cells'] = [{'x': c[0]['x0'], 't': ' '.join(w['text'] for w in c)} for c in cells]
        l['text'] = ' '.join(w['text'] for w in l['words'])
    return out


def page_columns(page):
    ws = [w for w in page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=['size']) if w['top'] < FOOT]
    foot = ' '.join(w['text'] for w in sorted([w for w in page.extract_words() if w['top'] >= FOOT], key=lambda w: w['x0']))
    ws = [w for w in ws if w.get('size', 9) < 14]   # drop the big chapter heading
    left = [w for w in ws if w['x0'] < SPLIT]
    right = [w for w in ws if w['x0'] >= SPLIT]
    return foot, lines_of(left), lines_of(right)


def main(pdf_path, out_path):
    pdf = pdfplumber.open(pdf_path)
    chapters = OrderedDict()  # key -> {'q': [lines], 'a': [lines], 'page': first page}
    last_title, seen_titles, cur_key = None, set(), None
    for i, page in enumerate(pdf.pages):
        if i < 6:
            continue
        foot, L, R = page_columns(page)
        foot = re.sub(r'^\d+\s+|\s+\d+$', '', foot.strip()).strip()
        if not foot:
            continue
        is_exp = foot.endswith('Explanation')
        title = re.sub(r'\s*-\s*Explanation$', '', foot).strip()
        # Chapters are contiguous runs of pages. Several chapters share a title ("Miscellaneous"),
        # so a new run of a title already seen starts a new chapter.
        if not chapters or last_title != title:
            if last_title is not None and title in seen_titles:
                key = f'{title} #{sum(1 for k in chapters if k.split(" #")[0] == title) + 1}'
            else:
                key = title
            chapters[key] = {'q': [], 'a': [], 'page': i + 1}
            seen_titles.add(title); cur_key = key
        last_title = title
        ch = chapters[cur_key]
        for col in (L, R):
            for l in col:
                l['page'] = i + 1
            (ch['a'] if is_exp else ch['q']).extend(col)

    questions, problems = [], []
    for title, ch in chapters.items():
        qs = split_numbered(ch['q'], header_skip=True)
        ans = parse_answers(ch['a'])
        sec = section_for(ch['page'], [])
        for n, block in qs.items():
            q = parse_question(block)
            if not q:
                problems.append((title, n, 'unparsed')); continue
            a = ans.get(n)
            if a is None:
                problems.append((title, n, 'no answer')); continue
            q.update({'chapter': title, 'section': sec, 'n': n, 'answer': a['letter'], 'dropped': a['dropped']})
            questions.append(q)
        missing = set(ans) - set(qs)
        for n in sorted(missing):
            problems.append((title, n, 'answer without question'))
    # The book repeats some questions under two topics: keep one copy, remember every topic.
    seen, uniq = {}, []
    for q in questions:
        key = re.sub(r'\W', '', (stem_text(q) + '|'.join(q['options'])).lower())
        if key in seen:
            k = seen[key]
            k['chapters'].append(q['chapter'])
            if k['year'] is None: k['year'] = q['year']
            if k['answer'] != q['answer']: problems.append((q['chapter'], q['n'], f"duplicate disagrees {k['answer']} vs {q['answer']}"))
            continue
        q['chapters'] = [q['chapter']]
        seen[key] = q; uniq.append(q)
    # Near-duplicates (same question, slightly different typing in the book) within a year.
    import difflib
    norm = lambda t: re.sub(r'\W', '', t.lower())
    keep = []
    for q in uniq:
        a, ao = norm(stem_text(q)), norm('|'.join(q['options']))
        twin = None
        for k in keep:
            if k['year'] != q['year'] and None not in (k['year'], q['year']):
                continue
            b, bo = norm(stem_text(k)), norm('|'.join(k['options']))
            if difflib.SequenceMatcher(None, a, b).quick_ratio() > 0.85 and difflib.SequenceMatcher(None, a, b).ratio() > 0.85 \
                    and difflib.SequenceMatcher(None, ao, bo).ratio() > 0.8:
                twin = k; break
        if twin:
            twin['chapters'] += q['chapters']
            if twin['year'] is None: twin['year'] = q['year']
            if twin['answer'] != q['answer']: problems.append((q['chapter'], q['n'], f"near-duplicate disagrees {twin['answer']} vs {q['answer']}"))
            continue
        keep.append(q)
    questions = keep
    for q in questions:
        q['options'] = [fix(o) for o in q['options']]
        for b in q['stem']:
            for k in ('p', 'li'):
                if k in b: b[k] = fix(b[k])
            if 'table' in b: b['table'] = [[fix(c) for c in r] for r in b['table']]
    # Our own ids and fields only: year, subject, question, options, answer.
    # Ids are kept stable across re-runs (the daily schedule refers to them): a question whose
    # year + question text matches the previous output keeps its id; new questions get the next free number.
    from prelims_fixes import FIXES
    prev, prev_opt, prev_stem = {}, {}, {}
    if os.path.exists(out_path):
        for o in json.load(open(out_path))['questions']:
            if o['id'] in FIXES:
                continue                       # hand-fixed questions are matched by their fix's text below
            prev.setdefault((o['year'], norm_key(o)), o['id'])
            prev_opt.setdefault((o['year'], opt_key(o)), o['id'])
            prev_stem.setdefault((o['year'], re.sub(r'\W', '', stem_text(o).lower())), o['id'])
    fixed_for = {}
    for fid, f in FIXES.items():
        y = None if fid.startswith('PNA') else int(fid[1:5])
        hits = [i for i, q in enumerate(questions) if q['year'] == y and f['match'] in stem_text(q) + ' ' + ' '.join(q['options'])]
        if len(hits) != 1:
            raise SystemExit(f'fix {fid}: expected one question matching "{f["match"]}" in {y}, found {len(hits)}')
        fixed_for[hits[0]] = fid
    used = set(prev.values()) | set(prev_opt.values()) | set(FIXES)
    count = defaultdict(int)
    for i in used:
        y, n = i[1:].split('-'); count[None if y == 'NA' else int(y)] = max(count[None if y == 'NA' else int(y)], int(n))
    out = []
    taken = set()
    for idx in sorted(range(len(questions)), key=lambda i: (questions[i]['year'] or 0)):
        q = questions[idx]
        qid = next((c for c in (fixed_for.get(idx), prev.get((q['year'], norm_key(q))), prev_opt.get((q['year'], opt_key(q))),
                                prev_stem.get((q['year'], re.sub(r'\W', '', stem_text(q).lower())))) if c and c not in taken), None)
        if not qid:
            count[q['year']] += 1
            qid = f"P{q['year'] or 'NA'}-{count[q['year']]:03d}"
        taken.add(qid)
        out.append({'id': qid, 'year': q['year'], 'subject': q['section'],
                    'stem': q['stem'], 'options': q['options'], 'answer': q['answer'], 'dropped': q['dropped']})
    questions = sorted(out, key=lambda q: q['id'])
    # Hand fixes for scrambled tables (guarded by a text match so they can't land on the wrong question).
    from prelims_fixes import FIXES
    byid = {q['id']: q for q in questions}
    for qid, f in FIXES.items():
        q = byid.get(qid)
        full = stem_text(q) + ' ' + ' '.join(q['options']) if q else ''
        if not q or f['match'] not in full:
            raise SystemExit(f'fix {qid}: question not found or text does not match "{f["match"]}"')
        q['stem'] = f['stem']
        if 'options' in f: q['options'] = f['options']
    print('fixes applied', len(FIXES))
    for q in questions:   # table cells: drop the ':' separators the book prints between columns
        for b in q['stem']:
            if 'table' in b:
                b['table'] = [[re.sub(r'\s*:$', '', re.sub(r'^:\s*', '', c)) for c in r] for r in b['table']]
    json.dump({'questions': questions}, open(out_path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('no year', sum(1 for q in questions if q['year'] is None))
    by = defaultdict(int)
    for q in questions:
        by[q['year']] += 1
    print('questions', len(questions), dict(sorted(by.items(), key=lambda kv: kv[0] or 0)))
    print('dropped', sum(q['dropped'] for q in questions), 'no-letter', sum(1 for q in questions if not q['answer'] and not q['dropped']))
    print('problems', len(problems))
    for p in problems[:60]:
        print('  ', p)


def fix(t):
    t = re.sub(r'`\s*(?=\d)', '₹', t).replace('`', '‘')
    t = re.sub(r'\s+([,.:;?])(?=\s|$)', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()


def opt_key(q):
    return re.sub(r'\W', '', '|'.join(q['options']).lower())[:200] + '#' + re.sub(r'\W', '', stem_text(q).lower())[:40]


def norm_key(q):
    return re.sub(r'\W', '', stem_text(q).lower()) + '|' + re.sub(r'\W', '', '|'.join(q['options']).lower())


def stem_text(q):
    return ' '.join(b.get('p') or b.get('li') or ' '.join(' '.join(r) for r in b['table']) for b in q['stem'])


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:30]


def split_numbered(lines, header_skip=False):
    """Split column lines into numbered blocks. A block starts with 'N.' at the column's outer indent
    and N must be the next expected number."""
    blocks, cur, expect = OrderedDict(), None, 1
    for l in lines:
        first = l['words'][0]['text']
        if re.fullmatch(r'\d{1,3}', first) and len(l['words']) > 1 and l['words'][1]['text'] == '.':
            first = first + '.'
            l['words'] = [dict(l['words'][0], text=first)] + l['words'][2:]
            l['text'] = ' '.join(w['text'] for w in l['words'])
            l['cells'][0]['t'] = re.sub(r'^(\d+) \. ?', r'\1. ', l['cells'][0]['t'])
        m = QNUM.match(first)
        outer = l['x0'] < 52 or 290 <= l['x0'] < 311
        if m and outer and int(m.group(1)) == expect:
            cur = int(m.group(1)); expect += 1
            blocks[cur] = [l]
            continue
        if cur is not None:
            blocks[cur].append(l)
    return blocks


def parse_answers(lines):
    out, cur = {}, None
    text_lines = [l['text'] for l in lines]
    joined = '\n'.join(text_lines)
    for m in re.finditer(r'(?m)^\s*(\d{1,3})\s*\.\s*Answer\s*:?\s*\(?\s*([a-dA-D])?\s*\)?', joined):
        n = int(m.group(1))
        if n in out:
            continue
        out[n] = {'letter': (m.group(2) or '').lower(), 'dropped': False, 'pos': m.start()}
    # dropped notes: attribute to the nearest preceding answer number in the same column stream
    for m in re.finditer(r'(?i)UPSC has dropped this question', joined):
        prev = [n for n, v in out.items() if v['pos'] < m.start()]
        if prev:
            n = max(prev, key=lambda k: out[k]['pos'])
            out[n]['dropped'] = True
    return out


MARK = re.compile(r'^(\d{1,2}\.\s|[IVX]{1,4}\.\s|Statement[- ]?(I|II|III)\b|Which |Select |How many|Consider |What |With reference|In the context|List[- ]|Assertion|Reason|Code|Choose )')
ITEM = re.compile(r'^(\d{1,2}\.|[IVX]{1,4}\.|[A-F]\.)\s')


def parse_question(block):
    lines = [dict(l) for l in block]
    # strip the question number
    w0 = lines[0]['words'][1:]
    if not w0:
        lines = lines[1:]
    else:
        lines[0] = dict(lines[0]); lines[0]['words'] = w0
        lines[0]['text'] = ' '.join(w['text'] for w in w0)
        lines[0]['cells'] = [c for c in lines[0]['cells']]
        lines[0]['cells'][0] = {'x': w0[0]['x0'], 't': lines[0]['cells'][0]['t'].split(' ', 1)[1] if ' ' in lines[0]['cells'][0]['t'] else ''}
        if not lines[0]['cells'][0]['t']:
            lines[0]['cells'] = lines[0]['cells'][1:]
    full = ' '.join(l['text'] for l in lines)
    # The year tag sits at the end of a line (often its own cell). Years inside the question text don't.
    tags = [m for l in lines for m in [re.search(YEAR.pattern + r'\s*$', l['text'])] if m]
    if not tags:
        tags = [m for l in lines for c in l['cells'] for m in [re.fullmatch(r'\s*' + YEAR.pattern + r'\s*', c['t'])] if m]
    ym = tags[0] if tags else YEAR.search(full)
    year = int(ym.group(1)) if ym else None
    q_multi = len(set(m.group(1) for m in YEAR.finditer(full))) > 1
    # Options start at the first line beginning '(a)' from which (b), (c), (d) follow in order.
    # Splitting strictly in order keeps text like 'Both (a) and (b)' inside option (d).
    oi, opts = None, None
    for k, l in enumerate(lines):
        if not re.match(r'^\(a\)', l['text']):
            continue
        t = YEAR.sub('', ' '.join(x['text'] for x in lines[k:])).replace('`', ' ')
        pos, ok = [], True
        start = 0
        for c in 'abcd':
            m = re.compile(r'\(' + c + r'\)\s*').search(t, start)
            if not m:
                ok = False; break
            pos.append((m.start(), m.end())); start = m.end()
        if ok:
            oi = k
            opts = [t[pos[i][1]:(pos[i + 1][0] if i < 3 else len(t))].strip() for i in range(4)]
            # A following question the layout hid (numbered at the statement indent) ends up after (d): cut it off.
            cut = re.search(r'\s\d{1,2}\.\s+[A-Z‘\'"].*?\(a\)', opts[3])
            if cut:
                opts[3] = opts[3][:cut.start()].strip()
            break
    if oi is None or not all(opts):
        return None
    stem_lines = lines[:oi]
    blocks = build_stem(stem_lines)
    return {'year': year, 'multi': q_multi, 'stem': blocks, 'options': opts}


def clean(t):
    t = YEAR.sub('', t)
    return re.sub(r'\s+', ' ', t).strip()


def build_stem(lines):
    """Return a list of blocks: {'p': text} | {'li': text} | {'table': [[cells]]}."""
    out = []
    for l in lines:
        cells = [dict(c, t=clean(c['t'])) for c in l['cells']]
        cells = [c for c in cells if c['t']]
        if not cells:
            continue
        txt = ' '.join(c['t'] for c in cells)
        is_row = len(cells) >= 2
        # "1. Bangkok    2. Hanoi" is a list printed in two columns, not a table
        if is_row and all(ITEM.match(c['t']) for c in cells):
            for c in cells:
                out.append({'li': c['t'], '_x': c['x']})
            continue
        if is_row and out and 'table' in out[-1] and len(out[-1]['table']) == 1 \
                and not ITEM.match(cells[0]['t']) and not ITEM.match(out[-1]['table'][0][0]):
            merge_continuation(out[-1], cells)   # a two-line header row
            continue
        if not is_row and out and 'table' in out[-1] and ITEM.match(txt) and len(out[-1]['_xs']) >= 2:
            # a table row whose cells printed too close together to split by position
            a, sep, b = txt.partition(':') if ':' in txt else (txt, '', '')
            row = [a.strip() + sep] + [''] * (len(out[-1]['_xs']) - 1)
            row[1] = b.strip()
            out[-1]['table'].append(row)
            continue
        if is_row:
            if out and 'table' in out[-1] and not re.match(r'^(\d+\.|[A-Z]\.)', cells[0]['t']) and out[-1]['_xs'] and cells[0]['x'] > out[-1]['_xs'][0] + 5 and len(cells) < len(out[-1]['_xs']):
                merge_continuation(out[-1], cells)
                continue
            if out and 'table' in out[-1] and abs(len(cells) - len(out[-1]['_xs'])) <= 1:
                out[-1]['table'].append(align(cells, out[-1]['_xs']))
                continue
            out.append({'table': [[c['t'] for c in cells]], '_xs': [c['x'] for c in cells]})
            continue
        c = cells[0]
        if out and 'table' in out[-1] and c['x'] > out[-1]['_xs'][0] + 5 and not MARK.match(c['t']):
            merge_continuation(out[-1], cells)
            continue
        if out and 'table' in out[-1] and len(out[-1]['table']) == 1 and not ITEM.match(out[-1]['table'][0][0]) \
                and not MARK.match(txt) and not ITEM.match(txt):
            merge_continuation(out[-1], cells)   # last word of a header row
            continue
        if txt.replace(' ', '') == 'ABCD' and out and 'p' in out[-1] and out[-1]['p'].startswith('Code'):
            out[-1]['p'] += ' A B C D'
            continue
        if ITEM.match(txt) or re.match(r'^Statement[- ]?(I|II|III)\s*:', txt, re.I):
            out.append({'li': txt, '_x': c['x']}); continue
        prev = out[-1] if out else None
        if prev and 'li' in prev:
            # statement text wraps with a deeper indent; a line back at the base indent is new text
            unfinished = not re.search(r'[.?:;]$', prev['li'])
            if (c['x'] > prev['_x'] + 5 or unfinished) and not MARK.match(txt):
                prev['li'] = join(prev['li'], txt); continue
            out.append({'p': txt}); continue
        if prev and 'p' in prev and not MARK.match(txt) and not re.search(r'[:?]$', prev['p']):
            prev['p'] = join(prev['p'], txt)
        else:
            out.append({'p': txt})
    for b in out:
        b.pop('_xs', None); b.pop('_x', None)
    return out


def join(a, b):
    if a.endswith('-') and not a.endswith(' -'):
        return a + b
    return a + ' ' + b


def align(cells, xs):
    row = [''] * len(xs)
    for c in cells:
        k = min(range(len(xs)), key=lambda i: abs(xs[i] - c['x']))
        row[k] = join(row[k], c['t']).strip() if row[k] else c['t']
    return row


def merge_continuation(tbl, cells):
    xs, last = tbl['_xs'], tbl['table'][-1]
    for c in cells:
        k = min(range(len(xs)), key=lambda i: abs(xs[i] - c['x']))
        last[k] = join(last[k], c['t']).strip() if last[k] else c['t']


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
