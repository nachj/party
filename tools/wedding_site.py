#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
모바일 청첩장 로컬 실행 / 관리 도구
==========================================================
배포처: https://nachj.github.io/party/
저장소: https://github.com/nachj/party
원본  : https://github.com/kakaopark857/sangwon_jisu.wedding

이 스크립트는 표준 라이브러리만 사용합니다. (pip 설치 불필요)
Python 3.8+ / Windows 10·11 에서 동작합니다.

저장소 루트에서 실행하세요.
------------------------------------------------------
  python tools/wedding_site.py               # 로컬 서버 실행 (브라우저 자동 열림)
  python tools/wedding_site.py serve --lan   # 같은 와이파이의 휴대폰에서 확인
  python tools/wedding_site.py status        # 사진·음원 누락 점검
  python tools/wedding_site.py fetch         # 이 저장소 파일을 GitHub에서 다시 받기

주소 / 키 바꾸기
------------------------------------------------------
  python tools/wedding_site.py rebrand --base-url https://내아이디.github.io/내레포/
  python tools/wedding_site.py rebrand --kakao-key <내 카카오 JS 키>
  python tools/wedding_site.py rebrand --title "이름 ♥ 이름 결혼합니다"

원본 저장소를 따로 받아보고 싶을 때
------------------------------------------------------
  python tools/wedding_site.py fetch --repo kakaopark857/sangwon_jisu.wedding --dir ../original
"""

from __future__ import annotations

import argparse
import errno
import json
import mimetypes
import os
import re
import shutil
import socket
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ──────────────────────────────────────────────────────────────
# 기본 설정
# ──────────────────────────────────────────────────────────────
DEFAULT_REPO = "nachj/party"
DEFAULT_BRANCH = "main"
DEFAULT_DIR = "."
DEFAULT_PORT = 8000

# 이 청첩장의 원본 저장소. 원본을 다시 받고 싶을 때:
#   python tools/wedding_site.py fetch --repo kakaopark857/sangwon_jisu.wedding --dir ../original
UPSTREAM_REPO = "kakaopark857/sangwon_jisu.wedding"

# 원본이 하드코딩해 둔 절대 주소 (rebrand 시 치환 대상의 기본값)
ORIGIN_BASE_URL = "https://kakaopark857.github.io/sangwon_jisu.wedding/"

UA = {"User-Agent": "wedding-site-mirror/1.0 (+python-urllib)"}

# 이미지 제외 모드에서 건너뛸 확장자
BINARY_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp3", ".mp4", ".m4a", ".wav"}


# ──────────────────────────────────────────────────────────────
# 콘솔 출력 (한글 깨짐 방지)
# ──────────────────────────────────────────────────────────────
def _init_console() -> None:
    """Windows 기본 콘솔(cp949)에서 한글/이모지가 깨지지 않도록 UTF-8로 전환."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def say(msg: str = "") -> None:
    print(msg, flush=True)


def human(n: int) -> str:
    f = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if f < 1024 or unit == "GB":
            return f"{f:,.1f} {unit}" if unit != "B" else f"{int(f)} B"
        f /= 1024
    return f"{f:.1f} GB"


