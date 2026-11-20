/* BD Tesla Slapper — lobby layer: update line, online/total counters, player card, World Chat, live game config.
   Talks to the backend at window.LB_API_URL (config.js). Everything here is optional: if the server is down the game plays normally. */
(function () {
  'use strict';
  var API = (window.LB_API_URL || '').replace(/\/+$/, '');
  var $ = function (id) { return document.getElementById(id); };
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var PID = (function () {
    var p = ls.get('tt_pid');
    if (!/^[0-9a-f]{24}$/.test(p || '')) {
      try { p = Array.from(crypto.getRandomValues(new Uint8Array(12)), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); } catch (e) { p = ''; for (var i = 0; i < 24; i++) p += Math.floor(Math.random() * 16).toString(16); }
      ls.set('tt_pid', p);
    }
    return p;
  })();

  function FB() { return window.TTFirebase || null; }
  function call(a, body, ms) {
    if (!API) return Promise.resolve(null);
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ctl && setTimeout(function () { ctl.abort(); }, ms || 8000);
    var url = API + (API.indexOf('?') > -1 ? '&' : '?') + 'a=' + a;
    var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' };
    if (ctl) opt.signal = ctl.signal;
    return fetch(url, opt).then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (d) { clearTimeout(to); return d; });
  }

  /* ---------------- config (cached, so the game has the admin's rules from the very first frame) ---------------- */
  var DEF = { cv: 0, chat: { enabled: true, title: 'World Chat', subtitle: 'BD Tesla Slapper Community 🌍', rules: '', placeholder: 'Type a message…', off_text: '', icon_side: 'right', theme: 'neon', accent: '#ffc23d', show_online: true, show_typing: true, cooldown: 3, max_chars: 300, max_lines: 4, history: 150, poll_ms: 2500, name_min: 2, name_max: 16, allow_rename: true, emojis: ['🙂', '😂', '😍', '🔥', '👏', '😎', '😡', '🤣', '👍', '😭', '🤝', '🙏', '💀', '😅', '🫡'] },
    notice: { enabled: true, texts: [], show_players: true, player_template: '🏆 {name} scored {score}', gap: 5, speed: 70, direction: 'rtl', bg: '#0b1a12', color: '#ffe08a', label: 'UPDATE' }, game: {}, site: { lobby_stats: true, lobby_player: true }, avatars: [] };
  var cfg = DEF;
  try { var c0 = JSON.parse(ls.get('tt_cfg')); if (c0 && c0.chat) cfg = c0; } catch (e) {}
  window.TTCFG = cfg;
  function loadConfig() {
    return call('config').then(function (d) {
      if (d && d.ok) { cfg = d; window.TTCFG = d; ls.set('tt_cfg', JSON.stringify(d)); applyConfig(); }
      return cfg;
    });
  }

  /* ---------------- tiny i18n ---------------- */
  var S = {
    name: ['তোমার নাম', 'Your name'], join: ['যোগ দাও', 'Join chat'], joinT: ['চ্যাটে যোগ দাও', 'Join the chat'],
    nameHelp: ['নামের সাথে একটা র‍্যান্ডম নম্বর জুড়ে তোমার ইউজারনেম বানানো হবে।', 'A random number is added to your name to make your username.'],
    errName: ['নাম ঠিক নেই — কমপক্ষে ২ অক্ষর, খারাপ শব্দ বা লিংক চলবে না।', 'Invalid name — min 2 letters, no bad words or links.'],
    errNet: ['সার্ভারে যাচ্ছে না, আবার চেষ্টা করো।', "Can't reach the server, try again."],
    send: ['পাঠাও', 'Send'], online: ['অনলাইন', 'online'], typing: ['লিখছে…', 'typing…'], newMsgs: ['নতুন মেসেজ ↓', 'New messages ↓'],
    pic: ['ছবি বদলাও', 'Change picture'], noPic: ['নেই', 'None'], rename: ['নাম বদলাও', 'Rename'], save: ['সেভ', 'Save'],
    empty: ['এখনো কোনো মেসেজ নেই — প্রথম হাই তুমিই দাও! 👋', 'No messages yet — say hi first! 👋'],
    rules: ['নিয়ম', 'Rules'], ok: ['বুঝেছি', 'Got it'], you: ['তুমি', 'You'], loading: ['লোড হচ্ছে…', 'Loading…'],
    cool: ['একটু অপেক্ষা করো ({0}s)', 'Wait {0}s'], repeat: ['একই মেসেজ বারবার নয়', "Don't repeat the same message"], long: ['মেসেজ অনেক বড়', 'Message too long'],
    lines: ['লাইন বেশি হয়ে গেছে', 'Too many lines'], slow: ['খুব দ্রুত পাঠাচ্ছো, একটু থামো', 'Slow down a little'], empty2: ['কিছু লেখো', 'Type something'],
    banned: ['তোমাকে চ্যাট থেকে ব্যান করা হয়েছে', 'You are banned from chat'], until: ['পর্যন্ত', 'until'], perm: ['স্থায়ীভাবে', 'permanently'],
    offline: ['চ্যাট সার্ভারে সংযোগ নেই', 'Chat server unreachable'], best: ['বেস্ট', 'Best'], coins: ['কয়েন', 'Coins'], close: ['বন্ধ', 'Close'], offChat: ['ইন্টারনেট নেই — আগের মেসেজ দেখাচ্ছে', 'Offline — showing saved messages'], sync: ['সেভ করা স্কোর সার্ভারে যাচ্ছে', 'Saved scores waiting to sync'],
    playersTitle: ['নিবন্ধিত প্লেয়ার তালিকা', 'Registered Players'], playersSub: ['সবার স্থায়ী প্লেয়ার নম্বর ও স্কোর (কখনো ডিলিট হবে না)', 'Permanent Player Numbers & Best Scores (Never Deleted)'],
    playersEmpty: ['এখনো কোনো প্লেয়ার নিবন্ধিত হয়নি', 'No registered players yet'],
    signInGoogle: ['Google দিয়ে লগইন', 'Sign in with Google'], signInHelp: ['তোমার স্থায়ী প্লেয়ার নম্বর (#), চ্যাট মেসেজ এবং লিডারবোর্ড স্কোর চিরতরে সেভ রাখতে Google দিয়ে লগইন করো।', 'Sign in with Google to claim your permanent Player # and save chat messages & leaderboard scores forever.'],
    signOut: ['লগআউট', 'Sign out'], signInToChat: ['চ্যাটে লিখতে Google লগইন করো', 'Sign in with Google to send messages'],
    errDomain: ['এই ডোমেইন ({0}) Firebase Authorized Domains-এ যোগ করা নেই। Firebase Console → Authentication → Settings-এ {0} যোগ করো।', 'Domain ({0}) is not authorized in Firebase Auth. Add {0} in Firebase Console → Authentication → Settings → Authorized domains.'],
    errPopup: ['লগইন পপআপ বন্ধ বা ব্লক হয়েছে — আবার চেষ্টা করো।', 'Sign-in popup was closed or blocked — please try again.']
  };
  function lang() { try { if (window.TTBridge) return window.TTBridge.lang(); } catch (e) {} return ls.get('tt_lang') === 'en' ? 'en' : 'bn'; }
  function T(k) { var a = S[k]; var s = a ? a[lang() === 'en' ? 1 : 0] : k; for (var i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]); return s; }
  function num(n) { n = Math.round(+n || 0); var s = n.toLocaleString('en-US'); return lang() === 'en' ? s : s.replace(/\d/g, function (d) { return '০১২৩৪৫৬৭৮৯'[d]; }); }

  /* ---------------- user ---------------- */
  var me = null; try { me = JSON.parse(ls.get('tt_me')); } catch (e) {} if (!me || !me.id) me = null;
  var cachedStats = null; try { cachedStats = JSON.parse(ls.get('tt_stats')); } catch (e) {}
  var stats = { total: cachedStats ? cachedStats.total : 0, online: cachedStats ? cachedStats.online : 1 }, ban = null, lastSeenId = +ls.get('tt_chat_seen') || 0, lastId = 0;
  function setMe(m) {
    if (!m || !m.id) return; me = m; ls.set('tt_me', JSON.stringify(m)); ls.set('tt_name', m.n);
    renderTop(); renderProfile();
  }
  function register(n) {
    var fb = FB();
    if (fb && fb.isReady()) {
      if (fb.playerProfile()) {
        return fb.updateProfile({ displayName: n }).then(function (prof) {
          if (prof) {
            var m = { id: prof.uid, n: prof.displayName, pn: prof.playerNumber, u: 'player' + prof.playerNumber, best: prof.bestScore || 0, coins: prof.coins || 0, spent: prof.spentCoins || 0, av: prof.avatar || '', sp: prof.isSpecial ? 1 : 0 };
            setMe(m);
            return { ok: true, me: m };
          }
          return { ok: false, err: 'net' };
        }).catch(function () { return { ok: false, err: 'net' }; });
      }
      return fb.signIn(n).then(function (prof) {
        if (prof) {
          var m = { id: prof.uid, n: prof.displayName, pn: prof.playerNumber, u: 'player' + prof.playerNumber, best: prof.bestScore || 0, coins: prof.coins || 0, spent: prof.spentCoins || 0, av: prof.avatar || '', sp: prof.isSpecial ? 1 : 0 };
          setMe(m);
          return { ok: true, me: m };
        }
        return { ok: false, err: 'net' };
      }).catch(function (err) {
        var code = err && err.code;
        return { ok: false, err: code === 'auth/unauthorized-domain' ? 'domain' : (code === 'auth/popup-closed-by-user' || code === 'auth/popup-blocked') ? 'popup' : 'net', host: (err && err.host) || location.hostname };
      });
    }
    return call('register', { d: PID, n: n }).then(function (r) {
      if (!r) return { ok: false, err: 'net' };
      if (r.ok && r.me) setMe(r.me);
      return r;
    });
  }
  var coinsLocal = +ls.get('tt_coins') || 0;
  var spentLocal = +ls.get('tt_spent') || 0;
  function walletInfo() {
    var fb = FB(), fbProf = (fb && fb.isReady()) ? fb.playerProfile() : null;
    if (fbProf) {
      var earnedFb = fbProf.coins || 0;
      var spentFb = fbProf.spentCoins || 0;
      return { earned: earnedFb, spent: spentFb, balance: Math.max(0, earnedFb - spentFb) };
    }
    var earned = Math.max(+(me && me.coins) || 0, coinsLocal);
    var spent = Math.max(+(me && me.spent) || 0, spentLocal);
    return { earned: earned, spent: spent, balance: Math.max(0, earned - spent) };
  }
  function creditCoins(amt) {
    amt = Math.max(0, Math.round(+amt || 0));
    if (!amt) return Promise.resolve(walletInfo());
    var fb = FB(), fbProf = (fb && fb.isReady()) ? fb.playerProfile() : null;
    if (fbProf && fb.creditCoins) {
      return fb.creditCoins(amt).then(function () { renderTop(); return walletInfo(); }).catch(function () { return walletInfo(); });
    }
    coinsLocal += amt;
    ls.set('tt_coins', String(coinsLocal));
    if (me) me.coins = Math.max(me.coins || 0, coinsLocal);
    renderTop();
    return Promise.resolve(walletInfo());
  }
  function spendCoins(amt) {
    amt = Math.max(0, Math.round(+amt || 0));
    var w = walletInfo();
    if (amt <= 0 || amt > w.balance) return Promise.resolve({ ok: false, err: 'insufficient', balance: w.balance });
    var fb = FB(), fbProf = (fb && fb.isReady()) ? fb.playerProfile() : null;
    if (fbProf && fb.spendCoins) {
      return fb.spendCoins(amt).then(function (res) { renderTop(); return res; });
    }
    spentLocal += amt;
    ls.set('tt_spent', String(spentLocal));
    if (me) me.spent = spentLocal;
    renderTop();
    return Promise.resolve({ ok: true, balance: Math.max(0, w.balance - amt) });
  }
  function gameOver(plates) {
    var k = +((cfg.game || {}).coin_per_plate); if (!(k >= 0)) k = 1;
    coinsLocal += Math.round((plates || 0) * k); ls.set('tt_coins', String(coinsLocal)); renderTop();
  }

  /* ---------------- scores played offline: kept on the phone, sent when the connection is back ----------------
     Each offline ride needs a single-use ticket + signing key that the server handed out while we were online. The saved
     record is signed with that key, so the server can tell if it was edited. Everything is stored sealed (not readable text),
     and a few decoy keys are left around: touching them tells the server. */
  function fnv(t) { var h = 2166136261; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function seal(o) {
    var j = JSON.stringify(o), b = unescape(encodeURIComponent(j)), out = '';
    for (var i = 0; i < b.length; i++) out += ('0' + (b.charCodeAt(i) ^ PID.charCodeAt(i % 24) ^ ((i * 37 + 11) & 255)).toString(16)).slice(-2);
    return fnv(j + PID) + out;
  }
  function unseal(h) {
    if (!h || h.length < 10) return null;
    try {
      var hex = h.slice(8), b = '';
      for (var i = 0; i < hex.length / 2; i++) b += String.fromCharCode(parseInt(hex.substr(i * 2, 2), 16) ^ PID.charCodeAt(i % 24) ^ ((i * 37 + 11) & 255));
      var j = decodeURIComponent(escape(b)); if (fnv(j + PID) !== h.slice(0, 8)) return null; return JSON.parse(j);
    } catch (e) { return null; }
  }
  var tampered = false;
  function readSealed(key) { var raw = ls.get(key); if (raw == null) return []; var v = unseal(raw); if (!Array.isArray(v)) { if (!tampered) { tampered = true; call('flag', { d: PID, why: key }); } return []; } return v; }
  function queue() { return readSealed('tt_sync'); }
  function tickets() { return readSealed('tt_cache2'); }
  function rhex(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function decoys(q) {
    ls.set('tt_ots', rhex(180));
    ls.set('tt_sig', rhex(64));
  }
  function checkDecoys() {}
  function saveQ(q) { ls.set('tt_sync', seal(q.slice(-40))); decoys(); renderTop(); }
  function saveTickets(t) { ls.set('tt_cache2', seal(t.slice(-8))); }
  function hmac(key, msg) {
    var enc = new TextEncoder(); if (!(window.crypto && crypto.subtle)) return Promise.resolve(null);
    return crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']).then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(msg)); })
      .then(function (sig) { return Array.from(new Uint8Array(sig), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16); }).catch(function () { return null; });
  }
  function refill() {      // keep a few tickets on the phone for the next time the net is gone
    var have = tickets().length; if (have >= 3 || !API) return;
    call('ot', { d: PID, have: have }).then(function (r) { if (r && r.ok && r.ts && r.ts.length) saveTickets(tickets().concat(r.ts)); });
  }
  function enqueue(rec) {
    if (!rec || !(rec.s >= 1) || !rec.n) return Promise.resolve(false);
    var tk = tickets(); if (!tk.length) return Promise.resolve(false);      // never been online with this phone: score stays local only
    var t = tk.shift(), at = Math.floor(Date.now() / 1000);
    var r = { n: rec.n, s: Math.round(rec.s), dur: +(+rec.dur || 0).toFixed(1), slaps: rec.slaps | 0, p: rec.p | 0, boss: rec.boss | 0, a: rec.a || '', at: at, ot: t.t };
    saveTickets(tk);
    return hmac(t.k, r.s + '|' + r.dur.toFixed(1) + '|' + r.slaps + '|' + r.p + '|' + r.boss + '|' + r.at + '|' + r.ot).then(function (mac) {
      if (!mac) return false; r.mac = mac; var q = queue(); q.push(r); saveQ(q); setTimeout(flush, 1500); return true;
    });
  }
  var flushing = false;
  function flush() {
    if (flushing || gstate === 'play' || !API) return;
    checkDecoys();
    var q = queue(); if (!q.length) { refill(); return; } flushing = true;
    var rec = Object.assign({ d: PID }, q[0]);
    call('submit', rec, 10000).then(function (d) {
      flushing = false;
      if (!d || (d.err === 'slow')) return;                    // still no connection: keep it, try again later
      q = queue().filter(function (x) { return x.ot !== rec.ot; }); saveQ(q);   // sent (or rejected for good): drop it
      if (d.ok) { if (d.me) setMe(d.me); ls.set('tt_top', JSON.stringify(d)); window.dispatchEvent(new CustomEvent('tt-synced', { detail: d })); }
      if (q.length) setTimeout(flush, 400); else refill();
    });
  }
  window.addEventListener('online', function () { setTimeout(flush, 800); schedule(300); });
  if (!ls.get('tt_q_sum')) decoys();
  setTimeout(flush, 4000); setInterval(flush, 30000); setTimeout(refill, 2500);

  /* ---------------- styles ---------------- */
  var css = [
    '.ttl{font-family:"Hind Siliguri","Baloo Da 2",system-ui,sans-serif;font-size:clamp(12.5px,min(2.1vh,3.9vw),16px);-webkit-user-select:none;user-select:none}',
    '#ttl-nbar,#ttl-top,#ttl-fab{display:none}',
    'body.ttl-menu #ttl-nbar.has{display:flex}body.ttl-menu #ttl-top{display:flex}body.ttl-menu.ttl-chat #ttl-fab{display:flex}',
    /* update line */
    '#ttl-nbar{position:fixed;left:0;right:0;top:0;z-index:6;height:2.35em;padding-top:env(safe-area-inset-top,0px);box-sizing:content-box;align-items:center;gap:.6em;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.12);pointer-events:none}',
    '#ttl-nbar .lb{flex:none;margin-left:.5em;padding:.18em .65em;border-radius:99px;background:#e63946;color:#fff;font:800 .7em "Baloo Da 2",sans-serif;letter-spacing:.08em;box-shadow:0 0 .9em rgba(230,57,70,.55);z-index:1}',
    '#ttl-nbar .tr{position:relative;flex:1;height:100%;overflow:hidden}',
    '#ttl-nbar .tx{position:absolute;left:0;top:50%;margin-top:-.75em;white-space:nowrap;font-weight:700;font-size:.92em;line-height:1.5;opacity:0;will-change:transform}',
    /* counters */
    '#ttl-top{position:fixed;left:0;right:0;top:calc(.45em + env(safe-area-inset-top,0px));z-index:6;justify-content:center;flex-wrap:wrap;gap:.4em;padding:0 .6em;pointer-events:none}',
    'body.ttl-nbar #ttl-top{top:calc(2.35em + env(safe-area-inset-top,0px) + .45em)}',
    '.ttl-pill{display:inline-flex;align-items:center;gap:.4em;padding:.22em .75em;border-radius:99px;background:rgba(9,24,17,.78);border:1px solid rgba(255,255,255,.16);font-weight:700;font-size:.8em;color:#fff;white-space:nowrap;max-width:92vw;overflow:hidden}',
    '.ttl-pill.ttl-btn{pointer-events:auto;cursor:pointer;transition:transform .12s,border-color .15s}.ttl-pill.ttl-btn:hover{border-color:#ffc23d}.ttl-pill.ttl-btn:active{transform:scale(.96)}',
    '.ttl-pill .pnum{padding:.05em .4em;border-radius:6px;background:rgba(255,194,61,.18);color:#ffc23d;font-family:"Baloo Da 2",sans-serif;font-weight:800}',
    '.ttl-pill b{color:#ffc23d;font-family:"Baloo Da 2",sans-serif}.ttl-pill .dot{width:.55em;height:.55em;border-radius:50%;background:#3ddc84;box-shadow:0 0 .6em #3ddc84}',
    '.ttl-pill .pa{width:1.7em;height:1.7em;border-radius:50%;object-fit:cover;background:#244;display:inline-grid;place-items:center;font-size:.9em;margin-left:-.45em;flex:none}',
    '#ttl-players{position:fixed;inset:0;z-index:12;background:rgba(0,0,0,.62);display:none;align-items:center;justify-content:center;padding:1em;pointer-events:auto}',
    '#ttl-players.on{display:flex}',
    '#ttl-players .card{width:min(28em,96vw);max-height:82vh;display:flex;flex-direction:column;background:#0e1d16;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:1.1em;padding:1em;box-shadow:0 1em 3em rgba(0,0,0,.7)}',
    '#ttl-players .phd{display:flex;align-items:center;gap:.5em;margin-bottom:.3em}#ttl-players .phd h3{flex:1;font:800 1.2em "Baloo Da 2","Hind Siliguri",sans-serif;color:#ffc23d}',
    '#ttl-players .psub{font-size:.8em;color:#9fc0ad;margin-bottom:.7em}',
    '#ttl-players .plist{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:.35em;padding-right:.2em}',
    '#ttl-players .prow{display:flex;align-items:center;gap:.6em;padding:.45em .65em;border-radius:.7em;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08)}',
    '#ttl-players .prow.me{border-color:#ffc23d;background:rgba(255,194,61,.12)}',
    '#ttl-players .prow .pno{font:800 .95em "Baloo Da 2",sans-serif;color:#ffc23d;min-width:2.6em}',
    '#ttl-players .prow .pnm{flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#ttl-players .prow .psc{font:800 .9em "Baloo Da 2",sans-serif;color:#3ddc84}',
    '.ttl-mh .pno{font:800 .85em "Baloo Da 2",sans-serif;color:#ffc23d;background:rgba(255,194,61,.14);padding:0 .35em;border-radius:4px}',
    /* shift the game menu content cleanly below the measured notice/top-pill bars */
    'body.ttl-menu #menu{padding-top:var(--ttl-top-off,calc(5.6em + env(safe-area-inset-top,0px)))!important}',
    '@media (max-height:700px){body.ttl-menu #menu .hero .pc:not(.joke){display:none}body.ttl-menu #menu .hero{gap:.28em}}',
    /* chat button */
    '#ttl-fab{position:fixed;top:50%;transform:translateY(-50%);z-index:6;width:3.2em;height:3.2em;border-radius:50%;align-items:center;justify-content:center;font-size:1.2em;cursor:pointer;pointer-events:auto;color:#fff;background:linear-gradient(135deg,var(--ac),#7b3df0);border:2px solid rgba(255,255,255,.55);box-shadow:0 .25em 1em rgba(0,0,0,.45),0 0 1.1em var(--ac)}',
    '#ttl-fab.r{right:.7em}#ttl-fab.l{left:.7em}#ttl-fab:active{transform:translateY(-50%) scale(.94)}',
    '@media (max-width:600px){#ttl-fab{top:calc(var(--ttl-top-off,calc(5.6em + env(safe-area-inset-top,0px))) + 2.35em);transform:none;width:2.65em;height:2.65em;font-size:1.05em}#ttl-fab.r{right:.55em}#ttl-fab.l{left:.55em}#ttl-fab:active{transform:scale(.94)}}',
    '#ttl-fab .u{position:absolute;right:-.1em;top:-.1em;min-width:1.15em;height:1.15em;border-radius:99px;background:#ff3b5c;border:2px solid #fff;display:none;font:800 .55em/1.0 "Baloo Da 2",sans-serif;align-items:center;justify-content:center;padding:0 .3em}',
    '#ttl-fab.un .u{display:flex}#ttl-fab small{position:absolute;bottom:-1.55em;left:50%;transform:translateX(-50%);font:800 .5em "Baloo Da 2",sans-serif;background:rgba(0,0,0,.65);padding:.1em .6em;border-radius:99px;white-space:nowrap}',
    /* themes */
    '.ttl-th{--bg:#080818;--hd:#12123a;--tx:#eaf0ff;--mu:#8a93c9;--bb:#17174a;--bt:#eaf0ff;--me:#5b2fd8;--mt:#fff;--ac:#19e3ff;--bd:#2b2b78}',
    '.ttl-th[data-tth=dark]{--bg:#111418;--hd:#1a1f25;--tx:#e8ecf0;--mu:#8b95a1;--bb:#232a32;--bt:#e8ecf0;--me:#2563eb;--mt:#fff;--ac:#4ea1ff;--bd:#2d3641}',
    '.ttl-th[data-tth=light]{--bg:#f3f5fa;--hd:#fff;--tx:#1a2030;--mu:#6b7487;--bb:#fff;--bt:#1a2030;--me:#2563eb;--mt:#fff;--ac:#2563eb;--bd:#d9deea}',
    '.ttl-th[data-tth=sunset]{--bg:#1f0f1a;--hd:#3a1530;--tx:#fff1e8;--mu:#d9a5a0;--bb:#3a1d33;--bt:#fff1e8;--me:#e8590c;--mt:#fff;--ac:#ffb347;--bd:#6b2a48}',
    '.ttl-th[data-tth=ocean]{--bg:#06202b;--hd:#0a3345;--tx:#e6faff;--mu:#8cc3d4;--bb:#0d3a4e;--bt:#e6faff;--me:#0891b2;--mt:#fff;--ac:#5eead4;--bd:#14566f}',
    '.ttl-th[data-tth=forest]{--bg:#0d1f16;--hd:#14301f;--tx:#eafff1;--mu:#92c7a6;--bb:#17382a;--bt:#eafff1;--me:#16a34a;--mt:#fff;--ac:#fbbf24;--bd:#25523a}',
    '.ttl-th[data-tth=glass]{--bg:rgba(18,24,36,.78);--hd:rgba(255,255,255,.08);--tx:#f2f6ff;--mu:#a6b3cf;--bb:rgba(255,255,255,.12);--bt:#f2f6ff;--me:rgba(90,123,216,.9);--mt:#fff;--ac:#9ec1ff;--bd:rgba(255,255,255,.2)}',
    '#ttl-fab.ttl-th{--ac:#19e3ff}',
    /* panel */
    '#ttl-back{position:fixed;inset:0;z-index:7;background:rgba(0,0,0,.45);display:none}#ttl-back.on{display:block}',
    '#ttl-panel{position:fixed;z-index:8;display:none;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--tx);border:1px solid var(--bd);box-shadow:0 1em 3em rgba(0,0,0,.6);pointer-events:auto;touch-action:manipulation}',
    '#ttl-panel[data-tth=glass]{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}',
    '#ttl-panel.on{display:flex}',
    '@media (min-width:561px){#ttl-back{display:none!important}#ttl-panel{bottom:1.1em;width:min(27em,calc(100vw - 2.2em));height:min(42em,calc(100vh - 2.2em));border-radius:1.2em}#ttl-panel.r{right:1.1em}#ttl-panel.l{left:1.1em}}',
    '@media (max-width:560px){#ttl-panel{left:0;right:0;bottom:0;height:90vh;height:90dvh;border-radius:1.2em 1.2em 0 0}}',
    '#ttl-panel button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}',
    '.ttl-hd{position:relative;z-index:4;flex:none;display:flex;align-items:center;gap:.6em;padding:.7em .9em;background:var(--hd);border-bottom:1px solid var(--bd)}',
    '.ttl-hd .tt{flex:1;min-width:0}.ttl-hd h3{font:800 1.2em "Baloo Da 2","Hind Siliguri",sans-serif;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ttl-hd small{display:block;color:var(--mu);font-size:.78em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ttl-on{flex:none;font-size:.78em;font-weight:700;padding:.2em .65em;border-radius:99px;background:rgba(61,220,132,.15);color:#3ddc84;border:1px solid rgba(61,220,132,.4);white-space:nowrap}',
    '.ttl-x{flex:none;width:2.2em;height:2.2em;border-radius:50%;background:rgba(127,127,127,.18)!important;font-size:1em}',
    /* profile strip */
    '.ttl-me{flex:none;display:flex;align-items:center;gap:.6em;padding:.5em .9em;border-bottom:1px solid var(--bd)}',
    '.ttl-me .av{width:2.6em;height:2.6em;border-radius:50%;object-fit:cover;background:var(--bb);display:grid;place-items:center;font-weight:800;flex:none;border:2px solid var(--ac)}',
    '.ttl-me .nm{flex:1;min-width:0;line-height:1.25}.ttl-me .nm b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ttl-me .nm small{color:var(--mu);font-size:.8em}',
    '.ttl-me .bt{flex:none;font-size:.78em;font-weight:700;padding:.35em .75em;border-radius:99px;border:1px solid var(--bd)!important;background:var(--bb)!important}',
    '.ttl-me .bt.on{background:var(--ac)!important;color:#001018;border-color:var(--ac)!important}',
    '.ttl-pics{flex:none;display:none;gap:.5em;overflow-x:auto;padding:.5em .9em;border-bottom:1px solid var(--bd);background:rgba(127,127,127,.07);scrollbar-width:thin}',
    '.ttl-pics.on{display:flex}.ttl-pics button{flex:none;width:3em;height:3em;border-radius:50%;overflow:hidden;border:2px solid transparent!important;background:var(--bb)!important;padding:0;font-size:.7em;font-weight:700}',
    '.ttl-pics button.sel{border-color:var(--ac)!important;box-shadow:0 0 .7em var(--ac)}.ttl-pics img{width:100%;height:100%;object-fit:cover;display:block}',
    '.ttl-rules{flex:none;display:none;gap:.6em;align-items:flex-start;margin:.55em .8em 0;padding:.5em .7em;border-radius:.8em;background:rgba(255,194,61,.12);border:1px solid rgba(255,194,61,.4);font-size:.85em;line-height:1.35}',
    '.ttl-rules.on{display:flex}.ttl-rules div{flex:1}.ttl-rules button{flex:none;font-weight:800;color:#ffc23d!important}',
    /* messages */
    '#ttl-list{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:.7em .8em;display:flex;flex-direction:column;gap:.6em;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;-webkit-user-select:text;user-select:text;scroll-behavior:auto}',
    '#ttl-list .empty{margin:auto;text-align:center;color:var(--mu);padding:1em}',
    '.ttl-m{display:flex;gap:.55em;align-items:flex-end;flex:none;animation:ttlin .18s ease-out}@keyframes ttlin{from{opacity:0;transform:translateY(.4em)}}',
    '.ttl-m.me{flex-direction:row-reverse}.ttl-m.pend{opacity:.6}.ttl-m.rm{transition:opacity .25s,transform .25s;opacity:0;transform:scale(.9)}',
    '.ttl-av{width:2.5em;height:2.5em;border-radius:50%;flex:none;object-fit:cover;background:var(--bb);color:var(--tx);display:grid;place-items:center;font-weight:800;font-size:.9em}',
    '.ttl-mb{display:flex;flex-direction:column;gap:.15em;max-width:80%;min-width:0}.ttl-m.long .ttl-mb{min-width:60%}.ttl-m.me .ttl-mb{align-items:flex-end}',
    '.ttl-mh{display:flex;align-items:center;gap:.3em;font-size:.78em;color:var(--mu);white-space:nowrap;max-width:100%}.ttl-mh .nm{font-weight:700;color:var(--tx);overflow:hidden;text-overflow:ellipsis;max-width:11em}',
    '.ttl-mh .vb{width:1.25em;height:1.25em;border-radius:50%;object-fit:cover;flex:none}',
    '.ttl-bub{background:var(--bb);color:var(--bt);padding:.5em .8em;border-radius:1em 1em 1em .25em;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;hyphens:manual;line-height:1.42;width:fit-content;max-width:100%;border:1px solid transparent}',
    '.ttl-m.long .ttl-bub{width:100%}.ttl-m.me .ttl-bub{background:var(--me);color:var(--mt);border-radius:1em 1em .25em 1em}',
    '.ttl-bub .ed{opacity:.55;font-size:.75em;margin-left:.4em}',
    /* special users: their own card */
    '.ttl-m.sp .ttl-bub{background:linear-gradient(135deg,#3a2705,#6a4708 55%,#3a2705);color:#fff3cf;border:1px solid #ffcf5a;box-shadow:0 0 0 1px rgba(255,183,0,.35),0 .3em 1.2em rgba(255,183,0,.3),inset 0 0 1.2em rgba(255,207,90,.12)}',
    '.ttl-m.sp .ttl-av{box-shadow:0 0 0 2px #ffcf5a,0 0 .9em rgba(255,183,0,.7)}.ttl-m.sp .ttl-mh .nm{color:#ffd25e;text-shadow:0 0 .8em rgba(255,183,0,.6)}',
    '.ttl-m.sp .ttl-mh:after{content:"★";color:#ffd25e;font-size:.9em}',
    '.ttl-m.sys .ttl-bub{border-radius:1em}',
    '#ttl-new{position:absolute;left:50%;bottom:7.2em;transform:translateX(-50%);display:none;padding:.35em .9em;border-radius:99px;background:var(--ac)!important;color:#001018!important;font-weight:800;font-size:.85em;box-shadow:0 .3em 1em rgba(0,0,0,.4);z-index:2}',
    '#ttl-new.on{display:block}',
    '.ttl-ty{flex:none;height:1.5em;padding:0 1em;font-size:.78em;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ttl-err{flex:none;display:none;margin:0 .8em .3em;padding:.35em .7em;border-radius:.7em;background:rgba(255,77,77,.16);color:#ff8a8a;font-size:.85em;font-weight:700}.ttl-err.on{display:block}',
    '.ttl-emo{flex:none;display:flex;gap:.2em;overflow-x:auto;padding:.2em .6em;border-top:1px solid var(--bd);scrollbar-width:none}.ttl-emo::-webkit-scrollbar{display:none}',
    '.ttl-emo button{flex:none;font-size:1.45em;line-height:1;padding:.2em .25em;border-radius:.5em}.ttl-emo button:active{background:var(--bb)}',
    '.ttl-in{flex:none;display:flex;gap:.5em;align-items:flex-end;padding:.5em .7em calc(.6em + env(safe-area-inset-bottom,0px));background:var(--hd)}',
    '.ttl-in textarea{flex:1;min-width:0;resize:none;max-height:7.6em;min-height:2.6em;padding:.6em .85em;border-radius:1.2em;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font:inherit;line-height:1.35;outline:none;-webkit-user-select:text;user-select:text}',
    '.ttl-in textarea:focus{border-color:var(--ac)}',
    '.ttl-in .sd{flex:none;height:2.6em;min-width:3.6em;padding:0 1em;border-radius:99px;background:var(--ac)!important;color:#001018!important;font-weight:800}.ttl-in .sd:disabled{opacity:.5}',
    /* gate (name) + states */
    '.ttl-gate{position:absolute;inset:0;z-index:3;display:none;flex-direction:column;align-items:center;justify-content:center;gap:.7em;padding:1.4em;text-align:center;background:var(--bg)}.ttl-gate.on{display:flex}',
    '.ttl-gate .big{font-size:3em;line-height:1}.ttl-gate h4{font:800 1.25em "Baloo Da 2","Hind Siliguri",sans-serif}.ttl-gate p{color:var(--mu);font-size:.88em;max-width:20em}',
    '.ttl-gate input{width:100%;max-width:17em;padding:.65em .9em;border-radius:.9em;border:2px solid var(--ac);background:var(--bg);color:var(--tx);font:700 1.05em inherit;text-align:center;outline:none;-webkit-user-select:text;user-select:text}',
    '.ttl-gate .go{padding:.6em 1.8em;border-radius:99px;background:var(--ac)!important;color:#001018!important;font-weight:800;font-size:1.05em}.ttl-gate .go:disabled{opacity:.5}.ttl-gate .er{color:#ff8a8a;font-size:.85em;min-height:1.2em}',
    '.ttl-ban{flex:none;display:none;padding:.55em .9em;background:rgba(255,77,77,.16);color:#ff8a8a;font-weight:700;text-align:center;font-size:.9em}.ttl-ban.on{display:block}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------------- DOM ---------------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var nbar = el('div', 'ttl'); nbar.id = 'ttl-nbar'; nbar.innerHTML = '<span class="lb"></span><div class="tr"><span class="tx"></span></div>';
  var top = el('div', 'ttl'); top.id = 'ttl-top';
  var fab = el('button', 'ttl ttl-th'); fab.id = 'ttl-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'World chat'); fab.innerHTML = '💬<span class="u"></span>';
  var back = el('div'); back.id = 'ttl-back';
  var panel = el('div', 'ttl ttl-th'); panel.id = 'ttl-panel';
  panel.innerHTML = [
    '<div class="ttl-hd"><div class="tt"><h3></h3><small></small></div><span class="ttl-on"></span><button class="ttl-x" type="button" aria-label="Close">✕</button></div>',
    '<div class="ttl-me"><span class="avh"></span><div class="nm"><b></b><small></small></div><button class="bt ren" type="button"></button><button class="bt pic" type="button"></button></div>',
    '<div class="ttl-pics"></div>',
    '<div class="ttl-rules"><div></div><button type="button"></button></div>',
    '<div id="ttl-list"></div><button id="ttl-new" type="button"></button>',
    '<div class="ttl-ty"></div><div class="ttl-err"></div><div class="ttl-ban"></div>',
    '<div class="ttl-emo"></div>',
    '<div class="ttl-in"><textarea rows="1" enterkeyhint="send" autocomplete="off" autocapitalize="sentences"></textarea><button class="sd" type="button"></button></div>',
    '<div class="ttl-gate"><div class="big">💬</div><h4></h4><p class="hlp"></p><input maxlength="30" autocomplete="nickname" enterkeyhint="done"><div class="er"></div><button class="go" type="button"></button></div>'
  ].join('');
  var pModal = el('div', 'ttl'); pModal.id = 'ttl-players';
  pModal.innerHTML = '<div class="card"><div class="phd"><h3></h3><button class="ttl-x" type="button" aria-label="Close">✕</button></div><div class="psub"></div><div class="plist"></div></div>';
  function mount() { document.body.append(nbar, top, fab, back, panel, pModal); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var P = function (s) { return panel.querySelector(s); };
  var listEl, ta, sendBtn, gate, gIn, gErr, gGo;
  function q() { listEl = P('#ttl-list'); ta = P('.ttl-in textarea'); sendBtn = P('.sd'); gate = P('.ttl-gate'); gIn = gate.querySelector('input'); gErr = gate.querySelector('.er'); gGo = gate.querySelector('.go'); }
  document.addEventListener('DOMContentLoaded', function () { q(); wire(); applyConfig(); renderTop(); }, { once: true });
  if (document.readyState !== 'loading') { setTimeout(function () { q(); wire(); applyConfig(); renderTop(); }, 0); }

  /* ---------------- state from the game ---------------- */
  var gstate = 'loading', panelOpen = false;
  function syncMenuOffset() {
    if (!document.body || !document.body.classList.contains('ttl-menu')) return;
    var b = 0;
    if (nbar && nbar.classList.contains('has')) b = Math.max(b, nbar.getBoundingClientRect().bottom || 0);
    if (top && top.offsetHeight) b = Math.max(b, top.getBoundingClientRect().bottom || 0);
    if (b > 0) document.documentElement.style.setProperty('--ttl-top-off', Math.ceil(b + 8) + 'px');
    else document.documentElement.style.removeProperty('--ttl-top-off');
  }
  window.addEventListener('resize', syncMenuOffset);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncMenuOffset);
  if (window.ResizeObserver) {
    try { new ResizeObserver(syncMenuOffset).observe(top); new ResizeObserver(syncMenuOffset).observe(nbar); } catch (e) {}
  }
  function onState(s) {
    gstate = s; document.body.classList.toggle('ttl-menu', s === 'menu'); if (s !== 'play' && queue().length) setTimeout(flush, 1200);
    if (s !== 'menu') { closePanel(); nbStop(); } else { nbStart(); if (!tops.t || Date.now() - tops.t > 90000) loadTop(); requestAnimationFrame(syncMenuOffset); }
    schedule(300);
  }
  window.addEventListener('tt-state', function (e) { onState(e.detail); });
  if (window.TTBridge) { try { onState(window.TTBridge.state()); } catch (e) {} }

  /* ---------------- apply admin config ---------------- */
  function applyConfig() {
    if (!panel || !panel.parentNode) return;
    var c = cfg.chat || {}, th = c.theme || 'neon';
    var fb = FB(), fbReady = !!(fb && fb.isReady());
    [panel, fab].forEach(function (n) { n.setAttribute("data-tth", th); n.style.setProperty('--ac', c.accent || ''); if (!c.accent) n.style.removeProperty('--ac'); });
    panel.className = 'ttl ttl-th ' + (c.icon_side === 'left' ? 'l' : 'r') + (panelOpen ? ' on' : '');
    fab.className = 'ttl ttl-th ' + (c.icon_side === 'left' ? 'l' : 'r') + (fab.classList.contains('un') || lastId > lastSeenId ? ' un' : '');
    document.body.classList.toggle('ttl-chat', !!((c.enabled || fbReady) && (API || fbReady)));
    if (!c.enabled && !fbReady && panelOpen) closePanel();
    if (!panel.querySelector('.ttl-hd h3')) return;
    if (!ta) { q(); wire(); }
    P('.ttl-hd h3').textContent = c.title || 'World Chat'; P('.ttl-hd small').textContent = c.subtitle || '';
    ta.placeholder = c.placeholder || ''; ta.maxLength = c.max_chars || 300;
    var emo = P('.ttl-emo'); emo.innerHTML = '';
    (c.emojis || []).forEach(function (x) { var b = el('button', '', x); b.type = 'button'; b.setAttribute('data-e', x); emo.appendChild(b); });
    P('.ttl-emo').style.display = (c.emojis || []).length ? '' : 'none';
    renderPics(); renderOnline(); renderTop(); nbConfig();
  }
  function renderOnline() {
    var c = cfg.chat || {}, o = P('.ttl-on');
    if (!o) return;
    var fb = FB(), fbReady = !!(fb && fb.isReady());
    var onCount = Math.max(stats.online || 1, 1);
    o.style.display = (c.show_online !== false && (stats.online != null || fbReady)) ? '' : 'none';
    o.textContent = fbReady
      ? ('🟢 ' + (lang() === 'en' ? 'LIVE · ' : 'লাইভ · ') + num(onCount) + ' ' + T('online'))
      : ('🟢 ' + num(onCount) + ' ' + T('online'));
  }

  /* ---------------- notice bar ---------------- */
  var tops = { t: 0, list: [] }, nb = { k: 0, anim: null, timer: null, on: false, lastP: -1 };
  function topList(d) {
    if (!d) return [];
    var list = (d.week && d.week.length ? d.week : d.all) || [];
    return list.filter(function (x) {
      return x && x.n && x.n !== 'biozid' && x.n !== 'Teslar Abba' && x.n !== 'mentosAbbu' && x.n !== 'OBITO';
    });
  }
  try { var tc = JSON.parse(ls.get('tt_top')); if (tc && tc.ok) tops.list = topList(tc); } catch (e) {}
  function loadTop() {
    var fb = FB();
    if (fb && fb.isReady()) {
      var d = fb.leaderboard();
      if (d && d.ok) { tops.t = Date.now(); tops.list = topList(d); ls.set('tt_top', JSON.stringify(d)); nbConfig(); return; }
    }
    call('top').then(function (d) { if (d && d.ok) { tops.t = Date.now(); tops.list = topList(d); ls.set('tt_top', JSON.stringify(d)); nbConfig(); } });
  }
  function nbConfig() {
    var n = cfg.notice || {}, fb = FB(), fbReady = !!(fb && fb.isReady());
    var showPl = (n.show_players !== false || fbReady) && tops.list.length > 0;
    var has = !!(n.enabled !== false && ((n.texts || []).length || showPl));
    nbar.className = 'ttl' + (has ? ' has' : '');
    if (document.body) document.body.classList.toggle('ttl-nbar', has);
    nbar.style.background = n.bg || '#0b1a12'; nbar.style.color = n.color || '#ffe08a';
    var lb = nbar.querySelector('.lb'); lb.textContent = n.label || ''; lb.style.display = n.label ? '' : 'none';
    if (has && gstate === 'menu' && !nb.on) nbStart(); if (!has) nbStop();
    requestAnimationFrame(syncMenuOffset);
  }
  function nbStop() { nb.on = false; clearTimeout(nb.timer); if (nb.anim) { try { nb.anim.cancel(); } catch (e) {} nb.anim = null; } }
  function nbStart() { if (nb.on) return; var n = cfg.notice || {}; if (n.enabled === false || !nbar.classList.contains('has')) return; nb.on = true; nbNext(); }
  function nbItem() {
    var n = cfg.notice || {}, texts = n.texts || [], fb = FB(), pl = (n.show_players !== false || (fb && fb.isReady())) ? tops.list : [];
    var wantPlayer = pl.length && (nb.k % 2 === 1 || !texts.length);
    var k = nb.k++; if (wantPlayer) {
      var i; do { i = Math.floor(Math.random() * pl.length); } while (pl.length > 1 && i === nb.lastP); nb.lastP = i;
      var pLabel = pl[i].n;
      return (n.player_template || '🏆 {name} scored {score}').replace('{name}', pLabel).replace('{score}', num(pl[i].s));
    }
    return texts.length ? texts[Math.floor(k / 2) % texts.length] : '';
  }
  function nbNext() {
    if (!nb.on || gstate !== 'menu') return;
    var n = cfg.notice || {}, txt = nbItem(), tx = nbar.querySelector('.tx'), tr = nbar.querySelector('.tr');
    if (!txt) { nb.timer = setTimeout(nbNext, 2000); return; }
    tx.textContent = txt; tx.style.opacity = 1;
    var cw = tr.clientWidth, tw = tx.getBoundingClientRect().width, sp = Math.max(20, +n.speed || 70);
    var from = n.direction === 'rtl' ? cw : -tw, to = n.direction === 'rtl' ? -tw : cw;
    if (!tx.animate) { nb.timer = setTimeout(nbNext, (n.gap || 5) * 1000); return; }
    nb.anim = tx.animate([{ transform: 'translateX(' + from + 'px)' }, { transform: 'translateX(' + to + 'px)' }], { duration: Math.max(1500, (cw + tw) / sp * 1000), easing: 'linear', fill: 'forwards' });
    nb.anim.onfinish = function () { tx.style.opacity = 0; nb.timer = setTimeout(nbNext, Math.max(1, +n.gap || 5) * 1000); };
  }

  /* ---------------- registered players modal ---------------- */
  function openPlayersModal() {
    var fb = FB();
    pModal.querySelector('.phd h3').textContent = '👥 ' + T('playersTitle');
    pModal.querySelector('.psub').textContent = T('playersSub');
    var list = pModal.querySelector('.plist');
    var prevScroll = list.scrollTop;
    list.textContent = '';
    var arr = fb && fb.isReady() ? fb.playersList() : [];
    if (!arr.length) {
      var emp = el('div', '', T('playersEmpty'));
      emp.style.cssText = 'text-align:center;color:#9fc0ad;padding:1.5em';
      list.appendChild(emp);
    } else {
      arr.forEach(function (p) {
        var row = el('div', 'prow' + (me && p.uid === me.id ? ' me' : ''));
        row.appendChild(el('span', 'pno', '#' + num(p.playerNumber || 0)));
        row.appendChild(el('span', 'pnm', (p.displayName || 'Player') + (p.isSpecial ? ' ★' : '')));
        row.appendChild(el('span', 'psc', '⭐ ' + num(p.bestScore || 0)));
        list.appendChild(row);
      });
    }
    pModal.classList.add('on');
    list.scrollTop = prevScroll;
  }
  pModal.addEventListener('click', function (e) { if (e.target === pModal || e.target.closest('.ttl-x')) pModal.classList.remove('on'); });

  /* ---------------- lobby counters + player card ---------------- */
  function authErrText(err) {
    var code = err && (err.code || err.err);
    if (code === 'auth/unauthorized-domain' || code === 'domain') return T('errDomain', (err && err.host) || location.hostname);
    if (code === 'auth/popup-closed-by-user' || code === 'auth/popup-blocked' || code === 'popup') return T('errPopup');
    return T('errNet');
  }
  var authErrTimer = null;
  function showTopAuthErr(err) {
    if (!top) return;
    var old = top.querySelector('.ttl-auth-err');
    if (old) old.remove();
    var msg = authErrText(err);
    var b = el('span', 'ttl-pill ttl-btn ttl-auth-err', '⚠️ ' + msg);
    b.style.cssText = 'background:rgba(120,20,20,.92);border-color:#ff7b7b;color:#ffd6d6;white-space:normal;text-align:center;line-height:1.3';
    b.onclick = function () { b.remove(); };
    top.appendChild(b);
    clearTimeout(authErrTimer);
    authErrTimer = setTimeout(function () { if (b.parentNode) b.remove(); }, 9000);
  }
  function renderTop() {
    if (!top) return; var s = cfg.site || {};
    var fb = FB(), fbReady = !!(fb && fb.isReady()), fbUser = fbReady ? fb.currentUser() : null, fbProf = fbReady ? fb.playerProfile() : null;
    var name = (fbProf && fbProf.displayName) || (fbUser && fbUser.displayName) || (me && me.n) || ls.get('tt_name') || '';
    var pnum = (fbProf && fbProf.playerNumber) || (me && me.pn) || 0;
    var best = Math.max((fbProf && fbProf.bestScore) || 0, +(me && me.best) || 0, +ls.get('tt_best') || 0);
    var coins = walletInfo().balance;
    var avUrl = (fbProf && fbProf.avatar) || (fbUser && fbUser.photoURL) || (me && me.av) || '';
    top.textContent = '';
    if (s.lobby_player !== false) {
      if (fbProf || name) {
        var pl = el('span', 'ttl-pill ttl-btn'), av = /^https?:\/\//.test(avUrl) ? el('img', 'pa') : el('span', 'pa', (name || '?').trim().charAt(0).toUpperCase());
        if (av.tagName === 'IMG') { av.src = avUrl; av.referrerPolicy = 'no-referrer'; av.alt = ''; }
        pl.appendChild(av);
        pl.appendChild(document.createTextNode(' ' + name + ' · ⭐ '));
        pl.appendChild(el('b', '', num(best)));
        pl.appendChild(document.createTextNode(' · 🪙 '));
        pl.appendChild(el('b', '', num(coins)));
        pl.onclick = fbProf ? openPlayersModal : function () { if (fb && !fbUser) fb.signIn().catch(showTopAuthErr); else openPlayersModal(); };
        top.appendChild(pl);
        if (fbReady && !fbUser) {
          var sgb = el('button', 'ttl-pill ttl-btn'); sgb.type = 'button';
          sgb.appendChild(document.createTextNode('🔑 '));
          sgb.appendChild(el('b', '', T('signInGoogle')));
          sgb.onclick = function () { fb.signIn().catch(showTopAuthErr); };
          top.appendChild(sgb);
        }
      } else {
        var sg = el('button', 'ttl-pill ttl-btn'); sg.type = 'button';
        sg.appendChild(document.createTextNode('🔑 '));
        sg.appendChild(el('b', '', T('signInGoogle')));
        if (best > 0) { sg.appendChild(document.createTextNode(' · ⭐ ')); sg.appendChild(el('b', '', num(best))); }
        sg.onclick = function () { if (fb) fb.signIn().catch(showTopAuthErr); };
        top.appendChild(sg);
      }
    }
    var nq = queue().length;
    if (nq) { var qp = el('span', 'ttl-pill'); qp.title = T('sync'); qp.appendChild(document.createTextNode('⏳ ')); qp.appendChild(el('b', '', num(nq))); top.appendChild(qp); }
    if (s.lobby_stats !== false) {
      var totalVal = fb && fb.isReady() ? Math.max(fb.totalPlayers(), stats.total || 0) : (stats.total || 0);
      var onlineVal = Math.max(stats.online || 1, 1);
      var sp = el('button', 'ttl-pill ttl-btn'); sp.type = 'button';
      sp.appendChild(document.createTextNode('👥 '));
      sp.appendChild(el('b', '', num(totalVal)));
      sp.appendChild(el('i', 'dot')); sp.lastChild.style.cssText = 'display:inline-block;margin-left:.3em;width:.55em;height:.55em;border-radius:50%;background:#3ddc84;box-shadow:0 0 .6em #3ddc84';
      sp.appendChild(el('b', '', num(onlineVal))); sp.appendChild(document.createTextNode(' ' + T('online')));
      sp.onclick = openPlayersModal;
      top.appendChild(sp);
    }
    requestAnimationFrame(syncMenuOffset);
  }

  /* ---------------- polling (presence + typing) ---------------- */
  var ver = null, closedAt = 0, pollT = null, polling = false, fails = 0;
  function schedule(ms) { clearTimeout(pollT); pollT = setTimeout(tick, ms); }
  function nextDelay(ok) {
    if (!ok) return Math.min(60000, 5000 * Math.pow(2, Math.min(fails, 4)));
    if (document.hidden) return 60000;
    if (panelOpen) return Math.max(1200, (cfg.chat || {}).poll_ms || 2500);
    return gstate === 'play' ? 90000 : 30000;
  }
  function tick() {
    if (polling || !API) return; polling = true;
    var open = panelOpen && (cfg.chat || {}).enabled;
    call('poll', { d: PID, open: !!open, v: open && ver != null ? ver : null }).then(function (r) {
      polling = false;
      if (r && r.ok) { fails = 0; handle(r, open); } else { fails++; if (open && !FB()?.isReady()) P('.ttl-ty').textContent = T('offChat'); }
      schedule(nextDelay(r && r.ok));
    });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(200); });
  function handle(r, open) {
    var fb = FB();
    stats.online = r.online || 1;
    stats.total = fb && fb.isReady() ? Math.max(fb.totalPlayers(), r.total || 0) : (r.total || 0);
    renderOnline(); renderTop(); ls.set('tt_stats', JSON.stringify(stats));
    if (queue().length) flush(); else refill();
    if (r.cv && r.cv !== cfg.cv) loadConfig();
    ban = r.ban || null; renderBan();
    if (fb && fb.isReady()) {
      syncFromFirebase();
    } else {
      lastId = Math.max(lastId, r.last || 0);
      if (!open) { fab.classList.toggle('un', lastId > lastSeenId); setUnread(); return; }
      var mx = ver || 0;
      (r.msgs || []).forEach(function (m) { mx = Math.max(mx, m.ver || 0); applyMsg(m); });
      ver = (r.msgs && r.msgs.length) ? mx : Math.max(mx, r.ver || 0);
      if (r.msgs && r.msgs.length) afterMsgs();
    }
    var ty = P('.ttl-ty'); var names = r.typing || [];
    ty.textContent = names.length ? names.join(', ') + ' ' + T('typing') : '';
  }
  function setUnread() { var u = fab.querySelector('.u'); u.textContent = ''; }

  /* ---------------- messages ---------------- */
  var nodes = {}, msgVerMap = {}, pending = [], nearBottom = true;
  var hasSeenVerStored = ls.get('tt_chat_ver') != null;
  var lastSeenVer = +ls.get('tt_chat_ver') || 0;
  var maxFbVer = 0;
  function markChatRead() {
    if (maxFbVer > lastSeenVer) {
      lastSeenVer = maxFbVer;
      ls.set('tt_chat_ver', String(lastSeenVer));
      hasSeenVerStored = true;
    }
    fab.classList.remove('un');
    var u = fab.querySelector('.u'); if (u) u.textContent = '';
  }
  function clearList() { listEl.textContent = ''; nodes = {}; msgVerMap = {}; pending = []; msgData = {}; }
  function fmtTime(ts) { try { return new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function avatarEl(m) {
    if (/^https?:\/\//.test(m.av || '')) {
      var i = el('img', 'ttl-av'); i.referrerPolicy = 'no-referrer'; i.loading = 'lazy'; i.alt = ''; i.src = m.av;
      i.onerror = function () { var s = el('span', 'ttl-av', firstCh(m.n)); i.replaceWith(s); }; return i;
    }
    return el('span', 'ttl-av', firstCh(m.n));
  }
  function firstCh(n) { return Array.from(String(n || '?').trim())[0] || '?'; }
  function buildMsg(m, mine) {
    var row = el('div', 'ttl-m' + (mine ? ' me' : '') + (m.sp ? ' sp' : '') + ((m.t || '').length > 38 || (m.t || '').indexOf('\n') > -1 ? ' long' : ''));
    if (m.id != null) row.dataset.mid = String(m.id);
    row.appendChild(avatarEl(m));
    var mb = el('div', 'ttl-mb'), hd = el('div', 'ttl-mh');
    var nm = el('span', 'nm', m.n || '?'); hd.appendChild(nm);
    if (m.sp && /^https?:\/\//.test(m.bd || '')) { var v = el('img', 'vb'); v.src = m.bd; v.referrerPolicy = 'no-referrer'; v.alt = '✔'; v.onerror = function () { v.remove(); }; hd.appendChild(v); }
    hd.appendChild(el('span', 'tm', '(' + fmtTime(m.ts || Date.now() / 1000) + ')'));
    var bub = el('div', 'ttl-bub', m.t || ''); if (m.ed) bub.appendChild(el('span', 'ed', '✎'));
    mb.append(hd, bub); row.appendChild(mb); return row;
  }
  var msgData = {}, saveT = null;
  function saveChat() {
    clearTimeout(saveT); saveT = setTimeout(function () {
      var ids = Object.keys(msgData).sort();
      ls.set('tt_chat', JSON.stringify(ids.slice(-50).map(function (i) { return msgData[i]; })));
    }, 1500);
  }
  function applyMsg(m) {
    if (m.id != null) { msgData[m.id] = m; msgVerMap[m.id] = m.ver || 0; } saveChat();
    var n = nodes[m.id];
    var mine = !!(me && m.uid === me.id);
    if (n) { var nn = buildMsg(m, mine); n.replaceWith(nn); nodes[m.id] = nn; return; }
    if (mine) {
      for (var i = 0; i < pending.length; i++) if (pending[i].text === m.t) { var p = pending.splice(i, 1)[0]; var nn2 = buildMsg(m, true); p.node.replaceWith(nn2); nodes[m.id] = nn2; return; }
    }
    var node = buildMsg(m, mine); nodes[m.id] = node; listEl.appendChild(node);
  }
  function afterMsgs() {
    var e = listEl.querySelector('.empty'); if (e) e.remove();
    var keep = Math.max(50, ((cfg.chat || {}).history || 150) + 25), kids = listEl.children;
    while (kids.length > keep) { var f = kids[0]; for (var k in nodes) if (nodes[k] === f) { delete nodes[k]; delete msgVerMap[k]; } f.remove(); }
    if (!kids.length) listEl.appendChild(el('div', 'empty', T('empty')));
    if (nearBottom) scrollEnd(); else P('#ttl-new').classList.add('on');
    var len = Object.keys(nodes).length; if (len) { lastSeenId = Math.max(lastSeenId, len); ls.set('tt_chat_seen', String(lastSeenId)); }
  }
  function scrollEnd() { listEl.scrollTop = listEl.scrollHeight; P('#ttl-new').classList.remove('on'); markChatRead(); }
  function syncFromFirebase() {
    var fb = FB(); if (!fb || !fb.isReady()) return;
    document.body.classList.add('ttl-chat');
    var prof = fb.playerProfile();
    if (prof) {
      var m = { id: prof.uid, n: prof.displayName, pn: prof.playerNumber, u: 'player' + prof.playerNumber, best: prof.bestScore || 0, coins: prof.coins || 0, av: prof.avatar || '', sp: prof.isSpecial ? 1 : 0 };
      if (!me || me.id !== m.id || me.n !== m.n || me.pn !== m.pn || me.best !== m.best || me.coins !== m.coins || me.av !== m.av) {
        me = m; ls.set('tt_me', JSON.stringify(m)); ls.set('tt_name', m.n);
      }
      if (gate && gate.classList.contains('on')) gate.classList.remove('on');
    } else if (!fb.currentUser() && me && me.pn) {
      me = null;
    }
    stats.total = Math.max(fb.totalPlayers(), stats.online || 1);
    renderOnline();
    renderTop();
    renderProfile();
    if (pModal.classList.contains('on')) openPlayersModal();

    var msgs = fb.messages();
    var msgsReady = typeof fb.msgsLoaded === 'function' ? fb.msgsLoaded() : true;
    maxFbVer = 0;
    for (var mi = 0; mi < msgs.length; mi++) maxFbVer = Math.max(maxFbVer, msgs[mi].ver || 0);

    if (panelOpen && listEl) {
      if (msgs.length) {
        var em = listEl.querySelector('.empty'); if (em) em.remove();
        var present = {};
        for (var j = 0; j < msgs.length; j++) present[msgs[j].id] = true;
        for (var oldId in nodes) {
          if (!present[oldId]) {
            if (nodes[oldId] && nodes[oldId].parentNode) nodes[oldId].remove();
            delete nodes[oldId]; delete msgVerMap[oldId];
          }
        }
        var addedNew = false;
        for (var k = 0; k < msgs.length; k++) {
          var msg = msgs[k];
          if (nodes[msg.id] && msgVerMap[msg.id] === (msg.ver || 0)) continue;
          if (!nodes[msg.id]) addedNew = true;
          applyMsg(msg);
        }
        // Keep optimistic pending bubbles at bottom after real messages
        for (var pi = 0; pi < pending.length; pi++) {
          if (pending[pi].node && pending[pi].node.parentNode === listEl) listEl.appendChild(pending[pi].node);
        }
        if (addedNew) {
          if (nearBottom) scrollEnd();
          else P('#ttl-new').classList.add('on');
        } else if (nearBottom) {
          markChatRead();
        }
      } else if (!pending.length) {
        listEl.textContent = '';
        listEl.appendChild(el('div', 'empty', msgsReady ? T('empty') : T('loading')));
      }
    } else if (msgs.length) {
      if (!hasSeenVerStored && maxFbVer > 0) {
        lastSeenVer = maxFbVer;
        ls.set('tt_chat_ver', String(lastSeenVer));
        hasSeenVerStored = true;
      }
      var myUid = (prof && prof.uid) || (me && me.id) || '';
      var unread = 0;
      for (var ui = 0; ui < msgs.length; ui++) {
        if ((msgs[ui].ver || 0) > lastSeenVer && (!myUid || msgs[ui].uid !== myUid)) unread++;
      }
      fab.classList.toggle('un', unread > 0);
      var ub = fab.querySelector('.u');
      if (ub) ub.textContent = unread > 99 ? '99+' : (unread > 0 ? String(unread) : '');
    }

    var lb = fb.leaderboard();
    if (lb && lb.ok) {
      tops.t = Date.now();
      tops.list = topList(lb);
      nbConfig();
    }
  }
  window.addEventListener('tt-firebase-update', syncFromFirebase);

  /* ---------------- sending ---------------- */
  var cool = 0, coolT = null, sending = false, lastTyping = 0, errT = null;
  function showErr(msg) { var e = P('.ttl-err'); e.textContent = msg; e.classList.add('on'); clearTimeout(errT); errT = setTimeout(function () { e.classList.remove('on'); }, 3200); }
  function fmtUntil(u) { if (!u) return T('perm'); try { return T('until') + ' ' + new Date(u * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
  function renderBan() { var b = P('.ttl-ban'); if (!b) return; if (ban) { b.textContent = '🚫 ' + T('banned') + ' · ' + fmtUntil(ban.until) + (ban.reason ? ' — ' + ban.reason : ''); b.classList.add('on'); } else b.classList.remove('on'); ta.disabled = !!ban; sendBtn.disabled = !!ban || cool > 0; }
  function coolTick() {
    var left = Math.ceil((cool - Date.now()) / 1000);
    if (left <= 0) { clearInterval(coolT); cool = 0; sendBtn.textContent = T('send'); sendBtn.disabled = !!ban; return; }
    sendBtn.textContent = left + 's'; sendBtn.disabled = true;
  }
  function startCool(sec) { if (!(sec > 0)) return; cool = Date.now() + sec * 1000; clearInterval(coolT); coolT = setInterval(coolTick, 250); coolTick(); }
  function errText(r) {
    switch (r && r.err) {
      case 'cool': return T('cool', r.wait || 1); case 'repeat': return T('repeat'); case 'long': return T('long'); case 'lines': return T('lines');
      case 'slow': return T('slow'); case 'empty': return T('empty2'); case 'banned': return T('banned'); case 'off': return (cfg.chat || {}).off_text || '';
      default: return T('errNet');
    }
  }
  function send(retry) {
    var raw = ta.value.replace(/\s+$/, ''); if (!raw.trim() || sending || cool > Date.now() || ban) return;
    var c = cfg.chat || {}; if (raw.split('\n').length > (c.max_lines || 4)) { showErr(T('lines')); return; }
    var fb = FB();
    if (fb && fb.isReady()) {
      if (!fb.playerProfile()) { openGate(); return; }
      sending = true;
      var curProf = fb.playerProfile();
      var m = { id: 'p' + Date.now(), t: raw, n: curProf.displayName, pn: curProf.playerNumber, av: curProf.avatar, ts: Date.now() / 1000, uid: curProf.uid, sp: curProf.isSpecial ? 1 : 0 };
      var node = buildMsg(m, true); node.classList.add('pend'); var e = listEl.querySelector('.empty'); if (e) e.remove(); listEl.appendChild(node); var pe = { node: node, text: raw }; pending.push(pe);
      ta.value = ''; grow(); scrollEnd(); startCool(c.cooldown || 0);
      fb.sendMessage(raw).then(function (r) {
        sending = false;
        var i = pending.indexOf(pe); if (i > -1) pending.splice(i, 1);
        if (r && r.ok && r.msg) {
          msgVerMap[r.msg.id] = r.msg.ver || 0;
          maxFbVer = Math.max(maxFbVer, r.msg.ver || 0);
          if (nodes[r.msg.id]) { node.remove(); } else { var nn = buildMsg(r.msg, true); node.replaceWith(nn); nodes[r.msg.id] = nn; }
          afterMsgs();
        }
      }).catch(function () {
        sending = false;
        var j = pending.indexOf(pe); if (j > -1) pending.splice(j, 1); node.remove();
        if (!ta.value) ta.value = raw; grow(); showErr(T('errNet'));
      });
      return;
    }
    if (!me) { openGate(); return; }
    sending = true;
    var m2 = { id: 'p' + Date.now(), t: raw, n: me.n, av: me.av, ts: Date.now() / 1000, uid: me.id, sp: 0 };
    var node2 = buildMsg(m2, true); node2.classList.add('pend'); var e2 = listEl.querySelector('.empty'); if (e2) e2.remove(); listEl.appendChild(node2); var pe2 = { node: node2, text: raw }; pending.push(pe2);
    ta.value = ''; grow(); scrollEnd(); startCool(c.cooldown || 0);
    call('send', { d: PID, text: raw }).then(function (r) {
      sending = false;
      if (r && r.ok && r.msg) {
        var i = pending.indexOf(pe2); if (i > -1) pending.splice(i, 1);
        if (nodes[r.msg.id]) { node2.remove(); } else { var nn = buildMsg(r.msg, true); node2.replaceWith(nn); nodes[r.msg.id] = nn; }
        msgData[r.msg.id] = r.msg; saveChat(); afterMsgs(); return;
      }
      var j = pending.indexOf(pe2); if (j > -1) pending.splice(j, 1); node2.remove();
      if (r && r.err === 'name' && !retry && ls.get('tt_name')) { register(ls.get('tt_name')).then(function (x) { if (x.ok) { ta.value = raw; send(true); } else { ta.value = raw; openGate(); } }); return; }
      if (r && r.err === 'name') { ta.value = raw; openGate(); return; }
      if (r && r.err === 'banned') { ban = { until: r.until, reason: r.reason }; renderBan(); }
      if (r && r.err === 'cool') startCool(r.wait || 1); else { clearInterval(coolT); cool = 0; coolTick(); }
      if (!ta.value) ta.value = raw; grow(); showErr(errText(r));
    });
  }
  function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 122) + 'px'; }
  function typingPing() { var n = Date.now(); if (n - lastTyping < 3000 || !me || !(cfg.chat || {}).show_typing) return; lastTyping = n; call('typing', { d: PID }); }

  /* ---------------- profile strip, pictures, name gate ---------------- */
  function renderProfile() {
    if (!panel.querySelector('.ttl-me')) return; var box = P('.ttl-me'), h = P('.avh'); if (!h) return;
    var fb = FB(), fbProf = fb && fb.isReady() ? fb.playerProfile() : null;
    var activeMe = fbProf ? { id: fbProf.uid, n: fbProf.displayName, pn: fbProf.playerNumber, u: 'player' + fbProf.playerNumber, av: fbProf.avatar } : me;
    var m = activeMe || { n: '?', av: '' }; h.textContent = '';
    var a = /^https?:\/\//.test(m.av || '') ? el('img', 'av') : el('span', 'av', firstCh(m.n)); if (a.tagName === 'IMG') { a.src = m.av; a.referrerPolicy = 'no-referrer'; a.alt = ''; }
    h.appendChild(a); h.style.display = 'contents';
    box.querySelector('b').textContent = activeMe ? activeMe.n : T('signInToChat');
    box.querySelector('small').textContent = activeMe ? '@' + activeMe.u : '';
    box.querySelector('.pic').textContent = activeMe ? ('🖼 ' + T('pic')) : ('🔑 ' + T('signInGoogle'));
    box.querySelector('.pic').style.display = '';
    box.querySelector('.ren').textContent = '✎'; box.querySelector('.ren').setAttribute('aria-label', T('rename'));
    box.querySelector('.ren').style.display = (!activeMe || (cfg.chat || {}).allow_rename === false) ? 'none' : '';
    box.style.display = '';
    if (activeMe) renderPics(); else P('.ttl-pics').classList.remove('on');
  }
  function renderPics() {
    var box = P('.ttl-pics'); if (!box) return; box.textContent = '';
    var none = el('button', '', T('noPic')); none.type = 'button'; none.setAttribute('data-id', '0'); if (!me || !me.av) none.classList.add('sel'); box.appendChild(none);
    (cfg.avatars || []).forEach(function (a) {
      var b = el('button'); b.type = 'button'; b.setAttribute('data-id', a.id); var i = el('img'); i.src = a.url; i.alt = ''; i.loading = 'lazy'; i.referrerPolicy = 'no-referrer'; b.appendChild(i);
      if (me && me.av === a.url) b.classList.add('sel'); box.appendChild(b);
    });
  }
  function openGate(msg) {
    gate.classList.add('on'); gate.querySelector('h4').textContent = T('joinT');
    gate.querySelector('.hlp').textContent = T('signInHelp');
    gate.querySelector('.hlp').style.whiteSpace = 'pre-line'; gIn.placeholder = T('name'); gGo.textContent = '🔑 ' + T('signInGoogle'); gGo.disabled = false; gErr.textContent = msg || '';
    gIn.value = ls.get('tt_name') || ''; setTimeout(function () { try { gIn.focus(); } catch (e) {} }, 60);
  }
  function submitGate() {
    var n = gIn.value.replace(/\s+/g, ' ').trim();
    gGo.disabled = true; gErr.textContent = '';
    register(n).then(function (r) {
      gGo.disabled = false;
      if (r && r.ok) { gate.classList.remove('on'); renderProfile(); syncFromFirebase(); } else gErr.textContent = authErrText(r);
    });
  }
  function renameFlow() {
    var m = P('.ttl-me'), nmEl = m.querySelector('.nm'); if (!me || m.querySelector('.rn')) return;
    var inp = el('input', 'rn'); inp.value = me.n; inp.maxLength = (cfg.chat || {}).name_max || 16;
    inp.style.cssText = 'width:100%;padding:.35em .6em;border-radius:.6em;border:1px solid var(--ac);background:var(--bg);color:var(--tx);font:inherit;-webkit-user-select:text;user-select:text';
    var old = nmEl.innerHTML; nmEl.textContent = ''; nmEl.appendChild(inp); inp.focus(); inp.select();
    var done = function (ok) {
      var v = inp.value.replace(/\s+/g, ' ').trim();
      if (ok && v && v.length >= 2 && v !== me.n) register(v).then(function (r) { if (!(r && r.ok)) showErr(T('errName')); renderProfile(); }); else { nmEl.innerHTML = old; renderProfile(); }
    };
    inp.onkeydown = function (e) { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }; inp.onblur = function () { done(true); };
  }

  /* ---------------- open / close ---------------- */
  function openPanel() {
    var fb = FB(), fbReady = !!(fb && fb.isReady());
    if (panelOpen || (!(cfg.chat || {}).enabled && !fbReady)) return;
    panelOpen = true; nearBottom = true; applyConfig(); panel.classList.add('on'); back.classList.add('on');
    gate.classList.remove('on');
    if (fbReady) {
      syncFromFirebase();
      markChatRead();
      setTimeout(scrollEnd, 20);
    } else if (Date.now() - closedAt > 90000) {
      ver = null; clearList();
      var cm = []; try { cm = JSON.parse(ls.get('tt_chat')) || []; } catch (e) {}
      if (cm.length) { cm.forEach(function (m) { applyMsg(m); }); afterMsgs(); } else listEl.appendChild(el('div', 'empty', T('loading')));
    }
    var r = (cfg.chat || {}).rules, key = 'tt_rules_' + (r || '').length + '_' + (r || '').slice(0, 12), rb = P('.ttl-rules');
    if (r && ls.get(key) !== '1') { rb.firstChild.textContent = '📜 ' + r; rb.querySelector('button').textContent = T('ok'); rb.classList.add('on'); rb.querySelector('button').onclick = function () { ls.set(key, '1'); rb.classList.remove('on'); }; } else rb.classList.remove('on');
    renderProfile(); renderBan(); sendBtn.textContent = cool > Date.now() ? sendBtn.textContent : T('send');
    schedule(30); fitViewport();
  }
  function closePanel() { if (!panelOpen) return; panelOpen = false; closedAt = Date.now(); panel.classList.remove('on'); back.classList.remove('on'); try { document.activeElement && document.activeElement.blur(); } catch (e) {} P('.ttl-pics').classList.remove('on'); lastSeenId = Math.max(lastSeenId, lastId); ls.set('tt_chat_seen', String(lastSeenId)); markChatRead(); schedule(1000); }
  function fitViewport() {   // phones: keep the panel above the on-screen keyboard
    var vv = window.visualViewport; if (!vv || !panelOpen || window.innerWidth > 560) { panel.style.height = ''; panel.style.top = ''; panel.style.bottom = ''; return; }
    panel.style.height = Math.round(vv.height * 0.92) + 'px'; panel.style.bottom = Math.round(window.innerHeight - vv.height - vv.offsetTop) + 'px';
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', fitViewport); visualViewport.addEventListener('scroll', fitViewport); }

  var wired = false;
  function wire() {
    if (wired || !panel.querySelector('#ttl-list')) return; wired = true; q();
    fab.addEventListener('click', function () { openPanel(); }); back.addEventListener('click', closePanel);
    P('.ttl-x').addEventListener('click', closePanel);
    ['keydown', 'keyup', 'keypress', 'touchend', 'pointerdown'].forEach(function (ev) { panel.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closePanel(); }); });
    listEl.addEventListener('scroll', function () { nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 90; if (nearBottom) { P('#ttl-new').classList.remove('on'); markChatRead(); } }, { passive: true });
    P('#ttl-new').addEventListener('click', scrollEnd); P('#ttl-new').textContent = T('newMsgs');
    sendBtn.textContent = T('send'); sendBtn.addEventListener('click', function () { send(); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    ta.addEventListener('input', function () { grow(); typingPing(); });
    P('.ttl-emo').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var s = ta.selectionStart || ta.value.length, v = ta.value; ta.value = v.slice(0, s) + b.dataset.e + v.slice(ta.selectionEnd || s); ta.selectionStart = ta.selectionEnd = s + b.dataset.e.length; ta.dispatchEvent(new Event('input')); });
    P('.ttl-me .pic').addEventListener('click', function () {
      var fb = FB();
      if (fb && fb.isReady() && !fb.playerProfile()) { openGate(); return; }
      P('.ttl-pics').classList.toggle('on'); P('.ttl-me .pic').classList.toggle('on');
    });
    P('.ttl-me .ren').addEventListener('click', renameFlow);
    P('.ttl-pics').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var id = +b.dataset.id || 0;
      var avObj = (cfg.avatars || []).find(function (a) { return a.id === id; });
      var url = avObj ? avObj.url : '';
      var fb = FB();
      if (fb && fb.isReady() && fb.playerProfile()) {
        fb.updateProfile({ avatar: url }).then(function () { renderProfile(); }).catch(function () { showErr(T('errNet')); });
        return;
      }
      call('avatar', { d: PID, id: id }).then(function (r) { if (r && r.ok) { setMe(r.me); } else showErr(T('errNet')); });
    });
    gGo.addEventListener('click', submitGate); gIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitGate(); });
    var closeGateBtn = el('button', 'bt', T('close'));
    closeGateBtn.type = 'button';
    closeGateBtn.style.cssText = 'margin-top:.4em;opacity:.7;font-size:.85em';
    closeGateBtn.onclick = function () { gate.classList.remove('on'); };
    gate.appendChild(closeGateBtn);
    renderProfile();
  }


  /* ---------------- live room: the people riding right now (names + live scores only; the ride itself runs on this phone) ---------------- */
  var LV = { on: false, ws: null, mode: '', snap: null, myId: '', name: '', score: 0, sent: -1, hb: 0, beat: 0, session: 0, wsBadAt: 0, busy: false, pauseT: 0, hide: ls.get('tt_live_hide') === '1', el: null };
  function lvCfg() { return (cfg && cfg.live) || { enabled: false }; }
  (function () {
    var st = document.createElement('style');
    st.textContent = '#ttl-live{position:fixed;z-index:5;display:none;pointer-events:none;width:min(40vw,12.5em);font:700 clamp(10px,1.7vh,12.5px)/1.25 "Hind Siliguri","Baloo Da 2",system-ui,sans-serif;color:#eafff1;background:rgba(7,16,12,.58);border:1px solid rgba(255,255,255,.14);border-radius:.8em;padding:.35em .45em;-webkit-user-select:none;user-select:none}' +
      '#ttl-live.on{display:block}#ttl-live .h{display:flex;align-items:center;gap:.35em;font-size:.92em;padding:0 .1em .25em;white-space:nowrap}' +
      '#ttl-live .h i{width:.6em;height:.6em;border-radius:50%;background:#ff3b5c;box-shadow:0 0 .6em #ff3b5c;flex:none;animation:ttlp 1.3s infinite}@keyframes ttlp{50%{opacity:.35}}' +
      '#ttl-live .h b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#ffe08a}#ttl-live .h button{pointer-events:auto;flex:none;font:inherit;background:rgba(255,255,255,.14);color:#fff;border:0;border-radius:99px;width:1.9em;height:1.9em;padding:0;cursor:pointer}' +
      '#ttl-live .r{display:grid;grid-template-columns:1.5em 1fr auto;gap:.3em;align-items:center;padding:.08em .2em;border-radius:.4em}#ttl-live .r em{font-style:normal;opacity:.75;text-align:center}' +
      '#ttl-live .r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ttl-live .r u{text-decoration:none;color:#ffc23d}#ttl-live .r.me{background:rgba(255,194,61,.24)}#ttl-live .r.top em{opacity:1}' +
      '#ttl-live .sep{text-align:center;opacity:.5;line-height:.6}#ttl-live.min .r,#ttl-live.min .sep{display:none}';
    document.head.appendChild(st);
  })();
  function lvEl() {
    if (LV.el) return LV.el;
    var e = document.createElement('div'); e.id = 'ttl-live'; e.className = 'ttl'; e.innerHTML = '<div class="h"><i></i><b></b><button type="button" aria-label="toggle">👁</button></div><div class="rows"></div>';
    document.body.appendChild(e); LV.el = e;
    var b = e.querySelector('button');
    ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown'].forEach(function (ev) { b.addEventListener(ev, function (x) { x.stopPropagation(); }, { passive: true }); });
    b.addEventListener('click', function (x) { x.stopPropagation(); LV.hide = !LV.hide; ls.set('tt_live_hide', LV.hide ? '1' : '0'); lvRender(); });
    return e;
  }
  function lvRender() {
    var e = lvEl(), c = lvCfg(), s = LV.snap;
    if (!LV.on || !s) { e.classList.remove('on'); return; }
    e.style.top = (+c.top_pct || 0) + '%'; e.style.opacity = c.opacity || 0.88; e.style.left = c.side === 'right' ? 'auto' : '.5em'; e.style.right = c.side === 'right' ? '.5em' : 'auto';
    e.classList.toggle('min', LV.hide);
    var room = c.show_room === false ? '' : ' · ' + (lang() === 'en' ? 'Room ' : 'রুম ') + num(s.r);
    e.querySelector('.h b').textContent = (c.title || 'LIVE') + room + ' · ' + num(s.n) + (s.mx ? '/' + num(s.mx) : '');
    var rows = e.querySelector('.rows'), html = [], inTop = false;
    function row(rank, nm, sc, me, sp, top) { var d = document.createElement('div'); d.className = 'r' + (me ? ' me' : '') + (top ? ' top' : ''); d.innerHTML = '<em></em><span></span><u></u>'; d.children[0].textContent = top ? ['🥇', '🥈', '🥉'][rank - 1] : num(rank); d.children[1].textContent = nm + (sp ? ' ✔' : '') ; d.children[2].textContent = num(sc); return d; }
    rows.textContent = '';
    s.top.forEach(function (x, i) { var me = x[0] === LV.myId; if (me) inTop = true; rows.appendChild(row(i + 1, x[1], me ? Math.max(x[2], LV.score) : x[2], me, x[3], i < 3)); });
    if (!inTop && LV.myId) {
      var rk = 1, sc = LV.score; (s.sc || []).forEach(function (v) { if (v > sc) rk++; });
      var sep = document.createElement('div'); sep.className = 'sep'; sep.textContent = '⋮'; rows.appendChild(sep);
      rows.appendChild(row(rk, LV.name, sc, true, 0, false));
    }
    e.classList.add('on');
  }
  function lvSend(o) { try { if (LV.ws && LV.ws.readyState === 1) LV.ws.send(JSON.stringify(o)); } catch (x) {} }
  function lvSync() {
    if (LV.busy || !LV.on) return; LV.busy = true; var sid = LV.session;
    call('live', { d: PID, n: LV.name, op: 'sync', s: LV.score }, 6000).then(function (r) {
      LV.busy = false; if (sid !== LV.session || !LV.on) return;
      if (r && r.ok && r.snap) { LV.myId = r.me; LV.snap = r.snap; lvRender(); }
      else if (r && r.err && r.err !== 'slow') lvStop(false);
    });
  }
  function lvFallback(sid, bad) {
    if (sid !== LV.session || !LV.on) return;
    if (bad) LV.wsBadAt = Date.now();
    try { if (LV.ws) { LV.ws.onclose = null; LV.ws.close(); } } catch (x) {} LV.ws = null; LV.mode = 'poll'; lvSync();
  }
  function lvWs() {
    var sid = LV.session, w, joined = false, url = API.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/ws';
    try { w = new WebSocket(url); } catch (x) { return lvFallback(sid, true); }
    LV.ws = w; LV.mode = 'ws';
    var to = setTimeout(function () { if (!joined) lvFallback(sid, true); }, 4000);
    w.onopen = function () { try { w.send(JSON.stringify({ t: 'join', d: PID, n: LV.name })); } catch (x) {} };
    w.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (x) { return; } if (sid !== LV.session) return;
      if (m.t === 'joined') { joined = true; clearTimeout(to); LV.myId = m.me; }
      else if (m.t === 'snap') { LV.snap = m; lvRender(); }
      else if (m.t === 'err' || m.t === 'kicked' || m.t === 'closed') { clearTimeout(to); lvStop(false); }
    };
    w.onerror = function () {};
    w.onclose = function () { clearTimeout(to); if (sid !== LV.session || !LV.on) return; lvFallback(sid, !joined); };   // never got in: remember it (skip websockets for a while); got cut later: carry on by polling
  }
  function lvStart() {
    var c = lvCfg(); if (LV.on || !c.enabled || !API || !PID || (navigator.onLine === false)) return;
    var nm = (me && me.n) || ls.get('tt_name') || ''; if ((nm.match(/\S/g) || []).length < 2) return;
    LV.on = true; LV.session++; LV.name = nm; LV.sent = -1; LV.snap = null; LV.myId = (me && me.id) || ''; LV.score = 0; LV.beat = 0;
    var ws = c.transport !== 'poll' && 'WebSocket' in window && !(c.transport === 'auto' && Date.now() - LV.wsBadAt < 300000);
    if (ws) lvWs(); else { LV.mode = 'poll'; lvSync(); }
    LV.hb = setInterval(function () {
      LV.score = (window.TTBridge && TTBridge.score && TTBridge.score()) || 0; LV.beat++;
      if (LV.mode === 'poll') lvSync();
      else if (LV.score !== LV.sent) { LV.sent = LV.score; lvSend({ t: 's', s: LV.score }); }
      else if (LV.beat % 6 === 0) lvSend({ t: 'ping' });
      if (LV.snap) lvRender();
    }, Math.max(800, +c.push_ms || 1500));
  }
  function lvStop(tell) {
    if (!LV.on) return; LV.on = false; LV.session++; clearInterval(LV.hb); clearTimeout(LV.pauseT); LV.snap = null;
    if (tell !== false) {
      if (LV.mode === 'ws') lvSend({ t: 'leave' });
      else { try { navigator.sendBeacon && navigator.sendBeacon(API + '/?a=live', new Blob([JSON.stringify({ d: PID, op: 'leave' })], { type: 'text/plain' })); } catch (x) {} }
    }
    try { if (LV.ws) { LV.ws.onclose = null; LV.ws.close(); } } catch (x) {} LV.ws = null; LV.mode = ''; lvRender();
  }
  window.addEventListener('tt-state', function (ev) {
    var s = ev.detail; clearTimeout(LV.pauseT);
    if (s === 'play') lvStart();
    else if (s === 'pause') { if (LV.on) LV.pauseT = setTimeout(function () { lvStop(true); }, 60000); }
    else lvStop(true);
  });
  window.addEventListener('pagehide', function () { lvStop(true); });

  /* ---------------- boot ---------------- */
  window.TTL = { queue: enqueue, flush: flush, register: register, setMe: setMe, me: function () { return me; }, wallet: walletInfo, creditCoins: creditCoins, spendCoins: spendCoins, renderTop: renderTop, gameOver: gameOver, cfg: function () { return cfg; }, open: openPanel, close: closePanel, refresh: loadConfig };
  loadConfig().then(function () { schedule(50); });
  schedule(1500);
})();
