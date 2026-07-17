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
let scheduledPosts = [];
let currentView = "compose";
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelected = null;

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

// ── Mobile Menu & Sidebar ──

const mobileMenuBtn = $("#mobile-menu-btn");
const sidebar = $("#sidebar");
const sidebarClose = $("#sidebar-close");
const sidebarOverlay = $("#sidebar-overlay");

function toggleSidebar() {
  sidebar.classList.toggle("sidebar-open");
  sidebarOverlay.classList.toggle("active");
  document.body.style.overflow = sidebar.classList.contains("sidebar-open") ? "hidden" : "";
}

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", toggleSidebar);
}

if (sidebarClose) {
  sidebarClose.addEventListener("click", toggleSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", toggleSidebar);
}

// Close sidebar when clicking nav items on mobile
$$(".sidebar-nav-item").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
});

// ── Navigation ──

function showView(name) {
  currentView = name;
  $$(".view").forEach((v) => v.classList.add("hidden"));
  const target = $(`#view-${name}`);
  if (target) target.classList.remove("hidden");

  // Update top nav
  $$(".nav-link").forEach((l) => l.classList.toggle("nav-link-active", l.dataset.view === name));
  
  // Update sidebar nav
  $$(".sidebar-nav-item").forEach((l) => l.classList.toggle("sidebar-nav-item-active", l.dataset.view === name));
}

// ── Old topbar navigation (for reference) ──
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (!session && (link.dataset.view === "compose" || link.dataset.view === "history" || link.dataset.view === "accounts")) {
      showView("welcome");
      return;
    }
    showView(link.dataset.view);
  });
});

// ── Sidebar navigation ──
$$(".sidebar-nav-item").forEach((link) => {
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
      updatePlatformPreviews();
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
  updatePlatformPreviews();
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

// ── Calendar ──

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function renderCalendar() {
  $("#calendar-month").textContent = `${MONTHS[calMonth]} ${calYear}`;
  const grid = $("#calendar-grid");
  let html = DAYS.map((d) => `<div class="calendar-header">${d}</div>`).join("");

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  // Days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    html += `<div class="calendar-day other-month">${d}</div>`;
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === calSelected;
    const hasPosts = scheduledPosts.some((p) => p.scheduledAt?.startsWith(dateStr));
    html += `<div class="calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}${hasPosts ? " has-posts" : ""}" data-date="${dateStr}">${d}</div>`;
  }

  // Remaining cells
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="calendar-day other-month">${d}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".calendar-day:not(.other-month)").forEach((day) => {
    day.addEventListener("click", () => {
      calSelected = day.dataset.date;
      renderCalendar();
      renderDayPosts();
    });
  });

  renderDayPosts();
}

function renderDayPosts() {
  const container = $("#calendar-posts");
  if (!calSelected) { container.innerHTML = ""; return; }

  const dayPosts = scheduledPosts.filter((p) => p.scheduledAt?.startsWith(calSelected));
  const dateLabel = new Date(calSelected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  let html = `<h3 style="margin-bottom:12px;">${dateLabel}</h3>`;

  if (dayPosts.length) {
    html += dayPosts.map((p) => `
      <div class="scheduled-list-item">
        <div>
          <div class="sli-text">${esc(p.text.slice(0, 100))}${p.text.length > 100 ? "…" : ""}</div>
          <div class="sli-meta">${p.platforms?.join(", ")} · ${new Date(p.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <button class="btn btn-xs btn-ghost" data-cancel="${p.id}" style="color:var(--error);">Cancel</button>
      </div>`).join("");
  } else {
    html += `<p style="color:var(--text-muted);font-size:0.875rem;">No posts scheduled for this day.</p>`;
  }

  // Schedule form
  html += `
    <div class="schedule-form">
      <textarea id="sched-text" placeholder="What do you want to post?" rows="3" style="width:100%;border:1.5px solid var(--border);border-radius:6px;padding:10px;font:inherit;font-size:0.875rem;resize:vertical;"></textarea>
      <div class="schedule-form-row">
        <input type="datetime-local" id="sched-time" value="${calSelected}T09:00" style="flex:1;" />
        <button class="btn btn-sm btn-primary" id="btn-schedule">Schedule</button>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);">Select platforms in the Compose tab first, or they will default to your connected platforms.</div>
    </div>`;
  container.innerHTML = html;

  // Cancel buttons
  container.querySelectorAll("[data-cancel]").forEach((btn) => {
    btn.addEventListener("click", async () => cancelScheduled(btn.dataset.cancel));
  });

  // Schedule button
  const schedBtn = $("#btn-schedule");
  if (schedBtn) {
    schedBtn.addEventListener("click", schedulePost);
  }
}

async function fetchScheduled() {
  if (!session?.access_token) return;
  try {
    const res = await fetch(`${API_BASE}/api/scheduled`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    scheduledPosts = (await res.json()) || [];
  } catch { scheduledPosts = []; }
  renderCalendar();
}

async function schedulePost() {
  const text = $("#sched-text")?.value?.trim();
  const timeInput = $("#sched-time")?.value;
  if (!text) return;
  if (!timeInput) return;

  const platforms = Array.from($$(".platform-chip.selected")).map((c) => c.dataset.platform);
  if (!platforms.length) { alert("Select at least one platform in the Compose tab."); return; }

  try {
    const res = await fetch(`${API_BASE}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ text, platforms, scheduledAt: new Date(timeInput).toISOString() }),
    });
    if (res.ok) {
      await fetchScheduled();
      $("#sched-text").value = "";
    } else {
      const err = await res.json();
      alert(err.error || "Failed to schedule");
    }
  } catch { alert("Network error."); }
}

async function cancelScheduled(id) {
  if (!confirm("Cancel this scheduled post?")) return;
  try {
    await fetch(`${API_BASE}/api/scheduled/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    await fetchScheduled();
  } catch { alert("Failed to cancel."); }
}

$("#cal-prev").addEventListener("click", () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } calSelected = null; renderCalendar(); });
$("#cal-next").addEventListener("click", () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } calSelected = null; renderCalendar(); });
$("#cal-today").addEventListener("click", () => { calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); calSelected = new Date().toISOString().slice(0,10); renderCalendar(); });

