// ── cnxt to post — Dashboard ──
import { getSharedSession, clearSharedSession } from "./cnxt-auth.js";

const API_BASE = "https://post.cnxt.to";
const CHAR_SOFT_LIMIT = 300;
const CHAR_HARD_LIMIT = 5000;
const SUPABASE_URL = "https://jstojewashwoswsskwjk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdG9qZXdhc2h3b3N3c3Nrd2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTg2OTAsImV4cCI6MjA5MzkzNDY5MH0.o3hYxYr1ZbmEShPfZebx1vchjmIrN7uYZMX1C5fhoac";

// ── Platform config ──
const PLATFORMS = [
  { key: "bluesky",   name: "Bluesky",   oauth: false, note: "App Password — no registration needed" },
  { key: "x",         name: "X",          oauth: true,  note: "BYOK or credits required" },
  { key: "linkedin",  name: "LinkedIn",   oauth: true },
  { key: "facebook",  name: "Facebook",   oauth: true },
  { key: "instagram", name: "Instagram",  oauth: true },
  { key: "threads",   name: "Threads",    oauth: true },
  { key: "tiktok",    name: "TikTok",     oauth: true, note: "Content Posting API approval required" },
];

// ── State ──
let session = null;
let connectedProfiles = []; // { platform, label, handle, id }[]
let postHistory = [];
let currentView = "compose";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── Auth ──

async function initSupabase() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}

async function refreshAuth() {
  try {
    await getSharedSession();
    const supabase = await initSupabase();
    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch { session = null; }
  await fetchProfiles();
  renderAuthUI();
}

async function fetchProfiles() {
  if (!session?.access_token) { connectedProfiles = []; return; }
  try {
    const res = await fetch(`${API_BASE}/api/profiles`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    connectedProfiles = data.profiles || [];
  } catch {
    connectedProfiles = [];
  }
}

function renderAuthUI() {
  const signedIn = Boolean(session?.user);
  $("#user-email").textContent = signedIn ? session.user.email : "";
  $("#btn-sign-in").classList.toggle("hidden", signedIn);
  $("#btn-sign-out").classList.toggle("hidden", !signedIn);

  // Show/hide nav items based on auth
  $("#topbar-nav").querySelectorAll(".nav-link").forEach((l) => {
    if (l.dataset.view === "compose" || l.dataset.view === "history" || l.dataset.view === "accounts") {
      l.style.display = signedIn ? "" : "none";
    }
  });

  // Switch between welcome and compose
  if (!signedIn) {
    showView("welcome");
  } else if (currentView === "welcome") {
    showView("compose");
  } else {
    showView(currentView);
  }
}

$("#btn-sign-out").addEventListener("click", async () => {
  const supabase = await initSupabase();
  await supabase.auth.signOut();
  await clearSharedSession();
  session = null;
  connectedProfiles = [];
  renderAuthUI();
  renderPlatformChips();
});

// ── Navigation ──

function showView(name) {
  currentView = name;
  $$(".view").forEach((v) => v.classList.add("hidden"));
  const target = $(`#view-${name}`);
  if (target) target.classList.remove("hidden");

  $$(".nav-link").forEach((l) => l.classList.toggle("nav-link-active", l.dataset.view === name));
}

$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (!session && (link.dataset.view === "compose" || link.dataset.view === "history" || link.dataset.view === "accounts")) {
      showView("welcome");
      return;
    }
    showView(link.dataset.view);
  });
});

// ── Platform Chips ──

function renderPlatformChips() {
  const container = $("#platform-toggles");
  const connectedSet = new Set(connectedProfiles.map((p) => p.platform));
  container.innerHTML = PLATFORMS.map((p) => {
    const connected = connectedSet.has(p.key);
    return `<label class="platform-chip ${connected ? "selected" : ""}" data-platform="${p.key}">
      ${p.name}${connected ? ` (${connectedProfiles.filter((cp) => cp.platform === p.key).length})` : ""}
      <input type="checkbox" ${connected ? "checked" : ""} />
    </label>`;
  }).join("");

  container.querySelectorAll(".platform-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const cb = chip.querySelector("input");
      cb.checked = !cb.checked;
      chip.classList.toggle("selected", cb.checked);
    });
  });
}

// ── Compose ──

const textarea = $("#post-text");
const charCount = $("#char-count");
const btnPost = $("#btn-post");
const feedback = $("#post-feedback");

textarea.addEventListener("input", () => {
  const len = textarea.value.length;
  charCount.textContent = `${len} / ${CHAR_SOFT_LIMIT}`;
  charCount.className = "char-count";
  if (len > CHAR_HARD_LIMIT) charCount.classList.add("danger");
  else if (len > CHAR_SOFT_LIMIT) charCount.classList.add("warning");
  btnPost.disabled = len === 0 || len > CHAR_HARD_LIMIT;
});

