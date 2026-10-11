#!/usr/bin/env python3
"""레인 1 시안 빌드: _src-lane1/A0N.html → preview-v3/A0N-<이름>.html
사진 base64 · Tabler 아이콘 인라인 · 공통 블록(blocks.html) · 코어(core.css/js) 치환.
실행: PYTHONDONTWRITEBYTECODE=1 /opt/pipo/venv/bin/python build.py  (Pillow 만 빌려 씀)"""
import base64, calendar, re, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
PH = SRC / 'photos'
TAB = SRC / 'icons'   # Tabler Icons(MIT) 중 쓰는 것만 복사
NAMES = {'invitation': 'index'}   # 10-11 확정본 하나(A02 액자형 + 사용자 수정)
COVER = {'invitation': '17'}
CREDIT = {'01': 'Vadim Paripa', '02': 'Alexander Mass', '03': 'Alexander Mass', '04': 'Lam Vu',
          '05': 'Thomas AE', '06': 'Céline Druguet', '07': 'Irina Iriser', '08': 'Foto Pettine',
          '09': 'Tim Stagge', '10': 'Eric Alves', '11': 'Brooke Balentine', '12': 'Tom Pumford',
          '13': 'Samantha Gades', '14': 'Luis Tosta', '15': 'Thanhy Nguyen', '16': 'nikki gibson'}
GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
_uri = {}


def photo_uri(nn, full):
    key = (nn, full)
    if key not in _uri:
        f = next(PH.glob(nn + '-*.jpg'))
        b = f.read_bytes()
        if not full:  # 표지 외 사진은 긴 변 1000px 로 다시 줄여 파일 크기를 맞춘다
            c = SRC / 'photos' / '_small' / (nn + '.jpg')
            if not c.exists():
                from PIL import Image
                im = Image.open(f)
                im.thumbnail((1000, 1000))
                c.parent.mkdir(exist_ok=True)
                im.save(c, 'JPEG', quality=72, optimize=True, progressive=True)
            b = min(b, c.read_bytes(), key=len)
        _uri[key] = 'data:image/jpeg;base64,' + base64.b64encode(b).decode()
    return _uri[key]


def icon(name, filled=False, cls='ico'):
    s = (TAB / ('filled' if filled else 'outline') / (name + '.svg')).read_text()
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.replace('<path stroke="none" d="M0 0h24v24H0z" fill="none" />', '')
    s = re.sub(r'class="[^"]*"', f'class="{cls}" aria-hidden="true" focusable="false"', s)
    return s.replace('stroke-width="2"', 'stroke-width="1.5"').replace(' width="24" height="24"', '')


def cal():
    rows = []
    for w in calendar.Calendar(firstweekday=6).monthdayscalendar(2027, 5):
        tds = []
        for i, d in enumerate(w):
            if not d:
                tds.append('<td></td>')
            elif d == 29:
                tds.append('<td class="on"><span aria-label="5월 29일 토요일, 예식일">29</span></td>')
            else:
                tds.append(f'<td{" class=sun" if i == 0 else ""}><span>{d}</span></td>')
        rows.append('<tr>' + ''.join(tds) + '</tr>')
    head = ''.join(f'<th scope="col"{" class=sun" if i == 0 else ""}>{d}</th>' for i, d in enumerate('일월화수목금토'))
    return (f'<table class="cal"><caption class="sr">2027년 5월 달력</caption><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table>')


BLOCKS = dict(re.findall(r'<!--@@([\w-]+)-->\n(.*?)(?=\n<!--@@|\Z)', (SRC / 'blocks.html').read_text(), flags=re.S))
CORE_CSS = (SRC / 'core.css').read_text()
CORE_JS = (SRC / 'core.js').read_text()


def render(t, ctx):
    def rep(m):
        k, _, a = m.group(1).partition(':')
        if k == 'block':
            return render(BLOCKS[a], ctx)
        if k == 'img':
            if a in ctx['used']:
                return f'src="{GIF}" data-dup="{a}"'
            ctx['used'].append(a)
            return f'src="{photo_uri(a, a == ctx["cover"])}" data-ph="{a}"'
        if k in ('icon', 'iconf'):
            n, _, cls = a.partition(':')
            return icon(n, k == 'iconf', cls or 'ico')
        if k == 'cal':
            return cal()
        if k == 'css':
            return CORE_CSS
        if k == 'js':
            return CORE_JS
        if k == 'credits':
            return '@@CREDITS@@'
        raise KeyError(m.group(0))
    return re.sub(r'\{\{([^{}]+)\}\}', rep, t)


def main(only):
    bad = 0
    for aid, name in NAMES.items():
        if only and aid not in only:
            continue
        ctx = {'used': [], 'cover': COVER[aid]}
        out = render((SRC / f'{aid}.html').read_text(), ctx)
        who = sorted({CREDIT[n] for n in ctx['used'] if n in CREDIT}, key=str.lower)   # 17 = 사용자 본인 사진(출처 표기 없음)
        out = out.replace('@@CREDITS@@', 'Photos: Unsplash (' + ', '.join(who) + ')')
        p = OUT / f'{name}.html'
        p.write_text(out)
        text = re.sub(r'data:[^"\')]+', '', out)
        dash = len(re.findall('[—–]', text))
        hexes = sorted(set(h.upper() for h in re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b', text)))
        size = p.stat().st_size
        bad += dash > 0 or size > 1_200_000
        print(f'{p.name}: {size/1024:.0f} KB · 사진 {len(ctx["used"])} · 엠대시 {dash} · hex {" ".join(hexes)}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
