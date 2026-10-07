/* ==========================================================
   STUDY PLANNER — app logic (vanilla JS + localStorage)
   ========================================================== */

"use strict";

// ---------- Constants ----------
const LS_TASKS = "studyplanner_tasks";
const LS_THEME = "studyplanner_theme";

// ---------- State ----------
let tasks = [];
let currentView = "dashboard"; // dashboard | all | today | upcoming | done
let tabFilter = "all";         // all | today | upcoming | todo | done
let priorityFilter = "all";
let searchQuery = "";
let editingId = null;
let deleteId = null;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const taskList = $("taskList");
const emptyState = $("emptyState");
const notFound = $("notFound");

// ---------- Helpers ----------
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function uid() {
  return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Deadline: hitung selisih hari (deadline - hari ini), abaikan jam
function deadlineInfo(iso) {
  if (!iso) return { diff: null, label: "—", cls: "" };
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(iso + "T00:00:00"));
  const diff = Math.round((target - today) / 86400000);
  if (diff < 0) return { diff, label: `🔴 Terlambat ${Math.abs(diff)} hari`, cls: "late" };
  if (diff === 0) return { diff, label: "🔴 Hari ini", cls: "today" };
  if (diff === 1) return { diff, label: "🟠 Besok", cls: "tomorrow" };
  return { diff, label: `🔵 ${diff} hari lagi`, cls: "future" };
}
function isToday(iso) {
  return deadlineInfo(iso).diff === 0;
}
function isUpcoming(iso) {
  const d = deadlineInfo(iso).diff;
  return d !== null && d > 0;
}

// ---------- Seed & Storage ----------
function seedTasks() {
  const now = new Date();
  return [
    {
      id: uid() + "1",
      title: "Membuat CRUD Laravel",
      subject: "Pemrograman Web",
      desc: "Buat CRUD data siswa dengan validasi dan migration.",
      deadline: toISODate(addDays(now, 1)), // besok
      priority: "Tinggi",
      status: "Sedang Dikerjakan",
      createdAt: Date.now() - 3000,
    },
    {
      id: uid() + "2",
      title: "Membuat laporan PKL",
      subject: "Bahasa Indonesia",
      desc: "Susun laporan bab 1–3, perhatikan EYD dan struktur.",
      deadline: toISODate(addDays(now, 3)), // 3 hari lagi
      priority: "Sedang",
      status: "Belum Dikerjakan",
      createdAt: Date.now() - 2000,
    },
    {
      id: uid() + "3",
      title: "Belajar JavaScript Array",
      subject: "Pemrograman Web",
      desc: "Pelajari map, filter, reduce + latihan soal.",
      deadline: toISODate(now), // hari ini
      priority: "Rendah",
      status: "Selesai",
      createdAt: Date.now() - 1000,
    },
  ];
}
function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_TASKS);
    if (!raw) {
      tasks = seedTasks();
      saveTasks();
      return;
    }
    const parsed = JSON.parse(raw);
    tasks = Array.isArray(parsed) ? parsed : seedTasks();
    if (tasks.length === 0 && raw === null) tasks = seedTasks();
  } catch {
    tasks = seedTasks();
  }
}
function saveTasks() {
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
}

