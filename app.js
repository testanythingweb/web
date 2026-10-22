import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, increment,
  deleteDoc, collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdrd2b-U-w2U7bIP-QyWoVQQ1oShy6F1o",
  authDomain: "testanything-5983c.firebaseapp.com",
  projectId: "testanything-5983c",
  storageBucket: "testanything-5983c.firebasestorage.app",
  messagingSenderId: "1097284029589",
  appId: "1:1097284029589:web:09af9f000dd73e65f65f9c",
  measurementId: "G-P3HZHWNCYG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const BASE_URL = "https://url.myvnc.com";
const LS_MY_LINKS = "snip_my_links";

// ============ ANTI-DEVTOOLS (halka) ============
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) || (e.ctrlKey && e.key.toLowerCase() === 'u')) {
    e.preventDefault();
  }
});
setInterval(() => { console.clear(); console.log('%c🚫 Ruk ja bhai', 'color:red;font-size:24px;font-weight:bold'); }, 2000);

// ============ THEME ============
function initTheme() {
  const saved = localStorage.getItem("snip_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
}
initTheme();
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("snip_theme", next);
}
document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
document.getElementById("themeBtnAdmin")?.addEventListener("click", toggleTheme);

// ============ TOAST ============
function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️";
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById("toastContainer").appendChild(el);
  setTimeout(() => {
    el.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============ CLIPBOARD ============
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied!", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("Copied!", "success");
  }
}

