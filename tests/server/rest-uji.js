/* rest-uji.js — server uji yang meniru subset PostgREST + Supabase Auth/Storage di atas PostgreSQL lokal.
   HANYA UNTUK PENGUJIAN. Tujuannya: aplikasi berjalan dalam mode Supabase terhadap basis data sungguhan
   sehingga RLS, pemicu, dan fungsi benar-benar diuji dari tampilan sampai basis data.
   Setiap permintaan dijalankan dalam transaksi dengan `set local role authenticated|anon` + klaim JWT.
   Pemakaian: PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=hse_uji node tests/server/rest-uji.js 3101 */
'use strict';
const http = require('http');
const { Pool } = require('pg');
const pool = new Pool({ max: 8 });
const PORT = +(process.argv[2] || 3101);
const ID = /^[a-z_][a-z0-9_]*$/;
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = c => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(c) + '.uji';
const klaim = t => { try { return JSON.parse(Buffer.from(String(t).split('.')[1], 'base64url').toString()); } catch (e) { return null; } };
const berkas = new Map();
const kirim = (res, status, body, hdr) => { res.writeHead(status, Object.assign({ 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range' }, hdr || {})); res.end(body === undefined ? '' : (typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))); };
const galat = (res, e) => kirim(res, e.code === '42501' ? 403 : e.http || 400, { code: e.code || 'PGRST', message: e.message, details: e.detail || null, hint: e.hint || null });

async function transaksi(c, fn) {
  const k = await pool.connect();
  try {
    await k.query('begin');
    await k.query(`set local role ${c && c.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    await k.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(c || { role: 'anon' }), (c && c.sub) || '']);
    const r = await fn(k);
    await k.query('commit'); return r;
  } catch (e) { await k.query('rollback').catch(() => {}); throw e; } finally { k.release(); }
}

// ---- Penerjemah filter PostgREST → SQL berparameter ----
function nilaiFilter(op, v, p) {
  if (op === 'is') { if (!/^(null|true|false)$/.test(v)) throw Object.assign(new Error('is tidak valid'), { http: 400 }); return { sql: 'is ' + v }; }
  if (op === 'in') { const arr = v.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')); p.push(arr); return { sql: '= any($' + p.length + '::text[])', teks: true }; }
  const peta = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
  if (!peta[op]) throw Object.assign(new Error('operator tidak didukung: ' + op), { http: 400 });
  p.push(op.endsWith('like') ? v.replace(/\*/g, '%') : v); return { sql: peta[op] + ' $' + p.length };
}
function kondisi(kolom, ekspr, p) {
  if (!ID.test(kolom)) throw Object.assign(new Error('kolom tidak valid'), { http: 400 });
  let neg = false; if (ekspr.startsWith('not.')) { neg = true; ekspr = ekspr.slice(4); }
  const i = ekspr.indexOf('.'); const op = ekspr.slice(0, i), v = ekspr.slice(i + 1);
  const f = nilaiFilter(op, v, p);
  const c = f.teks ? `${kolom}::text ${f.sql}` : `${kolom} ${f.sql}`;
  return neg ? `not (${c})` : c;
}
function pecahOr(isi) { const out = []; let d = 0, buf = ''; for (const ch of isi) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(buf); buf = ''; } else buf += ch; } if (buf) out.push(buf); return out; }
function bangunWhere(q, p) {
  const w = [];
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    if (k === 'or') { w.push('(' + pecahOr(v.replace(/^\(|\)$/g, '')).map(x => { const j = x.indexOf('.'); return kondisi(x.slice(0, j), x.slice(j + 1), p); }).join(' or ') + ')'); continue; }
    w.push(kondisi(k, v, p));
  }
  return w.length ? ' where ' + w.join(' and ') : '';
}
function kolomSelect(s) { if (!s || s === '*') return '*'; return s.split(',').map(x => { x = x.trim(); if (!ID.test(x)) throw Object.assign(new Error('select tidak didukung: ' + x), { http: 400 }); return x; }).join(','); }
function urutan(o) { if (!o) return ''; return ' order by ' + o.split(',').map(x => { const [c, a, n] = x.split('.'); if (!ID.test(c)) throw new Error('order'); return c + (a === 'desc' ? ' desc' : ' asc') + (n === 'nullslast' ? ' nulls last' : n === 'nullsfirst' ? ' nulls first' : ''); }).join(','); }

async function tabel(req, res, c, nama, q, body) {
  if (!ID.test(nama)) throw Object.assign(new Error('tabel'), { http: 404 });
  const p = []; const sel = kolomSelect(q.get('select')); const pref = req.headers.prefer || '';
  const satu = /vnd\.pgrst\.object/.test(req.headers.accept || '');
  const balas = (rows, total, awal) => {
    const hdr = {}; if (total !== undefined) hdr['content-range'] = (rows.length ? awal + '-' + (awal + rows.length - 1) : '*') + '/' + total;
    if (satu) { if (rows.length !== 1) return kirim(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains ' + rows.length + ' rows' }); return kirim(res, 200, rows[0], hdr); }
    kirim(res, req.method === 'HEAD' ? 200 : 200, req.method === 'HEAD' ? undefined : rows, hdr);
  };
  if (req.method === 'GET' || req.method === 'HEAD') {
    const where = bangunWhere(q, p); const lim = q.get('limit'), off = +(q.get('offset') || 0);
    const r = await transaksi(c, async k => {
      const rows = req.method === 'HEAD' ? [] : (await k.query(`select ${sel} from public.${nama}${where}${urutan(q.get('order'))}${lim ? ' limit ' + (+lim) : ''}${off ? ' offset ' + off : ''}`, p)).rows;
      const total = /count=exact/.test(pref) ? +(await k.query(`select count(*) from public.${nama}${where}`, p)).rows[0].count : undefined;
      return { rows, total };
    });
    return balas(r.rows, r.total, off);
  }
  if (req.method === 'POST') {
    const data = Array.isArray(body) ? body : [body]; const kol = [...new Set(data.flatMap(Object.keys))];
    kol.forEach(x => { if (!ID.test(x)) throw new Error('kolom'); });
    const nilai = data.map(o => '(' + kol.map(x => { p.push(o[x] !== null && typeof o[x] === 'object' ? JSON.stringify(o[x]) : o[x]); return '$' + p.length; }).join(',') + ')').join(',');
    const rows = await transaksi(c, async k => (await k.query(`insert into public.${nama}(${kol.join(',')}) values ${nilai}${/return=representation/.test(pref) ? ' returning ' + sel : ''}`, p)).rows);
    return /return=representation/.test(pref) ? balas(rows) : kirim(res, 201, '');
  }
  if (req.method === 'PATCH') {
    const set = Object.keys(body).map(x => { if (!ID.test(x)) throw new Error('kolom'); p.push(body[x] !== null && typeof body[x] === 'object' ? JSON.stringify(body[x]) : body[x]); return x + ' = $' + p.length; }).join(', ');
    const where = bangunWhere(q, p);
    const rows = await transaksi(c, async k => (await k.query(`update public.${nama} set ${set}${where}${/return=representation/.test(pref) ? ' returning ' + sel : ''}`, p)).rows);
    return /return=representation/.test(pref) ? balas(rows) : kirim(res, 204, '');
  }
  if (req.method === 'DELETE') { const where = bangunWhere(q, p); await transaksi(c, k => k.query(`delete from public.${nama}${where}`, p)); return kirim(res, 204, ''); }
  kirim(res, 405, { message: 'metode' });
}

async function rpc(res, c, fn, body) {
  if (!ID.test(fn)) throw Object.assign(new Error('fungsi'), { http: 404 });
  const info = (await pool.query("select proretset, prorettype::regtype::text as tipe, coalesce(proargnames, '{}') as nama from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace limit 1", [fn])).rows[0];
  if (!info) throw Object.assign(new Error('Could not find the function public.' + fn + ' in the schema cache'), { code: 'PGRST202', http: 404 });
  const p = []; const arg = Object.keys(body || {}).map(k => { if (!ID.test(k)) throw new Error('arg'); const v = body[k]; p.push(v !== null && typeof v === 'object' ? (Array.isArray(v) && fn === 'notif_tandai_dibaca' ? '{' + v.join(',') + '}' : JSON.stringify(v)) : v); return k + ' => $' + p.length; }).join(', ');
  const setof = info.proretset || info.tipe === 'record';
  const r = await transaksi(c, async k => (await k.query(setof ? `select * from public.${fn}(${arg})` : `select public.${fn}(${arg}) as v`, p)).rows);
  kirim(res, 200, setof ? r : r[0].v);
}

async function auth(req, res, url, body) {
  const jalur = url.pathname.replace('/auth/v1', '');
  if (jalur === '/token') {
    const u = (await pool.query('select id, email from auth.users where lower(email) = lower($1)', [body.email || ''])).rows[0];
    if (!u || body.password !== 'Uji-Sandi-2026') return kirim(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
    const exp = Math.floor(Date.now() / 1000) + 3600, user = { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', factors: [] };
    return kirim(res, 200, { access_token: token({ sub: u.id, role: 'authenticated', aal: 'aal2', exp, email: u.email, amr: [{ method: 'password', timestamp: exp - 3600 }, { method: 'totp', timestamp: exp - 3600 }] }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + u.id, user });
  }
  if (jalur === '/user') { const c = klaim((req.headers.authorization || '').replace('Bearer ', '')); return kirim(res, 200, { id: c && c.sub, email: c && c.email, aud: 'authenticated', role: 'authenticated', factors: [] }); }
  if (jalur === '/logout') return kirim(res, 204, '');
  if (jalur === '/factors' || jalur.startsWith('/factors')) return kirim(res, 200, { all: [], totp: [] });
  kirim(res, 200, {});
}

async function storage(req, res, url, mentah) {
  const m = url.pathname.match(/^\/storage\/v1\/object\/(sign\/)?([^/]+)\/(.+)$/); if (!m) return kirim(res, 404, { message: 'tidak ada' });
  const kunci = m[2] + '/' + decodeURIComponent(m[3]);
  if (req.method === 'POST' && !m[1]) { berkas.set(kunci, { isi: mentah, tipe: req.headers['content-type'] }); return kirim(res, 200, { Key: kunci, Id: kunci }); }
  if (req.method === 'POST' && m[1]) return kirim(res, 200, { signedURL: '/object/sign/' + kunci + '?token=uji' });
  if (req.method === 'GET') { const f = berkas.get(kunci); return f ? kirim(res, 200, f.isi, { 'content-type': f.tipe || 'application/octet-stream' }) : kirim(res, 404, { message: 'tidak ada' }); }
  kirim(res, 405, {});
}

http.createServer((req, res) => {
  const potong = []; req.on('data', d => potong.push(d)); req.on('end', async () => {
    const mentah = Buffer.concat(potong); const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return kirim(res, 204, '');
    try {
      if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url, mentah.length ? JSON.parse(mentah) : {});
      if (url.pathname.startsWith('/storage/v1')) return await storage(req, res, url, mentah);
      const c = klaim((req.headers.authorization || '').replace('Bearer ', ''));
      const body = mentah.length && /json/.test(req.headers['content-type'] || '') ? JSON.parse(mentah) : {};
      const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_0-9]+)$/); if (!m) return kirim(res, 404, { message: 'jalur' });
      if (m[1]) return await rpc(res, c, m[2], body);
      return await tabel(req, res, c, m[2], url.searchParams, body);
    } catch (e) { galat(res, e); }
  });
}).listen(PORT, () => console.log('rest-uji siap di', PORT));
