(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const H = document.documentElement;
  const ID = H.dataset.id;
  const T = Date.parse('2027-05-29T14:30:00+09:00');
  const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 사생활 모드: 저장 없이 진행 */ } }
  };

  // 같은 사진 두 번째 자리: 파일 크기를 늘리지 않게 첫 사진의 src 를 빌려 온다
  $$('img[data-dup]').forEach(i => { const s = $('img[data-ph="' + i.dataset.dup + '"]'); if (s) i.src = s.src; });

  // 토스트
  const toastEl = $('#toast');
  let tt;
  const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 2000); };

  // 오프닝: 세션당 1회 · 탭/키로 건너뜀 · reduced-motion 이면 머리 스크립트가 play 를 붙이지 않는다
  const endOpening = () => {
    if (!H.classList.contains('play')) return;
    H.classList.remove('play');
    H.classList.add('played');
    try { sessionStorage.setItem('op-' + ID, '1'); } catch (e) { /* 저장 불가 = 다음에도 재생 */ }
  };
  if (H.classList.contains('play')) {
    setTimeout(endOpening, +(H.dataset.op || 2600));
    addEventListener('pointerdown', endOpening, { once: true });
    addEventListener('keydown', endOpening, { once: true });
  }

  // 스크롤 등장
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.rv').forEach(el => io.observe(el));

  // 카운트다운 (목표 2027-05-29 14:30 KST)
  const setT = (k, v) => $$('[data-cd-' + k + ']').forEach(e => { if (e.textContent !== String(v)) e.textContent = v; });
  const msgs = $$('[data-cd-msg]');
  const tick = () => {
    const now = Date.now(), s = Math.max(0, Math.floor((T - now) / 1000));
    setT('d', Math.floor(s / 86400)); setT('h', pad(Math.floor(s % 86400 / 3600))); setT('m', pad(Math.floor(s % 3600 / 60))); setT('s', pad(s % 60));
    const k = new Date(now + 9 * 3600e3), today = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
    const dd = Math.round((Date.UTC(2027, 4, 29) - today) / 864e5);
    const m = dd > 0 ? `창준, 영주의 결혼식이 <b>${dd}일</b> 남았습니다.` : dd === 0 ? '오늘, 창준과 영주가 결혼합니다.' : `창준, 영주는 <b>${-dd}일</b> 전 결혼했습니다.`;
    msgs.forEach(e => { if (e.innerHTML !== m) e.innerHTML = m; });
  };
  tick(); setInterval(tick, 1000);

  // .ics
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-ics]')) return;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//changjoon-youngju//invitation//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:20270529T053000Z-changjoon-youngju', 'DTSTAMP:' + stamp, 'DTSTART:20270529T053000Z', 'DTEND:20270529T073000Z',
      'SUMMARY:나창준 · 김영주 결혼식', 'LOCATION:W스퀘어컨벤션 L층 그레이스홀\\, 경기 성남시 분당구 판교역로226번길 16',
      'DESCRIPTION:2027년 5월 29일 토요일 오후 2시 30분', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:내일 결혼식이 있어요', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'changjoon-youngju-20270529.ics';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('캘린더 파일을 받았어요');
  });

  // 복사 (클립보드 → execCommand → 실패 시 글자 선택)
  async function copyText(t) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* 아래 대체 경로 */ }
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); return ok;
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    if (await copyText(b.dataset.copy)) { toast(b.dataset.toast || '복사했어요'); return; }
    const n = b.closest('[data-row], .addr')?.querySelector('[data-num], .addr-v span');
    if (n) { const r = document.createRange(); r.selectNodeContents(n); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    toast('복사가 막혀 있어요. 선택된 글자를 길게 눌러 복사해 주세요');
  });

  // 탭 (교통·계좌)
  $$('[data-tabs]').forEach(w => {
    const tabs = $$('[role=tab]', w), ps = $$('[role=tabpanel]', w), ind = $('.tab-ind', w);
    if (ind) ind.style.width = 100 / tabs.length + '%';
    const sel = i => {
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
      ps.forEach((p, j) => { p.hidden = j !== i; });
      if (ind) ind.style.transform = `translateX(${i * 100}%)`;
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => sel(i));
      t.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { const n = (i + k + tabs.length) % tabs.length; sel(n); tabs[n].focus(); } });
    });
    sel(0);
  });

  // 아코디언
  $$('[data-acc]').forEach(b => {
    const p = document.getElementById(b.getAttribute('aria-controls'));
    b.addEventListener('click', () => { const o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', o); p.hidden = !o; });
  });

  // 바텀시트
  let sheetLast = null;
  function openSheet(id) {
    const w = document.getElementById(id); if (!w) return;
    sheetLast = document.activeElement; w.hidden = false; H.classList.add('lock');
    requestAnimationFrame(() => requestAnimationFrame(() => w.classList.add('open')));
    setTimeout(() => $('.sheet', w).focus({ preventScroll: true }), 60);
  }
  function closeSheet(w) {
    if (!w) return;
    const s = $('.sheet', w); w.classList.remove('open'); s.style.transform = '';
    H.classList.remove('lock');
    setTimeout(() => { if (!w.classList.contains('open')) w.hidden = true; }, 460);
    if (sheetLast) sheetLast.focus({ preventScroll: true });
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openSheet(o.dataset.open); return; }
    const c = e.target.closest('[data-close]'); if (c) closeSheet(c.closest('.sheet-wrap'));
  });
  $$('[data-grab]').forEach(g => { // 손잡이를 끌어내리면 닫힘
    const w = g.closest('.sheet-wrap'), s = $('.sheet', w); let y0 = null, dy = 0;
    g.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; g.setPointerCapture(e.pointerId); s.style.transition = 'none'; });
    g.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); s.style.transform = `translateY(${dy}px)`; });
    const up = () => { if (y0 === null) return; y0 = null; s.style.transition = ''; if (dy > 90) closeSheet(w); else s.style.transform = ''; };
    g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  });

  // RSVP
  const rf = $('#rsvp-form');
  if (rf) {
    const KEY = 'rsvp-' + ID, done = $('#rsvp-done'), nm = rf.elements.name, err = $('#rs-name-err');
    const cntIn = rf.elements.count, cntOut = $('#rs-cnt-o');
    const setCnt = v => { v = Math.max(0, Math.min(9, v)); cntIn.value = v; cntOut.textContent = v + '명'; $('[data-step="-1"]', rf).disabled = v === 0; $('[data-step="1"]', rf).disabled = v === 9; };
    const status = $$('[data-rsvp-status]');
    const showDone = d => { rf.hidden = true; done.hidden = false; $('#rsvp-done-name').textContent = d.name; status.forEach(s => { s.textContent = `${d.name}님의 회신을 받았어요 · ${d.attend}`; }); };
    rf.addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) setCnt(+cntIn.value + +b.dataset.step); });
    setCnt(0);
    const saved = store.get(KEY, null);
    if (saved) { for (const [k, v] of Object.entries(saved)) { if (rf.elements[k]) rf.elements[k].value = v; } setCnt(+saved.count || 0); showDone(saved); }
    nm.addEventListener('input', () => { if (nm.value.trim()) { err.hidden = true; nm.removeAttribute('aria-invalid'); } });
    rf.addEventListener('submit', e => {
      e.preventDefault();
      if (!nm.value.trim()) { err.hidden = false; nm.setAttribute('aria-invalid', 'true'); nm.focus(); return; }
      const btn = $('[type=submit]', rf), label = btn.textContent;
      btn.disabled = true; btn.textContent = '보내는 중';
      setTimeout(() => { const d = Object.fromEntries(new FormData(rf)); d.name = d.name.trim(); store.set(KEY, d); btn.disabled = false; btn.textContent = label; showDone(d); }, 700);
    });
    $('[data-rsvp-edit]').addEventListener('click', () => { done.hidden = true; rf.hidden = false; nm.focus(); });
  }

  // 방명록 (데모: localStorage)
  const gbList = $('#gb-list');
  if (gbList) {
    const KEY = 'gb-' + ID, tpl = $('#tpl-gb'), more = $('#gb-more'), empty = $('#gb-empty'), f = $('#gb-form');
    let items = store.get(KEY, []), shown = 3;
    const render = () => {
      gbList.replaceChildren(...items.slice(0, shown).map((m, i) => {
        const li = tpl.content.firstElementChild.cloneNode(true);
        $('.gb-msg', li).textContent = m.msg; $('.gb-who', li).textContent = m.name; $('.gb-date', li).textContent = m.date; li.dataset.i = i;
        return li;
      }));
      empty.hidden = items.length > 0; more.hidden = items.length <= shown;
    };
    render();
    more.addEventListener('click', () => { shown += 3; render(); });
    gbList.addEventListener('click', e => { const d = e.target.closest('.gb-del'); if (!d) return; const fm = $('.gb-delf', d.closest('li')); fm.hidden = !fm.hidden; if (!fm.hidden) $('input', fm).focus(); });
    gbList.addEventListener('submit', e => {
      e.preventDefault();
      const i = +e.target.closest('li').dataset.i;
      // ponytail: 데모라 비밀번호를 이 기기 localStorage 에 그대로 둔다. 실서비스는 서버에서 해시 비교
      if ($('input', e.target).value === items[i].pw) { items.splice(i, 1); store.set(KEY, items); render(); toast('메시지를 지웠어요'); } else toast('비밀번호가 맞지 않아요');
    });
    const cnt = $('#gb-cnt'), msg = f.elements.msg;
    msg.addEventListener('input', () => { cnt.textContent = msg.value.length + ' / 200'; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const nm = f.elements.name, pw = f.elements.pw;
      let first = null;
      [[nm, !nm.value.trim(), 'gb-name-err'], [pw, !/^\d{4,8}$/.test(pw.value), 'gb-pw-err'], [msg, !msg.value.trim(), 'gb-msg-err']].forEach(([el, bad, id]) => {
        $('#' + id).hidden = !bad;
        if (bad) { el.setAttribute('aria-invalid', 'true'); first = first || el; } else el.removeAttribute('aria-invalid');
      });
      if (first) { first.focus(); return; }
      const k = new Date(Date.now() + 9 * 3600e3);
      items.unshift({ name: nm.value.trim(), msg: msg.value.trim(), pw: pw.value, date: `${k.getUTCFullYear()}.${pad(k.getUTCMonth() + 1)}.${pad(k.getUTCDate())}` });
      store.set(KEY, items); render(); f.reset(); cnt.textContent = '0 / 200';
      closeSheet(f.closest('.sheet-wrap')); toast('축하 메시지를 남겼어요');
    });
  }

  // 하객 사진: 예식 시각 전 = 잠김. 시안용 토글로 열린 상태 확인
  const gp = $('[data-gp]');
  if (gp) {
    const tg = $('[data-gp-toggle]', gp), grid = $('#gp-grid'), file = $('#gp-file');
    const set = open => { gp.dataset.state = open ? 'open' : 'locked'; tg.setAttribute('aria-pressed', open); tg.textContent = open ? '시안 보기: 잠긴 상태' : '시안 보기: 열린 상태'; };
    set(Date.now() >= T);
    tg.addEventListener('click', () => set(gp.dataset.state !== 'open'));
    file.addEventListener('change', () => {
      const fs = Array.from(file.files).filter(x => x.type.startsWith('image/')).slice(0, 9);
      $$('img', grid).forEach(i => URL.revokeObjectURL(i.src));
      grid.replaceChildren(...fs.map(x => { const li = document.createElement('li'), im = new Image(); im.src = URL.createObjectURL(x); im.alt = '고른 사진'; li.append(im); return li; }));
      if (fs.length) toast(`사진 ${fs.length}장을 골랐어요`);
    });
  }

  // 공유: navigator.share 가 있으면 사용, 없으면 링크 복사
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-share]'); if (!b) return;
    if (b.dataset.share !== 'link' && navigator.share) {
      try { await navigator.share({ title: '나창준 · 김영주 결혼합니다', text: '2027년 5월 29일 토요일 오후 2시 30분 · W스퀘어컨벤션', url: location.href }); return; } catch (x) { if (x.name === 'AbortError') return; }
    }
    toast(await copyText(location.href) ? '링크를 복사했어요' : '주소창의 링크를 복사해 주세요');
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-kpay]')) toast('카카오페이 송금 링크는 확정 후 연결돼요'); });

  // 연락하기: 휴대폰 = tel:/sms: 그대로(전화·문자 앱) · 컴퓨터 = 이상한 앱 연결 대신 번호 팝업
  const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const pop = $('#ct-pop');
  const fmt = n => n.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-ct]'); if (!a || MOBILE || !pop) return;
    e.preventDefault();
    const num = a.getAttribute('href').replace(/^(tel|sms):/, ''), sms = a.href.startsWith('sms:');
    $('#ct-pop-k').textContent = sms ? '문자 보내기' : '전화하기';
    $('#ct-pop-t').textContent = a.dataset.ct; $('#ct-pop-n').textContent = fmt(num); pop.dataset.num = fmt(num);
    pop.showModal ? pop.showModal() : pop.setAttribute('open', '');
  });
  if (pop) {
    pop.addEventListener('click', async e => {
      if (e.target === pop || e.target.closest('[data-ct-close]')) pop.close();
      else if (e.target.closest('[data-ct-copy]')) { toast(await copyText(pop.dataset.num) ? '번호를 복사했어요' : '번호를 길게 눌러 복사해 주세요'); pop.close(); }
    });
  }

  // 음악: 상태 UI 만 (음원 없음, 자동재생 안 함)
  const mu = $('[data-music]');
  if (mu) mu.addEventListener('click', () => {
    const on = mu.getAttribute('aria-pressed') !== 'true';
    mu.setAttribute('aria-pressed', on); mu.setAttribute('aria-label', on ? '배경 음악 끄기' : '배경 음악 켜기');
    const au = $('[data-bgm]');   // 음원이 있는 안(A02)은 실제 재생 · 없는 안은 상태 UI 만
    if (au) { if (on) au.play().catch(() => toast('재생을 시작하지 못했어요')); else au.pause(); }
    toast(on ? (au ? '배경 음악을 켰어요' : '배경 음악을 켰어요 · 시안에는 음원이 없어요') : '배경 음악을 껐어요');
  });

  // 가로 슬라이더 + 썸네일 (A01)
  $$('[data-slider]').forEach(root => {
    const track = $('.sl-track', root), items = $$('.sl-item', track), thumbs = $$('[data-to]', root), cnt = $('.sl-cnt', root);
    const cur = i => { thumbs.forEach((t, j) => t.setAttribute('aria-current', j === i)); if (cnt) cnt.textContent = `${i + 1} / ${items.length}`; };
    const sio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) cur(items.indexOf(e.target)); }), { root: track, threshold: 0.6 });
    items.forEach(it => sio.observe(it));
    thumbs.forEach(t => t.addEventListener('click', () => track.scrollTo({ left: items[+t.dataset.to].offsetLeft, behavior: R ? 'auto' : 'smooth' })));
    cur(0);
  });

  // 라이트박스
  const lb = $('#lb'), lbTrack = $('.lb-track', lb), lbDots = $('.lb-dots', lb), lbCnt = $('.lb-cnt', lb), view = $('.lb-view', lb);
  let lbI = 0, lbN = 0, lbLast = null;
  const lbGo = (i, anim = true) => {
    lbI = Math.max(0, Math.min(lbN - 1, i));
    lbTrack.style.transition = anim ? '' : 'none';
    lbTrack.style.transform = `translateX(${-lbI * 100}%)`;
    $$('.lb-slide', lbTrack).forEach((s, j) => s.classList.toggle('cur', j === lbI));
    $$('i', lbDots).forEach((d, j) => d.setAttribute('aria-current', j === lbI));
    lbCnt.textContent = `${lbI + 1} / ${lbN}`;
  };
  function lbOpen(srcs, i) {
    lbLast = document.activeElement; lbN = srcs.length;
    const mono = lb.hasAttribute('data-mono');
    lbTrack.replaceChildren(); lbDots.replaceChildren();
    srcs.forEach(o => {
      const f = document.createElement('figure'), p = document.createElement('span'), im = new Image();
      f.className = 'lb-slide'; p.className = 'lb-pic'; im.src = o.src; im.alt = o.alt; im.draggable = false; p.append(im);
      if (mono) { const g = im.cloneNode(); g.className = 'lb-g'; g.alt = ''; p.append(g); }
      f.append(p); lbTrack.append(f); lbDots.append(document.createElement('i'));
    });
    lb.hidden = false; H.classList.add('lock');
    lbGo(i, false); $$('.lb-slide', lbTrack)[lbI].classList.remove('cur');
    requestAnimationFrame(() => requestAnimationFrame(() => { lb.classList.add('open'); lbGo(i, false); }));
    $('[data-lb-close]', lb).focus({ preventScroll: true });
  }
  function lbClose() { lb.classList.remove('open'); H.classList.remove('lock'); setTimeout(() => { if (!lb.classList.contains('open')) lb.hidden = true; }, 300); if (lbLast) lbLast.focus({ preventScroll: true }); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-lb]');
    if (t) { const all = $$('[data-lb]', t.closest('[data-gallery]')); lbOpen(all.map(a => { const im = a.tagName === 'IMG' ? a : $('img', a); return { src: im.src, alt: im.alt }; }), all.indexOf(t)); return; }
    if (e.target.closest('[data-lb-close]')) lbClose();
    else if (e.target.closest('[data-lb-prev]')) lbGo(lbI - 1);
    else if (e.target.closest('[data-lb-next]')) lbGo(lbI + 1);
  });
  let sx = null, sdx = 0;
  view.addEventListener('pointerdown', e => { if (sx !== null || (e.pointerType === 'mouse' && e.button)) return; sx = e.clientX; sdx = 0; view.setPointerCapture(e.pointerId); lbTrack.style.transition = 'none'; });
  view.addEventListener('pointermove', e => { if (sx === null) return; sdx = e.clientX - sx; lbTrack.style.transform = `translateX(calc(${-lbI * 100}% + ${sdx}px))`; });
  const swEnd = () => { if (sx === null) return; sx = null; lbTrack.style.transition = ''; lbGo(Math.abs(sdx) > view.clientWidth * 0.18 ? lbI + (sdx < 0 ? 1 : -1) : lbI); };
  view.addEventListener('pointerup', swEnd); view.addEventListener('pointercancel', swEnd);
  addEventListener('keydown', e => {
    if (!lb.hidden) { if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowRight') lbGo(lbI + 1); else if (e.key === 'ArrowLeft') lbGo(lbI - 1); return; }
    if (e.key === 'Escape') closeSheet($('.sheet-wrap.open'));
  });
  // 사진 길게 누르기 저장 막기 (페이지 확대는 막지 않음)
  document.addEventListener('contextmenu', e => { if (e.target.closest('[data-gallery] img, #lb img, img.prot')) e.preventDefault(); });
  document.addEventListener('dragstart', e => { if (e.target.closest('[data-gallery] img, #lb img, img.prot')) e.preventDefault(); });

  window.inv = { toast, openSheet };
})();
