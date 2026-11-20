import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
};

let app = null;
let auth = null;
let db = null;
let ready = false;
let projectId = '';
let currentUser = null;
let myProfile = null;
let totalPlayersCount = 0;
let playersArr = [];
let messagesArr = [];
let leaderboardArr = [];
let myReferralsArr = [];
let playersLoaded = false;
let msgsLoaded = false;
let lbLoaded = false;
let referralsLoaded = false;
let unsubReferrals = null;
const listeners = new Set();

function captureReferralParam() {
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && /^[a-zA-Z0-9_\-]{1,128}$/.test(ref.trim())) {
      localStorage.setItem('tt_ref', ref.trim());
    }
  } catch (e) {}
}
captureReferralParam();

function notify() {
  for (const cb of listeners) {
    try { cb(); } catch (e) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('tt-firebase-update'));
  } catch (e) {}
}

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeName(raw, fallbackNum) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (s.length < 2) s = 'Player #' + (fallbackNum || 1);
  if (s.length > 24) s = s.slice(0, 24).trim();
  if (s.length < 2) s = 'Player';
  return s;
}

function sanitizeAvatar(raw) {
  const s = String(raw || '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  return s.slice(0, 300);
}

function getWeekKey() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

function getResetSeconds() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  const nextMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday));
  return Math.max(0, Math.floor((nextMonday.getTime() - now.getTime()) / 1000));
}

