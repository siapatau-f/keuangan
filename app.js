/* ===== Catatan Keuangan - app.js ===== */
'use strict';
(() => {
  const VERSION = '1.0';
  const LS = {
    cfg: 'fin.cfg', cache: 'fin.cache', last: 'fin.last', period: 'fin.period',
    trend: 'fin.trend', lastcat: 'fin.lastcat', lastjenis: 'fin.lastjenis'
  };
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const DEFAULT_CATS = {
    pemasukan: ['Gaji', 'Bonus', 'Freelance', 'Investasi', 'Hadiah', 'Penjualan', 'Lainnya'],
    pengeluaran: ['Makanan & Minuman', 'Transportasi', 'Belanja', 'Tagihan & Utilitas', 'Tempat Tinggal', 'Kesehatan', 'Pendidikan', 'Hiburan', 'Cicilan & Utang', 'Donasi & Sosial', 'Tabungan', 'Lainnya']
  };
  const PALETTE = ['#4f46e5', '#7c3aed', '#06b6d4', '#14b8a6', '#ec4899', '#f59e0b', '#64748b'];
  const EMOJI = [
    [/gaji/i, '💼'], [/bonus/i, '🎁'], [/freelance|jasa/i, '💻'], [/investasi|saham|dividen|reksa/i, '📈'],
    [/hadiah/i, '🎀'], [/jual|penjualan/i, '🛍️'], [/makan|minum|kuliner|kopi/i, '🍜'], [/transport|bensin|ojek/i, '🚌'],
    [/belanja/i, '🛒'], [/tagihan|utilitas|listrik|pulsa|internet/i, '⚡'], [/tinggal|sewa|kos|rumah/i, '🏠'],
    [/kesehatan|obat/i, '💊'], [/pendidikan|sekolah|kuliah/i, '🎓'], [/hiburan|nonton|game/i, '🎬'],
    [/cicilan|utang|hutang|kredit/i, '💳'], [/donasi|sosial|zakat|sedekah/i, '🤝'], [/tabungan|nabung/i, '🐖'], [/lain/i, '✨']
  ];

  class AppError extends Error {
    constructor(message, code) { super(message); this.code = code || 'ERR'; }
  }

  /* ---------- Util ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
  const addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  const diffDays = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
  const todayStr = () => ymd(new Date());
  const fmtDate = s => { const d = parseYmd(s); return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmtDigits = d => String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rp = n => { n = Math.round(n || 0); return (n < 0 ? '-' : '') + 'Rp ' + fmtDigits(Math.abs(n)); };
  const short = n => {
    const a = Math.abs(n);
    const f = (v, u) => (Math.round(v * 10) / 10).toString().replace('.', ',') + u;
    if (a >= 1e9) return f(n / 1e9, 'M');
    if (a >= 1e6) return f(n / 1e6, 'jt');
    if (a >= 1e3) return f(n / 1e3, 'rb');
    return String(Math.round(n));
  };
  const emoji = (k, j) => { for (const [re, e] of EMOJI) if (re.test(k || '')) return e; return j === 'pemasukan' ? '💰' : '🧾'; };
  const weekStart = d => { const x = new Date(d.getTime()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; };
  const between = (list, from, to) => list.filter(x => x.tanggal >= from && x.tanggal <= to);
  const total = (list, j) => list.reduce((s, x) => (x.jenis === j ? s + x.nominal : s), 0);
  const groupSum = (list, key) => {
    const m = {};
    list.forEach(x => { const k = x[key] || 'Tanpa kategori'; m[k] = (m[k] || 0) + x.nominal; });
    return Object.keys(m).map(k => ({ k, v: m[k] })).sort((a, b) => b.v - a.v);
  };
  const niceMax = v => {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / p;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 4 ? 4 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return nf * p;
  };
  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- State ---------- */
  const S = {
    cfg: null,
    data: { pemasukan: [], pengeluaran: [], kategori: { pemasukan: [], pengeluaran: [] }, dilewati: { pemasukan: 0, pengeluaran: 0 } },
    all: [],
    loaded: false, loading: false, stale: false, ver: 0, needReload: false, lastSync: null,
    tab: 'home',
    period: { type: 'month', from: '', to: '' },
    trend: 'daily',
    hist: { q: '', jenis: '', cat: '', from: '', to: '', limit: 50 },
    shownBal: 0, skipPop: 0, installEvt: null
  };

  /* ---------- API ---------- */
  async function api(action, payload) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let json;
    try {
      const res = await fetch(S.cfg.url, {
        method: 'POST',
        body: JSON.stringify(Object.assign({ action, key: S.cfg.key }, payload || {})),
        signal: ctrl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store'
      });
      const text = await res.text();
      try { json = JSON.parse(text); } catch (e) {
        throw new AppError('Respons server tidak valid. Pastikan deployment Apps Script diatur "Siapa saja" dan URL berakhiran /exec.', 'BAD');
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e && e.name === 'AbortError') throw new AppError('Koneksi terlalu lama. Coba lagi.', 'TIMEOUT');
      throw new AppError('Tidak bisa terhubung. Periksa internet atau URL Apps Script.', 'NET');
    } finally { clearTimeout(timer); }
    if (!json || !json.ok) throw new AppError((json && json.error) || 'Terjadi kesalahan di server.', (json && json.code) || 'ERR');
    return json;
  }

  /* ---------- Data ---------- */
  function applyData(d) {
    S.data = {
      pemasukan: Array.isArray(d.pemasukan) ? d.pemasukan : [],
      pengeluaran: Array.isArray(d.pengeluaran) ? d.pengeluaran : [],
      kategori: d.kategori || { pemasukan: [], pengeluaran: [] },
      dilewati: d.dilewati || { pemasukan: 0, pengeluaran: 0 }
    };
    rebuild();
  }
  function rebuild() {
    S.all = []
      .concat(S.data.pemasukan.map(x => Object.assign({}, x, { jenis: 'pemasukan' })))
      .concat(S.data.pengeluaran.map(x => Object.assign({}, x, { jenis: 'pengeluaran' })));
    S.all.sort((a, b) =>
      b.tanggal.localeCompare(a.tanggal) ||
      String(b.dibuat || '').localeCompare(String(a.dibuat || '')) ||
      (b.row || 0) - (a.row || 0));
  }
  function cats(j) {
    const base = (S.data.kategori && S.data.kategori[j] && S.data.kategori[j].length) ? S.data.kategori[j] : DEFAULT_CATS[j];
    const used = Array.from(new Set(S.data[j].map(x => x.kategori).filter(Boolean)));
    return base.concat(used.filter(c => base.indexOf(c) < 0));
  }
  function persistCache() { store.set(LS.cache, { pemasukan: S.data.pemasukan, pengeluaran: S.data.pengeluaran, kategori: S.data.kategori, dilewati: S.data.dilewati }); }

  async function loadData(opts) {
    opts = opts || {};
    if (S.loading || !S.cfg) return;
    S.loading = true;
    setRefreshing(true);
    const v = S.ver;
    try {
      const r = await api('init');
      if (v !== S.ver) { S.needReload = true; return; }
      applyData(r.data);
      S.loaded = true; S.stale = false; S.lastSync = Date.now();
      persistCache(); store.set(LS.last, S.lastSync);
      renderAll();
      if (opts.toast) toast('Data diperbarui dari Google Sheets', 'ok');
    } catch (e) {
      if (e.code === 'AUTH') { showSetup('Kunci akses ditolak. Masukkan kunci yang benar.'); return; }
      S.stale = true;
      if (!S.loaded) { S.loaded = true; renderAll(); }
      else renderAll();
      toast(e.message + (S.all.length ? ' Menampilkan data tersimpan.' : ''), 'err');
    } finally {
      S.loading = false;
      setRefreshing(false);
      if (S.needReload) { S.needReload = false; setTimeout(() => loadData({ silent: true }), 300); }
    }
  }
  function setRefreshing(on) { $('#btn-refresh').classList.toggle('spinning', !!on); }

  /* ---------- Periode ---------- */
  function getRange(p) {
    const now = new Date(), t = ymd(now);
    if (p.type === 'today') return { from: t, to: t };
    if (p.type === 'week') { const s = weekStart(now); return { from: ymd(s), to: ymd(addDays(s, 6)) }; }
    if (p.type === 'month') {
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1, 12)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12)) };
    }
    let f = p.from || t, e = p.to || t;
    if (f > e) { const x = f; f = e; e = x; }
    return { from: f, to: e };
  }
  function effTo(r) { const t = todayStr(); return r.to < t ? r.to : t; }
  function prevRange(p, r) {
    const n = Math.max(1, diffDays(r.from, effTo(r)) + 1);
    if (p.type === 'today') { const y = ymd(addDays(parseYmd(r.from), -1)); return { from: y, to: y, label: 'kemarin' }; }
    if (p.type === 'week') { const s = addDays(parseYmd(r.from), -7); return { from: ymd(s), to: ymd(addDays(s, n - 1)), label: 'minggu lalu' }; }
    if (p.type === 'month') {
      const f = parseYmd(r.from);
      const ps = new Date(f.getFullYear(), f.getMonth() - 1, 1, 12);
      const dim = new Date(f.getFullYear(), f.getMonth(), 0).getDate();
      return { from: ymd(ps), to: ymd(new Date(ps.getFullYear(), ps.getMonth(), Math.min(n, dim), 12)), label: 'bulan lalu' };
    }
    const len = diffDays(r.from, r.to) + 1;
    const to = addDays(parseYmd(r.from), -1);
    return { from: ymd(addDays(to, -(len - 1))), to: ymd(to), label: 'periode sebelumnya' };
  }
  function periodLabel(p, r) {
    if (p.type === 'today') return 'Hari ini, ' + fmtDate(r.from);
    if (p.type === 'month') { const d = parseYmd(r.from); return BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
    return fmtDate(r.from) + ' – ' + fmtDate(r.to);
  }
  function syncPeriodUI() {
    $$('#periodbar .chip').forEach(c => c.classList.toggle('on', c.dataset.p === S.period.type));
    const custom = S.period.type === 'custom';
    $('#custom-range').hidden = !custom;
    if (custom) { const r = getRange(S.period); $('#p-from').value = r.from; $('#p-to').value = r.to; }
  }

  /* ---------- Tampilan umum ---------- */
  const TITLES = { home: 'Beranda', history: 'Riwayat', stats: 'Statistik', account: 'Akun' };
  function go(tab) {
    S.tab = tab;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
    $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.tab === tab));
    $('#periodbar').hidden = !(tab === 'home' || tab === 'stats');
    window.scrollTo(0, 0);
    updateHeader();
  }
  function updateHeader() {
    $('#page-title').textContent = TITLES[S.tab];
    let sub = '';
    if (S.tab === 'home') { const d = new Date(); sub = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(); }
    if (S.tab === 'stats') sub = periodLabel(S.period, getRange(S.period));
    $('#page-sub').textContent = sub;
  }
  function renderAll() {
    updateHeader(); renderHome(); renderHistoryControls(); renderHistory(); renderStats(); renderAccount();
  }

  const skeleton = '<div class="sk hero-sk"></div><div class="sk card-sk" style="margin-top:14px"></div><div class="sk row-sk"></div><div class="sk row-sk"></div><div class="sk row-sk"></div>';
  function emptySvg() {
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>' +
      '<circle cx="60" cy="60" r="52" fill="#eef2ff"/><rect x="26" y="40" width="68" height="46" rx="12" fill="url(#eg)" opacity=".92"/>' +
      '<rect x="26" y="34" width="52" height="14" rx="7" fill="#c7d2fe"/><circle cx="80" cy="63" r="7" fill="#fff"/><circle cx="80" cy="63" r="3" fill="#7c3aed"/></svg>';
  }
  function emptyBlock(title, text, withBtn) {
    return '<div class="empty">' + emptySvg() + '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
      (withBtn ? '<button class="btn primary" data-act="add">Tambah transaksi</button>' : '') + '</div>';
  }

  function txItem(x, withDate) {
    const sub = x.catatan ? esc(x.catatan) + (withDate ? ' · ' + fmtDate(x.tanggal) : '') : (withDate ? fmtDate(x.tanggal) : '&nbsp;');
    const sign = x.jenis === 'pemasukan' ? '+' : '-';
    return '<button class="tx" data-id="' + esc(x.id) + '" data-j="' + x.jenis + '">' +
      '<span class="tx-ic ' + x.jenis + '">' + emoji(x.kategori, x.jenis) + '</span>' +
      '<span class="tx-main"><b>' + esc(x.kategori || 'Tanpa kategori') + '</b><small>' + sub + '</small></span>' +
      '<span class="tx-amt ' + x.jenis + ' num">' + sign + rp(x.nominal) + '</span></button>';
  }

  /* ---------- Beranda ---------- */
  function deltaHtml(cur, prev, kind) {
    if (!prev && !cur) return '<span class="neutral">–</span>';
    if (!prev) return '<span class="neutral">Baru</span>';
    const pct = (cur - prev) / prev * 100;
    if (Math.abs(pct) < 0.5) return '<span class="neutral">■ 0%</span>';
    const good = kind === 'exp' ? pct < 0 : pct > 0;
    return '<span class="' + (good ? 'down-good' : 'up-bad') + '">' + (pct > 0 ? '▲' : '▼') + ' ' + Math.abs(pct).toFixed(0) + '%</span>';
  }

  function renderHome() {
    const el = $('#home-body');
    if (!S.loaded) { el.innerHTML = skeleton; return; }
    const p = S.period, r = getRange(p);
    const tx = between(S.all, r.from, r.to);
    const inc = total(tx, 'pemasukan'), exp = total(tx, 'pengeluaran'), bal = inc - exp;
    let h = '';
    if (S.stale) h += '<div class="banner">' + (S.all.length
      ? 'Tidak bisa memuat data terbaru. Menampilkan data tersimpan' + (S.lastSync ? ' (' + fmtTime(S.lastSync) + ')' : '') + '.'
      : 'Tidak bisa memuat data. Periksa internet, lalu ketuk tombol muat ulang di kanan atas.') + '</div>';
    h += '<div class="hero" style="' + (S.stale ? 'margin-top:12px' : '') + '"><div class="hero-label">Saldo bersih · ' + esc(periodLabel(p, r)) + '</div>' +
      '<div class="hero-amount" id="hero-amt">' + rp(S.shownBal) + '</div>' +
      '<div class="hero-split"><div><span><i class="dot in"></i>Pemasukan</span><b>' + rp(inc) + '</b></div>' +
      '<div><span><i class="dot out"></i>Pengeluaran</span><b>' + rp(exp) + '</b></div></div></div>';

    if (!tx.length) {
      h += '<div class="card glass">' + emptyBlock('Belum ada transaksi', 'Belum ada transaksi di periode ini. Catat yang pertama, hanya butuh beberapa detik.', true) + '</div>';
    } else {
      const exps = tx.filter(x => x.jenis === 'pengeluaran');
      const by = groupSum(exps, 'kategori');
      const days = Math.max(1, diffDays(r.from, effTo(r)) + 1);
      const prev = prevRange(p, r);
      const cmpTo = p.type === 'custom' ? r.to : effTo(r);
      const curTx = between(S.all, r.from, cmpTo), prevTx = between(S.all, prev.from, prev.to);
      const curExp = total(curTx, 'pengeluaran'), prevExp = total(prevTx, 'pengeluaran');
      const curInc = total(curTx, 'pemasukan'), prevInc = total(prevTx, 'pemasukan');
      const ratio = inc > 0 ? Math.round((inc - exp) / inc * 100) : null;
      h += '<div class="insights">' +
        '<div class="ins glass"><div class="k">🏆 Pengeluaran terbesar</div>' +
        (by.length ? '<div class="v">' + esc(by[0].k) + '</div><div class="s">' + rp(by[0].v) + ' · ' + Math.round(by[0].v / exp * 100) + '% dari pengeluaran</div>' : '<div class="v">–</div><div class="s">Belum ada pengeluaran</div>') + '</div>' +
        '<div class="ins glass"><div class="k">📅 Rata-rata harian</div><div class="v">' + rp(exp / days) + '</div><div class="s">pengeluaran, dari ' + days + ' hari</div></div>' +
        '<div class="ins glass wide"><div class="k">📊 Dibanding ' + prev.label + '</div><div class="delta-row">' +
        '<div class="delta"><div class="k">Pengeluaran</div><div class="v">' + deltaHtml(curExp, prevExp, 'exp') + '</div><div class="s small muted">' + rp(prevExp) + ' ' + prev.label + '</div></div>' +
        '<div class="delta"><div class="k">Pemasukan</div><div class="v">' + deltaHtml(curInc, prevInc, 'inc') + '</div><div class="s small muted">' + rp(prevInc) + ' ' + prev.label + '</div></div></div></div>' +
        '<div class="ins glass"><div class="k">💡 Sisa dari pemasukan</div><div class="v ' + (ratio !== null && ratio < 0 ? 'up-bad' : '') + '">' + (ratio === null ? '–' : ratio + '%') + '</div><div class="s">saldo bersih ÷ pemasukan</div></div>' +
        '<div class="ins glass"><div class="k">🧾 Jumlah transaksi</div><div class="v">' + tx.length + '</div><div class="s">' + tx.filter(x => x.jenis === 'pemasukan').length + ' masuk · ' + exps.length + ' keluar</div></div></div>';
    }

    const recent = S.all.slice(0, 5);
    h += '<div class="card glass"><div class="card-head"><h3>Transaksi terbaru</h3>' + (S.all.length ? '<button class="link-btn" data-goto="history">Lihat semua</button>' : '') + '</div>' +
      (recent.length ? recent.map(x => txItem(x, true)).join('') : emptyBlock('Belum ada data', 'Transaksi dari spreadsheet dan yang kamu catat akan muncul di sini.', false)) + '</div>';
    el.innerHTML = h;
    const amt = $('#hero-amt');
    if (amt) { countUp(amt, bal, S.shownBal); S.shownBal = bal; }
  }
  function countUp(el, to, from) {
    if (reduceMotion() || from === to) { el.textContent = rp(to); return; }
    const t0 = performance.now(), d = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3);
      el.textContent = rp(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function fmtTime(ts) {
    const d = new Date(ts), t = pad(d.getHours()) + ':' + pad(d.getMinutes());
    return ymd(d) === todayStr() ? 'hari ini ' + t : d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + t;
  }

  /* ---------- Riwayat ---------- */
  function renderHistoryControls() {
    const sel = $('#h-cat'), cur = S.hist.cat;
    const all = Array.from(new Set(cats('pengeluaran').concat(cats('pemasukan')))).sort((a, b) => a.localeCompare(b, 'id'));
    sel.innerHTML = '<option value="">Semua kategori</option>' + all.map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
    sel.value = all.indexOf(cur) >= 0 ? cur : '';
    if (sel.value !== cur) S.hist.cat = sel.value;
    $('#h-q').value = S.hist.q; $('#h-from').value = S.hist.from; $('#h-to').value = S.hist.to;
    $$('#h-jenis button').forEach(b => b.classList.toggle('on', b.dataset.j === S.hist.jenis));
  }
  function filtered() {
    const h = S.hist, q = h.q.trim().toLowerCase();
    return S.all.filter(x =>
      (!h.jenis || x.jenis === h.jenis) && (!h.cat || x.kategori === h.cat) &&
      (!h.from || x.tanggal >= h.from) && (!h.to || x.tanggal <= h.to) &&
      (!q || (x.catatan + ' ' + x.kategori + ' ' + x.nominal + ' ' + rp(x.nominal)).toLowerCase().indexOf(q) >= 0));
  }
  function dayLabel(s) {
    const t = todayStr();
    if (s === t) return 'Hari ini';
    if (s === ymd(addDays(parseYmd(t), -1))) return 'Kemarin';
    const d = parseYmd(s);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function renderHistory() {
    const list = $('#h-list'), sum = $('#h-summary');
    const h = S.hist;
    $('#h-reset').hidden = !(h.q || h.jenis || h.cat || h.from || h.to);
    if (!S.loaded) { list.innerHTML = skeleton; sum.textContent = ''; return; }
    const rows = filtered();
    if (!rows.length) {
      sum.textContent = '';
      list.innerHTML = '<div class="card glass">' + (S.all.length
        ? emptyBlock('Tidak ada hasil', 'Coba ubah kata kunci atau filter.', false)
        : emptyBlock('Belum ada transaksi', 'Catat transaksi pertamamu atau isi spreadsheet.', true)) + '</div>';
      return;
    }
    sum.textContent = rows.length + ' transaksi · Masuk ' + rp(total(rows, 'pemasukan')) + ' · Keluar ' + rp(total(rows, 'pengeluaran'));
    const net = {};
    rows.forEach(x => { net[x.tanggal] = (net[x.tanggal] || 0) + (x.jenis === 'pemasukan' ? x.nominal : -x.nominal); });
    let html = '<div class="card glass" style="margin-top:8px;padding:6px 12px 12px">', last = '';
    rows.slice(0, h.limit).forEach(x => {
      if (x.tanggal !== last) {
        last = x.tanggal;
        html += '<div class="day-head"><span>' + esc(dayLabel(x.tanggal)) + '</span><span>' + (net[x.tanggal] >= 0 ? '+' : '') + rp(net[x.tanggal]) + '</span></div>';
      }
      html += txItem(x, false);
    });
    html += '</div>';
    if (rows.length > h.limit) html += '<button class="more" data-act="more">Muat lebih banyak (' + (rows.length - h.limit) + ')</button>';
    list.innerHTML = html;
  }

  /* ---------- Statistik ---------- */
  function donut(items, tot) {
    const R = 44, C = 2 * Math.PI * R;
    let off = 0, segs = '';
    items.forEach(it => {
      const full = C * it.v / tot, len = Math.max(0, full - (items.length > 1 ? 1.6 : 0));
      segs += '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + it.c + '" stroke-width="14" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
      off += full;
    });
    return '<svg class="donut" viewBox="0 0 120 120" role="img" aria-label="Diagram pengeluaran per kategori"><circle cx="60" cy="60" r="' + R + '" fill="none" stroke="rgba(15,23,42,.06)" stroke-width="14"/>' + segs +
      '<text x="60" y="57" text-anchor="middle" class="d-l">Total</text><text x="60" y="71" text-anchor="middle" class="d-v">' + short(tot) + '</text></svg>';
  }

  function trendData(mode, r) {
    if (mode === 'monthly') {
      const now = new Date(), out = [], idx = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 12), key = d.getFullYear() + '-' + pad(d.getMonth() + 1);
        idx[key] = out.length;
        out.push({ label: BLN[d.getMonth()], tip: BULAN[d.getMonth()] + ' ' + d.getFullYear(), inc: 0, exp: 0 });
      }
      S.all.forEach(x => { const k = x.tanggal.slice(0, 7); if (k in idx) out[idx[k]][x.jenis === 'pemasukan' ? 'inc' : 'exp'] += x.nominal; });
      return { b: out, kind: 'bars', note: '6 bulan terakhir' };
    }
    const to = effTo(r);
    if (to < r.from) return { b: [], kind: 'line', note: '' };
    const n = diffDays(r.from, to) + 1;
    const tx = between(S.all, r.from, to);
    if (n > 92) {
      const out = [], idx = {};
      let d = parseYmd(r.from); d = new Date(d.getFullYear(), d.getMonth(), 1, 12);
      const end = parseYmd(to);
      while (d <= end) {
        idx[d.getFullYear() + '-' + pad(d.getMonth() + 1)] = out.length;
        out.push({ label: BLN[d.getMonth()], tip: BULAN[d.getMonth()] + ' ' + d.getFullYear(), inc: 0, exp: 0 });
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
      }
      tx.forEach(x => { const k = x.tanggal.slice(0, 7); if (k in idx) out[idx[k]][x.jenis === 'pemasukan' ? 'inc' : 'exp'] += x.nominal; });
      return { b: out, kind: out.length <= 12 ? 'bars' : 'line', note: 'Periode panjang ditampilkan per bulan' };
    }
    const out = [], idx = {};
    for (let i = 0; i < n; i++) {
      const d = addDays(parseYmd(r.from), i);
      idx[ymd(d)] = i;
      out.push({ label: String(d.getDate()), tip: HR[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()], inc: 0, exp: 0 });
    }
    tx.forEach(x => { if (x.tanggal in idx) out[idx[x.tanggal]][x.jenis === 'pemasukan' ? 'inc' : 'exp'] += x.nominal; });
    return { b: out, kind: n <= 10 ? 'bars' : 'line', note: '' };
  }

  function trendChart(b, kind) {
    const W = 340, H = 190, pl = 42, pr = 8, pt = 10, pb = 24, iw = W - pl - pr, ih = H - pt - pb, n = b.length;
    const mx = niceMax(Math.max(1, Math.max.apply(null, b.map(x => Math.max(x.inc, x.exp)))));
    const Y = v => pt + ih - (v / mx) * ih;
    const X = i => kind === 'line' ? pl + (n === 1 ? iw / 2 : iw * i / (n - 1)) : pl + iw * (i + 0.5) / n;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik tren pemasukan dan pengeluaran">';
    for (let k = 0; k <= 4; k++) {
      const v = mx * k / 4, y = Y(v);
      s += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="axis" x="' + (pl - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + short(v) + '</text>';
    }
    const step = Math.ceil(n / 6);
    b.forEach((x, i) => { if (i % step === 0) s += '<text class="axis" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(x.label) + '</text>'; });
    if (kind === 'line') {
      const pts = f => b.map((x, i) => X(i).toFixed(1) + ',' + Y(x[f]).toFixed(1)).join(' ');
      const area = 'M' + X(0).toFixed(1) + ',' + Y(0).toFixed(1) + ' L' + b.map((x, i) => X(i).toFixed(1) + ',' + Y(x.exp).toFixed(1)).join(' L') + ' L' + X(n - 1).toFixed(1) + ',' + Y(0).toFixed(1) + ' Z';
      s += '<defs><linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".26"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></linearGradient></defs>';
      s += '<path d="' + area + '" fill="url(#gExp)"/>';
      s += '<polyline class="path-draw" fill="none" stroke="#14b8a6" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="' + pts('inc') + '"/>';
      s += '<polyline class="path-draw" fill="none" stroke="#7c3aed" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" points="' + pts('exp') + '"/>';
    } else {
      const gw = iw / n, bw = Math.max(3, Math.min(16, gw * 0.34));
      b.forEach((x, i) => {
        const cx = X(i);
        s += '<rect x="' + (cx - bw - 1).toFixed(1) + '" y="' + Y(x.inc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, Y(0) - Y(x.inc)).toFixed(1) + '" rx="3" fill="#14b8a6"/>';
        s += '<rect x="' + (cx + 1).toFixed(1) + '" y="' + Y(x.exp).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, Y(0) - Y(x.exp)).toFixed(1) + '" rx="3" fill="#7c3aed"/>';
      });
    }
    s += '<line id="t-cursor" x1="0" x2="0" y1="' + pt + '" y2="' + (pt + ih) + '" stroke="#4f46e5" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>';
    b.forEach((x, i) => {
      const w = kind === 'line' ? (n > 1 ? iw / (n - 1) : iw) : iw / n;
      const x0 = kind === 'line' ? X(i) - w / 2 : pl + iw * i / n;
      s += '<rect class="hit" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '" x="' + x0.toFixed(1) + '" y="' + pt + '" width="' + w.toFixed(1) + '" height="' + ih + '"/>';
    });
    return s + '</svg>';
  }

  let trendCache = null;
  function renderStats() {
    const el = $('#stats-body');
    if (!S.loaded) { el.innerHTML = skeleton; return; }
    const p = S.period, r = getRange(p), tx = between(S.all, r.from, r.to);
    const exps = tx.filter(x => x.jenis === 'pengeluaran');
    const inc = total(tx, 'pemasukan'), exp = total(exps, 'pengeluaran') || total(tx, 'pengeluaran');
    let h = '';

    h += '<div class="card glass"><div class="card-head"><h3>Pengeluaran per kategori</h3></div>';
    if (!exps.length) h += emptyBlock('Belum ada pengeluaran', 'Grafik muncul setelah ada pengeluaran di periode ini.', false);
    else {
      const by = groupSum(exps, 'kategori');
      const top = by.slice(0, 6), rest = by.slice(6);
      const items = top.map((x, i) => ({ k: x.k, v: x.v, c: PALETTE[i], tap: true }));
      if (rest.length) items.push({ k: 'Lainnya (' + rest.length + ' kategori)', v: rest.reduce((s, x) => s + x.v, 0), c: PALETTE[6], tap: false });
      h += '<div class="donut-wrap">' + donut(items, exp) + '<div class="legend">' +
        items.map(it => '<button class="lg" ' + (it.tap ? 'data-cat="' + esc(it.k) + '"' : 'disabled') + '><i style="background:' + it.c + '"></i><span class="n">' + esc(it.k) + '</span><span class="p">' + Math.round(it.v / exp * 100) + '%</span><span class="a">' + rp(it.v) + '</span></button>').join('') +
        '</div></div>';
    }
    h += '</div>';

    const td = trendData(S.trend, r);
    trendCache = td;
    h += '<div class="card glass trend"><div class="card-head"><h3>Tren</h3><div class="seg mini" id="t-mode"><button data-trend="daily" class="' + (S.trend === 'daily' ? 'on' : '') + '">Harian</button><button data-trend="monthly" class="' + (S.trend === 'monthly' ? 'on' : '') + '">Bulanan</button></div></div>';
    if (!td.b.length || !td.b.some(x => x.inc || x.exp)) h += emptyBlock('Belum ada data tren', S.trend === 'monthly' ? 'Belum ada transaksi dalam 6 bulan terakhir.' : 'Belum ada transaksi di periode ini.', false);
    else {
      h += '<div class="legend-inline"><span><i style="background:#14b8a6"></i>Pemasukan</span><span><i style="background:#7c3aed"></i>Pengeluaran</span></div>' + trendChart(td.b, td.kind) +
        '<div class="readout" id="t-readout">Ketuk grafik untuk melihat angka' + (td.note ? ' · ' + esc(td.note) : '') + '.</div>';
    }
    h += '</div>';

    const mx = Math.max(inc, exp, 1);
    h += '<div class="card glass"><div class="card-head"><h3>Pemasukan vs pengeluaran</h3></div>' +
      '<div class="cmp-row"><span class="nm">Pemasukan</span><div class="bar"><i class="in" data-w="' + (inc / mx * 100).toFixed(1) + '"></i></div><span class="val">' + rp(inc) + '</span></div>' +
      '<div class="cmp-row"><span class="nm">Pengeluaran</span><div class="bar"><i class="out" data-w="' + (exp / mx * 100).toFixed(1) + '"></i></div><span class="val">' + rp(exp) + '</span></div>' +
      '<div class="cmp-foot">Saldo bersih <b>' + rp(inc - exp) + '</b>' + (inc > 0 ? ' · ' + Math.round((inc - exp) / inc * 100) + '% dari pemasukan' : '') + '</div></div>';
    el.innerHTML = h;
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.bar i', el).forEach(i => { i.style.width = i.dataset.w + '%'; })));
  }
  function showReadout(i, xPos) {
    if (!trendCache || !trendCache.b[i]) return;
    const x = trendCache.b[i];
    $('#t-readout').innerHTML = '<b>' + esc(x.tip) + '</b> · Masuk ' + rp(x.inc) + ' · Keluar ' + rp(x.exp);
    const c = $('#t-cursor');
    if (c) { c.setAttribute('x1', xPos); c.setAttribute('x2', xPos); c.setAttribute('opacity', '.6'); }
  }

  /* ---------- Akun ---------- */
  function renderAccount() {
    const el = $('#account-body');
    const nIn = S.data.pemasukan.length, nOut = S.data.pengeluaran.length;
    const skipped = (S.data.dilewati.pemasukan || 0) + (S.data.dilewati.pengeluaran || 0);
    const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
    let h = '<div class="card glass"><div class="card-head"><h3>Koneksi Google Sheets</h3></div><div class="kv">' +
      '<div><span>Status</span><b class="' + (S.stale ? 'up-bad' : 'down-good') + '">' + (S.cfg ? (S.stale ? 'Gagal memuat terakhir' : 'Terhubung') : 'Belum terhubung') + '</b></div>' +
      '<div><span>URL</span><b>' + (S.cfg ? esc(S.cfg.url.replace(/^https:\/\//, '').slice(0, 26)) + '…' : '–') + '</b></div>' +
      '<div><span>Sinkron terakhir</span><b>' + (S.lastSync ? esc(fmtTime(S.lastSync)) : '–') + '</b></div>' +
      '<div><span>Transaksi</span><b>' + (nIn + nOut) + ' (' + nIn + ' masuk, ' + nOut + ' keluar)</b></div></div>' +
      (skipped ? '<div class="banner">' + skipped + ' baris di spreadsheet dilewati karena tanggal atau nominalnya tidak terbaca.</div>' : '') + '</div>';
    h += '<div class="stack">' +
      '<button class="btn soft" data-act="refresh">Muat ulang dari Google Sheets</button>' +
      (S.installEvt && !standalone ? '<button class="btn soft" data-act="install">Pasang aplikasi di layar utama</button>' : '') +
      '<button class="btn soft" data-act="reconnect">Ubah koneksi</button>' +
      '<button class="btn danger" data-act="logout">Keluar dan hapus kunci dari HP ini</button></div>';
    if (!standalone && !S.installEvt) h += '<div class="banner" style="margin-top:14px">Untuk memasang di layar utama: buka menu ⋮ di Chrome, lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</div>';
    h += '<p class="small muted" style="text-align:center;margin-top:18px">Catatan Keuangan v' + VERSION + '</p>';
    el.innerHTML = h;
  }

  /* ---------- Overlay + tombol back ---------- */
  const overlays = [];
  function pushOverlay(el) {
    overlays.push(el);
    el.classList.add('show'); el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('noscroll');
    try { history.pushState({ ov: overlays.length }, ''); } catch (e) { /* abaikan */ }
  }
  function popOverlay(fromPop) {
    const el = overlays.pop();
    if (!el) return;
    el.classList.remove('show'); el.setAttribute('aria-hidden', 'true');
    if (!overlays.length) document.body.classList.remove('noscroll');
    if (!fromPop) { S.skipPop++; history.back(); }
  }
  function closeAllOverlays() {
    const n = overlays.length;
    if (!n) return;
    while (overlays.length) { const el = overlays.pop(); el.classList.remove('show'); el.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('noscroll');
    S.skipPop++; history.go(-n);
  }
  window.addEventListener('popstate', () => {
    if (S.skipPop > 0) { S.skipPop--; return; }
    if (overlays.length) popOverlay(true);
  });

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.innerHTML = '<span>' + (type === 'ok' ? '✓' : type === 'err' ? '⚠️' : 'ℹ️') + '</span><span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t);
    const ms = type === 'err' ? 4800 : 2600;
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  }

  /* ---------- Form tambah / ubah ---------- */
  const F = { mode: 'add', jenis: 'pengeluaran', kategori: '', id: null, orig: null, saving: false };
  function clearErrors() { ['nominal', 'kategori', 'tanggal'].forEach(k => { const e = $('#e-' + k); e.hidden = true; e.textContent = ''; }); }
  function showErr(k, msg) { const e = $('#e-' + k); e.textContent = msg; e.hidden = false; }
  function renderCats() {
    let list = cats(F.jenis);
    if (F.kategori && list.indexOf(F.kategori) < 0) list = [F.kategori].concat(list);
    $('#f-cats').innerHTML = list.map(c => '<button type="button" class="cat ' + (c === F.kategori ? 'on' : '') + '" data-c="' + esc(c) + '">' + emoji(c, F.jenis) + ' ' + esc(c) + '</button>').join('');
  }
  function openForm(tx) {
    F.mode = tx ? 'edit' : 'add'; F.orig = tx || null; F.id = tx ? tx.id : null; F.saving = false;
    F.jenis = tx ? tx.jenis : store.get(LS.lastjenis, 'pengeluaran');
    F.kategori = tx ? tx.kategori : store.get(LS.lastcat + '.' + F.jenis, '');
    $('#f-title').textContent = tx ? 'Ubah Transaksi' : 'Tambah Transaksi';
    $('#f-nominal').value = tx ? fmtDigits(tx.nominal) : '';
    $('#f-tanggal').value = tx ? tx.tanggal : todayStr();
    $('#f-catatan').value = tx ? tx.catatan : '';
    $('#f-delete').hidden = !tx;
    $('#f-quick').hidden = false;
    $$('#f-jenis button').forEach(b => { b.classList.toggle('on', b.dataset.j === F.jenis); b.disabled = !!tx && b.dataset.j !== F.jenis; });
    setSaving(false);
    renderCats(); clearErrors();
    pushOverlay($('#sheet-form'));
    if (!tx) setTimeout(() => { try { $('#f-nominal').focus(); } catch (e) { /* abaikan */ } }, 340);
  }
  function setSaving(on) {
    F.saving = on;
    const b = $('#f-save');
    b.disabled = on; $('.spin', b).hidden = !on; $('.lbl', b).textContent = on ? 'Menyimpan…' : (F.mode === 'edit' ? 'Simpan perubahan' : 'Simpan');
  }
  async function submitForm() {
    if (F.saving) return;
    clearErrors();
    const nominal = parseInt($('#f-nominal').value.replace(/\D/g, ''), 10) || 0;
    const tanggal = $('#f-tanggal').value, catatan = $('#f-catatan').value.trim();
    let ok = true;
    if (!nominal || nominal <= 0) { showErr('nominal', 'Nominal wajib diisi dan harus lebih dari 0.'); ok = false; }
    else if (nominal > 999999999999) { showErr('nominal', 'Nominal terlalu besar.'); ok = false; }
    if (!F.kategori) { showErr('kategori', 'Pilih satu kategori.'); ok = false; }
    if (!tanggal) { showErr('tanggal', 'Tanggal wajib diisi.'); ok = false; }
    if (!ok) { if (navigator.vibrate) navigator.vibrate(60); return; }
    setSaving(true);
    try {
      if (F.mode === 'add') {
        const r = await api('add', { jenis: F.jenis, tanggal, kategori: F.kategori, nominal, catatan });
        S.data[F.jenis].push(r.item);
        store.set(LS.lastcat + '.' + F.jenis, F.kategori); store.set(LS.lastjenis, F.jenis);
      } else {
        const o = F.orig;
        const r = await api('update', { jenis: F.jenis, id: F.id, tanggal, kategori: F.kategori, nominal, catatan, expect: { tanggal: o.tanggal, nominal: o.nominal } });
        const arr = S.data[F.jenis], i = arr.findIndex(x => x.id === F.id);
        if (i >= 0) arr[i] = r.item; else arr.push(r.item);
      }
      S.ver++; rebuild(); persistCache(); S.stale = false;
      renderAll();
      closeAllOverlays();
      toast(F.mode === 'add' ? 'Tersimpan ke Google Sheets' : 'Perubahan tersimpan', 'ok');
    } catch (e) {
      setSaving(false);
      if (e.code === 'AUTH') { closeAllOverlays(); showSetup('Kunci akses ditolak. Masukkan kunci yang benar.'); return; }
      toast('Gagal menyimpan: ' + e.message, 'err');
    }
  }
  function askDelete() {
    const o = F.orig; if (!o) return;
    $('#d-detail').textContent = (o.jenis === 'pemasukan' ? 'Pemasukan ' : 'Pengeluaran ') + rp(o.nominal) + ' · ' + o.kategori + ' · ' + fmtDate(o.tanggal);
    const b = $('#d-confirm'); b.disabled = false; $('.spin', b).hidden = true; $('.lbl', b).textContent = 'Ya, hapus';
    pushOverlay($('#dlg-delete'));
  }
  async function confirmDelete() {
    const o = F.orig, b = $('#d-confirm');
    if (!o || b.disabled) return;
    b.disabled = true; $('.spin', b).hidden = false; $('.lbl', b).textContent = 'Menghapus…';
    try {
      await api('delete', { jenis: o.jenis, id: o.id, expect: { tanggal: o.tanggal, nominal: o.nominal } });
      S.data[o.jenis] = S.data[o.jenis].filter(x => x.id !== o.id);
      S.ver++; rebuild(); persistCache(); renderAll();
      closeAllOverlays();
      toast('Transaksi dihapus', 'ok');
    } catch (e) {
      b.disabled = false; $('.spin', b).hidden = true; $('.lbl', b).textContent = 'Ya, hapus';
      toast('Gagal menghapus: ' + e.message, 'err');
    }
  }

  /* ---------- Hubungkan ---------- */
  function showSetup(msg) {
    closeAllOverlays();
    $('#setup').hidden = false;
    $('#s-url').value = S.cfg ? S.cfg.url : '';
    $('#s-key').value = '';
    const e = $('#s-err'); e.hidden = !msg; e.textContent = msg || '';
    $('#s-cancel').hidden = !(S.cfg && S.cfg.key && !msg);
    setConnecting(false);
  }
  function setConnecting(on) { const b = $('#s-go'); b.disabled = on; $('.spin', b).hidden = !on; $('.lbl', b).textContent = on ? 'Menghubungkan…' : 'Hubungkan'; }
  async function connect() {
    const url = $('#s-url').value.trim(), key = $('#s-key').value.trim(), err = $('#s-err');
    err.hidden = true;
    if (!/^https:\/\/script\.google\.com\/.+\/exec\/?$/.test(url)) { err.textContent = 'URL harus berawalan https://script.google.com/ dan berakhiran /exec.'; err.hidden = false; return; }
    if (!key) { err.textContent = 'Kunci akses wajib diisi.'; err.hidden = false; return; }
    const old = S.cfg;
    S.cfg = { url, key };
    setConnecting(true);
    try {
      const r = await api('init');
      store.set(LS.cfg, S.cfg);
      applyData(r.data); S.loaded = true; S.stale = false; S.lastSync = Date.now();
      persistCache(); store.set(LS.last, S.lastSync);
      $('#setup').hidden = true;
      go('home'); renderAll();
      toast('Terhubung ke Google Sheets', 'ok');
    } catch (e) {
      S.cfg = old;
      err.textContent = e.code === 'AUTH' ? 'Kunci akses salah. Periksa kembali (tanpa spasi).' : e.message;
      err.hidden = false;
    } finally { setConnecting(false); }
  }
  function logout() {
    [LS.cfg, LS.cache, LS.last].forEach(store.del);
    S.cfg = null; S.loaded = false; S.all = []; S.data = { pemasukan: [], pengeluaran: [], kategori: { pemasukan: [], pengeluaran: [] }, dilewati: { pemasukan: 0, pengeluaran: 0 } };
    showSetup(); renderAll();
  }

  /* ---------- Event ---------- */
  function bindEvents() {
    document.addEventListener('click', ev => {
      const t = ev.target;
      let el;
      if ((el = t.closest('.tx'))) {
        const x = S.all.find(a => a.id === el.dataset.id && a.jenis === el.dataset.j);
        if (x) openForm(x);
        return;
      }
      if ((el = t.closest('[data-tab]'))) { go(el.dataset.tab); return; }
      if ((el = t.closest('[data-goto]'))) { go(el.dataset.goto); return; }
      if (t.closest('#fab')) { openForm(); return; }
      if ((el = t.closest('#periodbar .chip'))) {
        S.period.type = el.dataset.p;
        if (S.period.type === 'custom' && (!S.period.from || !S.period.to)) {
          const n = new Date(); S.period.from = ymd(new Date(n.getFullYear(), n.getMonth(), 1, 12)); S.period.to = todayStr();
        }
        store.set(LS.period, S.period); syncPeriodUI(); updateHeader(); renderHome(); renderStats();
        return;
      }
      if ((el = t.closest('[data-close]'))) {
        const ov = el.closest('.overlay');
        if (ov && overlays[overlays.length - 1] === ov) popOverlay(false);
        return;
      }
      if ((el = t.closest('[data-act]'))) {
        const a = el.dataset.act;
        if (a === 'add') openForm();
        else if (a === 'more') { S.hist.limit += 50; renderHistory(); }
        else if (a === 'refresh') loadData({ toast: true });
        else if (a === 'reconnect') showSetup();
        else if (a === 'logout') { if (confirm('Hapus koneksi dan data tersimpan dari HP ini? Data di Google Sheets tidak terpengaruh.')) logout(); }
        else if (a === 'install' && S.installEvt) { S.installEvt.prompt(); S.installEvt.userChoice.finally(() => { S.installEvt = null; renderAccount(); }); }
        return;
      }
      if ((el = t.closest('.lg[data-cat]'))) {
        const r = getRange(S.period);
        S.hist = { q: '', jenis: 'pengeluaran', cat: el.dataset.cat, from: r.from, to: r.to, limit: 50 };
        renderHistoryControls(); renderHistory(); go('history');
        return;
      }
      if ((el = t.closest('#t-mode [data-trend]'))) { S.trend = el.dataset.trend; store.set(LS.trend, S.trend); renderStats(); return; }
      if ((el = t.closest('.hit'))) { showReadout(+el.dataset.i, el.dataset.x); return; }
    });

    $('#btn-refresh').addEventListener('click', () => loadData({ toast: true }));
    $('#p-from').addEventListener('change', e => { S.period.from = e.target.value; store.set(LS.period, S.period); updateHeader(); renderHome(); renderStats(); });
    $('#p-to').addEventListener('change', e => { S.period.to = e.target.value; store.set(LS.period, S.period); updateHeader(); renderHome(); renderStats(); });

    // Riwayat
    let tmr;
    $('#h-q').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { S.hist.q = e.target.value; S.hist.limit = 50; renderHistory(); }, 160); });
    $('#h-cat').addEventListener('change', e => { S.hist.cat = e.target.value; S.hist.limit = 50; renderHistory(); });
    $('#h-from').addEventListener('change', e => { S.hist.from = e.target.value; S.hist.limit = 50; renderHistory(); });
    $('#h-to').addEventListener('change', e => { S.hist.to = e.target.value; S.hist.limit = 50; renderHistory(); });
    $('#h-jenis').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.hist.jenis = b.dataset.j; S.hist.limit = 50;
      $$('#h-jenis button').forEach(x => x.classList.toggle('on', x === b)); renderHistory();
    });
    $('#h-reset').addEventListener('click', () => { S.hist = { q: '', jenis: '', cat: '', from: '', to: '', limit: 50 }; renderHistoryControls(); renderHistory(); });

    // Form
    $('#f-jenis').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      F.jenis = b.dataset.j;
      F.kategori = store.get(LS.lastcat + '.' + F.jenis, '');
      $$('#f-jenis button').forEach(x => x.classList.toggle('on', x === b));
      renderCats(); clearErrors();
    });
    $('#f-cats').addEventListener('click', e => {
      const b = e.target.closest('.cat'); if (!b) return;
      F.kategori = b.dataset.c; renderCats(); $('#e-kategori').hidden = true;
    });
    const nom = $('#f-nominal');
    nom.addEventListener('input', () => { const d = nom.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13); nom.value = d ? fmtDigits(d) : ''; $('#e-nominal').hidden = true; });
    $('#f-quick').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const cur = parseInt(nom.value.replace(/\D/g, ''), 10) || 0;
      nom.value = fmtDigits(Math.min(999999999999, cur + Number(b.dataset.add))); $('#e-nominal').hidden = true;
    });
    $('#f-today').addEventListener('click', () => { $('#f-tanggal').value = todayStr(); });
    $('#f-yesterday').addEventListener('click', () => { $('#f-tanggal').value = ymd(addDays(new Date(), -1)); });
    $('#f-save').addEventListener('click', submitForm);
    $('#f-delete').addEventListener('click', askDelete);
    $('#d-confirm').addEventListener('click', confirmDelete);
    ['f-nominal', 'f-catatan'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitForm(); } }));

    // Hubungkan
    $('#s-go').addEventListener('click', connect);
    $('#s-key').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
    $('#s-cancel').addEventListener('click', () => { $('#setup').hidden = true; });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && S.cfg && S.lastSync && Date.now() - S.lastSync > 60000 && !overlays.length) loadData({ silent: true });
    });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; renderAccount(); });
    window.addEventListener('appinstalled', () => { S.installEvt = null; renderAccount(); });
  }

  /* ---------- Mulai ---------- */
  function boot() {
    S.cfg = store.get(LS.cfg, null);
    const p = store.get(LS.period, null);
    if (p && p.type) S.period = p;
    S.trend = store.get(LS.trend, 'daily');
    const cache = store.get(LS.cache, null);
    if (cache && S.cfg) { applyData(cache); S.loaded = true; S.lastSync = store.get(LS.last, null); }
    bindEvents();
    syncPeriodUI();
    go('home');
    renderAll();
    if (!S.cfg || !S.cfg.url || !S.cfg.key) showSetup();
    else {
      loadData({ silent: true });
      if (/[?&]add=1/.test(location.search)) setTimeout(() => openForm(), 350);
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
  }
  boot();
})();