// ── Media Upload ──

const mediaDropzone = $("#media-dropzone");
const mediaInput = $("#media-input");
const mediaPreview = $("#media-preview");

let uploadedMedia = [];

if (mediaDropzone && mediaInput) {
  mediaInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleMediaUpload(files);
    }
  });

  mediaDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    mediaDropzone.style.borderColor = "var(--brand)";
    mediaDropzone.style.background = "var(--brand-soft)";
  });

  mediaDropzone.addEventListener("dragleave", () => {
    mediaDropzone.style.borderColor = "var(--border)";
    mediaDropzone.style.background = "var(--bg)";
  });

  mediaDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    mediaDropzone.style.borderColor = "var(--border)";
    mediaDropzone.style.background = "var(--bg)";
    
    const files = Array.from(e.dataTransfer.files).filter((f) => 
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    
    if (files.length > 0) {
      handleMediaUpload(files);
    }
  });
}

function handleMediaUpload(files) {
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedMedia.push({
        file,
        url: e.target.result,
        type: file.type.startsWith("image/") ? "image" : "video"
      });
      renderMediaPreview();
    };
    reader.readAsDataURL(file);
  });
}

function renderMediaPreview() {
  if (uploadedMedia.length === 0) {
    mediaPreview.style.display = "none";
    mediaDropzone.style.display = "flex";
    return;
  }
  
  mediaPreview.style.display = "flex";
  mediaDropzone.style.display = "none";
  
  mediaPreview.innerHTML = uploadedMedia.map((media, index) => `
    <div class="media-preview-item">
      ${media.type === "image" 
        ? `<img src="${media.url}" alt="Uploaded media" />`
        : `<video src="${media.url}" muted></video>`}
      <button class="media-preview-remove" data-index="${index}">×</button>
    </div>
  `).join("");
  
  mediaPreview.querySelectorAll(".media-preview-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index);
      uploadedMedia.splice(index, 1);
      renderMediaPreview();
    });
  });
}

// ── Drafts ──

const btnSaveDraft = $("#btn-save-draft");

if (btnSaveDraft) {
  btnSaveDraft.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text && uploadedMedia.length === 0) {
      showFeedback("Add content to save as draft.", "error");
      return;
    }
    
    if (!session?.access_token) {
      showFeedback("Please sign in to save drafts.", "error");
      return;
    }
    
    const platforms = Array.from($$(".platform-chip.selected")).map((c) => c.dataset.platform);
    
    btnSaveDraft.disabled = true;
    btnSaveDraft.textContent = "Saving…";
    
    try {
      const res = await fetch(`${API_BASE}/api/drafts`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          text,
          platforms,
          media: uploadedMedia.map((m) => ({
            type: m.type,
            name: m.file.name
          }))
        }),
      });
      
      if (res.ok) {
        showFeedback("Draft saved!", "success");
      } else {
        const data = await res.json();
        showFeedback(data.error || "Failed to save draft.", "error");
      }
    } catch {
      showFeedback("Network error.", "error");
    }
    
    btnSaveDraft.disabled = false;
    btnSaveDraft.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Save draft
    `;
  });
}

// ── Init ──

async function init() {
  loadHistory();
  renderHistory();
  renderAccounts();
  renderPlatformChips();
  await refreshAuth();
  await fetchScheduled();
}

init();