// ---------- Toast ----------
function toast(msg, type = "success") {
  const wrap = $("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

// ---------- Header date ----------
function renderDate() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  let s = fmt.format(now); // cth: "Rabu, 7 Oktober 2026"
  s = s.charAt(0).toUpperCase() + s.slice(1);
  $("todayDate").textContent = s;
}

// ---------- Stats & Progress ----------
function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Selesai").length;
  const doing = tasks.filter((t) => t.status === "Sedang Dikerjakan").length;
  const todo = tasks.filter((t) => t.status === "Belum Dikerjakan").length;

  $("statTotal").textContent = total;
  $("statDoing").textContent = doing;
  $("statDone").textContent = done;
  $("statTodo").textContent = todo;

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  $("progressPct").textContent = pct + "%";
  $("progressSub").textContent = `${done} dari ${total} tugas telah selesai`;
  $("progressFill").style.width = pct + "%";

  // progress steps (max 12 titik)
  const steps = $("progressSteps");
  steps.innerHTML = "";
  const n = Math.min(Math.max(total, 4), 12);
  const filled = total === 0 ? 0 : Math.round((done / total) * n);
  for (let i = 0; i < n; i++) {
    const d = document.createElement("div");
    d.className = "step-dot" + (i < filled ? " fill" : "");
    steps.appendChild(d);
  }

  // sidebar mini progress
  $("sidebarProgressPct").textContent = `${pct}% tugas selesai`;
  $("sidebarProgressFill").style.width = pct + "%";
  $("sidebarProgressSub").textContent =
    pct === 100 ? "Luar biasa, semua beres! 🎉" :
    pct >= 60 ? "Bagus, pertahankan! 🔥" :
    pct > 0 ? "Tetap semangat! 🎯" : "Yuk mulai tugas pertama! 💪";

  // nav badges
  $("countAll").textContent = total;
  $("countToday").textContent = tasks.filter((t) => isToday(t.deadline) && t.status !== "Selesai").length;

  // notif dot: tampil jika ada yang terlambat / hari ini belum selesai
  const urgent = tasks.filter((t) => {
    const d = deadlineInfo(t.deadline).diff;
    return t.status !== "Selesai" && d !== null && d <= 0;
  }).length;
  $("notifDot").style.display = urgent > 0 ? "block" : "none";
}

// ---------- Filtering ----------
function getFilteredTasks() {
  let list = [...tasks];

  // 1. view dari sidebar
  if (currentView === "today") list = list.filter((t) => isToday(t.deadline));
  else if (currentView === "upcoming") list = list.filter((t) => isUpcoming(t.deadline));
  else if (currentView === "done") list = list.filter((t) => t.status === "Selesai");
  else if (currentView === "all") { /* semua, tab yang mengatur */ }

  // 2. tab filter
  if (tabFilter === "today") list = list.filter((t) => isToday(t.deadline));
  else if (tabFilter === "upcoming") list = list.filter((t) => isUpcoming(t.deadline));
  else if (tabFilter === "todo") list = list.filter((t) => t.status !== "Selesai");
  else if (tabFilter === "done") list = list.filter((t) => t.status === "Selesai");

  // 3. prioritas
  if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);

  // 4. search (nama, mapel, deskripsi)
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.desc || "").toLowerCase().includes(q)
    );
  }

  // urut: belum selesai dulu, lalu deadline terdekat
  const statusRank = { "Belum Dikerjakan": 0, "Sedang Dikerjakan": 1, "Selesai": 2 };
  list.sort((a, b) => {
    const r = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (r !== 0) return r;
    return (a.deadline || "").localeCompare(b.deadline || "");
  });
  return list;
}

function sectionTitle() {
  if (searchQuery.trim()) return "Hasil Pencarian";
  if (currentView === "today" || tabFilter === "today") return "Tugas Hari Ini";
  if (currentView === "upcoming" || tabFilter === "upcoming") return "Tugas Mendatang";
  if (currentView === "done" || tabFilter === "done") return "Tugas Selesai";
  if (tabFilter === "todo") return "Tugas Belum Selesai";
  if (currentView === "all") return "Semua Tugas";
  return "Tugas Terbaru";
}

// ---------- Render tasks ----------
function statusBadgeClass(s) {
  if (s === "Selesai") return "status-done";
  if (s === "Sedang Dikerjakan") return "status-doing";
  return "status-todo";
}
function statusShort(s) {
  if (s === "Belum Dikerjakan") return "Belum";
  if (s === "Sedang Dikerjakan") return "Proses";
  return "Selesai";
}

