(() => {
  const THEME_KEY = "axa-org-theme";
  const chartViewport = document.getElementById("chart-viewport");
  const chartScaler = document.getElementById("chart-scaler");
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

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
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

  async function chartToCanvas() {
    if (typeof html2canvas !== "function") {
      throw new Error("html2canvas is not available");
    }

    const tree = orgRoot.querySelector(".org-tree");
    if (!tree) throw new Error("Chart is not ready");

    const previous = chartScaler.style.transform;
    chartScaler.style.transform = "scale(1)";

    // Allow layout to settle at natural size before capture
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const canvas = await html2canvas(tree, {
      backgroundColor: isDark ? "#12122a" : "#ffffff",
      scale: Math.min(2, window.devicePixelRatio || 2),
      useCORS: true,
      logging: false,
    });

    chartScaler.style.transform = previous || "scale(1)";
    fitChart();
    return canvas;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not create PNG"))),
        "image/png"
      );
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read PNG"));
      reader.readAsDataURL(blob);
    });
  }

  function clickDownloadLink(href, filename) {
    const link = document.createElement("a");
    link.href = href;
    link.setAttribute("download", filename);
    link.download = filename;
    link.rel = "noopener";
    link.style.position = "fixed";
    link.style.left = "-9999px";
    link.style.top = "0";
    document.body.appendChild(link);
    // MouseEvent click is more reliable than link.click() on some mobile browsers
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    );
    link.remove();
  }

  /**
   * Always trigger a real file download to the device (Downloads / Files).
   * No "open image / Share" path — that was confusing and not what users want.
   */
  async function downloadBlobToDevice(blob, filename) {
    // Legacy Edge
    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    // Data URLs + the download attribute save a file on more mobile browsers
    // (including iOS Safari) instead of only previewing the image.
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl) throw new Error("Could not encode PNG");
    clickDownloadLink(dataUrl, filename);
  }

  async function downloadChart() {
    try {
      downloadBtn.disabled = true;
      showToast("Downloading PNG to your device…");
      const canvas = await chartToCanvas();
      const blob = await canvasToPngBlob(canvas);
      if (!blob.size) throw new Error("Empty image");

      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `ess-claims-org-chart-${stamp}.png`;
      await downloadBlobToDevice(blob, filename);
      showToast("Download started — check your Downloads folder");
    } catch (err) {
      console.error(err);
      showToast("Download failed");
    } finally {
      downloadBtn.disabled = false;
    }
  }

  async function copyChart() {
    try {
      copyBtn.disabled = true;
      const canvas = await chartToCanvas();

      const blob = await canvasToPngBlob(canvas);

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        showToast("Org chart copied as image");
      } else {
        // Fallback: open image so the user can copy manually
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        showToast("Opened image (clipboard unavailable)");
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

  downloadBtn.addEventListener("click", downloadChart);
  copyBtn.addEventListener("click", copyChart);

  window.addEventListener("resize", fitChart);
  if (window.ResizeObserver) {
    new ResizeObserver(fitChart).observe(chartViewport);
  }

  applyTheme(preferredTheme());
  loadData();
})();