// ============ PASSWORD HASH ============
async function hashPassword(pw) {
  const msgBuffer = new TextEncoder().encode(pw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ MY LINKS ============
function getMyLinks() {
  try { return JSON.parse(localStorage.getItem(LS_MY_LINKS) || "[]"); } catch { return []; }
}
function saveMyLinks(list) { localStorage.setItem(LS_MY_LINKS, JSON.stringify(list)); }
function addMyLink(code) {
  const list = getMyLinks();
  if (!list.includes(code)) { list.unshift(code); saveMyLinks(list); }
}
function removeMyLink(code) {
  const list = getMyLinks().filter(c => c !== code);
  saveMyLinks(list);
}

function timeAgo(ts) {
  if (!ts) return "just now";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

// ============ ROUTING ============
const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
const segments = path.split("/").filter(Boolean);

if (segments[0] === "admin") {
  showAdminView();
} else if (segments[0]) {
  handleRedirect(segments[0]);
} else {
  initHome();
}

// ============ REDIRECT ============
async function handleRedirect(code) {
  const overlay = document.getElementById("redirectOverlay");
  const title = document.getElementById("redirectTitle");
  const urlEl = document.getElementById("redirectUrl");
  const spinner = document.getElementById("redirectSpinner");
  const countdownEl = document.getElementById("redirectCountdown");
  const actions = document.getElementById("redirectActions");

  overlay.classList.add("show");

  try {
    const snap = await getDoc(doc(db, "links", code));
    if (!snap.exists()) {
      spinner.style.display = "none";
      title.textContent = "Link not found 😕";
      urlEl.innerHTML = `Ye short link exist nahi karta. <a href="/" style="color:var(--accent-2)">Home</a>`;
      return;
    }
    const data = snap.data();

    if (data.expiresAt && Date.now() > data.expiresAt) {
      spinner.style.display = "none";
      title.textContent = "Link expired ⏰";
      urlEl.innerHTML = `Ye link expire ho chuka hai. <a href="/" style="color:var(--accent-2)">Home</a>`;
      return;
    }

    if (data.maxClicks && (data.clicks || 0) >= data.maxClicks) {
      spinner.style.display = "none";
      title.textContent = "Link limit reached ⛔";
      urlEl.innerHTML = `Ye link apni maximum clicks limit tak pahunch chuka hai. <a href="/" style="color:var(--accent-2)">Home</a>`;
      return;
    }

    if (data.passwordHash) {
      const entered = prompt("🔒 Ye link password protected hai. Password daalo:");
      if (entered === null) {
        window.location.href = "/";
        return;
      }
      const enteredHash = await hashPassword(entered);
      if (enteredHash !== data.passwordHash) {
        spinner.style.display = "none";
        title.textContent = "Galat Password ❌";
        urlEl.innerHTML = `Password sahi nahi hai. <a href="/" style="color:var(--accent-2)">Home</a>`;
        return;
      }
    }

    try { await updateDoc(doc(db, "links", code), { clicks: increment(1) }); } catch (e) { /* ignore */ }

    spinner.style.display = "none";
    countdownEl.style.display = "block";
    actions.style.display = "flex";
    title.textContent = "Redirecting to:";
    urlEl.textContent = data.url;

    let count = 3;
    countdownEl.textContent = count;
    const goNow = () => window.location.replace(data.url);

    const interval = setInterval(() => {
      count--;
      countdownEl.textContent = count;
      if (count <= 0) { clearInterval(interval); goNow(); }
    }, 1000);

    document.getElementById("gotoBtn").addEventListener("click", () => { clearInterval(interval); goNow(); });
    document.getElementById("cancelRedirectBtn").addEventListener("click", () => { clearInterval(interval); window.location.href = "/"; });
  } catch (err) {
    spinner.style.display = "none";
    title.textContent = "Error";
    urlEl.textContent = err.message;
  }
}

// ============ HOME ============
function initHome() {
  const btn = document.getElementById("shortenBtn");
  const longUrlInput = document.getElementById("longUrl");
  const customCodeInput = document.getElementById("customCode");
  const expiryInput = document.getElementById("expiryDays");
  const maxClicksInput = document.getElementById("maxClicks");
  const linkPasswordInput = document.getElementById("linkPassword");
  const resultDiv = document.getElementById("result");
  const shortUrlLink = document.getElementById("shortUrl");
  const qrWrap = document.getElementById("qrWrap");

  let currentShortUrl = "";
  let currentCode = "";

  renderMyLinks();

  btn.addEventListener("click", async () => {
    const longUrl = longUrlInput.value.trim();
    let shortCode = customCodeInput.value.trim().toLowerCase();
    const expiryDays = parseInt(expiryInput.value, 10);
    const maxClicks = parseInt(maxClicksInput.value, 10);
    const linkPassword = linkPasswordInput.value.trim();

    resultDiv.classList.remove("show");
    qrWrap.classList.remove("show");

    if (!longUrl) return toast("URL daalo bhai", "error");
    try { new URL(longUrl); } catch { return toast("Valid URL nahi hai", "error"); }

    if (shortCode && !/^[a-z0-9_-]{2,20}$/.test(shortCode)) return toast("Alias sirf a-z, 0-9, - _ (2-20 chars)", "error");
    if (expiryDays && (expiryDays < 1 || expiryDays > 3650)) return toast("Expiry 1 se 3650 din", "error");
    if (maxClicks && maxClicks < 1) return toast("Max clicks 1 se zyada hone chahiye", "error");

    btn.disabled = true;
    btn.innerHTML = '⏳ Shortening...';

    try {
      if (shortCode) {
        const existing = await getDoc(doc(db, "links", shortCode));
        if (existing.exists()) {
          toast("Ye alias already use ho chuka hai", "error");
          btn.disabled = false; btn.innerHTML = '✨ Shorten URL'; return;
        }
      } else {
        for (let i = 0; i < 5; i++) {
          shortCode = Math.random().toString(36).substring(2, 8);
          const check = await getDoc(doc(db, "links", shortCode));
          if (!check.exists()) break;
        }
      }

      const payload = { url: longUrl, clicks: 0, createdAt: Date.now() };
      if (expiryDays) payload.expiresAt = Date.now() + expiryDays * 86400000;
      if (maxClicks) payload.maxClicks = maxClicks;
      if (linkPassword) payload.passwordHash = await hashPassword(linkPassword);

      await setDoc(doc(db, "links", shortCode), payload);

      currentCode = shortCode;
      currentShortUrl = `${BASE_URL}/${shortCode}`;
      shortUrlLink.href = currentShortUrl;
      shortUrlLink.textContent = currentShortUrl;
      resultDiv.classList.add("show");

      addMyLink(shortCode);
      renderMyLinks();
      toast("Ban gaya! 🎉", "success");

      longUrlInput.value = ""; customCodeInput.value = ""; expiryInput.value = ""; maxClicksInput.value = ""; linkPasswordInput.value = "";
    } catch (err) {
      console.error(err);
      toast("Error: " + err.message, "error");
    }

    btn.disabled = false;
    btn.innerHTML = '✨ Shorten URL';
  });

  document.getElementById("copyBtn").addEventListener("click", () => { if (currentShortUrl) copyToClipboard(currentShortUrl); });

  document.getElementById("qrBtn").addEventListener("click", () => {
    if (!currentShortUrl) return;
    qrWrap.classList.toggle("show");
    if (qrWrap.classList.contains("show")) {
      const qrEl = document.getElementById("qrcode");
      qrEl.innerHTML = "";
      const qrCode = new QRCodeStyling({
        width: 200, height: 200, data: currentShortUrl,
        image: "/snipmyvnc.jpg",
        dotsOptions: { color: "#6c5ce7", type: "rounded" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 4 }
      });
      qrCode.append(qrEl);
      window._currentQr = qrCode;
    }
  });

  document.getElementById("downloadQrBtn").addEventListener("click", () => {
    if (window._currentQr) {
      window._currentQr.download({ name: `qr-${currentCode}`, extension: "png" });
      toast("QR downloaded!", "success");
    } else { toast("QR ready nahi", "error"); }
  });

  document.querySelectorAll("[data-share]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!currentShortUrl) return;
      const text = encodeURIComponent("Check this out: " + currentShortUrl);
      const url = encodeURIComponent(currentShortUrl);
      const type = b.dataset.share;
      let shareUrl = "";

      if (type === "whatsapp") shareUrl = `https://wa.me/?text=${text}`;
      else if (type === "twitter") shareUrl = `https://twitter.com/intent/tweet?text=Check%20this%20out&url=${url}`;
      else if (type === "telegram") shareUrl = `https://t.me/share/url?url=${url}&text=Check%20this%20out`;
      else if (type === "native") {
        if (navigator.share) { try { await navigator.share({ title: "Short Link", url: currentShortUrl }); } catch {} }
        else { copyToClipboard(currentShortUrl); }
        return;
      }
      window.open(shareUrl, "_blank", "noopener");
    });
  });
}

