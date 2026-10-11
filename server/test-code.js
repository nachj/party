// node server/test-code.js — Code.gs 를 가짜 구글 서비스(시트·드라이브·캐시·잠금) 위에서 돌려 보는 점검
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const sheets = {}, files = [];
const mkSheet = n => { const rows = []; return { rows, appendRow: r => rows.push(r.slice()), setFrozenRows() {}, getLastRow: () => rows.length,
  getRange: (r, c, nr = 1, nc = 1) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map(x => x.slice(c - 1, c - 1 + nc)),
    setValues: v => v.forEach((x, i) => x.forEach((y, j) => { rows[r - 1 + i][c - 1 + j] = y; })), setValue: v => { rows[r - 1][c - 1] = v; } }) }; };
const ctx = { console, Date, JSON, Math, parseInt, String,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n], insertSheet: n => (sheets[n] = mkSheet(n)) }) },
  DriveApp: { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ createFile: b => files.push(b) }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }) },
  Utilities: { getUuid: () => crypto.randomUUID(), base64Decode: s => { if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw 0; return [...Buffer.from(s, 'base64')]; },
    base64Encode: b => Buffer.from(b).toString('base64'), computeDigest: (_, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()],
    DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, formatDate: (d, tz, f) => new Date(d).toISOString().slice(0, 10).replace(/-/g, '.'),
    newBlob: (b, t, n) => ({ b, t, n }) } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), ctx);
const post = b => ctx.doPost({ postData: { contents: JSON.stringify(b) } }), get = p => ctx.doGet({ parameter: p });
const ok = (c, m) => { if (!c) { console.error('실패:', m); process.exit(1); } };
// 참석
ok(post({ action: 'rsvp', cid: 'A', name: '홍길동', side: '신부 측', attend: '참석', count: 2, meal: '식사함' }).ok, 'rsvp');
ok(post({ action: 'rsvp', cid: 'A', name: '홍길동', side: '신부 측', attend: '불참', count: 0, meal: '미정' }).updated, 'rsvp 같은 기기 = 고침');
ok(sheets['참석'].rows.length === 2 && sheets['참석'].rows[1][4] === '불참', 'rsvp 한 줄');
ok(!post({ action: 'rsvp', name: ' ' }).ok, 'rsvp 이름 없음 거부');
// 방명록
const a = post({ action: 'gb_add', name: '친구', msg: '축하해 <b>', pw: '1234' }); ok(a.ok && a.item.id, 'gb_add');
ok(!post({ action: 'gb_add', name: '친구', msg: 'x', pw: '12' }).ok, '비밀번호 4자리 미만 거부');
let L = get({ action: 'gb_list' }); ok(L.items.length === 1 && Object.keys(L.items[0]).sort().join() === 'date,id,msg,name', '목록에 비밀번호 해시 없음');
ok(post({ action: 'gb_del', id: a.item.id, pw: '9999' }).error === 'pw', '틀린 비밀번호');
ok(post({ action: 'gb_del', id: a.item.id, pw: '1234' }).ok, '지우기');
ok(get({ action: 'gb_list' }).items.length === 0 && sheets['방명록'].rows.length === 2, '지운 줄은 목록에서 빠지고 시트엔 남음');
ok(post({ action: 'gb_add', name: '봇', msg: 'spam', pw: '1234', hp: 'x' }).ok && sheets['방명록'].rows.length === 2, '숨은 칸 = 저장 안 함');
// 사진: 기간 밖 = closed · 기간 안 = 저장
ok(post({ action: 'photo', data: 'AAAA', type: 'image/jpeg' }).error === 'closed', '사진 기간 전 거부');
ctx.CFG.PHOTO_OPEN_AT = '2000-01-01T00:00:00Z';
ok(post({ action: 'photo', name: '하객', data: Buffer.from('jpegbytes').toString('base64'), type: 'image/jpeg' }).ok && files.length === 1, '사진 저장');
ok(post({ action: 'photo', data: '!!', type: 'image/jpeg' }).error === 'data', '깨진 데이터 거부');
console.log('Code.gs 점검 통과 (참석 4 · 방명록 6 · 사진 3)');