btnPost.addEventListener("click", async () => {
  const text = textarea.value.trim();
  if (!text) return;
  const platforms = Array.from($$(".platform-chip.selected")).map((c) => c.dataset.platform);
  if (!platforms.length) { showFeedback("Select at least one platform.", "error"); return; }
  if (!session?.access_token) { showFeedback("Please sign in.", "error"); return; }

  btnPost.disabled = true;
  btnPost.textContent = "Posting…";
  clearFeedback();

  try {
    const res = await fetch(`${API_BASE}/api/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ platforms, text }),
    });
    const data = await res.json();

    if (res.ok) {
      let html = "";
      for (const r of data.results) {
        html += `<div class="feedback-result-item">
          <span>${r.success ? "✅" : "❌"}</span>
          <span><strong>${r.platform}</strong>: ${r.success ? `<a href="${r.postUrl}" target="_blank">View →</a>` : r.error}</span>
        </div>`;
      }
      const ok = data.results.filter((r) => r.success).length;
      const fail = data.results.filter((r) => !r.success).length;
      showFeedback(fail === 0 ? `Posted to ${ok} platform(s)!` : `${ok} OK, ${fail} failed.`, fail === 0 ? "success" : "warning");
      feedback.insertAdjacentHTML("beforeend", `<div class="feedback-results">${html}</div>`);
      postHistory.unshift({ id: data.id, text, results: data.results, postedAt: data.postedAt });
      saveHistory();
      textarea.value = "";
      charCount.textContent = "0 / 300";
      charCount.className = "char-count";
    } else {
      showFeedback(data.error || "Post failed.", "error");
    }
  } catch {
    showFeedback("Network error.", "error");
  }
  btnPost.disabled = false;
  btnPost.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> Post`;
});

function showFeedback(msg, type) { feedback.className = `feedback ${type} visible`; feedback.textContent = msg; }
function clearFeedback() { feedback.className = "feedback"; feedback.innerHTML = ""; }

// ── History ──

function saveHistory() { try { localStorage.setItem("cnxt-post-history", JSON.stringify(postHistory.slice(0, 50))); } catch {} }
function loadHistory() { try { postHistory = JSON.parse(localStorage.getItem("cnxt-post-history") || "[]"); } catch { postHistory = []; } }

function renderHistory() {
  if (!postHistory.length) {
    $("#history-list").innerHTML = `<div class="empty-state"><div class="empty-state-icon">📝</div><p class="empty-state-text">Your posts will appear here.</p></div>`;
    return;
  }
  $("#history-list").innerHTML = postHistory.map((p) => `
    <div class="history-item">
      <div class="history-text">${esc(p.text)}</div>
      <div class="history-meta">
        <div class="history-platforms">${p.results.map((r) => `<span class="history-platform-badge${r.success ? "" : " failed"}">${r.platform}</span>`).join("")}</div>
        <span class="history-date">${fmtDate(p.postedAt)}</span>
        ${p.results.filter((r) => r.success && r.postUrl).map((r) => `<a href="${r.postUrl}" target="_blank" class="history-link">${r.platform} →</a>`).join("")}
      </div>
    </div>`).join("");
}

function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fmtDate(iso) {
  const d = new Date(iso), n = new Date(), m = Math.floor((n - d) / 60000);
  if (m < 1) return "Now"; if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Accounts & OAuth ──

function renderAccounts() {
  const platformMap = new Map<string, typeof connectedProfiles>();
  for (const p of connectedProfiles) {
    if (!platformMap.has(p.platform)) platformMap.set(p.platform, []);
    platformMap.get(p.platform)!.push(p);
  }

  $("#account-list").innerHTML = PLATFORMS.map((p) => {
    const profiles = platformMap.get(p.key) || [];
    const count = profiles.length;
    return `<div class="account-item">
      <div class="account-item-info">
        <div class="account-item-name">${p.name}</div>
        <div class="account-item-status${count ? " connected" : ""}">
          ${count ? `${count} profile${count > 1 ? "s" : ""} connected${profiles[0]?.handle ? ` · ${profiles.map((pp) => pp.handle || pp.label).join(", ")}` : ""}` : p.note || "Not connected"}
        </div>
      </div>
      <button class="btn btn-sm ${count ? "btn-ghost" : "btn-secondary"}" data-connect="${p.key}">${count ? "+ Add" : "Connect"}</button>
    </div>`;
  }).join("");

  $$("[data-connect]").forEach((btn) => {
    btn.addEventListener("click", () => connectPlatform(btn.dataset.connect));
  });
}

function connectPlatform(key) {
  const platform = PLATFORMS.find((p) => p.key === key);
  if (!platform) return;

  if (key === "bluesky") {
    const label = prompt("Profile name (e.g. 'Personal' or 'Company'):", "Personal");
    if (!label) return;
    const handle = prompt("Bluesky handle (e.g. you.bsky.social):");
    const password = prompt("App Password (from bsky.app/settings/app-passwords):");
    if (handle && password) {
      connectedProfiles.push({ platform: key, label, handle, id: crypto.randomUUID() });
      renderAccounts();
      renderPlatformChips();
    }
  } else {
    alert(`${platform.name} OAuth will be available once the developer app is registered.\n\nSupports multiple profiles (personal + company pages) per platform.`);
  }
}

// ── Init ──

async function init() {
  loadHistory();
  renderHistory();
  renderAccounts();
  renderPlatformChips();
  await refreshAuth();
}

init();
