// ── cnxt to post — Dashboard ──

import { getSharedSession, clearSharedSession } from "./cnxt-auth.js";

const API_BASE = "https://post.cnxt.to";
const CHAR_SOFT_LIMIT = 300; // Bluesky limit (X is 280)
const CHAR_HARD_LIMIT = 5000;

// ── Supabase config ──
const SUPABASE_URL = "https://jstojewashwoswsskwjk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdG9qZXdhc2h3b3N3c3Nrd2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTg2OTAsImV4cCI6MjA5MzkzNDY5MH0.o3hYxYr1ZbmEShPfZebx1vchjmIrN7uYZMX1C5fhoac";

// ── State ──
let session = null;
let postHistory = [];
const ACCOUNTS = [
  { platform: "bluesky", name: "Bluesky", icon: "🦋", configured: false },
  { platform: "x", name: "X (Twitter)", icon: "𝕏", configured: false, note: "BYOK or credits required" },
  { platform: "linkedin", name: "LinkedIn", icon: "💼", configured: false },
  { platform: "facebook", name: "Facebook", icon: "📘", configured: false },
  { platform: "instagram", name: "Instagram", icon: "📸", configured: false },
  { platform: "tiktok", name: "TikTok", icon: "🎵", configured: false, note: "Content Posting API approval required" },
];

// ── DOM refs ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const textarea = $("#post-text");
const charCount = $("#char-count");
const btnPost = $("#btn-post");
const feedback = $("#post-feedback");
const historyList = $("#history-list");
const accountList = $("#account-list");
const userEmail = $("#user-email");
const btnSignIn = $("#btn-sign-in");
const btnSignOut = $("#btn-sign-out");

// ── Auth ──

async function initSupabase() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

async function refreshAuth() {
  try {
    // First, restore cross-domain session from shared cookie
    await getSharedSession();

    const supabase = await initSupabase();
    const { data } = await supabase.auth.getSession();
    session = data.session;

    const signedIn = Boolean(session?.user);
    userEmail.textContent = signedIn ? session.user.email : "";
    btnSignIn.classList.toggle("hidden", signedIn);
    btnSignOut.classList.toggle("hidden", !signedIn);
  } catch {
    session = null;
  }
}

btnSignOut.addEventListener("click", async () => {
  const supabase = await initSupabase();
  await supabase.auth.signOut();
  await clearSharedSession();
  session = null;
  refreshAuth();
});

// ── Navigation ──

$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    const view = link.dataset.view;
    $$(".nav-link").forEach((l) => l.classList.remove("nav-link-active"));
    link.classList.add("nav-link-active");
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $(`#view-${view}`).classList.remove("hidden");
  });
});

// ── Platform chip toggles ──

$$(".platform-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const cb = chip.querySelector("input");
    if (chip.classList.contains("disabled")) return;
    cb.checked = !cb.checked;
    chip.classList.toggle("selected", cb.checked);
  });
});

function getSelectedPlatforms() {
  return Array.from($$(".platform-chip.selected")).map((c) => c.dataset.platform);
}

// ── Compose ──

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

  const platforms = getSelectedPlatforms();
  if (!platforms.length) {
    showFeedback("Select at least one platform.", "error");
    return;
  }

  if (!session?.access_token) {
    showFeedback("Please sign in to post.", "error");
    return;
  }

  btnPost.disabled = true;
  btnPost.textContent = "Posting…";
  clearFeedback();

  try {
    const res = await fetch(`${API_BASE}/api/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ platforms, text }),
    });

    const data = await res.json();

    if (res.ok) {
      const succeeded = data.results.filter((r) => r.success);
      const failed = data.results.filter((r) => !r.success);

      let html = "";
      for (const r of data.results) {
        const icon = r.success ? "✅" : "❌";
        html += `<div class="feedback-result-item">
          <span class="feedback-result-icon">${icon}</span>
          <span><strong>${r.platform}</strong>: ${r.success
            ? `<a href="${r.postUrl}" target="_blank" rel="noopener">View post</a>`
            : r.error}</span>
        </div>`;
      }

      if (failed.length === 0) {
        showFeedback(`Posted to ${succeeded.length} platform${succeeded.length !== 1 ? "s" : ""}!`, "success");
      } else {
        showFeedback(`${succeeded.length} succeeded, ${failed.length} failed.`, "warning");
      }

      feedback.insertAdjacentHTML("beforeend", `<div class="feedback-results">${html}</div>`);

      // Add to local history
      postHistory.unshift({
        id: data.id,
        text,
        results: data.results,
        postedAt: data.postedAt,
      });
      saveHistory();

      textarea.value = "";
      charCount.textContent = "0 / 300";
      charCount.className = "char-count";
    } else {
      showFeedback(data.error || "Post failed. Please try again.", "error");
    }
  } catch (e) {
    showFeedback("Network error. Check your connection and try again.", "error");
  }

  btnPost.disabled = false;
  btnPost.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> Post`;
});

function showFeedback(msg, type) {
  feedback.className = `feedback ${type} visible`;
  // Keep existing results if any
  const existingResults = feedback.querySelector(".feedback-results");
  feedback.textContent = msg;
  if (existingResults) feedback.appendChild(existingResults);
}

function clearFeedback() {
  feedback.className = "feedback";
  feedback.innerHTML = "";
}

// ── History ──

function saveHistory() {
  try {
    localStorage.setItem("cnxt-post-history", JSON.stringify(postHistory.slice(0, 50)));
  } catch {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("cnxt-post-history");
    if (raw) postHistory = JSON.parse(raw);
  } catch {
    postHistory = [];
  }
}

function renderHistory() {
  if (!postHistory.length) {
    historyList.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">📝</div>
      <p class="empty-state-text">Your posts will appear here after you publish.</p>
    </div>`;
    return;
  }

  historyList.innerHTML = postHistory
    .map(
      (post) => `
    <div class="history-item">
      <div class="history-text">${escapeHtml(post.text)}</div>
      <div class="history-meta">
        <div class="history-platforms">
          ${post.results
            .map(
              (r) =>
                `<span class="history-platform-badge${r.success ? "" : " failed"}">${r.platform}</span>`
            )
            .join("")}
        </div>
        <span class="history-date">${formatDate(post.postedAt)}</span>
        ${post.results
          .filter((r) => r.success && r.postUrl)
          .map(
            (r) =>
              `<a href="${r.postUrl}" target="_blank" rel="noopener" class="history-link">View on ${r.platform} →</a>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

// ── Accounts ──

function renderAccounts() {
  accountList.innerHTML = ACCOUNTS.map(
    (a) => `
    <div class="account-item">
      <div class="account-item-icon">${a.icon}</div>
      <div class="account-item-info">
        <div class="account-item-name">${a.name}</div>
        <div class="account-item-status${a.configured ? " connected" : ""}">
          ${a.configured ? "Connected" : a.note || "Not connected"}
        </div>
      </div>
      <button class="btn btn-sm ${a.configured ? "btn-ghost" : "btn-secondary"}" data-connect="${a.platform}">
        ${a.configured ? "Reconnect" : "Connect"}
      </button>
    </div>`
  ).join("");

  // Wire connect buttons
  $$("[data-connect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const platform = btn.dataset.connect;
      alert(`Account connection for ${platform} will be available soon.\n\nFor now, you can use BYOK (Bring Your Own Keys) by setting environment variables in the Worker.`);
    });
  });
}

// ── Init ──

async function init() {
  loadHistory();
  renderHistory();
  renderAccounts();
  await refreshAuth();
}

init();
