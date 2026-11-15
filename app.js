(function () {
  'use strict';

  // ═══════════════ Көмекші функциялар ═══════════════
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), tabsEl = $('#tabs');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => shuffle(a).slice(0, n);
  const words = (t) => t.replace(/[–—,.!?;:«»"]/g, ' ').trim().split(/\s+/).map((w) => w.toLowerCase());

  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const yesterday = () => dstr(new Date(Date.now() - 864e5));
  const schoolQ = (ds) => { const m = +ds.slice(5, 7); return m >= 9 && m <= 10 ? 1 : m >= 11 ? 2 : m <= 3 ? 3 : 4; };
  const schoolY = (ds) => { const y = +ds.slice(0, 4), m = +ds.slice(5, 7); return m >= 9 ? y : y - 1; };

  // ═══════════════ 3D эмодзи ═══════════════
  const SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
  const graphemes = (s) => (SEG ? Array.from(SEG.segment(s), (x) => x.segment) : Array.from(s));
  const PICT = /\p{Extended_Pictographic}/u;
  const cp = (ch) => Array.from(ch).map((c) => c.codePointAt(0)).filter((c) => c !== 0xfe0f).map((c) => c.toString(16)).join('-');
  const em = (ch, cls) => `<img class="em${cls ? ' ' + cls : ''}" src="emoji/${cp(ch)}.png" alt="${esc(ch)}" draggable="false">`;
  document.addEventListener('error', (e) => { // сурет табылмаса, телефонның өз эмодзиі
    const t = e.target;
    if (t.tagName === 'IMG' && t.classList.contains('em')) {
      const s = document.createElement('span'); s.className = t.className + ' em-txt'; s.textContent = t.alt; t.replaceWith(s);
    }
  }, true);
  function code(e, cls) {
    return `<div class="code ${cls || ''}">` + e.split(',').map((part) => '<div class="cpart">' +
      part.trim().split(/\s+/).map((g) => '<span class="cg">' +
        graphemes(g).map((ch) => (PICT.test(ch) ? em(ch) : `<span class="sym">${esc(ch)}</span>`)).join('') + '</span>').join('') +
      '</div>').join('') + '</div>';
  }

  // ═══════════════ Мазмұн құрылымы ═══════════════
  const BY = {}; THEMES.forEach((t) => { BY[t.id] = PROVERBS.filter((p) => p.k === t.id); });
  const DAYS = Math.min(...THEMES.map((t) => BY[t.id].length));
  const WEEKS = Math.floor(DAYS / 5);
  const dayProv = (d) => THEMES.map((t) => BY[t.id][d]);
  const weekProv = (w) => [0, 1, 2, 3, 4].flatMap((i) => dayProv(w * 5 + i));
  const WEEKMAP = []; ROUTE.forEach((r, ri) => { for (let i = 0; i < r.weeks; i++) WEEKMAP.push({ ri: ri, wi: i }); });
  const stopName = (d) => { const w = Math.floor(d / 5), m = WEEKMAP[w], st = ROUTE[m.ri].stops && ROUTE[m.ri].stops[m.wi]; return st ? st[d % 5] : (d % 5 + 1) + '-аялдама'; };

  // ═══════════════ Пайдаланушы ═══════════════
  const KEY = 'maqal.v2';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(KEY + '.' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(KEY + '.' + k, JSON.stringify(v)); } catch (e) { /* сақтау мүмкін емес */ } },
    del(k) { try { localStorage.removeItem(KEY + '.' + k); } catch (e) { /* */ } }
  };
  const blank = () => ({ xp: 0, asyk: 0, asykTotal: 0, streak: 0, bestStreak: 0, lastDay: null, days: {}, exams: {}, log: {}, owned: {} });
  const loadUser = (login) => Object.assign(blank(), store.get('u.' + login) || {});
  let me = null, U = null;
  const save = () => { store.set('u.' + me.login, U); pushSoon(); };

  function addLog(xp, prov) {
    const l = U.log[today()] || (U.log[today()] = { xp: 0, prov: 0, les: 0 });
    l.xp += xp; l.prov += prov || 0; if (prov) l.les++;
  }
  function earn(xp, asyk) {
    U.xp += xp; U.asyk += asyk; U.asykTotal += asyk;
    addLog(xp, 0);
  }
  function level(xp) {
    let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
    const nx = LEVELS[i + 1];
    return { i: i, name: LEVELS[i].n, next: nx, left: nx ? nx.xp - xp : 0, pct: nx ? Math.round(100 * (xp - LEVELS[i].xp) / (nx.xp - LEVELS[i].xp)) : 100 };
  }
  const streakNow = () => (U.lastDay === today() || U.lastDay === yesterday() ? U.streak : 0);

  // ═══════════════ Прогресс ═══════════════
  const doneDays = () => Object.keys(U.days).length;
  const passed = (w) => !!(U.exams[w] && U.exams[w].best >= PASS);
  const passedCount = () => { let w = 0; while (w < WEEKS && passed(w)) w++; return w; };
  function dayState(d) {
    if (U.days[d]) return 'done';
    if (d >= DAYS || d !== doneDays()) return 'lock';
    const w = Math.floor(d / 5);
    if (w > 0 && !passed(w - 1)) return 'lock';
    if (DAILY_LIMIT && !me.demo && Object.values(U.days).some((x) => x.date === today())) return 'wait';
    return 'now';
  }
  function examState(w) {
    for (let i = 0; i < 5; i++) if (!U.days[w * 5 + i]) return 'lock';
    return passed(w) ? 'done' : 'now';
  }
  const curRegion = () => WEEKMAP[Math.min(passedCount(), WEEKMAP.length - 1)].ri;

  // ═══════════════ Навигация ═══════════════
  let view = 'map', S = null, toastT = null;
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }
  function go(v) {
    S = null; view = v || view;
    document.body.classList.remove('playing');
    tabsEl.hidden = false;
    tabsEl.innerHTML = [['map', '🗺️', 'Сапар'], ['stats', '📊', 'Жетістік'], ['rank', '🏆', 'Рейтинг'], ['veh', '🐎', 'Көлік']]
      .map((t) => `<button class="${t[0] === view ? 'on' : ''}" data-go="${t[0]}">${em(t[1])}<span>${t[2]}</span></button>`).join('');
    app.innerHTML = topbar() + `<div class="page">${VIEWS[view]()}</div>`;
    window.scrollTo(0, 0);
    if (view === 'map') { const n = $('.node.now, .node.wait'); if (n) n.scrollIntoView({ block: 'center' }); }
  }
  function topbar() {
    const lv = level(U.xp);
    return `<header class="top">
      <div class="ava">${em('🐎')}</div>
      <div class="lv"><b>${lv.name}</b><div class="bar"><i style="width:${lv.pct}%"></i></div>
        <small>${lv.next ? lv.next.n + 'ға дейін ' + lv.left + ' ұпай' : 'Ең жоғары деңгей!'}</small></div>
      <div class="chip" title="Қатарынан күн">${em('🔥')}${streakNow()}</div>
      <div class="chip" title="Алтын асық">${em(ASYK)}${U.asyk}</div>
      <button class="menu" data-act="logout" title="Шығу">⎋</button>
    </header>`;
  }

  // ═══════════════ Беттер ═══════════════
  const VIEWS = {
    map() {
      const ri = curRegion(), r = ROUTE[ri], q = QUARTERS[r.q - 1];
      let h = `<div class="mapcard">${mapSvg(ri)}
        <div class="mapinfo">${em(q.icon)}<div><b>${q.name} · ${q.season}</b><span>${esc(r.name)} · көлік: ${VEHICLES[r.veh].name.toLowerCase()}</span></div>${em(VEHICLES[r.veh].icon, 'big')}</div></div>`;
      for (let w = 0; w < WEEKS; w++) {
        const m = WEEKMAP[w], reg = ROUTE[m.ri];
        h += `<div class="banner${examState(w) === 'lock' && dayState(w * 5) === 'lock' && !U.days[w * 5] ? ' off' : ''}">
          <small>${w + 1}-апта · ${QUARTERS[reg.q - 1].season}</small><h3>${esc(reg.name)}</h3><p>5 аялдама · 35 мақал · апталық емтихан</p></div><div class="path">`;
        for (let i = 0; i < 5; i++) h += node(w * 5 + i, i + w * 6);
        h += examNode(w, w * 6 + 5) + '</div>';
      }
      const nextR = WEEKMAP[WEEKS] ? ROUTE[WEEKMAP[WEEKS].ri] : null;
      if (nextR) {
        h += `<div class="banner off"><small>${WEEKS + 1}-апта · ${QUARTERS[nextR.q - 1].season}</small><h3>${esc(nextR.name)}</h3><p>Мақалдары дайындалуда</p></div>
        <div class="later">${['Айлық емтихан · 4-аптадан кейін', 'Тоқсандық емтихан · 8-аптадан кейін', 'Жылдық емтихан · 32-аптадан кейін'].map((t) => `<div>${em('🏆')}<span>${t}</span>${em('🔒')}</div>`).join('')}</div>`;
      }
      return h;
    },

    stats() {
      const lv = level(U.xp), t = today();
      const per = [['Бүгін', (d) => d === t], ['Осы ай', (d) => d.slice(0, 7) === t.slice(0, 7)],
        ['Осы тоқсан', (d) => schoolY(d) === schoolY(t) && schoolQ(d) === schoolQ(t)], ['Оқу жылы', (d) => schoolY(d) === schoolY(t)]];
      const sum = (f) => Object.keys(U.log).filter(f).reduce((a, d) => ({ xp: a.xp + U.log[d].xp, prov: a.prov + U.log[d].prov, les: a.les + U.log[d].les }), { xp: 0, prov: 0, les: 0 });
      const learned = doneDays() * 7;
      return `<div class="card lvcard">${em('🐎', 'huge')}<div><small>Деңгей ${lv.i + 1}/${LEVELS.length}</small><h2>${lv.name}</h2>
          <div class="bar"><i style="width:${lv.pct}%"></i></div><p>${U.xp} ұпай${lv.next ? ' · <b>' + lv.next.n + '</b> деңгейіне дейін ' + lv.left + ' ұпай қалды' : ''}</p></div></div>
        <div class="ladder">${LEVELS.map((l, i) => `<span class="${i < lv.i ? 'past' : i === lv.i ? 'cur' : ''}">${l.n}</span>`).join('')}</div>
        <h3 class="sec">Нәтижелерім</h3>
        <div class="periods">${per.map((p) => { const s = sum(p[1]); return `<div class="card per"><small>${p[0]}</small><b>${s.prov}</b><span>жаңа мақал</span><em>${s.xp} ұпай · ${s.les} сабақ</em></div>`; }).join('')}</div>
        <button class="card rowbtn" data-act="learned">${em('📜')}<div><b>Жаттаған мақалдарым</b><span>${learned} мақал · қайталау үшін</span></div><i>›</i></button>
        <h3 class="sec">Емтихандар</h3>
        <div class="card exams">${Array.from({ length: WEEKS }, (_, w) => {
          const x = U.exams[w];
          return `<div class="ex">${em(passed(w) ? '🏆' : x ? '🎯' : '🔒')}<div><b>${w + 1}-апталық емтихан</b><span>${x ? 'Алғашқы: ' + x.first + '% · ең жақсы: ' + x.best + '% · ' + x.tries + ' рет' : 'Әлі тапсырылған жоқ'}</span></div><em class="${passed(w) ? 'ok' : ''}">${x ? x.best + '%' : '—'}</em></div>`;
        }).join('')}${['Айлық', 'Тоқсандық', 'Жылдық'].map((n) => `<div class="ex off">${em('🔒')}<div><b>${n} емтихан</b><span>Әлі ашылған жоқ</span></div><em>—</em></div>`).join('')}</div>
        <h3 class="sec">Жетістіктер</h3>
        <div class="badges">${BADGES.map((b) => { const v = Math.min(b.val(), b.max), ok = v >= b.max; return `<div class="badge${ok ? ' ok' : ''}">${em(b.icon)}<b>${b.name}</b><span>${ok ? 'Алынды' : v + ' / ' + b.max}</span></div>`; }).join('')}</div>`;
    },

    rank() {
      const isMe = (r) => r.me;
      let rows, note;
      if (synced()) { // ортақ рейтинг серверден
        if (!RANK) { loadRank(); return '<p class="note">Рейтинг жүктелуде…</p>'; }
        if (Date.now() - RANK_T > 20000) loadRank();
        rows = RANK.map((r) => (r.me ? { name: me.name, cls: me.cls, xp: U.xp, prov: doneDays() * 7, me: true } : { name: r.name, cls: r.cls, xp: r.xp, prov: r.lessons * 7 }));
        note = 'Рейтинг барлық 7–8-сынып оқушыларын көрсетеді.';
      } else { // demo: тек осы құрылғы
        const accs = ACCOUNTS.filter((a) => !a.demo || a.login === me.login);
        if (!accs.some((a) => a.login === me.login)) accs.push(me);
        rows = accs.map((a) => {
          const u = a.login === me.login ? U : store.get('u.' + a.login);
          return { name: a.name, cls: a.cls, xp: u ? u.xp : 0, prov: u ? Object.keys(u.days || {}).length * 7 : 0, me: a.login === me.login };
        });
        note = 'Демо аккаунтта рейтинг тек осы құрылғыны көрсетеді. Жеке логинмен кірсең, барлық оқушымен жарысасың.';
      }
      rows.sort((x, y) => y.xp - x.xp || y.prov - x.prov);
      const list = (all, title, limit) => {
        const pos = all.findIndex(isMe) + 1;
        let shown = all.map((r, i) => [r, i]);
        if (limit && all.length > limit) { shown = shown.slice(0, limit); if (pos > limit) shown.push([all[pos - 1], pos - 1]); }
        return `<h3 class="sec">${title}<span>${pos ? 'сенің орның: ' + pos + ' / ' + all.length : ''}</span></h3><div class="card rank">${shown.map(([r, i]) =>
          `<div class="rr${r.me ? ' me' : ''}"><i>${i < 3 ? em(['🥇', '🥈', '🥉'][i]) : i + 1}</i><div><b>${esc(r.name)}</b><span>${esc(r.cls)} · ${r.prov} мақал</span></div><em>${r.xp}</em></div>`).join('')}</div>`;
      };
      return list(rows.filter((r) => r.cls === me.cls), 'Сыныбым · ' + esc(me.cls)) + list(rows, 'Жалпы рейтинг', 10) + `<p class="note">${note}</p>`;
    },

    veh() {
      const ri = curRegion(), r = ROUTE[ri], q = QUARTERS[r.q - 1], v = VEHICLES[r.veh], lv = level(U.xp);
      return `<div class="card vcur">${em(v.icon, 'huge')}<div><small>Қазір: ${esc(r.name)} · ${q.season}</small><h2>${v.name}</h2><p>Атың: <b>${lv.name}</b>. Деңгей өскен сайын ол да өседі.</p></div></div>
        <h3 class="sec">Мезгіл мен мекенге сай көлік</h3>
        <div class="vlist">${QUARTERS.map((qq, i) => { const vv = VEHICLES[qq.veh]; return `<div class="card vv${i === r.q - 1 ? ' cur' : ''}">${em(vv.icon, 'big')}<b>${vv.name}</b><span>${qq.name} · ${qq.season}<br>${qq.land}</span><em>тегін</em></div>`; }).join('')}</div>
        <h3 class="sec">Дүкен<span>${em(ASYK)} ${U.asyk} асық</span></h3>
        <div class="card shop">${SHOP.map((s) => `<div class="si">${em(s.icon, 'big')}<div><b>${esc(s.name)}</b><span>${em(ASYK)} ${s.price}</span></div>${U.owned[s.id]
          ? '<button class="btn sm" disabled>Сенікі ✓</button>' : `<button class="btn sm gold" data-act="buy" data-id="${s.id}" ${U.asyk < s.price ? 'disabled' : ''}>Сатып алу</button>`}</div>`).join('')}</div>
        <p class="note">Алтын асық сабақтағы әр дұрыс жауапқа, аяқталған сабаққа және өткен емтиханға беріледі.</p>`;
    }
  };

  const BADGES = [
    { icon: '👣', name: 'Алғашқы қадам', max: 1, val: () => doneDays() },
    { icon: '🔥', name: '3 күн қатарынан', max: 3, val: () => U.bestStreak },
    { icon: '🔥', name: '7 күн қатарынан', max: 7, val: () => U.bestStreak },
    { icon: '📜', name: '35 мақал', max: 35, val: () => doneDays() * 7 },
    { icon: '🏆', name: 'Апталық емтихан', max: 1, val: () => passedCount() },
    { icon: '💯', name: 'Мінсіз емтихан', max: 1, val: () => (Object.values(U.exams).some((x) => x.best === 100) ? 1 : 0) },
    { icon: '🚩', name: 'Атырау облысы', max: 2, val: () => passedCount() },
    { icon: ASYK, name: '100 алтын асық', max: 100, val: () => U.asykTotal }
  ];

  function node(d, k) {
    const st = dayState(d), OFF = [0, 52, 78, 52, 0, -52, -78, -52], off = OFF[k % 8];
    const inner = st === 'done' ? em('⭐') : st === 'now' ? `<span>${d % 5 + 1}</span>` : em(st === 'wait' ? '⏰' : '🔒');
    const sub = st === 'done' ? '7 мақал · өтті' : st === 'wait' ? 'ертең ашылады' : st === 'now' ? 'бүгінгі сабақ' : (d % 5 + 1) + '-күн';
    return `<div class="nrow${st === 'now' ? ' cur' : ''}" style="--x:${off}px">
      ${st === 'now' ? '<div class="bubble">БАСТАУ</div>' : ''}
      <button class="node ${st}" data-act="day" data-d="${d}">${inner}</button>
      <div class="nlab ${off > 0 ? 'l' : 'r'}"><b>${esc(stopName(d))}</b><small>${sub}</small></div></div>`;
  }
  function examNode(w, k) {
    const st = examState(w), OFF = [0, 52, 78, 52, 0, -52, -78, -52], off = OFF[k % 8], x = U.exams[w];
    return `<div class="nrow" style="--x:${off}px">
      <button class="node exam ${st}" data-act="exam" data-w="${w}">${em(st === 'lock' ? '🔒' : '🏆')}</button>
      <div class="nlab ${off > 0 ? 'l' : 'r'}"><b>Апталық емтихан</b><small>${x ? 'ең жақсы: ' + x.best + '%' : EXAM_N + ' сұрақ · өту шегі ' + PASS + '%'}</small></div></div>`;
  }

  function mapSvg(ri) {
    const P = (r) => [((r.lon - MAP.lon0) * MAP.kx).toFixed(1), ((MAP.lat1 - r.lat) * MAP.ky).toFixed(1)];
    const pts = ROUTE.map(P);
    // Қалалар арасындағы жол автожолдарға ұқсас аралық нүктелер (via) арқылы өтеді
    const line = (n) => ROUTE.slice(0, n + 1).flatMap((r, i) =>
      (i ? (r.via || []).map((v) => P({ lat: v[0], lon: v[1] })) : []).concat([pts[i]])).map((p) => p.join(',')).join(' ');
    const all = line(ROUTE.length - 1), done = line(ri);
    const v = VEHICLES[ROUTE[ri].veh], cur = pts[ri];
    const seen = {};
    const dots = ROUTE.map((r, i) => {
      if (seen[r.city]) return ''; seen[r.city] = 1;
      return `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="7" class="${i <= ri ? 'dd' : 'dl'}"/>`;
    }).join('');
    return `<svg class="kz" viewBox="0 0 ${MAP.w} ${MAP.h}" role="img" aria-label="Сапар картасы">
      <path d="${MAP.land}" class="land"/><path d="${MAP.lakes}" class="lake"/>
      <polyline points="${all}" class="rt"/><polyline points="${done}" class="rtd"/>${dots}
      <circle cx="${cur[0]}" cy="${cur[1]}" r="30" class="halo"/>
      <image href="emoji/${cp(v.icon)}.png" x="${cur[0] - 40}" y="${cur[1] - 70}" width="80" height="80"/>
      <text x="${+cur[0] + 44}" y="${+cur[1] + 10}" class="lbl">${esc(ROUTE[ri].city)}</text>
    </svg>`;
  }

  // ═══════════════ Сабақ пен емтихан ═══════════════
  function startLesson(d, replay) {
    const ps = dayProv(d);
    S = { kind: 'lesson', d: d, replay: replay, ps: ps, stages: STAGES.map((st) => shuffle(ps).map((p) => ({ type: st.type, p: p }))), si: 0, done: 0, total: ps.length * STAGES.length, xp: 0, asyk: 0, first: 0, answered: 0, st: STAGES.map(() => 0) };
    S.queue = S.stages[0].slice();
    stageIntro();
  }
  function startExam(w) {
    const types = ['tany', 'qura', 'tusin', 'qoldan'];
    const qs = pick(weekProv(w), Math.min(EXAM_N, 35)).map((p, i) => ({ type: types[i % 4], p: p }));
    S = { kind: 'exam', w: w, pool: weekProv(w), queue: shuffle(qs), done: 0, total: qs.length, right: 0, wrong: [] };
    enterPlay();
    ask();
  }
  function enterPlay() { document.body.classList.add('playing'); tabsEl.hidden = true; }

  function stageIntro() {
    enterPlay();
    const st = STAGES[S.si];
    app.innerHTML = `<div class="play intro">${head()}
      <div class="introbody">${em(st.icon, 'huge')}<small>${S.si + 1}-кезең · ${S.replay ? 'қайталау' : esc(stopName(S.d))}</small><h2>${st.name}</h2><p>${st.desc}</p>
        ${S.si === 0 ? `<div class="today7">Бүгін <b>7 мақал</b> 4 кезеңнен өтеді: ${STAGES.map((x) => x.name).join(' → ')}</div>` : ''}</div>
      <div class="foot"><button class="btn primary wide" data-act="go-stage">БАСТАУ</button></div></div>`;
  }
  function head() {
    const bars = S.kind === 'lesson'
      ? `<div class="segs">${STAGES.map((st, i) => `<div><i style="width:${i < S.si ? 100 : i > S.si ? 0 : Math.round(100 * (S.ps.length - S.queue.length) / S.ps.length)}%"></i></div>`).join('')}</div>`
      : `<div class="segs one"><div><i style="width:${Math.round(100 * S.done / S.total)}%"></i></div></div>`;
    return `<div class="phead"><button class="x" data-act="quit" aria-label="Шығу">✕</button>${bars}<div class="chip">${em(ASYK)}${U.asyk + (S.asyk || 0)}</div></div>`;
  }

  function ask() {
    const it = S.queue[0], p = it.p, others = PROVERBS.filter((x) => x.id !== p.id);
    const pool = (S.kind === 'lesson' ? S.ps : S.pool).filter((x) => x.id !== p.id);
    const st = STAGES.find((x) => x.type === it.type);
    let body = '';
    S.cur = { it: it };
    const opts = (list, f) => `<div class="opts">${list.map((o, i) => `<button class="opt" data-act="opt" data-i="${i}">${f(o)}</button>`).join('')}</div>`;
    if (it.type === 'tany') {
      S.cur.opts = shuffle([p].concat(pick(others, 3)));
      body = code(p.e) + opts(S.cur.opts, (o) => esc(o.t));
    } else if (it.type === 'tusin') {
      S.cur.opts = shuffle([p].concat(pick(others.filter((o) => o.k !== p.k), 2)));
      body = code(p.e, 'sm') + `<div class="ptext">${esc(p.t)}</div>` + opts(S.cur.opts, (o) => esc(o.m));
    } else if (it.type === 'qoldan') {
      S.cur.opts = shuffle([p].concat(pick(pool, 2)));
      body = `<div class="situ">${em('🧑')}<p>${esc(p.s)}</p></div>` + opts(S.cur.opts, (o) => esc(o.t));
    } else { // qura
      const w = words(p.t);
      const extra = Array.from(new Set(pick(others, 4).flatMap((o) => words(o.t)).filter((x) => !w.includes(x))));
      S.cur.words = w; S.cur.tiles = shuffle(w.concat(pick(extra, 2))); S.cur.placed = [];
      body = code(p.e) + '<div id="qura"></div>';
    }
    app.innerHTML = `<div class="play">${head()}
      <div class="pbody"><div class="pmeta"><span class="pill">${S.kind === 'exam' ? 'ЕМТИХАН' : (S.si + 1) + '-КЕЗЕҢ'} · ${st.name.toUpperCase()}</span><span>${S.kind === 'exam' ? (S.done + 1) + ' / ' + S.total : (S.ps.length - S.queue.length + 1 > S.ps.length ? S.ps.length : S.ps.length - S.queue.length + 1) + ' / ' + S.ps.length + ' мақал'}</span></div>
        <h2>${st.ask}</h2>${body}</div><div class="foot" id="foot"></div></div>`;
    if (it.type === 'qura') drawQura();
    window.scrollTo(0, 0);
  }
  function drawQura() {
    const c = S.cur, used = new Set(c.placed);
    $('#qura').innerHTML = `<div class="slots">${c.placed.map((ti, i) => `<button class="tile" data-act="unplace" data-i="${i}">${esc(c.tiles[ti])}</button>`).join('') || '<span class="ph">Сөздерді ретімен басып шық…</span>'}</div>
      <div class="bank">${c.tiles.map((w, ti) => `<button class="tile" data-act="place" data-i="${ti}" ${used.has(ti) ? 'disabled' : ''}>${esc(w)}</button>`).join('')}</div>`;
    $('#foot').innerHTML = `<button class="btn primary wide" data-act="check" ${c.placed.length ? '' : 'disabled'}>ТЕКСЕРУ</button>`;
  }

  function answer(ok) {
    const c = S.cur, p = c.it.p;
    if (c.done) return; c.done = true;
    const pb = $('.pbody'); if (pb) pb.classList.add('locked');
    let gain = '';
    if (S.kind === 'lesson') {
      if (ok && !c.it.missed) {
        S.st[S.si]++;
        const xp = S.replay ? 2 : 10, as = S.replay ? 0 : 1;
        S.xp += xp; S.asyk += as; S.first++; gain = `+${xp} ұпай` + (as ? ` · ${em(ASYK)}+${as}` : '');
      }
      if (!ok) c.it.missed = true;
    } else {
      S.done++;
      if (ok) S.right++; else S.wrong.push(p);
    }
    $('#foot').innerHTML = `<div class="sheet ${ok ? 'ok' : 'bad'}">
      <div class="shr"><b>${ok ? '✓ Дұрыс!' : '✗ Дұрыс жауабы:'}</b><span>${gain}</span></div>
      ${ok ? '' : `<div class="shp">${esc(p.t)}</div>`}<div class="shm">${esc(p.m)}</div>
      <button class="btn ${ok ? 'ok' : 'bad'} wide" data-act="next">ЖАЛҒАСТЫРУ</button></div>`;
    $('#foot [data-act=next]').focus();
  }

  function next() {
    const it = S.queue.shift();
    if (S.kind === 'exam') return S.queue.length ? ask() : finishExam();
    if (it.missed && !it.requeued) { it.requeued = true; S.queue.push(it); } // қате кеткен мақал кезеңнің соңында қайталанады
    if (S.queue.length) return ask();
    S.si++;
    if (S.si < STAGES.length) { S.queue = S.stages[S.si].slice(); return stageIntro(); }
    finishLesson();
  }

  function finishLesson() {
    const d = S.d, first = !S.replay;
    let bonus = 0;
    if (first) {
      bonus = 5;
      U.days[d] = { date: today(), xp: S.xp };
      if (U.lastDay !== today()) U.streak = U.lastDay === yesterday() ? U.streak + 1 : 1;
      U.lastDay = today(); U.bestStreak = Math.max(U.bestStreak, U.streak);
      addLog(0, 7);
    }
    earn(S.xp, S.asyk + bonus); save();
    const acc = Math.round(100 * S.first / S.total);
    const ask4 = first && SURVEY_ON && SURVEY.lesson && SURVEY.lesson.length > 0;
    if (ask4) SV = { kind: 'lesson', qs: SURVEY.lesson, lesson: d + 1, score: S.first, total: S.total, stages: S.st.slice(), cls: svCls(), a: {} };
    app.innerHTML = `<div class="play done">
      <div class="result">${em(first ? '🏆' : '⭐', 'huge')}<h2>${esc(stopName(d))} ${first ? 'аялдамасы өтілді!' : '— қайталау аяқталды'}</h2>
        <div class="rstats"><div><b>${S.xp}</b><span>ұпай</span></div><div><b>${em(ASYK)}${S.asyk + bonus}</b><span>асық</span></div><div><b>${acc}%</b><span>дәлдік</span></div><div><b>${em('🔥')}${streakNow()}</b><span>күн</span></div></div></div>
      <h3 class="sec">Бүгінгі 7 мақал</h3>${provList(S.ps)}
      <div class="foot">${ask4 ? '<button class="btn primary wide" data-act="survey">ЖАЛҒАСТЫРУ</button>' : '<button class="btn primary wide" data-act="tomap">КАРТАҒА ОРАЛУ</button>'}</div></div>`;
    S = null; window.scrollTo(0, 0);
  }

  function finishExam() {
    const w = S.w, pct = Math.round(100 * S.right / S.total);
    const x = U.exams[w] || (U.exams[w] = { first: pct, best: 0, bestRight: 0, tries: 0 });
    const wasPassed = x.best >= PASS, perfectBefore = x.best === 100;
    x.tries++;
    const xp = Math.max(0, S.right - (x.bestRight || 0)) * 10;
    let as = 0;
    if (pct >= PASS && !wasPassed) as += 10;
    if (pct === 100 && !perfectBefore) as += 5;
    x.best = Math.max(x.best, pct); x.bestRight = Math.max(x.bestRight || 0, S.right);
    earn(xp, as); save();
    const ok = pct >= PASS;
    app.innerHTML = `<div class="play done">
      <div class="result">${em(ok ? '🏆' : '🎯', 'huge')}<h2>${w + 1}-апталық емтихан: ${pct}%</h2>
        <p>${ok ? (wasPassed ? 'Жақсы қайталау!' : 'Құттықтаймыз! Келесі аптаның жолы ашылды.') : 'Өту шегі — ' + PASS + '%. Қателерді қарап шығып, қайта тапсыр.'}</p>
        <div class="rstats"><div><b>${S.right}/${S.total}</b><span>дұрыс</span></div><div><b>${xp}</b><span>ұпай</span></div><div><b>${em(ASYK)}${as}</b><span>асық</span></div></div></div>
      ${S.wrong.length ? '<h3 class="sec">Қате кеткен мақалдар</h3>' + provList(S.wrong) : ''}
      <div class="foot">${ok ? '' : `<button class="btn wide" data-act="exam" data-w="${w}">ҚАЙТА ТАПСЫРУ</button>`}<button class="btn primary wide" data-act="tomap">КАРТАҒА ОРАЛУ</button></div></div>`;
    S = null; window.scrollTo(0, 0);
  }

  const provList = (ps) => `<div class="plist">${ps.map((p) => `<div class="card pi">${code(p.e, 'xs')}<b>${esc(p.t)}</b><span>${esc(p.m)}</span></div>`).join('')}</div>`;

  // ═══════════════ Сервер мен сауалнама ═══════════════
  // Сауалнамада есім мен логин жіберілмейді: тек түрі (start/lesson), сынып, сабақ нәтижесі және жауаптар.
  const ONLINE = typeof SERVER !== 'undefined' && SERVER.url && SERVER.key;
  const SURVEY_ON = ONLINE && typeof SURVEY !== 'undefined' && SURVEY.on;
  let SV = null;
  async function api(path, body) {
    const r = await fetch(SERVER.url + '/rest/v1/' + path, {
      method: 'POST',
      headers: { apikey: SERVER.key, Authorization: 'Bearer ' + SERVER.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  // ═══════════════ Прогресті серверде сақтау ═══════════════
  // Әр сабақ/емтихан/сатып алудан кейін прогресс оқушының логинімен серверге жазылады.
  // Кіргенде сервердегі мен телефондағы прогрестің қайсысы алда болса, сол алынады.
  const synced = () => !!(ONLINE && me && me.token && !me.teacher);
  let syncT = null, syncing = false, RANK = null, RANK_T = 0;
  function pushSoon() {
    if (!synced()) return;
    store.set('dirty.' + me.login, true);
    clearTimeout(syncT); syncT = setTimeout(push, 800);
  }
  async function push() {
    if (!synced() || syncing) return;
    syncing = true;
    const who = me.login;
    try {
      const ok = await api('rpc/save_progress', { p_token: me.token, p_data: U });
      if (ok === false) return relogin();
      if (me && me.login === who) store.del('dirty.' + who);
    } catch (e) { /* интернет жоқ: келесі сақтауда немесе кіргенде жіберіледі */ } finally { syncing = false; }
  }
  const pscore = (u) => Object.keys((u && u.days) || {}).length * 1e6 + ((u && u.xp) || 0);
  async function pull() {
    const r = await api('rpc/load_progress', { p_token: me.token });
    if (!r) return relogin();
    const srv = r.data;
    if (srv && pscore(srv) > pscore(U)) { U = Object.assign(blank(), srv); store.set('u.' + me.login, U); store.del('dirty.' + me.login); return; }
    if (!srv || pscore(U) > pscore(srv) || store.get('dirty.' + me.login)) await push();
  }
  async function loadRank() {
    try {
      const r = await api('rpc/get_rank', { p_token: me.token });
      if (!r) return relogin();
      RANK = r; RANK_T = Date.now();
      if (view === 'rank' && !S && !SV && me && !document.body.classList.contains('playing')) go('rank');
    } catch (e) { RANK_T = Date.now(); }
  }
  function relogin() {
    store.del('session'); me = null; U = null; RANK = null;
    loginView('Логин мен құпия сөзіңді қайта енгіз.');
  }

  const svCls = () => (me.demo ? store.get('survey.cls') || '' : me.cls);
  function surveyView() {
    const askCls = me.demo, n0 = askCls ? 2 : 1;
    const chips = (qid, list) => `<div class="svopts">${list.map((v) => `<button type="button" class="opt sv${SV.a[qid] === v || (qid === '_cls' && SV.cls === v) ? ' on' : ''}" data-act="sv" data-q="${esc(qid)}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
    const qs = SV.qs.map((q, i) => `<div class="card svq"><b>${i + n0}. ${esc(q.q)}</b>${q.type === 'text'
      ? `<textarea id="sv-${esc(q.id)}" maxlength="500" rows="3">${esc(SV.a[q.id] || '')}</textarea>`
      : chips(q.id, q.opts)}</div>`).join('');
    const ready = SV.cls && SV.qs.every((q) => q.type === 'text' || SV.a[q.id]);
    const start = SV.kind === 'start';
    app.innerHTML = `<div class="play done survey">
      <div class="result">${em('📝', 'huge')}<h2>${start ? 'Сапар алдында бірнеше сұрақ' : 'Бір минуттық сауалнама'}</h2><p>${start ? 'Жауабың жобаны жақсартуға көмектеседі.' : 'Сабақ туралы пікірің маңызды.'} Атың жазылмайды.</p></div>
      <div class="svlist">${askCls ? `<div class="card svq"><b>1. Сыныбың</b>${chips('_cls', SURVEY.classes)}</div>` : ''}${qs}</div>
      <div class="foot"><button class="btn primary wide" data-act="sv-send" ${ready ? '' : 'disabled'}>${start ? 'ЖІБЕРІП, САПАРҒА ШЫҒУ' : 'ЖІБЕРУ'}</button><button class="btn wide" data-act="sv-skip">Өткізіп жіберу</button></div></div>`;
  }
  function svKeepText() {
    SV.qs.forEach((q) => { const t = $('#sv-' + q.id); if (t) SV.a[q.id] = t.value.trim(); });
  }
  function svDone(how) { // сауалнамадан кейін картаға
    if (SV && SV.kind === 'start') { U.startSurvey = how; save(); }
    SV = null; go('map');
  }
  async function svFlush() { // интернет болмай жіберілмей қалғандарын қайта жіберу
    const pend = store.get('survey.pending') || [];
    if (!pend.length || !SURVEY_ON) return;
    const left = [];
    for (const row of pend) { try { await api('survey', row); } catch (e) { left.push(row); } }
    store.set('survey.pending', left);
  }
  async function svSend() {
    svKeepText();
    const row = { kind: SV.kind, cls: SV.cls, lesson: SV.lesson || null, score: SV.score == null ? null : SV.score, stages: SV.stages ? { total: SV.total, by_stage: SV.stages } : null, answers: SV.a };
    if (me.demo) store.set('survey.cls', SV.cls);
    svDone('sent');
    try { await api('survey', row); toast('Рахмет! Жауабың жіберілді.'); } catch (e) {
      const pend = store.get('survey.pending') || []; pend.push(row); store.set('survey.pending', pend);
      toast('Рахмет! Интернет қосылғанда жауабың өзі жіберіледі.');
    }
  }

  // ═══════════════ Мұғалім беті ═══════════════
  // Мұғалім логинімен кіргенде: сынып оқушыларының прогресі (өз сыныбы немесе admin — барлығы).
  let TR = null;
  const TF = { cls: '', per: 'all', sort: '', dir: 1 };
  // Бағандар: [кілт, атауы, сұрыптау мәні]. Мәтін — А→Я, сандар — үлкенінен бастап.
  const TCOLS = [['name', 'Оқушы', (r) => r.name], ['cls', 'Сынып', (r) => r.cls], ['les', 'Сабақ', (r) => r.les], ['prov', 'Мақал', (r) => r.prov],
    ['xp', 'Ұпай', (r) => r.xp], ['lv', 'Деңгей', (r) => r.lvl], ['ex', 'Емтихандар (ең жақсы)', (r) => r.exSum], ['last', 'Соңғы белсенділік', (r) => (r.started && r.last ? r.last.getTime() : 0)]];
  const TPER = [['all', 'Барлық уақыт'], ['today', 'Бүгін'], ['week', 'Соңғы 7 күн'], ['month', 'Осы ай']];
  function teacherStart(acc) {
    me = { teacher: true, login: acc.login, name: acc.name, cls: acc.cls || null, token: acc.token };
    U = null; store.set('session', me); TF.cls = me.cls || '';
    document.body.classList.add('playing', 'teacher'); tabsEl.hidden = true;
    teacherLoad();
  }
  async function teacherLoad() {
    app.innerHTML = '<div class="loading">Нәтижелер жүктелуде…</div>';
    try {
      const r = await api('rpc/teacher_report', { p_token: me.token });
      if (!r) { document.body.classList.remove('teacher'); return relogin(); }
      TR = r; teacherView();
    } catch (e) {
      app.innerHTML = '<div class="tview"><p class="err">Серверге қосылу мүмкін болмады.</p><button class="btn" data-act="tr-reload">Қайта көру</button> <button class="btn" data-act="logout">Шығу</button></div>';
    }
  }
  function inPer(ds) {
    const t = today();
    if (TF.per === 'today') return ds === t;
    if (TF.per === 'week') return ds > dstr(new Date(Date.now() - 7 * 864e5));
    if (TF.per === 'month') return ds.slice(0, 7) === t.slice(0, 7);
    return true;
  }
  function trRows() {
    const rows = TR.filter((p) => !TF.cls || p.cls === TF.cls).map((p) => {
      const d = p.data || {}, log = d.log || {};
      let les = 0, prov = 0, xp = 0;
      if (TF.per === 'all') { les = Object.keys(d.days || {}).length; prov = les * 7; xp = d.xp || 0; }
      else Object.keys(log).filter(inPer).forEach((k) => { les += log[k].les || 0; prov += log[k].prov || 0; xp += log[k].xp || 0; });
      const ex = Object.keys(d.exams || {}).sort((a, b) => a - b).map((w) => (+w + 1) + '-апта: ' + d.exams[w].best + '%');
      const exSum = Object.keys(d.exams || {}).reduce((a, w) => a + (d.exams[w].best || 0), 0);
      return { name: p.name, login: p.login, cls: p.cls, les: les, prov: prov, xp: xp, lv: p.data ? level(d.xp || 0).name : '—', lvl: p.data ? d.xp || 0 : -1, ex: ex.join(', '), exSum: exSum, last: p.updated ? new Date(p.updated) : null, started: !!p.data };
    });
    const col = TCOLS.find((c) => c[0] === TF.sort);
    if (!col) return rows.sort((a, b) => a.cls.localeCompare(b.cls) || b.xp - a.xp || a.name.localeCompare(b.name, 'kk'));
    return rows.sort((a, b) => {
      const x = col[2](a), y = col[2](b);
      const c = typeof x === 'string' ? x.localeCompare(y, 'kk') : x - y;
      return c * TF.dir || a.name.localeCompare(b.name, 'kk');
    });
  }
  const tfmt = (dt) => (dt ? pad(dt.getDate()) + '.' + pad(dt.getMonth() + 1) + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) : '—');
  function teacherView() {
    const rows = trRows(), classes = Array.from(new Set(TR.map((p) => p.cls))).sort();
    const started = rows.filter((r) => r.started).length, active = rows.filter((r) => r.les > 0).length;
    const avg = rows.length ? (rows.reduce((a, r) => a + r.les, 0) / rows.length).toFixed(1) : 0;
    const perName = TPER.find((p) => p[0] === TF.per)[1].toLowerCase();
    const chip = (k, v, label) => `<button type="button" class="opt sv${TF[k] === v ? ' on' : ''}" data-act="tr-f" data-k="${k}" data-v="${esc(v)}">${esc(label)}</button>`;
    app.innerHTML = `<div class="tview">
      <header class="thead"><div><small>Мұғалім беті · ${esc(APP_NAME)}</small><h2>${esc(me.name)}</h2></div><button class="btn sm" data-act="tr-reload">Жаңарту</button><button class="btn sm" data-act="logout">Шығу</button></header>
      ${me.cls ? '' : `<div class="svopts">${chip('cls', '', 'Барлық сынып')}${classes.map((c) => chip('cls', c, c)).join('')}</div>`}
      <div class="svopts">${TPER.map((p) => chip('per', p[0], p[1])).join('')}</div>
      <div class="tsum"><div class="card"><b>${rows.length}</b><span>оқушы</span></div><div class="card"><b>${started}</b><span>сайтқа кірді</span></div>
        <div class="card"><b>${active}</b><span>сабақ өтті · ${esc(perName)}</span></div><div class="card"><b>${avg}</b><span>бір оқушыға орташа сабақ</span></div></div>
      <div class="twrap"><table class="ttab"><thead><tr><th>№</th>${TCOLS.map((c) => `<th class="srt${TF.sort === c[0] ? ' on' : ''}" data-act="tr-sort" data-k="${c[0]}" title="Сұрыптау">${c[1]}<i>${TF.sort === c[0] ? (TF.dir > 0 ? '▲' : '▼') : '⇅'}</i></th>`).join('')}</tr></thead><tbody>
      ${rows.map((r, i) => `<tr class="${r.started ? '' : 'off'}"><td>${i + 1}</td><td><b>${esc(r.name)}</b><small>${esc(r.login)}</small></td><td>${esc(r.cls)}</td><td>${r.les}</td><td>${r.prov}</td><td>${r.xp}</td><td>${r.lv}</td><td>${esc(r.ex || '—')}</td><td>${r.started ? tfmt(r.last) : 'кірмеген'}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="tfoot"><button class="btn primary" data-act="tr-csv">Excel-ге жүктеу (CSV)</button>
        <p class="note">Сабақ, мақал және ұпай таңдалған кезең бойынша есептеледі. «Кірмеген» — жеке логинмен әлі кірмеген оқушы. Нәтиже оқушы әр сабақты бітірген сайын жаңарады; бетті жаңарту үшін «Жаңарту» батырмасын басыңыз.</p></div></div>`;
  }
  function teacherCsv() {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [['Оқушы', 'Логин', 'Сынып', 'Сабақ', 'Мақал', 'Ұпай', 'Деңгей', 'Емтихандар', 'Соңғы белсенділік'].map(q).join(';')]
      .concat(trRows().map((r) => [r.name, r.login, r.cls, r.les, r.prov, r.xp, r.lv, r.ex, r.started ? tfmt(r.last) : 'кірмеген'].map(q).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'maqal-natizheler-' + (TF.cls || 'barlygy') + '-' + TF.per + '-' + today() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ═══════════════ Кіру ═══════════════
  function loginView(msg) {
    document.body.classList.add('playing'); tabsEl.hidden = true;
    app.innerHTML = `<div class="login">
      <div class="lhero"><svg class="kz" viewBox="0 0 ${MAP.w} ${MAP.h}"><path d="${MAP.land}" class="land"/><path d="${MAP.lakes}" class="lake"/></svg>
        <h1>${esc(APP_NAME)}</h1><p>Эмодзиде жасырылған мақалдарды шешіп, Қазақстанды арала</p></div>
      <form class="card lform" id="lform" autocomplete="off">
        <label>Логин<input id="lg" autocapitalize="off" spellcheck="false" required></label>
        <label>Құпия сөз<input id="pw" type="password" required></label>
        <p class="err">${esc(msg || '')}</p>
        <button class="btn primary wide">КІРУ</button>
        <p class="hint">Логин мен құпия сөзді мұғалімің береді.</p>
      </form></div>`;
  }
  async function login(acc) {
    if (acc.teacher) return teacherStart(acc);
    me = { login: acc.login, name: acc.name, cls: acc.cls, demo: !!acc.demo, token: acc.token || null }; U = loadUser(me.login);
    RANK = null;
    if (!me.demo && ONLINE && !me.token) return relogin(); // ескі нұсқадағы сессия: бір рет қайта кіру керек
    store.set('session', me);
    if (synced()) {
      app.innerHTML = '<div class="loading">Жүктелуде…</div>';
      try { await pull(); } catch (e) { /* интернет жоқ: телефондағы прогреспен жалғастырамыз */ }
      if (!me) return;
    }
    if (SURVEY_ON && SURVEY.start && SURVEY.start.length && !U.startSurvey) {
      SV = { kind: 'start', qs: SURVEY.start, cls: svCls(), a: {} };
      return surveyView();
    }
    go('map');
  }

  // ═══════════════ Оқиғалар ═══════════════
  const ACT = {
    day(d) {
      const n = +d.d, st = dayState(n);
      if (st === 'now') return startLesson(n, false);
      if (st === 'done') return startLesson(n, true);
      if (st === 'wait') return toast('Күніне бір жаңа сабақ ашылады. Келесісі ертең! Өткен сабақтарды қайталай аласың.');
      const w = Math.floor(n / 5);
      toast(w > 0 && !passed(w - 1) && n === doneDays() ? 'Алдымен апталық емтиханнан өт.' : 'Бұл аялдамаға әлі жеткен жоқсың.');
    },
    exam(d) {
      const w = +d.w;
      if (examState(w) === 'lock') return toast('Емтихан аптаның 5 сабағы өткен соң ашылады.');
      startExam(w);
    },
    'go-stage'() { ask(); },
    quit() { if (confirm('Сабақтан шығасың ба? Бұл сабақтың нәтижесі сақталмайды.')) go('map'); },
    opt(d, el) {
      if (S.cur.done) return;
      const ok = S.cur.opts[+d.i] === S.cur.it.p;
      document.querySelectorAll('.opt').forEach((b, j) => { if (S.cur.opts[j] === S.cur.it.p) b.classList.add('right'); });
      if (!ok) el.classList.add('wrong');
      answer(ok);
    },
    place(d) { if (!S.cur.done) { S.cur.placed.push(+d.i); drawQura(); } },
    unplace(d) { if (!S.cur.done) { S.cur.placed.splice(+d.i, 1); drawQura(); } },
    check() {
      const c = S.cur;
      const ok = c.placed.map((ti) => c.tiles[ti]).join(' ') === c.words.join(' ');
      if (!ok) { const s = $('.slots'); s.classList.add('shake'); }
      answer(ok);
    },
    next() { next(); },
    tomap() { go('map'); },
    survey() { if (SV) surveyView(); else go('map'); },
    sv(d) {
      svKeepText();
      if (d.q === '_cls') SV.cls = d.v; else SV.a[d.q] = d.v;
      const y = window.scrollY; surveyView(); window.scrollTo(0, y);
    },
    'sv-send'() { if (SV) svSend(); },
    'sv-skip'() { svDone('skipped'); },
    learned() {
      const ps = Object.keys(U.days).map(Number).sort((a, b) => a - b).flatMap(dayProv);
      app.innerHTML = topbar() + `<div class="page"><button class="back" data-go="stats">‹ Жетістік</button><h3 class="sec">Жаттаған мақалдарым · ${ps.length}</h3>${ps.length ? provList(ps) : '<p class="note">Алғашқы сабақты өткен соң мақалдар осында жиналады.</p>'}</div>`;
      window.scrollTo(0, 0);
    },
    buy(d) {
      const s = SHOP.find((x) => x.id === d.id);
      if (!s || U.owned[s.id] || U.asyk < s.price) return;
      U.asyk -= s.price; U.owned[s.id] = today(); save();
      toast(s.name + ' — сенікі!'); go('veh');
    },
    logout() { if (confirm('Аккаунттан шығасың ба?')) { if (synced()) push(); store.del('session'); me = null; U = null; RANK = null; TR = null; document.body.classList.remove('teacher'); loginView(); } },
    'tr-f'(d) { TF[d.k] = d.v; teacherView(); },
    'tr-sort'(d) { // бір басу — сұрыптау, қайта басу — кері рет
      if (TF.sort === d.k) TF.dir = -TF.dir;
      else { TF.sort = d.k; TF.dir = ['name', 'cls'].includes(d.k) ? 1 : -1; }
      teacherView();
    },
    'tr-csv'() { teacherCsv(); },
    'tr-reload'() { teacherLoad(); }
  };

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) return go(g.dataset.go);
    const a = e.target.closest('[data-act]');
    if (a && !a.disabled && ACT[a.dataset.act]) ACT[a.dataset.act](a.dataset, a);
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'lform') return;
    e.preventDefault();
    const l = $('#lg').value.trim().toLowerCase(), p = $('#pw').value;
    const bad = 'Логин немесе құпия сөз қате.';
    const a = ACCOUNTS.find((x) => x.login.toLowerCase() === l);
    if (a) return a.pass === p ? login(a) : loginView(bad);
    if (!ONLINE) return loginView(bad);
    const btn = $('#lform button'); btn.disabled = true; btn.textContent = 'ТЕКСЕРІЛУДЕ…';
    try {
      const r = await api('rpc/pupil_login', { p_login: l, p_pass: p });
      if (r && r.login) return login(r);
      const t = await api('rpc/teacher_login', { p_login: l, p_pass: p });
      if (t && t.login) return teacherStart(t);
      loginView(bad);
    } catch (err) { loginView('Серверге қосылу мүмкін болмады. Интернетті тексеріп, қайта байқап көр.'); }
  });

  // ═══════════════ Іске қосу ═══════════════
  document.title = APP_NAME;
  let sess = store.get('session');
  if (typeof sess === 'string') sess = ACCOUNTS.find((a) => a.login === sess); // ескі нұсқадан қалған сессия
  if (sess && sess.teacher && sess.token) teacherStart(sess);
  else if (sess && sess.login) login(sess); else loginView();
  svFlush();
})();