function renderTasks() {
  const list = getFilteredTasks();
  $("taskSectionTitle").textContent = sectionTitle();
  $("taskSectionSub").textContent =
    list.length === 0 ? "Tidak ada tugas pada tampilan ini." :
    `${list.length} tugas ditemukan. Selesaikan satu per satu!`;

  // empty vs not-found
  const hasAnyTask = tasks.length > 0;
  const isSearching = searchQuery.trim() !== "" || tabFilter !== "all" ||
    priorityFilter !== "all" || currentView !== "dashboard";

  taskList.innerHTML = "";
  if (list.length === 0) {
    if (!hasAnyTask) {
      emptyState.classList.remove("hidden");
      notFound.classList.add("hidden");
    } else {
      emptyState.classList.add("hidden");
      if (searchQuery.trim()) {
        notFound.classList.remove("hidden");
        notFound.textContent = "🔍 Tugas tidak ditemukan.";
      } else {
        notFound.classList.remove("hidden");
        notFound.textContent = isSearching
          ? "📭 Tidak ada tugas pada filter ini."
          : "📭 Belum ada tugas.";
      }
    }
    return;
  }
  emptyState.classList.add("hidden");
  notFound.classList.add("hidden");

  list.forEach((t) => {
    const dl = deadlineInfo(t.deadline);
    const done = t.status === "Selesai";
    const card = document.createElement("div");
    card.className = "task-card" + (done ? " done" : "");
    card.dataset.id = t.id;
    card.innerHTML = `
      <button class="checkbox" data-act="toggle" aria-label="Tandai selesai" title="Tandai selesai"></button>
      <div class="task-main">
        <p class="task-title">${esc(t.title)}</p>
        <div class="task-meta">
          <span class="task-subject">${esc(t.subject)}</span>
          <span class="task-deadline ${dl.cls}">📅 ${esc(dl.label)}</span>
        </div>
        ${t.desc ? `<p class="task-desc">${esc(t.desc)}</p>` : ""}
      </div>
      <div class="task-badges">
        <span class="badge pri-${esc(t.priority)}">${t.priority === "Tinggi" ? "🔴" : t.priority === "Sedang" ? "🟡" : "🟢"} ${esc(t.priority)}</span>
        <span class="badge ${statusBadgeClass(t.status)}">${esc(statusShort(t.status))}</span>
      </div>
      <div class="task-menu-wrap">
        <button class="kebab" data-act="menu" aria-label="Opsi">⋮</button>
        <div class="task-menu">
          <button data-act="edit">✏️ Edit</button>
          <button data-act="delete" class="del">🗑️ Hapus</button>
        </div>
      </div>`;
    taskList.appendChild(card);
  });
}

function renderAll() {
  renderStats();
  renderTasks();
  renderNotif();
}

// ---------- Notifications ----------
function renderNotif() {
  const box = $("notifList");
  box.innerHTML = "";
  const urgent = tasks.filter((t) => t.status !== "Selesai" && deadlineInfo(t.deadline).diff !== null && deadlineInfo(t.deadline).diff <= 1);
  if (urgent.length === 0) {
    box.innerHTML = `<div class="notif-item"><strong>Semua aman! 🎉</strong><br><small>Tidak ada deadline mendesak.</small></div>`;
    return;
  }
  urgent.slice(0, 5).forEach((t) => {
    const dl = deadlineInfo(t.deadline);
    const el = document.createElement("div");
    el.className = "notif-item" + (dl.diff <= 0 ? " warn" : "");
    el.innerHTML = `<strong>${esc(t.title)}</strong><br><small>${esc(t.subject)} • ${esc(dl.label)}</small>`;
    box.appendChild(el);
  });
}