// ============ MY LINKS RENDER ============
async function renderMyLinks() {
  const list = getMyLinks();
  const wrap = document.getElementById("recentList");
  const countEl = document.getElementById("recentCount");
  if (!wrap) return;
  countEl.textContent = list.length;

  if (!list.length) { wrap.innerHTML = '<div class="empty-state">Abhi tak koi link nahi banaya</div>'; return; }

  wrap.innerHTML = '<div class="empty-state">Loading...</div>';
  const items = [];

  for (const code of list) {
    try {
      const snap = await getDoc(doc(db, "links", code));
      if (snap.exists()) items.push({ code, ...snap.data() });
      else removeMyLink(code);
    } catch (e) { /* ignore */ }
  }

  if (!items.length) { wrap.innerHTML = '<div class="empty-state">Abhi tak koi link nahi banaya</div>'; countEl.textContent = 0; return; }

  wrap.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "recent-item";
    const url = `${BASE_URL}/${item.code}`;
    div.innerHTML = `
      <div class="recent-info">
        <a class="recent-short" href="${url}" target="_blank" rel="noopener">${url}</a>
        <div class="recent-meta">
          <span>👁 ${item.clicks || 0} clicks</span>
          <span>📅 ${timeAgo(item.createdAt)}</span>
          ${item.maxClicks ? `<span>🔗 ${item.clicks}/${item.maxClicks}</span>` : ""}
          ${item.passwordHash ? `<span>🔒 Protected</span>` : ""}
        </div>
      </div>
      <div class="recent-actions">
        <button class="icon-btn" title="Copy" data-copy="${url}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button class="icon-btn danger" title="Delete" data-delete="${item.code}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    `;
    wrap.appendChild(div);
  });

  wrap.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => copyToClipboard(b.dataset.copy)));
  wrap.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteOwnLink(b.dataset.delete)));
}

async function deleteOwnLink(code) {
  if (!confirm(`Delete "${code}"?`)) return;
  try {
    await deleteDoc(doc(db, "links", code));
    removeMyLink(code);
    renderMyLinks();
    toast("Link delete ho gaya", "success");
  } catch (err) { toast("Delete failed: " + err.message, "error"); }
}