function isAdminUser(user) {
  return !!(user && user.email === 'aminulsordar04@gmail.com' && user.emailVerified === true);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

let ensurePromise = null;
let ensureUid = null;

async function ensurePlayerProfile(user, preferredName) {
  if (!user || !db) return null;
  if (ensurePromise && ensureUid === user.uid) {
    return ensurePromise;
  }
  ensureUid = user.uid;
  ensurePromise = _doEnsurePlayerProfile(user, preferredName).finally(() => {
    ensurePromise = null;
    ensureUid = null;
  });
  return ensurePromise;
}

async function _doEnsurePlayerProfile(user, preferredName) {
  const playerPath = `players/${user.uid}`;
  const statsPath = 'stats/global';

  let existingSnap;
  try {
    existingSnap = await getDoc(doc(db, 'players', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, playerPath);
  }

  if (existingSnap && existingSnap.exists()) {
    myProfile = existingSnap.data();
    const realGoogleName = sanitizeName(user.displayName, myProfile.playerNumber);
    if (/^Player #\d+$/.test(myProfile.displayName || '') && user.displayName && !/^Player #\d+$/.test(realGoogleName)) {
      try {
        await updateDoc(doc(db, 'players', user.uid), {
          displayName: realGoogleName,
          updatedAt: serverTimestamp()
        });
        myProfile = { ...myProfile, displayName: realGoogleName };
      } catch (e) {}
    }
    try {
      if (myProfile?.displayName) localStorage.setItem('tt_name', myProfile.displayName);
    } catch (e) {}
    notify();
    await claimPendingReferral(user, myProfile, false);
    return myProfile;
  }

  let localName = '';
  let localBest = 0;
  let localCoins = 0;
  let localSpent = 0;
  try {
    localName = localStorage.getItem('tt_name') || '';
    localBest = Math.max(0, Math.min(100000000, parseInt(localStorage.getItem('tt_best') || '0', 10) || 0));
    localCoins = Math.max(0, Math.min(10000000, parseInt(localStorage.getItem('tt_coins') || '0', 10) || 0));
    localSpent = Math.max(0, Math.min(localCoins, parseInt(localStorage.getItem('tt_spent') || '0', 10) || 0));
  } catch (e) {}

  let createdProfile = null;
  try {
    createdProfile = await runTransaction(db, async (tx) => {
      const pRef = doc(db, 'players', user.uid);
      const sRef = doc(db, 'stats', 'global');
      const pSnap = await tx.get(pRef);
      if (pSnap.exists()) return pSnap.data();

      const sSnap = await tx.get(sRef);
      const nextNum = sSnap.exists() ? ((sSnap.data().totalPlayers || 0) + 1) : 1;
      const displayName = sanitizeName(preferredName || localName || user.displayName, nextNum);
      const avatar = sanitizeAvatar(user.photoURL);
      const profile = {
        uid: user.uid,
        playerNumber: nextNum,
        displayName,
        avatar,
        bestScore: localBest,
        coins: localCoins,
        ...(localSpent > 0 ? { spentCoins: localSpent } : {}),
        isSpecial: isAdminUser(user),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      tx.set(sRef, {
        totalPlayers: nextNum,
        lastPlayerUid: user.uid,
        updatedAt: serverTimestamp()
      });
      tx.set(pRef, profile);
      return { ...profile, createdAt: new Date(), updatedAt: new Date() };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${statsPath} & ${playerPath}`);
  }

  // Save isolated PII separately
  try {
    const privRef = doc(db, 'users', user.uid, 'private', 'info');
    const privSnap = await getDoc(privRef);
    if (!privSnap.exists() && user.email) {
      await setDoc(privRef, {
        uid: user.uid,
        email: String(user.email).slice(0, 200),
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    // Non-blocking for public gameplay, still logged per spec
    console.warn('Private info sync warning:', error?.message || error);
  }

  myProfile = createdProfile;
  try {
    if (myProfile?.displayName) localStorage.setItem('tt_name', myProfile.displayName);
  } catch (e) {}
  notify();
  await claimPendingReferral(user, myProfile, true);
  return myProfile;
}

async function resolveReferrer(refCode) {
  if (!refCode || !db) return null;
  if (/^\d+$/.test(refCode)) {
    const num = Number(refCode);
    const localMatch = playersArr.find((p) => p.playerNumber === num);
    if (localMatch) return localMatch;
    try {
      const snap = await getDocs(query(collection(db, 'players'), where('playerNumber', '==', num), limit(1)));
      if (!snap.empty) return snap.docs[0].data();
    } catch (e) {}
    return null;
  }
  if (/^[a-zA-Z0-9_\-]{1,128}$/.test(refCode)) {
    try {
      const snap = await getDoc(doc(db, 'players', refCode));
      if (snap.exists()) return snap.data();
    } catch (e) {}
  }
  return null;
}

async function claimPendingReferral(user, profile, isNewPlayer) {
  if (!user || !profile || !db) return;
  let refCode = '';
  try { refCode = localStorage.getItem('tt_ref') || ''; } catch (e) {}
  if (!refCode) return;

  const refPath = `referrals/${user.uid}`;
  try {
    const existingRef = await getDoc(doc(db, 'referrals', user.uid));
    if (existingRef.exists()) {
      try { localStorage.removeItem('tt_ref'); } catch (e) {}
      return;
    }
  } catch (e) {
    // proceed carefully
  }

  const referrer = await resolveReferrer(refCode);
  if (!referrer || referrer.uid === user.uid || !referrer.playerNumber) {
    if (referrer && referrer.uid === user.uid) {
      try { localStorage.removeItem('tt_ref'); } catch (e) {}
    }
    return;
  }

  try {
    await setDoc(doc(db, 'referrals', user.uid), {
      uid: user.uid,
      referrerUid: referrer.uid,
      referrerNumber: referrer.playerNumber,
      referredName: sanitizeName(profile.displayName, profile.playerNumber),
      referredNumber: profile.playerNumber,
      createdAt: serverTimestamp()
    });
    try { localStorage.removeItem('tt_ref'); } catch (e) {}
    if (isNewPlayer) {
      await updateProfile({ coins: (profile.coins || 0) + 50 });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, refPath);
  }
}

function attachReferralListener(uid) {
  if (unsubReferrals) {
    try { unsubReferrals(); } catch (e) {}
    unsubReferrals = null;
  }
  myReferralsArr = [];
  referralsLoaded = false;
  if (!uid || !db) {
    notify();
    return;
  }
  const qRef = query(collection(db, 'referrals'), where('referrerUid', '==', uid), limit(100));
  unsubReferrals = onSnapshot(
    qRef,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      myReferralsArr = list;
      referralsLoaded = true;
      notify();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'referrals');
    }
  );
}

function referralLink() {
  const base = `${location.origin}${location.pathname}`;
  if (myProfile && myProfile.playerNumber) return `${base}?ref=${myProfile.playerNumber}`;
  if (currentUser && currentUser.uid) return `${base}?ref=${currentUser.uid}`;
  return base;
}

function attachPublicListeners() {
  // 1. Permanent total player counter
  onSnapshot(
    doc(db, 'stats', 'global'),
    (snap) => {
      if (snap.exists()) {
        totalPlayersCount = Math.max(0, Number(snap.data().totalPlayers) || 0);
        notify();
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'stats/global');
    }
  );

  // 2. Permanent registered players list with sequential player numbers
  const playersQuery = query(
    collection(db, 'players'),
    where('playerNumber', '>=', 1),
    orderBy('playerNumber', 'asc'),
    limit(200)
  );
  onSnapshot(
    playersQuery,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      playersArr = list;
      playersLoaded = true;
      if (list.length > totalPlayersCount) totalPlayersCount = list.length;
      if (currentUser) {
        const mine = list.find((p) => p.uid === currentUser.uid);
        if (mine) myProfile = mine;
      }
      notify();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'players');
    }
  );

  // 3. Permanent World Chat messages (never deleted)
  const msgQuery = query(
    collection(db, 'messages'),
    where('createdAt', '>', new Date(0)),
    orderBy('createdAt', 'desc'),
    limit(150)
  );
  onSnapshot(
    msgQuery,
    (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        const tsSec = data.createdAt?.seconds ? data.createdAt.seconds : Math.floor(Date.now() / 1000);
        const verMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : tsSec * 1000;
        list.push({
          id: d.id,
          t: data.text || '',
          n: data.name || 'Player',
          pn: data.playerNumber || 0,
          av: data.avatar || '',
          ts: tsSec,
          uid: data.uid,
          sp: data.isSpecial ? 1 : 0,
          ver: verMs
        });
      });
      list.reverse(); // chronological order (oldest -> newest)
      messagesArr = list;
      msgsLoaded = true;
      notify();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    }
  );

  // 4. Permanent Leaderboard entries (never deleted)
  const lbQuery = query(
    collection(db, 'leaderboard'),
    where('bestScore', '>=', 1),
    orderBy('bestScore', 'desc'),
    limit(100)
  );
  onSnapshot(
    lbQuery,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      leaderboardArr = list;
      lbLoaded = true;
      notify();
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leaderboard');
    }
  );
}

function formatLeaderboard() {
  const wk = getWeekKey();
  const all = leaderboardArr
    .slice()
    .sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0))
    .slice(0, 50)
    .map((e) => ({
      n: e.name,
      pn: e.playerNumber || 0,
      s: e.bestScore || 0,
      p: e.plates || 0,
      a: e.area || 'Dhaka',
      id: e.uid,
      sp: e.isSpecial ? 1 : 0
    }));

  const week = leaderboardArr
    .filter((e) => e.weekKey === wk && (e.weekScore || 0) > 0)
    .sort((a, b) => (b.weekScore || 0) - (a.weekScore || 0))
    .slice(0, 50)
    .map((e) => ({
      n: e.name,
      pn: e.playerNumber || 0,
      s: e.weekScore || 0,
      p: e.plates || 0,
      a: e.area || 'Dhaka',
      id: e.uid,
      sp: e.isSpecial ? 1 : 0
    }));

  return {
    ok: true,
    week,
    all,
    wk,
    resetIn: getResetSeconds()
  };
}

async function signIn(preferredName) {
  if (!auth) throw new Error('Firebase Auth not initialized');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err) {
    const code = err && err.code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-browser') {
      if (preferredName) {
        try { localStorage.setItem('tt_name', String(preferredName).slice(0, 24)); } catch (e) {}
      }
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (code === 'auth/unauthorized-domain') {
      console.error(`Firebase Auth unauthorized domain: add "${location.hostname}" in Firebase Console -> Authentication -> Settings -> Authorized domains (project: ${projectId}).`);
      err.host = location.hostname;
      err.projectId = projectId;
    }
    throw err;
  }
  currentUser = cred.user;
  const profile = await ensurePlayerProfile(cred.user, preferredName);
  return profile;
}

async function signOut() {
  if (!auth) return;
  await fbSignOut(auth);
  currentUser = null;
  myProfile = null;
  attachReferralListener(null);
  notify();
}

async function updateProfile({ displayName, avatar, coins, spentCoins }) {
  if (!currentUser || !myProfile) return null;
  const pRef = doc(db, 'players', currentUser.uid);
  const path = `players/${currentUser.uid}`;
  const nextName = displayName != null ? sanitizeName(displayName, myProfile.playerNumber) : myProfile.displayName;
  const nextAvatar = avatar !== undefined ? sanitizeAvatar(avatar) : (myProfile.avatar || '');
  const nextCoins = coins != null ? Math.max(myProfile.coins || 0, Math.min(10000000, Math.round(coins))) : (myProfile.coins || 0);
  const curSpent = myProfile.spentCoins || 0;
  const nextSpent = spentCoins != null ? Math.max(curSpent, Math.min(nextCoins, Math.round(spentCoins))) : curSpent;

  const patch = {
    displayName: nextName,
    avatar: nextAvatar,
    coins: nextCoins,
    updatedAt: serverTimestamp()
  };
  if (spentCoins != null || myProfile.spentCoins !== undefined) {
    patch.spentCoins = nextSpent;
  }

  try {
    await updateDoc(pRef, patch);
    myProfile = { ...myProfile, displayName: nextName, avatar: nextAvatar, coins: nextCoins, ...(patch.spentCoins !== undefined ? { spentCoins: nextSpent } : {}) };
    playersArr = playersArr.map((p) => (p.uid === currentUser.uid ? { ...p, ...myProfile } : p));
    try { localStorage.setItem('tt_name', nextName); } catch (e) {}
    notify();
    return myProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function availableCoins() {
  if (!myProfile) return 0;
  return Math.max(0, (myProfile.coins || 0) - (myProfile.spentCoins || 0));
}

async function creditCoins(amount) {
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  if (!currentUser || !myProfile || amt <= 0) return myProfile;
  return updateProfile({ coins: Math.min(10000000, (myProfile.coins || 0) + amt) });
}

async function spendCoins(amount) {
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  if (!currentUser || !myProfile) return { ok: false, err: 'auth_required' };
  const avail = availableCoins();
  if (amt <= 0 || amt > avail) return { ok: false, err: 'insufficient', balance: avail };
  const nextSpent = (myProfile.spentCoins || 0) + amt;
  const updated = await updateProfile({ spentCoins: nextSpent });
  return {
    ok: !!updated,
    coins: updated ? updated.coins : (myProfile.coins || 0),
    spentCoins: updated ? (updated.spentCoins || 0) : nextSpent,
    balance: updated ? Math.max(0, (updated.coins || 0) - (updated.spentCoins || 0)) : Math.max(0, avail - amt)
  };
}

async function sendMessage(text) {
  if (!currentUser || !myProfile) throw new Error('auth_required');
  const clean = String(text || '').trim().slice(0, 300);
  if (!clean) throw new Error('empty');

  const msgRef = doc(collection(db, 'messages'));
  const path = `messages/${msgRef.id}`;
  const payload = {
    uid: currentUser.uid,
    playerNumber: myProfile.playerNumber,
    name: sanitizeName(myProfile.displayName, myProfile.playerNumber),
    avatar: sanitizeAvatar(myProfile.avatar),
    text: clean,
    isSpecial: !!myProfile.isSpecial && isAdminUser(currentUser),
    createdAt: serverTimestamp()
  };

  try {
    await setDoc(msgRef, payload);
    return {
      ok: true,
      msg: {
        id: msgRef.id,
        t: payload.text,
        n: payload.name,
        pn: payload.playerNumber,
        av: payload.avatar,
        ts: Math.floor(Date.now() / 1000),
        uid: payload.uid,
        sp: payload.isSpecial ? 1 : 0,
        ver: Date.now()
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

async function submitScore({ name, score, plates, area }) {
  if (!currentUser) return { ok: false, err: 'auth_required' };
  const profile = myProfile || await ensurePlayerProfile(currentUser, name);
  if (!profile) return { ok: false, err: 'auth_required' };

  const cleanScore = Math.max(0, Math.min(100000000, Math.round(Number(score) || 0)));
  const cleanPlates = Math.max(0, Math.min(100000, Math.round(Number(plates) || 0)));
  const cleanArea = String(area || 'Dhaka').trim().slice(0, 40) || 'Dhaka';
  const cleanName = sanitizeName(name || profile.displayName, profile.playerNumber);
  const wk = getWeekKey();

  // 1. Update player profile bestScore & coins (never decreases)
  const pRef = doc(db, 'players', currentUser.uid);
  const nextProfileBest = Math.max(profile.bestScore || 0, cleanScore);
  const nextCoins = Math.min(10000000, (profile.coins || 0) + cleanPlates);
  try {
    await updateDoc(pRef, {
      displayName: cleanName,
      bestScore: nextProfileBest,
      coins: nextCoins,
      updatedAt: serverTimestamp()
    });
    myProfile = { ...profile, displayName: cleanName, bestScore: nextProfileBest, coins: nextCoins };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `players/${currentUser.uid}`);
  }

  // 2. Create/update permanent leaderboard entry (never deleted, bestScore never decreases)
  if (cleanScore >= 1) {
    const lbRef = doc(db, 'leaderboard', currentUser.uid);
    const lbPath = `leaderboard/${currentUser.uid}`;
    let lbSnap;
    try {
      lbSnap = await getDoc(lbRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, lbPath);
    }

    if (!lbSnap || !lbSnap.exists()) {
      const entry = {
        uid: currentUser.uid,
        playerNumber: profile.playerNumber,
        name: cleanName,
        bestScore: cleanScore,
        weekScore: cleanScore,
        weekKey: wk,
        plates: cleanPlates,
        area: cleanArea,
        isSpecial: !!profile.isSpecial && isAdminUser(currentUser),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      try {
        await setDoc(lbRef, entry);
        leaderboardArr = leaderboardArr.filter((x) => x.uid !== currentUser.uid).concat([entry]);
        lbLoaded = true;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, lbPath);
      }
    } else {
      const prev = lbSnap.data();
      const nextBest = Math.max(prev.bestScore || 0, cleanScore);
      const nextWeek = prev.weekKey === wk ? Math.max(prev.weekScore || 0, cleanScore) : cleanScore;
      const isNewBest = cleanScore >= (prev.bestScore || 0);
      const patch = {
        name: cleanName,
        bestScore: nextBest,
        weekScore: nextWeek,
        weekKey: wk,
        plates: isNewBest ? cleanPlates : (prev.plates || 0),
        area: isNewBest ? cleanArea : (prev.area || 'Dhaka'),
        updatedAt: serverTimestamp()
      };
      try {
        await updateDoc(lbRef, patch);
        leaderboardArr = leaderboardArr.filter((x) => x.uid !== currentUser.uid).concat([{ ...prev, ...patch }]);
        lbLoaded = true;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, lbPath);
      }
    }
  }

  playersArr = playersArr.map((p) => (p.uid === currentUser.uid ? { ...p, ...myProfile } : p));
  notify();

  // Compute immediate ranking from updated real-time state
  const lb = formatLeaderboard();
  const rankWeek = 1 + lb.week.findIndex((x) => x.id === currentUser.uid);
  const rankAll = 1 + lb.all.findIndex((x) => x.id === currentUser.uid);
  return {
    ...lb,
    rankWeek: rankWeek > 0 ? rankWeek : null,
    rankAll: rankAll > 0 ? rankAll : null,
    me: myProfile
  };
}

async function boot() {
  try {
    const res = await fetch('/firebase-applet-config.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Missing firebase-applet-config.json');
    const firebaseConfig = await res.json();
    projectId = firebaseConfig.projectId || '';
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);

    await testConnection();
    attachPublicListeners();

    try {
      const redir = await getRedirectResult(auth);
      if (redir && redir.user) {
        currentUser = redir.user;
        await ensurePlayerProfile(redir.user);
      }
    } catch (e) {
      console.warn('Redirect sign-in note:', e?.code || e?.message || e);
    }

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        attachReferralListener(user.uid);
        try {
          await ensurePlayerProfile(user);
        } catch (e) {
          console.error('Profile sync error:', e);
        }
      } else {
        myProfile = null;
        attachReferralListener(null);
        notify();
      }
    });

    ready = true;
    notify();
  } catch (e) {
    console.error('Firebase initialization failed:', e);
  }
}

window.TTFirebase = {
  isReady: () => ready,
  lbLoaded: () => lbLoaded,
  msgsLoaded: () => msgsLoaded,
  playersLoaded: () => playersLoaded,
  referralsLoaded: () => referralsLoaded,
  projectId: () => projectId,
  currentUser: () => currentUser,
  playerProfile: () => myProfile,
  totalPlayers: () => totalPlayersCount,
  playersList: () => playersArr.slice(),
  messages: () => messagesArr.slice(),
  leaderboard: () => formatLeaderboard(),
  referrals: () => myReferralsArr.slice(),
  referralLink,
  availableCoins,
  creditCoins,
  spendCoins,
  signIn,
  signOut,
  updateProfile,
  sendMessage,
  submitScore,
  onChange: (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }
};

boot();