// ---------- Modal (tambah / edit) ----------
function openModal(mode, task = null) {
  editingId = mode === "edit" && task ? task.id : null;
  $("modalTitle").textContent = mode === "edit" ? "Edit Tugas" : "Tambah Tugas Baru";
  $("saveTaskBtn").textContent = mode === "edit" ? "Simpan Perubahan" : "Simpan Tugas";
  clearErrors();

  if (task) {
    $("fTitle").value = task.title;
    $("fSubject").value = task.subject;
    $("fDesc").value = task.desc || "";
    $("fDeadline").value = task.deadline || "";
    setRadio("priority", task.priority);
    setRadio("status", task.status);
  } else {
    $("taskForm").reset();
    setRadio("priority", "Rendah");
    setRadio("status", "Belum Dikerjakan");
  }
  $("taskModalOverlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setTimeout(() => $("fTitle").focus(), 60);
}
function closeModal() {
  $("taskModalOverlay").classList.add("hidden");
  document.body.style.overflow = "";
  editingId = null;
}
function setRadio(name, value) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((r) => {
    r.checked = r.value === value;
  });
}
function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}
function clearErrors() {
  ["errTitle", "errSubject", "errDeadline"].forEach((id) => ($(id).textContent = ""));
  ["fTitle", "fSubject", "fDeadline"].forEach((id) => $(id).classList.remove("input-invalid"));
}
function validateForm() {
  clearErrors();
  let ok = true;
  const title = $("fTitle").value.trim();
  const subject = $("fSubject").value;
  const deadline = $("fDeadline").value;

  if (!title) {
    $("errTitle").textContent = "Nama tugas wajib diisi.";
    $("fTitle").classList.add("input-invalid");
    ok = false;
  }
  if (!subject) {
    $("errSubject").textContent = "Pilih mata pelajaran.";
    $("fSubject").classList.add("input-invalid");
    ok = false;
  }
  if (!deadline) {
    $("errDeadline").textContent = "Tanggal deadline wajib diisi.";
    $("fDeadline").classList.add("input-invalid");
    ok = false;
  }
  return ok;
}

function handleSave(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const data = {
    title: $("fTitle").value.trim(),
    subject: $("fSubject").value,
    desc: $("fDesc").value.trim(),
    deadline: $("fDeadline").value,
    priority: getRadio("priority") || "Rendah",
    status: getRadio("status") || "Belum Dikerjakan",
  };

  if (editingId) {
    const idx = tasks.findIndex((t) => t.id === editingId);
    if (idx !== -1) {
      const wasDone = tasks[idx].status === "Selesai";
      tasks[idx] = { ...tasks[idx], ...data };
      saveTasks(); renderAll();
      closeModal();
      toast(wasDone || data.status === "Selesai" ? "✓ Tugas berhasil diperbarui" : "✓ Tugas berhasil diperbarui");
    }
  } else {
    tasks.unshift({ id: uid(), createdAt: Date.now(), ...data });
    saveTasks(); renderAll();
    closeModal();
    toast("✓ Tugas berhasil ditambahkan");
  }
}

// ---------- Delete ----------
function openDelete(id) {
  deleteId = id;
  const t = tasks.find((x) => x.id === id);
  $("deleteText").textContent = t
    ? `Apakah kamu yakin ingin menghapus "${t.title}"?`
    : "Apakah kamu yakin ingin menghapus tugas ini?";
  $("deleteOverlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeDelete() {
  $("deleteOverlay").classList.add("hidden");
  document.body.style.overflow = "";
  deleteId = null;
}
function confirmDelete() {
  if (!deleteId) return;
  tasks = tasks.filter((t) => t.id !== deleteId);
  saveTasks(); renderAll();
  closeDelete();
  toast("✓ Tugas berhasil dihapus");
}

// ---------- Toggle selesai ----------
function toggleTask(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.status === "Selesai") {
    t.status = "Belum Dikerjakan";
    saveTasks(); renderAll();
    toast("Tugas dikembalikan ke belum selesai");
  } else {
    t.status = "Selesai";
    saveTasks(); renderAll();
    // animasi kecil pada card yang baru selesai
    const card = taskList.querySelector(`[data-id="${id}"]`);
    if (card) card.classList.add("just-done");
    toast("🎉 Tugas berhasil diselesaikan!");
  }
}

