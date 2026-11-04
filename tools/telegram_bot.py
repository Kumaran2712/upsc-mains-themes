"""UPSC Themes Telegram bot: daily PYQs by direct message to everyone who pressed Start.

Runs from GitHub Actions (.github/workflows/telegram.yml); there is no always-on server.

  python3 tools/telegram_bot.py sync      # handle /start /stop /today /help sent since the last run
  python3 tools/telegram_bot.py send      # sync, then send today's set to every subscriber (once per day)
  python3 tools/telegram_bot.py preview [--site-dir dist]   # print today's messages, send nothing

Today's set is read from the published site (/daily/meta.json, /daily/p/<n>.json, /daily/m/<n>.json,
/daily/t/<n>.json), so the bot always matches the Daily PYQs page.

Subscribers are stored only as Telegram chat IDs, encrypted with SUBSCRIBERS_KEY, in
data/telegram/subscribers.enc. Env: TELEGRAM_BOT_TOKEN, SUBSCRIBERS_KEY, SITE_URL (default https://upscthemes.live).
"""
import base64, datetime as dt, hashlib, html, json, os, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, 'data', 'telegram', 'subscribers.enc')
SITE = os.environ.get('SITE_URL', 'https://upscthemes.live').rstrip('/')
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
LIMIT = 3900          # Telegram allows 4096 characters per message; keep a margin
esc = lambda s: html.escape(str(s), quote=False)


# ---------------- site data ----------------
def fetch(path, site_dir=None):
    if site_dir:
        with open(os.path.join(site_dir, path.lstrip('/')), encoding='utf-8') as f:
            return json.load(f)
    req = urllib.request.Request(SITE + path, headers={'User-Agent': 'upscthemes-bot'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def today_set(site_dir=None, day=None):
    meta = fetch('/daily/meta.json', site_dir)
    y, m, d = map(int, meta['epoch'].split('-'))
    day = day or dt.datetime.now(IST).date()
    k = max(0, (day - dt.date(y, m, d)).days)
    return {'day': day, 'meta': meta,
            'prelims': fetch(f"/daily/p/{k % meta['P']}.json", site_dir),
            'mains': fetch(f"/daily/m/{k % meta['M']}.json", site_dir),
            'theme': fetch(f"/daily/t/{k % meta['T']}.json", site_dir)}


def link(path, text):
    return f'<a href="{esc(SITE + path)}">{esc(text)}</a>'


def stem_lines(blocks):
    out = []
    for b in blocks:
        if 'table' in b:
            rows = b['table']
            for r in rows:
                out.append('  ' + ' — '.join(esc(c) for c in r if c))
        else:
            out.append(esc(b.get('p') or b.get('li') or ''))
    return out


def render(s):
    """Return the list of messages (HTML) for one day."""
    day, meta = s['day'], s['meta']
    date = day.strftime('%a, %d %b %Y')
    parts = []
    head = (f'<b>UPSC PYQs of the day · {esc(date)}</b>\n'
            f'10 Prelims + 2 Mains + 1 theme. Answer each Prelims question first, then tap the hidden answer to check.\n')
    parts.append(head)
    for i, q in enumerate(s['prelims'], 1):
        note = ' (official key not yet released)' if q['y'] and q['y'] > meta['officialKeyUpto'] else ''
        opts = '\n'.join(f'({c}) {esc(o)}' for c, o in zip('abcd', q['o']))
        parts.append(f'<b>Q{i}</b> · Prelims {q["y"]} · {esc(q["s"])}\n' + '\n'.join(stem_lines(q['st'])) +
                     f'\n{opts}\nAnswer: <tg-spoiler>({q["a"]}){esc(note)}</tg-spoiler>\n')
    parts.append(f'Score yourself with UPSC marking: {link("/daily/", "upscthemes.live/daily")}\n')
    msgs = pack(parts)

    mparts = ['<b>Mains · write these on paper</b>\n']
    for q in s['mains']:
        mins = 7 if (q.get('m') == 10 or q.get('w') == 150) else 11 if (q.get('m') == 15 or q.get('w') == 250) else 9
        meta_line = ' · '.join(x for x in [q['p'], str(q['y']), f"{q['m']} marks" if q.get('m') else '', f"{q['w']} words" if q.get('w') else ''] if x)
        cover = '\n'.join('• ' + esc(c) for c in q['th']['checklist'])
        mparts.append(f'<b>{esc(meta_line)}</b> · about {mins} min\n{esc(q["t"])}\n'
                      f'<tg-spoiler>What to cover:\n{cover}</tg-spoiler>\n'
                      f'Theme: {link(q["th"]["url"], "T" + str(q["th"]["n"]) + " " + q["th"]["title"])} · {link(q["u"], "Question page")}\n')
    msgs += pack(mparts)

    t = s['theme']
    tparts = [f'<b>Theme of the day</b> · roadmap step {t["step"]} of {meta["T"]}\n<b>{esc(t["title"])}</b> ({t["count"]} PYQs)\n',
              f'<b>What UPSC asks</b>\n{esc(t["asks"])}\n',
              '<b>What to cover</b>\n' + '\n'.join('• ' + esc(c) for c in t['checklist']) + '\n',
              '<b>Writing the answer</b>\n' + '\n'.join('• ' + esc(c) for c in t['answer']) + '\n',
              f'All its PYQs: {link(t["url"], "upscthemes.live" + t["url"])}\n\nSend /stop any time to unsubscribe.']
    msgs += pack(tparts)
    return msgs


def pack(parts):
    msgs, cur = [], ''
    for p in parts:
        if len(p) > LIMIT:                      # one oversized block: split on lines
            for line in p.split('\n'):
                if len(cur) + len(line) + 1 > LIMIT:
                    msgs.append(cur); cur = ''
                cur += line + '\n'
            continue
        if len(cur) + len(p) + 1 > LIMIT:
            msgs.append(cur); cur = ''
        cur += p + '\n'
    if cur.strip():
        msgs.append(cur)
    return [m.strip() for m in msgs]


# ---------------- state ----------------
def fernet():
    from cryptography.fernet import Fernet
    key = os.environ.get('SUBSCRIBERS_KEY')
    if not key:
        sys.exit('SUBSCRIBERS_KEY is not set')
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()))


