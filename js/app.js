(() => {
  const THEME_KEY = "axa-org-theme";
  const THEMES = ["light", "color", "dark"];
  const PPT_WIDTH = 1920;
  const PPT_HEIGHT = 1080;

  const chartViewport = document.getElementById("chart-viewport");
  const chartScaler = document.getElementById("chart-scaler");
  const pptSlide = document.getElementById("ppt-slide");
  const orgRoot = document.getElementById("org-root");
  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("chart-title");
  const subtitleEl = document.getElementById("chart-subtitle");
  const footerEl = document.getElementById("slide-footer-note");
  const toastEl = document.getElementById("toast");
  const downloadBtn = document.getElementById("download-btn");
  const copyBtn = document.getElementById("copy-btn");
  const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));

  let toastTimer = null;
  let fitRaf = 0;
  let exportBlob = null;
  let exportBlobPromise = null;
  const APP_BUILD = "20261029i";

  const DEFAULT_PILLARS = [
    { id: "system", label: "System Enhancement", tone: "green" },
    { id: "process", label: "Process Improvement", tone: "purple" },
    { id: "automation", label: "Automation", tone: "orange" },
  ];

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    const next = THEMES.includes(theme) ? theme : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    modeButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode") === next);
    });
    if (orgRoot.querySelector(".org-tree")) {
      queueExportRefresh();
    }
  }

  function resolvePhotoSrc(photo) {
    const value = String(photo || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:|\.\/|\/)/i.test(value)) return value;
    return `./assets/photos/${value.replace(/^\/+/, "")}`;
  }

  function personInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0))
      .join("")
      .toUpperCase();
  }

  function placeholderMark(name) {
    const wrap = document.createElement("div");
    wrap.className = "ph";
    wrap.innerHTML = `
      <svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" />
        <circle cx="12" cy="10" r="3" />
        <path d="M5.5 19.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5" />
      </svg>
      <span class="ph-initials"></span>
    `;
    wrap.querySelector(".ph-initials").textContent = personInitials(name);
    return wrap;
  }

  function createAvatar(person) {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");

    const src = resolvePhotoSrc(person.photo || person.image || person.avatar || "");
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => {
        img.remove();
        avatar.appendChild(placeholderMark(person.name));
      };
      avatar.appendChild(img);
    } else {
      avatar.appendChild(placeholderMark(person.name));
    }
    return avatar;
  }

  function createCard(person, options = {}) {
    const card = document.createElement("article");
    const pillar = String(person.pillar || "leadership").toLowerCase();
    const size = options.size || "default";
    card.className = `card${options.root ? " root" : ""}${size !== "default" ? ` card-${size}` : ""}`;
    card.dataset.pillar = pillar;
    card.setAttribute("aria-label", `${person.name}, ${person.role || ""}`);

    const meta = document.createElement("div");
    meta.className = "meta";

    const name = document.createElement("p");
    name.className = "name";
    name.textContent = person.name;

    const role = document.createElement("p");
    role.className = "role";
    role.textContent = person.role || "";

    meta.append(name, role);

    if (options.showTeam && person.team) {
      const team = document.createElement("p");
      team.className = "team";
      team.textContent = person.team;
      meta.append(team);
    }

    card.append(createAvatar(person), meta);
    return card;
  }

  function sortById(list) {
    return [...list].sort((a, b) =>
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
    );
  }

  function isLeadRole(role) {
    const r = String(role || "").toLowerCase();
    return r.includes("pillar lead") || r.includes("pillar co-lead") || r.includes("co-lead");
  }

  function renderPillarsLayout(data, people) {
    const pillars = Array.isArray(data.pillars) && data.pillars.length
      ? data.pillars
      : DEFAULT_PILLARS;

    const leaders = sortById(
      people.filter((p) => String(p.pillar || "").toLowerCase() === "leadership")
    );

    const tree = document.createElement("div");
    tree.className = "org-tree pillars-layout org-board";
    tree.setAttribute("role", "tree");

    const command = document.createElement("header");
    command.className = "command-bar";

    const leadLabel = document.createElement("div");
    leadLabel.className = "rail-label";
    leadLabel.textContent = "Leadership";
    command.appendChild(leadLabel);

    const leadersEl = document.createElement("div");
    leadersEl.className = "leaders";
    leaders.forEach((person, index) => {
      leadersEl.appendChild(
        createCard(person, { root: index === 0, showTeam: true, size: "lead" })
      );
      if (index < leaders.length - 1) {
        const arrow = document.createElement("span");
        arrow.className = "lead-flow";
        arrow.setAttribute("aria-hidden", "true");
        leadersEl.appendChild(arrow);
      }
    });
    command.appendChild(leadersEl);

    const flow = document.createElement("div");
    flow.className = "flow-ribbons";
    flow.setAttribute("aria-hidden", "true");
    flow.innerHTML = `
      <span class="ribbon ribbon-a"></span>
      <span class="ribbon ribbon-b"></span>
      <span class="ribbon ribbon-c"></span>
    `;
    command.appendChild(flow);
    tree.appendChild(command);

    const stage = document.createElement("div");
    stage.className = "pillars-stage";

    const row = document.createElement("div");
    row.className = "pillars-row";

    pillars.forEach((pillar) => {
      const pid = String(pillar.id || "").toLowerCase();
      const members = sortById(
        people.filter((p) => String(p.pillar || "").toLowerCase() === pid)
      );
      const leads = members.filter((p) => isLeadRole(p.role));
      const team = members.filter((p) => !isLeadRole(p.role));

      const col = document.createElement("section");
      col.className = "pillar";
      col.dataset.pillar = pid;

      const banner = document.createElement("div");
      banner.className = "pillar-banner";
      const bannerTitle = document.createElement("span");
      bannerTitle.textContent = pillar.label || pid;
      const bannerMeta = document.createElement("em");
      const total = members.length;
      bannerMeta.textContent = `${total} people`;
      banner.append(bannerTitle, bannerMeta);
      col.appendChild(banner);

      const teamEl = document.createElement("div");
      teamEl.className = "pillar-team pillar-mosaic";
      teamEl.dataset.count = String(total);
      teamEl.dataset.leads = String(leads.length);

      leads.forEach((person) => {
        const card = createCard(person, { showTeam: false, size: "lead" });
        card.classList.add("is-lead");
        teamEl.appendChild(card);
      });
      team.forEach((person) => {
        teamEl.appendChild(createCard(person, { showTeam: false, size: "compact" }));
      });
      col.appendChild(teamEl);

      row.appendChild(col);
    });

    stage.appendChild(row);
    tree.appendChild(stage);
    return tree;
  }

  function buildTree(people) {
    const byId = new Map();
    people.forEach((p) => byId.set(String(p.id), { ...p, children: [] }));
    const roots = [];
    byId.forEach((node) => {
      const managerId = String(node.manager_id || "").trim();
      if (managerId && byId.has(managerId)) byId.get(managerId).children.push(node);
      else roots.push(node);
    });
    const sortNodes = (nodes) => {
      nodes.sort((a, b) =>
        String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
      );
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }

  function renderNode(person, isRoot = false) {
    const node = document.createElement("div");
    node.className = "node";
    node.appendChild(createCard(person, { root: isRoot, showTeam: true }));
    if (person.children.length) {
      const children = document.createElement("div");
      children.className = `children${person.children.length === 1 ? " single" : ""}`;
      person.children.forEach((child) => children.appendChild(renderNode(child, false)));
      node.appendChild(children);
    }
    return node;
  }

  function renderClassicTree(people) {
    const roots = buildTree(people);
    const tree = document.createElement("div");
    tree.className = "org-tree";
    tree.setAttribute("role", "tree");
    const level = document.createElement("div");
    level.className = "level";
    roots.forEach((root) => level.appendChild(renderNode(root, true)));
    tree.appendChild(level);
    return tree;
  }

  function fitChart() {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      const tree = orgRoot.querySelector(".org-tree");
      if (!tree || !chartViewport) return;
      chartScaler.style.transform = "scale(1)";
      const isBoard = tree.classList.contains("org-board");
      chartViewport.classList.toggle("is-board", isBoard);
      chartScaler.classList.toggle("is-board", isBoard);

      // Board layout: stretch to fill the slide (no letterboxing)
      if (isBoard) {
        tree.style.width = "100%";
        tree.style.height = "100%";
        chartScaler.style.transform = "scale(1)";
        return;
      }

      tree.style.width = "";
      tree.style.height = "";
      const pad = 8;
      const availW = Math.max(chartViewport.clientWidth - pad * 2, 40);
      const availH = Math.max(chartViewport.clientHeight - pad * 2, 40);
      const treeW = tree.scrollWidth;
      const treeH = tree.scrollHeight;
      if (!treeW || !treeH) return;
      // Allow scale-up so the composition fills the slide
      const scale = Math.min(availW / treeW, availH / treeH);
      chartScaler.style.transform = `scale(${scale})`;
    });
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusEl.setAttribute("aria-hidden", "true");
  }

  function showStatus(message, isError = false) {
    statusEl.hidden = false;
    statusEl.setAttribute("aria-hidden", "false");
    statusEl.className = isError ? "status error" : "status";
    statusEl.textContent = message;
  }

  function renderChart(data) {
    hideStatus();
    orgRoot.innerHTML = "";

    if (data.title) titleEl.textContent = data.title;
    if (data.subtitle) subtitleEl.textContent = data.subtitle;
    if (footerEl) {
      footerEl.textContent = data.footer || "";
    }

    const people = Array.isArray(data.people) ? data.people : [];
    if (!people.length) {
      showStatus("No people found in data/org-chart.json.", true);
      return;
    }

    const tree =
      data.layout === "pillars"
        ? renderPillarsLayout(data, people)
        : renderClassicTree(people);

    orgRoot.appendChild(tree);
    fitChart();
    queueExportRefresh();
  }

  async function loadData() {
    showStatus("Loading organisation chart…");
    try {
      const res = await fetch("./data/org-chart.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderChart(data);
    } catch (err) {
      showStatus("Could not load org chart data. Check data/org-chart.json.", true);
      console.error(err);
    }
  }

  function exportBackground() {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark") return "#0a0a0a";
    if (theme === "color") return "#f7f7f7";
    return "#ffffff";
  }

  async function slideToCanvas() {
    if (typeof html2canvas !== "function") {
      throw new Error("html2canvas is not available");
    }
    if (!pptSlide) throw new Error("Slide frame is missing");
    if (!orgRoot.querySelector(".org-tree")) throw new Error("Chart is not ready");

    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const bg = exportBackground();
    const slideW = pptSlide.offsetWidth || pptSlide.getBoundingClientRect().width;
    const slideH = pptSlide.offsetHeight || pptSlide.getBoundingClientRect().height;
    if (!slideW || !slideH) throw new Error("Slide has no size");

    const captureScale = Math.max(PPT_WIDTH / slideW, 2);
    const captured = await html2canvas(pptSlide, {
      backgroundColor: bg,
      scale: captureScale,
      width: slideW,
      height: slideH,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });

    const out = document.createElement("canvas");
    out.width = PPT_WIDTH;
    out.height = PPT_HEIGHT;
    const ctx = out.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, PPT_WIDTH, PPT_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(captured, 0, 0, PPT_WIDTH, PPT_HEIGHT);
    return out;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not create PNG"))),
        "image/png"
      );
    });
  }

  function triggerFileDownload(blob, filename) {
    if (!blob) throw new Error("PNG not ready");
    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.setAttribute("download", filename);
    link.rel = "noopener";
    link.type = "image/png";
    link.style.position = "fixed";
    link.style.left = "-9999px";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function buildExportBlob() {
    const canvas = await slideToCanvas();
    const blob = await canvasToPngBlob(canvas);
    if (!blob || !blob.size) throw new Error("Empty image");
    exportBlob = blob;
    return blob;
  }

  function queueExportRefresh(options = {}) {
    const clear = options.clear !== false;
    if (clear) exportBlob = null;
    if (exportBlobPromise) return exportBlobPromise;
    const run = (exportBlobPromise = buildExportBlob()
      .catch((err) => {
        console.warn("Export cache refresh failed", err);
        return null;
      })
      .finally(() => {
        if (exportBlobPromise === run) exportBlobPromise = null;
      }));
    return run;
  }

  function pngFilename() {
    const stamp = new Date().toISOString().slice(0, 10);
    return `ess-claims-org-chart-ppt-1920x1080-${stamp}.png`;
  }

  async function ensureExportBlob() {
    if (exportBlob) return exportBlob;
    if (exportBlobPromise) {
      const blob = await exportBlobPromise;
      if (blob) return blob;
    }
    return buildExportBlob();
  }

  async function downloadChart() {
    const filename = pngFilename();
    try {
      if (exportBlob) {
        triggerFileDownload(exportBlob, filename);
        showToast("Slide PNG downloading (1920×1080)…");
        queueExportRefresh();
        return;
      }
      downloadBtn.disabled = true;
      showToast("Preparing slide PNG…");
      const blob = await ensureExportBlob();
      triggerFileDownload(blob, filename);
      showToast("Slide PNG downloading (1920×1080)…");
      queueExportRefresh();
    } catch (err) {
      console.error(err);
      showToast("Download failed — try again");
    } finally {
      downloadBtn.disabled = false;
    }
  }

  async function copyChart() {
    try {
      copyBtn.disabled = true;
      const blob = exportBlob || (await ensureExportBlob());
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        showToast("Full slide copied (1920×1080)");
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        showToast("Opened slide image (clipboard unavailable)");
      }
    } catch (err) {
      console.error(err);
      showToast("Copy failed — try Download instead");
    } finally {
      copyBtn.disabled = false;
    }
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.getAttribute("data-mode")));
  });

  function warmExportOnPress() {
    if (!exportBlob && !exportBlobPromise) {
      queueExportRefresh({ clear: false });
    }
  }
  downloadBtn.addEventListener("pointerdown", warmExportOnPress);
  copyBtn.addEventListener("pointerdown", warmExportOnPress);
  downloadBtn.addEventListener("click", downloadChart);
  copyBtn.addEventListener("click", copyChart);

  window.addEventListener("resize", fitChart);
  if (window.ResizeObserver) {
    new ResizeObserver(fitChart).observe(chartViewport);
  }

  applyTheme(preferredTheme());
  loadData();
})();