// ---------- View / filter ----------
function setView(view) {
  currentView = view;
  // sinkronkan tab bila view punya padanan
  if (view === "today") tabFilter = "today";
  else if (view === "upcoming") tabFilter = "upcoming";
  else if (view === "done") tabFilter = "done";
  else if (view === "all") tabFilter = "all";
  else if (view === "dashboard") tabFilter = "all";

  document.querySelectorAll("#filterTabs .tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.filter === tabFilter);
  });
  document.querySelectorAll("[data-view]").forEach((b) => {
    if (b.classList.contains("nav-item") || b.classList.contains("bnav-item")) {
      b.classList.toggle("active", b.dataset.view === view);
    }
  });
  renderTasks();
  closeSidebarMobile();
  document.querySelector(".tasks-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Sidebar mobile ----------
function closeSidebarMobile() {
  $("sidebar").classList.remove("open");
  $("sidebarOverlay").classList.remove("show");
}

// ---------- Theme ----------
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
}
function loadTheme() {
  const saved = localStorage.getItem(LS_THEME) || "light";
  applyTheme(saved);
}
function toggleTheme() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(LS_THEME, isDark ? "dark" : "light");
  toast(isDark ? "🌙 Dark mode aktif" : "☀️ Light mode aktif");
}

// ---------- Events ----------
function bindEvents() {
  // tambah tugas (3 tombol + fab)
  ["addTaskBtnHero", "addTaskBtnTop", "addTaskBtnEmpty", "fabAdd"].forEach((id) => {
    $(id)?.addEventListener("click", () => openModal("add"));
  });

  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("taskModalOverlay").addEventListener("click", (e) => {
    if (e.target === $("taskModalOverlay")) closeModal();
  });
  $("taskForm").addEventListener("submit", handleSave);

  // delete modal
  $("cancelDeleteBtn").addEventListener("click", closeDelete);
  $("deleteOverlay").addEventListener("click", (e) => {
    if (e.target === $("deleteOverlay")) closeDelete();
  });
  $("confirmDeleteBtn").addEventListener("click", confirmDelete);

  // task list (delegation)
  taskList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const card = e.target.closest(".task-card");
    if (!card) return;
    const id = card.dataset.id;
    const act = btn.dataset.act;

    if (act === "toggle") toggleTask(id);
    else if (act === "edit") {
      const t = tasks.find((x) => x.id === id);
      if (t) openModal("edit", t);
    }
    else if (act === "delete") openDelete(id);
    else if (act === "menu") {
      const menu = card.querySelector(".task-menu");
      const wasOpen = menu.classList.contains("show");
      document.querySelectorAll(".task-menu.show").forEach((m) => m.classList.remove("show"));
      if (!wasOpen) menu.classList.add("show");
      e.stopPropagation();
    }
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".task-menu.show").forEach((m) => m.classList.remove("show"));
  });

  // tabs
  $("filterTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    tabFilter = btn.dataset.filter;
    document.querySelectorAll("#filterTabs .tab").forEach((b) => b.classList.toggle("active", b === btn));
    // jika tab spesifik dipilih, anggap view mengikuti agar konsisten
    renderTasks();
  });

  // priority
  $("priorityFilter").addEventListener("change", (e) => {
    priorityFilter = e.target.value;
    renderTasks();
  });

  // search realtime
  $("searchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTasks();
  });

  // sidebar + bottom nav
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.view));
  });
  $("logoBtn").addEventListener("click", (e) => {
    e.preventDefault();
    setView("dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("viewTodayBtn").addEventListener("click", () => setView("today"));

  // hamburger & overlay
  $("hamburger").addEventListener("click", () => {
    $("sidebar").classList.add("open");
    $("sidebarOverlay").classList.add("show");
  });
  $("sidebarOverlay").addEventListener("click", closeSidebarMobile);

  // notif
  $("notifBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    $("notifPanel").classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#notifPanel") && !e.target.closest("#notifBtn")) {
      $("notifPanel").classList.remove("show");
    }
  });

  // theme + settings
  $("themeToggle").addEventListener("click", toggleTheme);
  $("settingsBtn").addEventListener("click", () => {
    toast("⚙️ Pengaturan: gunakan toggle 🌙/☀️ untuk ganti tema");
    closeSidebarMobile();
  });

  // ESC menutup modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeDelete();
      $("notifPanel").classList.remove("show");
    }
  });
}

// ---------- Init ----------
function init() {
  loadTheme();
  loadTasks();
  renderDate();
  bindEvents();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