def load():
    if not os.path.exists(STATE):
        return {'offset': 0, 'subs': {}, 'last_sent': None}
    with open(STATE, 'rb') as f:
        return json.loads(fernet().decrypt(f.read()))


def save(state):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    data = fernet().encrypt(json.dumps(state, sort_keys=True).encode())
    with open(STATE, 'wb') as f:
        f.write(data)


# ---------------- Telegram ----------------
def api(method, **params):
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        sys.exit('TELEGRAM_BOT_TOKEN is not set')
    body = json.dumps(params).encode()
    for attempt in range(5):
        req = urllib.request.Request(f'https://api.telegram.org/bot{token}/{method}', data=body,
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            res = json.loads(e.read() or b'{}')
            wait = (res.get('parameters') or {}).get('retry_after')
            if e.code == 429 and wait:
                time.sleep(wait + 1); continue
            return res
        except urllib.error.URLError:
            time.sleep(3)
    return {'ok': False, 'description': 'network error'}


def send(chat, text):
    return api('sendMessage', chat_id=chat, text=text, parse_mode='HTML', link_preview_options={'is_disabled': True})


def gone(res):
    d = (res.get('description') or '').lower()
    return res.get('error_code') == 403 or 'chat not found' in d or 'user is deactivated' in d


WELCOME = ('Welcome to <b>UPSC Themes</b> daily PYQs.\n\nEvery morning around 6 AM you will get 10 Prelims questions '
           '(answers hidden until you tap), 2 Mains questions with what to cover, and one theme from the roadmap.\n\n'
           'Commands: /today (send today\'s set again) · /stop (unsubscribe)\n\nHere is today\'s set:')
HELP = 'Send /start to get daily PYQs, /today for today\'s set, /stop to unsubscribe.\nWebsite: ' + SITE + '/'


def sync(state, site_dir=None):
    """Process messages since the last run. Returns True if the state changed."""
    changed, msgs = False, None
    while True:
        res = api('getUpdates', offset=state['offset'], timeout=0, limit=100, allowed_updates=['message', 'my_chat_member'])
        if not res.get('ok'):
            sys.exit(f"Telegram refused getUpdates: {res.get('description')} (check TELEGRAM_BOT_TOKEN)")
        ups = res.get('result') or []
        print(f'{len(ups)} new message(s)')
        if not ups:
            break
        for u in ups:
            state['offset'] = u['update_id'] + 1; changed = True
            mcm = u.get('my_chat_member')
            if mcm and mcm['chat']['type'] == 'private' and mcm['new_chat_member']['status'] in ('kicked', 'left'):
                state['subs'].pop(str(mcm['chat']['id']), None)
                continue
            m = u.get('message')
            if not m or m['chat']['type'] != 'private':
                continue
            chat, text = str(m['chat']['id']), (m.get('text') or '').strip().split('@')[0].lower()
            if text.startswith('/start'):
                state['subs'].setdefault(chat, {'since': dt.datetime.now(IST).date().isoformat()})
                send(chat, WELCOME)
                msgs = msgs or render(today_set(site_dir))
                for x in msgs: send(chat, x); time.sleep(0.05)
            elif text.startswith('/stop'):
                state['subs'].pop(chat, None)
                send(chat, 'You are unsubscribed. Send /start any time to come back.')
            elif text.startswith('/today'):
                msgs = msgs or render(today_set(site_dir))
                for x in msgs: send(chat, x); time.sleep(0.05)
            else:
                send(chat, HELP)
    return changed


def send_all(state, site_dir=None, force=False):
    today = dt.datetime.now(IST).date().isoformat()
    if state.get('last_sent') == today and not force:
        print('already sent today'); return False
    msgs = render(today_set(site_dir))
    sent = removed = 0
    for chat in list(state['subs']):
        if state['subs'][chat].get('since') == today:
            continue              # joined today: already got today's set with the welcome message
        for x in msgs:
            res = send(chat, x)
            if not res.get('ok'):
                if gone(res):
                    state['subs'].pop(chat, None); removed += 1
                else:
                    print('send failed', res.get('description'))
                break
            time.sleep(0.04)      # stays well under Telegram's ~30 messages/second
        else:
            sent += 1
    state['last_sent'] = today
    print(f'sent to {sent}, removed {removed}, subscribers {len(state["subs"])}')
    return True


def main():
    args = sys.argv[1:]
    mode = args[0] if args else 'sync'
    site_dir = args[args.index('--site-dir') + 1] if '--site-dir' in args else None
    if mode == 'preview':
        for i, m in enumerate(render(today_set(site_dir)), 1):
            print(f'----- message {i} ({len(m)} chars)\n{m}')
        return
    state = load()
    changed = sync(state, site_dir)
    if mode == 'send':
        changed = send_all(state, site_dir, force='--force' in args) or changed
    if changed:
        save(state)
    print('subscribers:', len(state['subs']))


if __name__ == '__main__':
    main()
