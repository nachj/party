/**
 * 모바일 청첩장 저장소 — Google Apps Script 웹 앱 (구글 시트 + 구글 드라이브 · 무료 · 카드 등록 없음)
 * 시트 탭: 참석(RSVP) · 방명록 · 사진(업로드 기록) / 드라이브 폴더: 청첩장 하객 사진
 * 설치 방법은 server/README.md.
 *
 * 요청: POST 본문 = JSON 문자열(Content-Type text/plain — 브라우저 사전 요청 없이 보내려고)
 *   {action:'rsvp', cid, name, side, attend, count, meal}
 *   {action:'gb_add', name, msg, pw}      → {ok, item}
 *   {action:'gb_del', id, pw}             → {ok}
 *   {action:'photo', name, data(base64 jpeg), type}  → {ok}
 *   GET ?action=gb_list                    → {ok, items:[{id,name,msg,date}]}
 */
var CFG = {
  PHOTO_OPEN_AT: '2027-05-29T13:30:00+09:00',   // 하객 사진 올리기 시작(예식 1시간 전)
  PHOTO_CLOSE_AT: '2027-06-30T23:59:59+09:00',  // 마감
  PHOTO_FOLDER: '청첩장 하객 사진',
  MAX_PHOTO_BYTES: 4 * 1024 * 1024,             // 장당(화면에서 1600px 로 줄여 보냄 · 보통 0.3~0.6 MB)
  WRITES_PER_MIN: 60                            // 전체 쓰기 상한(장난 막기)
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'gb_list') return out_({ ok: true, items: gbList_() });
  return out_({ ok: true, service: 'wedding' });
}

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out_({ ok: false, error: 'bad_json' }); }
  if (b.hp) return out_({ ok: true });                       // 숨은 칸(봇)이 채워졌으면 저장하지 않음
  if (!rate_()) return out_({ ok: false, error: 'busy' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return out_({ ok: false, error: 'busy' });
  try {
    if (b.action === 'rsvp') return out_(rsvp_(b));
    if (b.action === 'gb_add') return out_(gbAdd_(b));
    if (b.action === 'gb_del') return out_(gbDel_(b));
    if (b.action === 'photo') return out_(photo_(b));
    return out_({ ok: false, error: 'unknown_action' });
  } finally { lock.releaseLock(); }
}

/* ---------- 참석 여부: 같은 기기(cid)가 다시 보내면 그 줄을 고친다 ---------- */
function rsvp_(b) {
  var name = clip_(b.name, 20);
  if (!name) return { ok: false, error: 'name' };
  var row = [now_(), clip_(b.cid, 40), name, pick_(b.side, ['신랑 측', '신부 측']), pick_(b.attend, ['참석', '불참']),
             Math.max(0, Math.min(9, parseInt(b.count, 10) || 0)), pick_(b.meal, ['식사함', '식사 안 함', '미정'])];
  var sh = sheet_('참석', ['받은 시각', '기기', '이름', '측', '참석', '동행 인원', '식사']);
  var cids = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = 0; i < cids.length; i++) {
    if (row[1] && cids[i][0] === row[1]) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return { ok: true, updated: true }; }
  }
  sh.appendRow(row);
  return { ok: true };
}

/* ---------- 방명록: 비밀번호는 소금 + SHA-256 으로만 저장 · 목록에는 안 나감 ---------- */
function gbAdd_(b) {
  var name = clip_(b.name, 12), msg = clip_(b.msg, 200), pw = String(b.pw || '');
  if (!name || !msg || !/^\d{4,8}$/.test(pw)) return { ok: false, error: 'input' };
  var id = Utilities.getUuid(), salt = Utilities.getUuid().slice(0, 8), t = now_();
  sheet_('방명록', ['id', '시각', '이름', '메시지', '비밀번호(해시)', '지움']).appendRow([id, t, name, msg, salt + ':' + hash_(salt + pw), '']);
  return { ok: true, item: { id: id, name: name, msg: msg, date: day_(t) } };
}

function gbDel_(b) {
  var sh = sheet_('방명록', ['id', '시각', '이름', '메시지', '비밀번호(해시)', '지움']);
  if (sh.getLastRow() < 2) return { ok: false, error: 'not_found' };
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (var i = 0; i < v.length; i++) {
    if (v[i][0] !== b.id || v[i][5]) continue;
    var sp = String(v[i][4]).split(':');
    if (hash_(sp[0] + String(b.pw || '')) !== sp[1]) return { ok: false, error: 'pw' };
    sh.getRange(i + 2, 6).setValue(now_());                  // 지운 시각만 적고 줄은 남김(되살릴 수 있게)
    return { ok: true };
  }
  return { ok: false, error: 'not_found' };
}

function gbList_() {
  var sh = sheet_('방명록', ['id', '시각', '이름', '메시지', '비밀번호(해시)', '지움']);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(function (r) { return r[0] && !r[5]; })
    .map(function (r) { return { id: r[0], name: r[2], msg: r[3], date: day_(r[1]) }; })
    .reverse();
}

/* ---------- 하객 사진: 드라이브 폴더에만 저장(두 사람만 봄) ---------- */
function photo_(b) {
  var t = Date.now();
  if (t < Date.parse(CFG.PHOTO_OPEN_AT) || t > Date.parse(CFG.PHOTO_CLOSE_AT)) return { ok: false, error: 'closed' };
  var type = /^image\/(jpeg|png|webp|heic|heif)$/.test(b.type) ? b.type : 'image/jpeg';
  var bytes;
  try { bytes = Utilities.base64Decode(String(b.data || '')); } catch (x) { return { ok: false, error: 'data' }; }
  if (!bytes.length || bytes.length > CFG.MAX_PHOTO_BYTES) return { ok: false, error: 'size' };
  var who = clip_(b.name, 12) || '하객';
  var fname = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmmss') + '-' + who + '-' + Utilities.getUuid().slice(0, 6) + (type === 'image/png' ? '.png' : '.jpg');
  folder_().createFile(Utilities.newBlob(bytes, type, fname));
  sheet_('사진', ['시각', '올린 사람', '파일 이름', '크기(KB)']).appendRow([now_(), who, fname, Math.round(bytes.length / 1024)]);
  return { ok: true };
}

/* ---------- 도움 함수 ---------- */
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clip_(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
function pick_(v, list) { return list.indexOf(v) >= 0 ? v : list[list.length - 1]; }
function now_() { return new Date(); }
function day_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy.MM.dd'); }
function hash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function sheet_(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function folder_() {
  var it = DriveApp.getFoldersByName(CFG.PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CFG.PHOTO_FOLDER);
}
function rate_() {
  var c = CacheService.getScriptCache(), k = 'w' + Math.floor(Date.now() / 60000), n = +(c.get(k) || 0);
  if (n >= CFG.WRITES_PER_MIN) return false;
  c.put(k, String(n + 1), 120);
  return true;
}
/** 설치 직후 한 번 실행: 탭 3개·폴더를 미리 만들고 권한을 승인한다 */
function setup() {
  sheet_('참석', ['받은 시각', '기기', '이름', '측', '참석', '동행 인원', '식사']);
  sheet_('방명록', ['id', '시각', '이름', '메시지', '비밀번호(해시)', '지움']);
  sheet_('사진', ['시각', '올린 사람', '파일 이름', '크기(KB)']);
  folder_();
}