# ──────────────────────────────────────────────────────────────
# 다운로드
# ──────────────────────────────────────────────────────────────
def http_get(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def list_repo_files(repo: str, branch: str) -> list[dict]:
    """GitHub Trees API로 저장소의 전체 파일 목록(path, size)을 가져온다."""
    url = f"https://api.github.com/repos/{repo}/git/trees/{branch}?recursive=1"
    try:
        data = json.loads(http_get(url).decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise SystemExit(
                "GitHub API 요청 한도(시간당 60회)에 걸렸습니다.\n"
                "잠시 후 다시 시도하거나, git이 설치돼 있다면 아래 명령이 더 빠릅니다:\n"
                f"  git clone https://github.com/{repo}.git site"
            ) from e
        raise SystemExit(f"저장소 목록을 가져오지 못했습니다 (HTTP {e.code}): {url}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"네트워크 오류로 저장소에 접속하지 못했습니다: {e.reason}") from e

    if data.get("truncated"):
        say("! 파일 목록이 잘렸습니다(파일이 매우 많은 저장소). git clone 사용을 권합니다.")

    files = [n for n in data.get("tree", []) if n.get("type") == "blob"]
    if not files:
        raise SystemExit(f"저장소 {repo}@{branch} 에서 파일을 찾지 못했습니다.")
    return files


def download_file(repo: str, branch: str, path: str, dest: Path, expect: int) -> None:
    """raw.githubusercontent 에서 파일 하나를 받아 임시파일 → 원자적 교체."""
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{urllib.request.quote(path)}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    last_err: Exception | None = None
    for attempt in range(1, 4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as resp, open(tmp, "wb") as fh:
                shutil.copyfileobj(resp, fh, length=1024 * 256)
            got = tmp.stat().st_size
            if expect and got != expect:
                raise IOError(f"크기 불일치 (기대 {expect}, 받음 {got})")
            os.replace(tmp, dest)      # Windows에서도 안전한 덮어쓰기
            return
        except Exception as e:          # noqa: BLE001 - 네트워크 오류 전부 재시도
            last_err = e
            tmp.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(1.5 * attempt)

    raise IOError(f"{path} 내려받기 실패: {last_err}")


def cmd_fetch(args: argparse.Namespace) -> Path:
    root = Path(args.dir).resolve()
    say(f"저장소   : {args.repo} ({args.branch} 브랜치)")
    say(f"저장 위치: {root}")
    say("파일 목록을 가져오는 중...")

    files = list_repo_files(args.repo, args.branch)
    if args.code_only:
        files = [f for f in files if Path(f["path"]).suffix.lower() not in BINARY_EXT]
        say("(--code-only: 이미지/음원 제외)")

    total_bytes = sum(f.get("size", 0) for f in files)
    say(f"대상 {len(files)}개 파일 / 총 {human(total_bytes)}")
    if total_bytes > 300 * 1024 * 1024 and not args.code_only:
        say("! 사진 원본이 커서 시간이 오래 걸립니다. 중간에 끊겨도 다시 실행하면 이어받습니다.")
    say("-" * 60)

    done_bytes = skipped = downloaded = 0
    failures: list[str] = []

    for i, node in enumerate(files, 1):
        path = node["path"]
        size = node.get("size", 0)
        dest = root / path
        label = f"[{i:>3}/{len(files)}] {path}"

        # 이미 같은 크기로 받아둔 파일은 건너뛴다 (= 이어받기)
        if not args.force and dest.exists() and (size == 0 or dest.stat().st_size == size):
            skipped += 1
            done_bytes += size
            say(f"{label}  · 있음")
            continue

        try:
            download_file(args.repo, args.branch, path, dest, size)
            downloaded += 1
            done_bytes += size
            pct = (done_bytes / total_bytes * 100) if total_bytes else 100
            say(f"{label}  ✓ {human(size)}  ({pct:.0f}%)")
        except IOError as e:
            failures.append(path)
            say(f"{label}  ✗ {e}")

    # GitHub Pages가 파일을 Jekyll로 가공하지 않도록
    (root / ".nojekyll").write_text("", encoding="utf-8")
    # Windows의 git이 줄바꿈을 CRLF로 바꿔 원본과 달라지는 것을 막는다
    (root / ".gitattributes").write_text("* -text\n", encoding="utf-8", newline="\n")

    say("-" * 60)
    say(f"완료: 새로 받음 {downloaded}개 / 이미 있음 {skipped}개 / 실패 {len(failures)}개")
    if failures:
        say("실패한 파일 (스크립트를 다시 실행하면 재시도합니다):")
        for p in failures[:20]:
            say(f"  - {p}")
    return root


# ──────────────────────────────────────────────────────────────
# 상태 점검
# ──────────────────────────────────────────────────────────────
ASSET_RE = re.compile(r"""(?:images|music)/[A-Za-z0-9_./-]+?\.(?:jpg|jpeg|png|gif|webp|mp3|mp4)""", re.I)


def referenced_assets(index_html: str) -> set[str]:
    """index.html이 실제로 쓰는 로컬 자산 경로를 뽑아낸다.

    갤러리는 `Array.from({length:24},(_,i)=>` 형태로 동적 생성하므로 그 패턴도 함께 해석한다.
    """
    found = set(ASSET_RE.findall(index_html))
    for length, folder in re.findall(
        r"Array\.from\(\{length:(\d+)\}[^`]*`([A-Za-z0-9_./-]+/)\$\{i\+1\}\.jpg`", index_html
    ):
        found.update(f"{folder}{n}.jpg" for n in range(1, int(length) + 1))
    # 주석 속 예시 경로는 실제 파일이 아니므로 제외
    return {p for p in found if not p.endswith(("main.jpg", "photo01.jpg", "bgm.mp3"))}


def cmd_status(args: argparse.Namespace) -> None:
    root = Path(args.dir).resolve()
    index = root / "index.html"
    say(f"폴더: {root}")
    if not index.exists():
        say("✗ index.html 이 없습니다. 먼저 `python wedding_site.py fetch` 를 실행하세요.")
        return

    html = index.read_text(encoding="utf-8")
    wanted = sorted(referenced_assets(html))
    missing = [p for p in wanted if not (root / p).exists()]

    files = [f for f in root.rglob("*") if f.is_file() and ".git" not in f.parts]
    total = sum(f.stat().st_size for f in files)

    say(f"✓ index.html  ({human(index.stat().st_size)})")
    say(f"  전체 파일   : {len(files)}개 / {human(total)}")
    say(f"  참조 자산   : {len(wanted)}개 중 {len(wanted) - len(missing)}개 존재")
    if missing:
        say(f"  ✗ 누락 {len(missing)}개:")
        for p in missing[:20]:
            say(f"      {p}")
        say("  → `python wedding_site.py fetch` 로 다시 받으세요.")
    else:
        say("  ✓ 참조된 사진·음원이 모두 있습니다.")

    base = ORIGIN_BASE_URL in html
    say(f"  절대 URL    : {'원본 주소 그대로' if base else '변경됨'} (rebrand 명령으로 교체)")


# ──────────────────────────────────────────────────────────────
# 내 도메인/키로 교체
# ──────────────────────────────────────────────────────────────
def cmd_rebrand(args: argparse.Namespace) -> None:
    root = Path(args.dir).resolve()
    index = root / "index.html"
    if not index.exists():
        raise SystemExit("index.html 이 없습니다. 먼저 fetch 를 실행하세요.")

    html = original = index.read_text(encoding="utf-8")
    changes: list[str] = []

    if args.base_url:
        new = args.base_url if args.base_url.endswith("/") else args.base_url + "/"
        # 이미 한 번 교체한 뒤 또 바꿀 수 있도록, 지금 설정된 siteUrl을 치환 대상으로 삼는다.
        cur = re.search(r'siteUrl:\s*"([^"]*)"', html)
        old = args.from_url or (cur.group(1) if cur and cur.group(1) else ORIGIN_BASE_URL)
        old = old if old.endswith("/") else old + "/"
        n = html.count(old)
        if n and old != new:
            html = html.replace(old, new)
            changes.append(f"공유주소/QR 주소 {n}곳: {old} → {new}")
        elif old == new:
            changes.append(f"(이미 {new} 로 설정돼 있습니다)")
        else:
            changes.append(f"(치환할 주소 {old} 를 찾지 못했습니다. --from-url 로 지정하세요)")

    if args.kakao_key:
        html, n = re.subn(
            r'(kakaoJsKey:\s*")[^"]*(")', rf'\g<1>{args.kakao_key}\g<2>', html
        )
        if n:
            changes.append(f"카카오 JS 키 교체 ({n}곳)")

    if args.title:
        html, a = re.subn(r"(<title>).*?(</title>)", rf"\g<1>{args.title}\g<2>", html, flags=re.S)
        html, b = re.subn(
            r'(<meta property="og:title" content=")[^"]*(")', rf"\g<1>{args.title}\g<2>", html
        )
        changes.append(f"제목 교체 ({a + b}곳)")

    if html == original:
        if changes:
            for c in changes:
                say(f"  · {c}")
            say("실제로 바뀐 내용은 없습니다.")
        else:
            say("변경 사항이 없습니다. --base-url / --kakao-key / --title 중 하나를 지정하세요.")
        return

    backup = index.with_suffix(".html.bak")
    shutil.copy2(index, backup)
    # newline="\n" 필수: Windows에서는 기본값이 줄바꿈을 CRLF로 바꿔 버려
    # 원본과 바이트가 달라지고 git diff가 파일 전체로 잡힌다.
    index.write_text(html, encoding="utf-8", newline="\n")

    say(f"백업 생성: {backup.name}")
    for c in changes:
        say(f"  ✓ {c}")
    say("\n방명록(Firebase)은 원본 제작자의 프로젝트를 가리킵니다.")
    say("내 방명록을 쓰려면 index.html 하단 `firebaseConfig` 블록을 본인 값으로 바꾸세요.")


# ──────────────────────────────────────────────────────────────
# 로컬 서버
# ──────────────────────────────────────────────────────────────
class InvitationHandler(SimpleHTTPRequestHandler):
    """GitHub Pages와 최대한 비슷하게 동작하는 정적 서버."""

    # Windows는 레지스트리에서 MIME을 읽어와 .js를 text/plain으로 주는 경우가 있는데,
    # 그러면 Firebase의 ES 모듈 import가 통째로 막힌다. 직접 고정한다.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".htm": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".mp3": "audio/mpeg",
        ".mp4": "video/mp4",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        # 수정한 내용이 새로고침에 바로 반영되도록 캐시 끄기
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_request(self, code="-", size="-"):
        # 사진 40여 장 요청 로그로 화면이 도배되지 않게, 오류(4xx/5xx)만 표시
        try:
            failed = int(code) >= 400
        except (TypeError, ValueError):
            failed = False
        if failed:
            super().log_request(code, size)


def lan_ip() -> str | None:
    """휴대폰에서 접속할 때 쓸 이 PC의 사설 IP."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))     # 실제 패킷은 나가지 않음
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def cmd_serve(args: argparse.Namespace) -> None:
    root = Path(args.dir).resolve()
    if not (root / "index.html").exists():
        raise SystemExit(
            f"{root} 에 index.html 이 없습니다.\n"
            "먼저 `python wedding_site.py fetch` 를 실행하세요."
        )

    mimetypes.init()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    handler = partial(InvitationHandler, directory=str(root))

    httpd = None
    port = args.port
    for port in range(args.port, args.port + 20):
        try:
            httpd = ThreadingHTTPServer((host, port), handler)
            break
        except OSError as e:
            if e.errno in (errno.EADDRINUSE, getattr(errno, "WSAEADDRINUSE", 10048)):
                continue
            raise
    if httpd is None:
        raise SystemExit(f"{args.port}~{args.port + 19} 포트가 모두 사용 중입니다.")

    url = f"http://localhost:{port}/"
    say("=" * 60)
    say("  모바일 청첩장 로컬 서버 실행 중")
    say("=" * 60)
    say(f"  PC 브라우저 : {url}")
    if args.lan:
        ip = lan_ip()
        if ip:
            say(f"  휴대폰      : http://{ip}:{port}/   (같은 와이파이)")
            say("                방화벽 허용 창이 뜨면 '허용'을 눌러 주세요.")
    else:
        say("  휴대폰에서 보려면 --lan 옵션을 붙여 실행하세요.")
    say(f"  폴더        : {root}")
    say("")
    say("  종료: Ctrl + C")
    say("=" * 60)
    say("")
    say("참고 - 로컬에서 원본과 다르게 보이는 부분")
    say("  · 카카오 지도: 카카오 개발자센터 > 플랫폼 > Web 에")
    say(f"    http://localhost:{port} 를 등록해야 표시됩니다. (미등록 시 안내문구 노출)")
    say("  · 방명록/참석여부: 원본 제작자의 Firebase를 가리키므로 실제로 쓰지 마세요.")
    say("  · 글꼴: Google Fonts를 불러오므로 인터넷 연결이 필요합니다.")
    say("")

    if not args.no_open:
        webbrowser.open(url)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        say("\n서버를 종료합니다.")
    finally:
        httpd.server_close()


# ──────────────────────────────────────────────────────────────
# 진입점
# ──────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    # 옵션은 하위 명령 앞뒤 어디에 써도 되도록 공통 부모 파서로 정의한다.
    # 기본값을 전부 SUPPRESS로 두고 실제 기본값은 p.set_defaults() 한 곳에서만 주면,
    # 하위 파서가 상위에서 이미 받은 값을 기본값으로 덮어쓰는 문제가 생기지 않는다.
    S = argparse.SUPPRESS

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--dir", default=S, help=f"사이트 폴더 (기본 {DEFAULT_DIR})")
    common.add_argument("--repo", default=S, help=f"GitHub 저장소 (기본 {DEFAULT_REPO})")
    common.add_argument("--branch", default=S, help=f"브랜치 (기본 {DEFAULT_BRANCH})")

    fetchopts = argparse.ArgumentParser(add_help=False)
    fetchopts.add_argument("--force", action="store_true", default=S, help="이미 있는 파일도 다시 받기")
    fetchopts.add_argument("--code-only", action="store_true", default=S,
                           help="이미지·음원 제외 (빠른 테스트용)")

    serveopts = argparse.ArgumentParser(add_help=False)
    serveopts.add_argument("--port", type=int, default=S, help=f"포트 (기본 {DEFAULT_PORT})")
    serveopts.add_argument("--lan", action="store_true", default=S,
                           help="같은 와이파이의 휴대폰에서도 접속 허용")
    serveopts.add_argument("--no-open", action="store_true", default=S, help="브라우저 자동 실행 안 함")

    p = argparse.ArgumentParser(
        prog="wedding_site.py",
        parents=[common, fetchopts, serveopts],
        description="모바일 청첩장 소스를 내려받아 윈도우 로컬에서 그대로 실행합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="예) python wedding_site.py               (내려받기 + 서버 실행)\n"
               "    python wedding_site.py serve --lan   (휴대폰에서 확인)",
    )
    # 주의: 여기서 p.set_defaults()를 쓰면 안 된다. parents= 로 넘긴 파서는 액션 '객체'를
    # 공유하므로, set_defaults가 하위 파서가 들고 있는 같은 액션의 default까지 바꿔 버린다.
    # (그러면 `--port 5500 serve` 처럼 옵션을 앞에 쓴 값이 하위 파서 기본값에 덮여 사라진다.)
    # 기본값은 파싱이 끝난 뒤 apply_defaults() 에서 채운다.

    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("fetch", parents=[common, fetchopts], help="소스 전체를 내려받기 (이어받기 지원)")
    sub.add_parser("serve", parents=[common, serveopts], help="로컬 웹서버 실행")
    sub.add_parser("run", parents=[common, fetchopts, serveopts],
                   help="필요하면 내려받고 바로 서버 실행 (기본 동작)")
    sub.add_parser("status", parents=[common], help="내려받은 파일 / 참조 자산 점검")

    b = sub.add_parser("rebrand", parents=[common], help="내 깃허브 주소·API 키로 교체")
    b.add_argument("--base-url", help="예: https://내아이디.github.io/내레포/")
    b.add_argument("--from-url", help="치환할 기존 주소 (생략하면 현재 siteUrl 값을 사용)")
    b.add_argument("--kakao-key", help="내 카카오 JavaScript 키")
    b.add_argument("--title", help="페이지 제목")

    return p


DEFAULTS = {
    "dir": DEFAULT_DIR, "repo": DEFAULT_REPO, "branch": DEFAULT_BRANCH,
    "port": DEFAULT_PORT, "lan": False, "no_open": False,
    "force": False, "code_only": False,
}


def apply_defaults(args: argparse.Namespace) -> argparse.Namespace:
    """지정하지 않은 옵션의 기본값을 채운다 (모든 액션 default는 SUPPRESS)."""
    for key, value in DEFAULTS.items():
        if not hasattr(args, key):
            setattr(args, key, value)
    return args


def main(argv: list[str] | None = None) -> int:
    _init_console()
    parser = build_parser()
    args = apply_defaults(parser.parse_args(argv))
    cmd = args.cmd or "run"

    try:
        if cmd == "fetch":
            cmd_fetch(args)
        elif cmd == "serve":
            cmd_serve(args)
        elif cmd == "status":
            cmd_status(args)
        elif cmd == "rebrand":
            cmd_rebrand(args)
        else:  # run
            if not (Path(args.dir) / "index.html").exists() or args.force:
                cmd_fetch(args)
                say("")
            cmd_serve(args)
    except KeyboardInterrupt:
        say("\n중단했습니다.")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