// ============ ADMIN VIEW & GOOGLE AUTH ============
function showAdminView() {
  document.getElementById("homeView").style.display = "none";
  document.getElementById("adminView").style.display = "block";

  const loginCard = document.getElementById("adminLoginCard");
  const panelCard = document.getElementById("adminPanelCard");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginCard.style.display = "none";
      panelCard.style.display = "block";
      loadAllLinks();
    } else {
      loginCard.style.display = "block";
      panelCard.style.display = "none";
    }
  });

  document.getElementById("googleLoginBtn").addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Firestore se check karo ki admin hai ya nahi
      try {
        const adminDoc = await getDoc(doc(db, "admins", user.email));
        if (!adminDoc.exists()) {
          await signOut(auth);
          toast("Aap authorized admin nahi hain!", "error");
        } else {
          toast("Welcome Admin 👑", "success");
        }
      } catch (err) {
        // Agar rule block kar raha hai toh matlab ye admin nahi hai
        await signOut(auth);
        toast("Unauthorized access. Permission denied.", "error");
      }
      
    } catch (err) {
      toast("Login failed: " + err.message, "error");
    }
  });

  document.getElementById("adminLogoutBtn").addEventListener("click", () => {
    signOut(auth);
    toast("Logged out", "info");
  });

  document.getElementById("adminSearch").addEventListener("input", e => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".admin-item").forEach(el => {
      el.style.display = el.dataset.search.includes(q) ? "" : "none";
    });
  });
}

async function loadAllLinks() {
  const wrap = document.getElementById("adminList");
  const countEl = document.getElementById("adminLinkCount");
  wrap.innerHTML = '<div class="empty-state">Loading...</div>';

  try {
    const q = query(collection(db, "links"), orderBy("createdAt", "desc"), limit(500));
    const snap = await getDocs(q);

    const items = [];
    snap.forEach(d => items.push({ code: d.id, ...d.data() }));

    countEl.textContent = items.length;

    if (!items.length) { wrap.innerHTML = '<div class="empty-state">Koi link nahi hai</div>'; return; }

    const totalClicks = items.reduce((sum, x) => sum + (x.clicks || 0), 0);
    const activeLinks = items.filter(x => !x.expiresAt || Date.now() < x.expiresAt).length;

    let html = `
      <div class="admin-stats">
        <div class="stat-box"><div class="num">${items.length}</div><div class="lbl">Total</div></div>
        <div class="stat-box"><div class="num">${activeLinks}</div><div class="lbl">Active</div></div>
        <div class="stat-box"><div class="num">${totalClicks}</div><div class="lbl">Clicks</div></div>
      </div>
    `;

    items.forEach(item => {
      const url = `${BASE_URL}/${item.code}`;
      const expired = item.expiresAt && Date.now() > item.expiresAt;
      html += `
        <div class="admin-item" data-search="${(item.code + ' ' + item.url).toLowerCase()}">
          <div class="admin-item-info">
            <a class="admin-code" href="${url}" target="_blank" rel="noopener">/${item.code}</a>
            <div class="admin-dest">${item.url}</div>
            <div class="admin-meta">
              <span>👁 ${item.clicks || 0}</span>
              <span>📅 ${timeAgo(item.createdAt)}</span>
              ${item.maxClicks ? `<span>🔗 Limit: ${item.maxClicks}</span>` : ""}
              ${item.passwordHash ? `<span>🔒 Protected</span>` : ""}
              ${item.expiresAt ? `<span>⏱ ${expired ? 'EXPIRED' : new Date(item.expiresAt).toLocaleDateString()}</span>` : ""}
            </div>
          </div>
          <div class="recent-actions">
            <button class="icon-btn" title="Copy" data-copy="${url}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            <button class="icon-btn danger" title="Delete" data-delete="${item.code}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
      `;
    });

    wrap.innerHTML = html;
    wrap.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => copyToClipboard(b.dataset.copy)));
    wrap.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => adminDelete(b.dataset.delete)));
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

async function adminDelete(code) {
  if (!confirm(`Pakka delete "${code}"?`)) return;
  try {
    await deleteDoc(doc(db, "links", code));
    removeMyLink(code);
    toast("Deleted", "success");
    loadAllLinks();
  } catch (err) { toast("Failed: " + err.message, "error"); }
}