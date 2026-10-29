(() => {
  const THEME_KEY = "axa-org-theme";
  // Standard PowerPoint widescreen slide pixel size (16:9)
  const PPT_WIDTH = 1920;
  const PPT_HEIGHT = 1080;
  const chartViewport = document.getElementById("chart-viewport");
  const chartScaler = document.getElementById("chart-scaler");
  const pptSlide = document.getElementById("ppt-slide");
  const orgRoot = document.getElementById("org-root");
  const statusEl = document.getElementById("status");
  const titleEl = document.getElementById("chart-title");
  const subtitleEl = document.getElementById("chart-subtitle");
  const toastEl = document.getElementById("toast");
  const themeToggle = document.getElementById("theme-toggle");
  const downloadBtn = document.getElementById("download-btn");
  const copyBtn = document.getElementById("copy-btn");

  let toastTimer = null;
  let fitRaf = 0;
  let exportBlob = null;
  let exportBlobPromise = null;
  const APP_BUILD = "20261029d";

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    const isDark = theme === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.querySelector(".label").textContent = isDark
      ? "Light mode"
      : "Dark mode";
    // Theme affects export colors — refresh only once a chart exists
    if (orgRoot.querySelector(".org-tree")) {
      queueExportRefresh();
    }
  }

  function buildTree(people) {
    const byId = new Map();
    people.forEach((p) => {
      byId.set(String(p.id), { ...p, children: [] });
    });

    const roots = [];
    byId.forEach((node) => {
      const managerId = String(node.manager_id || "").trim();
      if (managerId && byId.has(managerId)) {
        byId.get(managerId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes) => {
      nodes.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
      nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);
    return roots;
  }

  function createCard(person, isRoot) {
    const card = document.createElement("article");
    card.className = `card${isRoot ? " root" : ""}`;
    card.setAttribute("aria-label", `${person.name}, ${person.role || ""}`);

    const name = document.createElement("p");
    name.className = "name";
    name.textContent = person.name;

    const role = document.createElement("p");
    role.className = "role";
    role.textContent = person.role || "";

    card.append(name, role);

    if (person.team) {
      const team = document.createElement("p");
      team.className = "team";
      team.textContent = person.team;
      card.append(team);
    }
    return card;
  }

  function renderNode(person, isRoot = false) {
    const node = document.createElement("div");
    node.className = "node";
    node.appendChild(createCard(person, isRoot));

    if (person.children.length) {
      const children = document.createElement("div");
      children.className = `children${person.children.length === 1 ? " single" : ""}`;
      person.children.forEach((child) => {
        children.appendChild(renderNode(child, false));
      });
      node.appendChild(children);
    }
    return node;
  }

  function fitChart() {
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      const tree = orgRoot.querySelector(".org-tree");
      if (!tree || !chartViewport) return;

      chartScaler.style.transform = "scale(1)";

      const pad = 8;
      const availW = Math.max(chartViewport.clientWidth - pad * 2, 40);
      const availH = Math.max(chartViewport.clientHeight - pad * 2, 40);
      const treeW = tree.scrollWidth;
      const treeH = tree.scrollHeight;
      if (!treeW || !treeH) return;

      const scale = Math.min(availW / treeW, availH / treeH, 1);
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

    const people = Array.isArray(data.people) ? data.people : [];
    if (!people.length) {
      showStatus("No people found in data/org-chart.json.", true);
      return;
    }

    const roots = buildTree(people);
    const tree = document.createElement("div");
    tree.className = "org-tree";
    tree.setAttribute("role", "tree");

    const level = document.createElement("div");
    level.className = "level";
    roots.forEach((root) => level.appendChild(renderNode(root, true)));
    tree.appendChild(level);
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

  /**
   * Capture the full 16:9 slide (not just the tree) and rasterize to an
   * exact PowerPoint widescreen canvas: 1920×1080.
   */
  async function slideToCanvas() {
    if (typeof html2canvas !== "function") {
      throw new Error("html2canvas is not available");
    }
    if (!pptSlide) throw new Error("Slide frame is missing");
    if (!orgRoot.querySelector(".org-tree")) throw new Error("Chart is not ready");

    // Keep the on-screen fitted scale so export matches what users see
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const bg = isDark ? "#12122a" : "#ffffff";
    const slideW = pptSlide.offsetWidth || pptSlide.getBoundingClientRect().width;
    const slideH = pptSlide.offsetHeight || pptSlide.getBoundingClientRect().height;
    if (!slideW || !slideH) throw new Error("Slide has no size");

    // Render at high DPI so the downscale to 1920×1080 stays sharp
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

  /**
   * Synchronous file download inside a user-gesture handler.
   * Mobile Safari only honors `download` when this runs in the click turn
   * (not after an await) — so we keep a pre-rendered PNG blob ready.
   */
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
      // Fast path: PNG already prepared — download in this click gesture
      if (exportBlob) {
        triggerFileDownload(exportBlob, filename);
        showToast(`Slide PNG downloading (1920×1080)…`);
        queueExportRefresh();
        return;
      }

      downloadBtn.disabled = true;
      showToast("Preparing slide PNG…");
      const blob = await ensureExportBlob();
      triggerFileDownload(blob, filename);
      showToast(`Slide PNG downloading (1920×1080)…`);
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

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // Warm the export as soon as the user presses Download/Copy so mobile
  // Safari can still honor a synchronous download on click.
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
