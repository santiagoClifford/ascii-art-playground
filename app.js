(() => {
  "use strict";

  const el = {
    grid: document.getElementById("grid"),
    colsInput: document.getElementById("colsInput"),
    rowsInput: document.getElementById("rowsInput"),
    resizeBtn: document.getElementById("resizeBtn"),
    wallpaperPresetInput: document.getElementById("wallpaperPresetInput"),
    applyWallpaperBtn: document.getElementById("applyWallpaperBtn"),
    aspectRatioInput: document.getElementById("aspectRatioInput"),
    lockAspectInput: document.getElementById("lockAspectInput"),
    aspectHint: document.getElementById("aspectHint"),
    modeTypeBtn: document.getElementById("modeTypeBtn"),
    modePaintBtn: document.getElementById("modePaintBtn"),
    modeEraseBtn: document.getElementById("modeEraseBtn"),
    modeHint: document.getElementById("modeHint"),
    brushInput: document.getElementById("brushInput"),
    brushPreview: document.getElementById("brushPreview"),
    brushSizeInput: document.getElementById("brushSizeInput"),
    palette: document.getElementById("palette"),
    fontSizeInput: document.getElementById("fontSizeInput"),
    fgColorInput: document.getElementById("fgColorInput"),
    bgColorInput: document.getElementById("bgColorInput"),
    transparentBgInput: document.getElementById("transparentBgInput"),
    undoBtn: document.getElementById("undoBtn"),
    redoBtn: document.getElementById("redoBtn"),
    clearBtn: document.getElementById("clearBtn"),
    copyTextBtn: document.getElementById("copyTextBtn"),
    downloadTxtBtn: document.getElementById("downloadTxtBtn"),
    downloadPngBtn: document.getElementById("downloadPngBtn"),
    clipboardHelper: document.getElementById("clipboardHelper"),
    posRow: document.getElementById("posRow"),
    posRowTotal: document.getElementById("posRowTotal"),
    posCol: document.getElementById("posCol"),
    posColTotal: document.getElementById("posColTotal"),
    posRowOffset: document.getElementById("posRowOffset"),
    posColOffset: document.getElementById("posColOffset"),
    moveUpBtn: document.getElementById("moveUpBtn"),
    moveDownBtn: document.getElementById("moveDownBtn"),
    moveLeftBtn: document.getElementById("moveLeftBtn"),
    moveRightBtn: document.getElementById("moveRightBtn"),
    moveStepInput: document.getElementById("moveStepInput"),
    centerContentBtn: document.getElementById("centerContentBtn"),
    referenceInput: document.getElementById("referenceInput"),
    referenceOpacityInput: document.getElementById("referenceOpacityInput"),
    referenceFitInput: document.getElementById("referenceFitInput"),
    removeReferenceBtn: document.getElementById("removeReferenceBtn"),
    referenceImage: document.getElementById("referenceImage"),
  };

  // Each cell is its own DOM node, so the grid rebuild cost scales with
  // cols * rows; 400x240 (~96k cells) rebuilds in roughly 1.4s, which is the
  // most that still feels acceptable for an occasional resize.
  const MAX_COLS = 400;
  const MAX_ROWS = 240;

  const PALETTE_CHARS = [
    "#", "@", "*", ".", ":", "-", "+", "=",
    "|", "/", "\\", "O", "o", "x", "%", "&",
    "_", "^", "~", "<", ">", "0", "1", " ",
  ];

  const state = {
    cols: 60,
    rows: 24,
    cells: [],
    mode: "type",
    brush: "#",
    brushSize: 1,
    fontSize: 16,
    fg: "#00ff66",
    bg: "#0b0f14",
    cursor: { r: 0, c: 0 },
    isMouseDown: false,
    history: [],
    historyIndex: -1,
    referenceVisible: false,
    lastPaintPoint: null,
    exportPreset: null,
  };

  const STORAGE_KEY = "ascii-art-playground:state:v1";
  const REFERENCE_STORAGE_KEY = "ascii-art-playground:reference:v1";
  function saveState() {
    try {
      const payload = {
        cols: state.cols,
        rows: state.rows,
        cells: state.cells,
        fontSize: state.fontSize,
        fg: state.fg,
        bg: state.bg,
        brush: state.brush,
        brushSize: state.brushSize,
        mode: state.mode,
        referenceVisible: state.referenceVisible,
        referenceOpacity: el.referenceOpacityInput.value,
        referenceFit: el.referenceFitInput.value,
        exportPreset: state.exportPreset,
        wallpaperPreset: el.wallpaperPresetInput.value,
        aspectRatio: el.aspectRatioInput.value,
        lockAspect: el.lockAspectInput.checked,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // localStorage unavailable or quota exceeded; autosave is best-effort
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveReferenceImage(dataUrl) {
    try {
      if (dataUrl) {
        localStorage.setItem(REFERENCE_STORAGE_KEY, dataUrl);
      } else {
        localStorage.removeItem(REFERENCE_STORAGE_KEY);
      }
    } catch (err) {
      // image too large for localStorage quota; skip persisting it
    }
  }

  function loadReferenceImage() {
    try {
      return localStorage.getItem(REFERENCE_STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function makeEmptyGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));
  }

  function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  }

  function pushHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(cloneGrid(state.cells));
    if (state.history.length > 100) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateHistoryButtons();
    saveState();
  }

  function updateHistoryButtons() {
    el.undoBtn.disabled = state.historyIndex <= 0;
    el.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  function undo() {
    if (state.historyIndex <= 0) return;
    state.historyIndex -= 1;
    state.cells = cloneGrid(state.history[state.historyIndex]);
    renderGrid();
    updateHistoryButtons();
    saveState();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    state.cells = cloneGrid(state.history[state.historyIndex]);
    renderGrid();
    updateHistoryButtons();
    saveState();
  }

  function buildGridDom() {
    el.grid.innerHTML = "";
    el.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellWidth()}px)`;
    el.grid.style.gridTemplateRows = `repeat(${state.rows}, ${cellHeight()}px)`;
    el.grid.style.background = state.referenceVisible ? "transparent" : state.bg;

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.r = String(r);
        div.dataset.c = String(c);
        div.style.width = `${cellWidth()}px`;
        div.style.height = `${cellHeight()}px`;
        div.style.fontSize = `${state.fontSize}px`;
        div.style.color = state.fg;
        div.textContent = state.cells[r][c];
        el.grid.appendChild(div);
      }
    }
  }

  function cellWidth() {
    return Math.round(state.fontSize * 0.62);
  }

  function cellHeight() {
    return Math.round(state.fontSize * 1.15);
  }

  // A character cell is taller than it is wide, so a grid of NxN cells looks
  // like a tall rectangle rather than a square. Every conversion between an
  // aspect ratio and a column/row count has to divide that shape out.
  function cellAspect() {
    return cellWidth() / cellHeight();
  }

  function currentRatio() {
    const value = el.aspectRatioInput.value;
    if (!value) return null;
    const [w, h] = value.split(":").map(Number);
    return w / h;
  }

  function rowsForCols(cols, ratio) {
    return Math.max(2, Math.min(MAX_ROWS, Math.round((cols * cellAspect()) / ratio)));
  }

  function colsForRows(rows, ratio) {
    return Math.max(4, Math.min(MAX_COLS, Math.round((rows * ratio) / cellAspect())));
  }

  // Keeps the paired input in step while the lock is on. `source` is the field
  // the user just edited, so the other one is the one that gives way.
  function syncAspectInputs(source) {
    const ratio = currentRatio();
    if (!ratio || !el.lockAspectInput.checked) return;

    if (source === "rows") {
      const rows = Number(el.rowsInput.value);
      if (!rows) return;
      el.colsInput.value = colsForRows(rows, ratio);
    } else {
      const cols = Number(el.colsInput.value);
      if (!cols) return;
      el.rowsInput.value = rowsForCols(cols, ratio);
    }
  }

  function renderGrid() {
    const children = el.grid.children;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const idx = r * state.cols + c;
        const div = children[idx];
        if (!div) continue;
        div.textContent = state.cells[r][c];
        div.classList.toggle(
          "cursor",
          state.mode === "type" && r === state.cursor.r && c === state.cursor.c
        );
      }
    }
  }

  function setCell(r, c, ch) {
    if (r < 0 || r >= state.rows || c < 0 || c >= state.cols) return;
    state.cells[r][c] = ch;
    const idx = r * state.cols + c;
    const div = el.grid.children[idx];
    if (div) div.textContent = ch;
  }

  function moveCursor(r, c) {
    state.cursor.r = Math.max(0, Math.min(state.rows - 1, r));
    state.cursor.c = Math.max(0, Math.min(state.cols - 1, c));
    renderGrid();
    updatePositionReadout();
  }

  function updatePositionReadout() {
    const { r, c } = state.cursor;
    el.posRow.textContent = String(r + 1);
    el.posRowTotal.textContent = String(state.rows);
    el.posCol.textContent = String(c + 1);
    el.posColTotal.textContent = String(state.cols);

    const rowCenter = (state.rows - 1) / 2;
    const colCenter = (state.cols - 1) / 2;
    const rowDiff = r - rowCenter;
    const colDiff = c - colCenter;

    if (rowDiff === 0) {
      el.posRowOffset.textContent = "Fila: centrada";
      el.posRowOffset.classList.add("centered");
    } else {
      const dir = rowDiff > 0 ? "abajo" : "arriba";
      el.posRowOffset.textContent = `Fila: ${Math.abs(rowDiff)} ${dir} del centro`;
      el.posRowOffset.classList.remove("centered");
    }

    if (colDiff === 0) {
      el.posColOffset.textContent = "Col: centrada";
      el.posColOffset.classList.add("centered");
    } else {
      const dir = colDiff > 0 ? "derecha" : "izquierda";
      el.posColOffset.textContent = `Col: ${Math.abs(colDiff)} ${dir} del centro`;
      el.posColOffset.classList.remove("centered");
    }
  }

  function setMode(mode) {
    state.mode = mode;
    [el.modeTypeBtn, el.modePaintBtn, el.modeEraseBtn].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    const hints = {
      type: "Haz clic en una celda y escribe con el teclado. Usa las flechas para moverte. Pega (Ctrl+V) arte ASCII copiado desde otro lado.",
      paint: "Haz clic o arrastra para pintar. Mantén Shift y haz clic para trazar una línea recta desde el último punto.",
      erase: "Haz clic o arrastra para borrar. Mantén Shift y haz clic para borrar en línea recta desde el último punto.",
    };
    el.modeHint.textContent = hints[mode];
    document.getElementById("positionGroup").style.display = mode === "type" ? "" : "none";
    renderGrid();
  }

  function applyAppearance() {
    el.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellWidth()}px)`;
    el.grid.style.gridTemplateRows = `repeat(${state.rows}, ${cellHeight()}px)`;
    el.grid.style.background = state.referenceVisible ? "transparent" : state.bg;
    Array.from(el.grid.children).forEach((div) => {
      div.style.width = `${cellWidth()}px`;
      div.style.height = `${cellHeight()}px`;
      div.style.fontSize = `${state.fontSize}px`;
      div.style.color = state.fg;
    });
  }

  function buildPalette() {
    el.palette.innerHTML = "";
    PALETTE_CHARS.forEach((ch) => {
      const btn = document.createElement("button");
      btn.textContent = ch === " " ? "␣" : ch;
      btn.title = ch === " " ? "espacio" : ch;
      btn.addEventListener("click", () => {
        state.brush = ch;
        el.brushInput.value = ch;
        el.brushPreview.textContent = ch === " " ? "␣" : ch;
      });
      el.palette.appendChild(btn);
    });
  }

  function getContentBounds() {
    let minR = null;
    let maxR = null;
    let minC = null;
    let maxC = null;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.cells[r][c] === " ") continue;
        if (minR === null || r < minR) minR = r;
        if (maxR === null || r > maxR) maxR = r;
        if (minC === null || c < minC) minC = c;
        if (maxC === null || c > maxC) maxC = c;
      }
    }
    if (minR === null) return null;
    return { minR, maxR, minC, maxC };
  }

  function shiftContent(dr, dc) {
    if (dr === 0 && dc === 0) return;
    const newCells = makeEmptyGrid(state.rows, state.cols);
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const ch = state.cells[r][c];
        if (ch === " ") continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
          newCells[nr][nc] = ch;
        }
      }
    }
    state.cells = newCells;
    renderGrid();
    pushHistory();
  }

  function centerContent() {
    const bounds = getContentBounds();
    if (!bounds) return;
    const contentRows = bounds.maxR - bounds.minR + 1;
    const contentCols = bounds.maxC - bounds.minC + 1;
    const targetMinR = Math.floor((state.rows - contentRows) / 2);
    const targetMinC = Math.floor((state.cols - contentCols) / 2);
    shiftContent(targetMinR - bounds.minR, targetMinC - bounds.minC);
  }

  function paintAt(r, c) {
    const ch = state.mode === "erase" ? " " : state.brush;
    setCell(r, c, ch);
  }

  function paintBrush(r, c) {
    const size = state.brushSize;
    const offset = Math.floor((size - 1) / 2);
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        paintAt(r - offset + dr, c - offset + dc);
      }
    }
  }

  function paintLine(from, to) {
    let x0 = from.c;
    let y0 = from.r;
    const x1 = to.c;
    const y1 = to.r;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      paintBrush(y0, x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  // ---- Event wiring ----

  el.grid.addEventListener("mousedown", (e) => {
    const target = e.target.closest(".cell");
    if (!target) return;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);

    if (state.mode === "type") {
      moveCursor(r, c);
    } else if (e.shiftKey && state.lastPaintPoint) {
      paintLine(state.lastPaintPoint, { r, c });
      state.lastPaintPoint = { r, c };
      pushHistory();
    } else {
      state.isMouseDown = true;
      paintBrush(r, c);
      state.lastPaintPoint = { r, c };
    }
    el.grid.focus();
  });

  el.grid.addEventListener("mouseover", (e) => {
    if (!state.isMouseDown) return;
    if (state.mode === "type") return;
    const target = e.target.closest(".cell");
    if (!target) return;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    paintBrush(r, c);
    state.lastPaintPoint = { r, c };
  });

  window.addEventListener("mouseup", () => {
    if (state.isMouseDown) {
      state.isMouseDown = false;
      pushHistory();
    }
  });

  el.grid.addEventListener("keydown", (e) => {
    if (state.mode !== "type") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const { r, c } = state.cursor;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveCursor(r, c + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveCursor(r, c - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCursor(r + 1, c);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCursor(r - 1, c);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      moveCursor(r + 1, 0);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      const nc = c - 1;
      if (nc >= 0) {
        setCell(r, nc, " ");
        moveCursor(r, nc);
      }
      pushHistory();
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      setCell(r, c, " ");
      pushHistory();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      setCell(r, c, e.key);
      const nc = c + 1;
      if (nc >= state.cols) {
        moveCursor(r + 1, 0);
      } else {
        moveCursor(r, nc);
      }
      pushHistory();
    }
  });

  el.brushInput.addEventListener("input", () => {
    const v = el.brushInput.value.slice(-1) || " ";
    state.brush = v;
    el.brushPreview.textContent = v === " " ? "␣" : v;
    saveState();
  });

  el.brushSizeInput.addEventListener("input", () => {
    const v = Math.max(1, Math.min(12, Number(el.brushSizeInput.value) || 1));
    state.brushSize = v;
    saveState();
  });

  [el.modeTypeBtn, el.modePaintBtn, el.modeEraseBtn].forEach((btn) => {
    btn.addEventListener("click", () => {
      setMode(btn.dataset.mode);
      saveState();
    });
  });

  function resizeGrid(cols, rows) {
    const newCols = Math.max(4, Math.min(MAX_COLS, cols || state.cols));
    const newRows = Math.max(2, Math.min(MAX_ROWS, rows || state.rows));
    const newGrid = makeEmptyGrid(newRows, newCols);
    for (let r = 0; r < Math.min(newRows, state.rows); r++) {
      for (let c = 0; c < Math.min(newCols, state.cols); c++) {
        newGrid[r][c] = state.cells[r][c];
      }
    }
    state.rows = newRows;
    state.cols = newCols;
    state.cells = newGrid;
    state.cursor = { r: 0, c: 0 };
    el.colsInput.value = newCols;
    el.rowsInput.value = newRows;
    buildGridDom();
    updatePositionReadout();
    pushHistory();
  }

  el.resizeBtn.addEventListener("click", () => {
    resizeGrid(Number(el.colsInput.value), Number(el.rowsInput.value));
  });

  el.colsInput.addEventListener("input", () => syncAspectInputs("cols"));
  el.rowsInput.addEventListener("input", () => syncAspectInputs("rows"));

  el.aspectRatioInput.addEventListener("change", () => {
    const ratio = currentRatio();
    if (ratio) el.rowsInput.value = rowsForCols(Number(el.colsInput.value), ratio);
    updateAspectHint();
    saveState();
  });

  el.lockAspectInput.addEventListener("change", () => {
    syncAspectInputs("cols");
    updateAspectHint();
    saveState();
  });

  function updateAspectHint() {
    const ratio = currentRatio();
    if (!ratio) {
      el.aspectHint.textContent =
        "Elige una proporción para que las filas se calculen solas (los caracteres son más altos que anchos).";
      return;
    }
    const label = el.aspectRatioInput.value;
    el.aspectHint.textContent = el.lockAspectInput.checked
      ? `Bloqueado en ${label}: al cambiar un lado, el otro se ajusta solo.`
      : `Filas ajustadas a ${label}. Marca el candado para mantenerlo al redimensionar.`;
  }

  el.applyWallpaperBtn.addEventListener("click", () => {
    const value = el.wallpaperPresetInput.value;
    if (!value) {
      state.exportPreset = null;
      saveState();
      return;
    }
    const [w, h] = value.split("x").map(Number);
    const cols = state.cols;
    el.aspectRatioInput.value = ratioLabelFor(w, h);
    updateAspectHint();
    state.exportPreset = { width: w, height: h };
    resizeGrid(cols, rowsForCols(cols, w / h));
  });

  // Maps a pixel resolution onto one of the ratio options so the two selectors
  // agree; falls back to "Libre" for a resolution with no matching entry.
  function ratioLabelFor(w, h) {
    const target = w / h;
    const options = Array.from(el.aspectRatioInput.options)
      .map((o) => o.value)
      .filter(Boolean);
    const match = options.find((value) => {
      const [ow, oh] = value.split(":").map(Number);
      return Math.abs(ow / oh - target) < 0.01;
    });
    return match || "";
  }

  el.fontSizeInput.addEventListener("input", () => {
    state.fontSize = Number(el.fontSizeInput.value);
    applyAppearance();
    // Cell proportions are derived from the font size, so a locked ratio needs
    // a fresh row count to stay true.
    syncAspectInputs("cols");
    saveState();
  });

  el.fgColorInput.addEventListener("input", () => {
    state.fg = el.fgColorInput.value;
    applyAppearance();
    saveState();
  });

  el.bgColorInput.addEventListener("input", () => {
    state.bg = el.bgColorInput.value;
    applyAppearance();
    saveState();
  });

  // ---- Reference image ----

  el.referenceInput.addEventListener("change", () => {
    const file = el.referenceInput.files && el.referenceInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      el.referenceImage.src = reader.result;
      state.referenceVisible = true;
      el.referenceImage.classList.add("visible");
      applyAppearance();
      saveReferenceImage(reader.result);
      saveState();
    };
    reader.readAsDataURL(file);
  });

  el.referenceOpacityInput.addEventListener("input", () => {
    el.referenceImage.style.opacity = Number(el.referenceOpacityInput.value) / 100;
    saveState();
  });

  el.referenceFitInput.addEventListener("change", () => {
    el.referenceImage.classList.remove("fit-cover", "fit-stretch");
    if (el.referenceFitInput.value === "cover") el.referenceImage.classList.add("fit-cover");
    if (el.referenceFitInput.value === "stretch") el.referenceImage.classList.add("fit-stretch");
    saveState();
  });

  el.removeReferenceBtn.addEventListener("click", () => {
    el.referenceInput.value = "";
    el.referenceImage.src = "";
    el.referenceImage.classList.remove("visible");
    state.referenceVisible = false;
    applyAppearance();
    saveReferenceImage(null);
    saveState();
  });

  el.referenceImage.style.opacity = Number(el.referenceOpacityInput.value) / 100;

  // ---- Paste ASCII art ----

  el.grid.addEventListener("paste", (e) => {
    if (state.mode !== "type") return;
    const text = (e.clipboardData || window.clipboardData).getData("text");
    if (!text) return;
    e.preventDefault();
    const lines = text.replace(/\t/g, "    ").split(/\r\n|\r|\n/);
    const startR = state.cursor.r;
    const startC = state.cursor.c;
    let lastR = startR;
    let lastC = startC;
    lines.forEach((line, li) => {
      const r = startR + li;
      if (r >= state.rows) return;
      for (let ci = 0; ci < line.length; ci++) {
        const c = startC + ci;
        if (c >= state.cols) break;
        setCell(r, c, line[ci]);
        lastR = r;
        lastC = Math.min(c + 1, state.cols - 1);
      }
    });
    moveCursor(lastR, lastC);
    pushHistory();
  });

  el.undoBtn.addEventListener("click", undo);
  el.redoBtn.addEventListener("click", redo);

  function moveStep() {
    return Math.max(1, Math.min(50, Number(el.moveStepInput.value) || 1));
  }

  el.moveUpBtn.addEventListener("click", () => shiftContent(-moveStep(), 0));
  el.moveDownBtn.addEventListener("click", () => shiftContent(moveStep(), 0));
  el.moveLeftBtn.addEventListener("click", () => shiftContent(0, -moveStep()));
  el.moveRightBtn.addEventListener("click", () => shiftContent(0, moveStep()));
  el.centerContentBtn.addEventListener("click", centerContent);

  el.clearBtn.addEventListener("click", () => {
    if (!confirm("¿Limpiar todo el lienzo?")) return;
    state.cells = makeEmptyGrid(state.rows, state.cols);
    renderGrid();
    pushHistory();
  });

  window.addEventListener("beforeunload", () => saveState());

  function gridToText() {
    return state.cells.map((row) => row.join("").replace(/\s+$/g, "")).join("\n");
  }

  el.copyTextBtn.addEventListener("click", async () => {
    const text = gridToText();
    try {
      await navigator.clipboard.writeText(text);
      flashButton(el.copyTextBtn, "✅ Copiado");
    } catch (err) {
      el.clipboardHelper.value = text;
      el.clipboardHelper.style.top = "0";
      el.clipboardHelper.select();
      document.execCommand("copy");
      el.clipboardHelper.style.top = "-1000px";
      flashButton(el.copyTextBtn, "✅ Copiado");
    }
  });

  function flashButton(btn, label) {
    const original = btn.textContent;
    btn.textContent = label;
    setTimeout(() => {
      btn.textContent = original;
    }, 1200);
  }

  el.downloadTxtBtn.addEventListener("click", () => {
    const text = gridToText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ascii-art.txt";
    a.click();
    URL.revokeObjectURL(url);
  });

  el.downloadPngBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    let cw;
    let ch;
    let exportFontSize;

    if (state.exportPreset) {
      canvas.width = state.exportPreset.width;
      canvas.height = state.exportPreset.height;
      cw = canvas.width / state.cols;
      ch = canvas.height / state.rows;
      exportFontSize = ch * (state.fontSize / cellHeight());
    } else {
      cw = cellWidth();
      ch = cellHeight();
      canvas.width = cw * state.cols;
      canvas.height = ch * state.rows;
      exportFontSize = state.fontSize;
    }

    const ctx = canvas.getContext("2d");

    if (!el.transparentBgInput.checked) {
      ctx.fillStyle = state.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = state.fg;
    ctx.font = `${exportFontSize}px "Courier New", Consolas, monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const ch2 = state.cells[r][c];
        if (ch2 === " ") continue;
        const x = c * cw + cw / 2;
        const y = r * ch + ch / 2;
        ctx.fillText(ch2, x, y);
      }
    }

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ascii-art.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });

  // ---- Init ----
  function init() {
    const saved = loadState();

    if (saved) {
      state.cols = saved.cols;
      state.rows = saved.rows;
      state.fontSize = saved.fontSize;
      state.fg = saved.fg;
      state.bg = saved.bg;
      state.brush = saved.brush || "#";
      state.brushSize = saved.brushSize || 1;
      state.cells = saved.cells;
      state.referenceVisible = !!saved.referenceVisible;
      state.exportPreset = saved.exportPreset || null;

      el.colsInput.value = state.cols;
      el.rowsInput.value = state.rows;
      el.fontSizeInput.value = state.fontSize;
      el.fgColorInput.value = state.fg;
      el.bgColorInput.value = state.bg;
      el.brushInput.value = state.brush;
      el.brushSizeInput.value = state.brushSize;
      if (saved.referenceOpacity) el.referenceOpacityInput.value = saved.referenceOpacity;
      if (saved.referenceFit) el.referenceFitInput.value = saved.referenceFit;
      if (saved.wallpaperPreset) el.wallpaperPresetInput.value = saved.wallpaperPreset;
      if (saved.aspectRatio) el.aspectRatioInput.value = saved.aspectRatio;
      el.lockAspectInput.checked = !!saved.lockAspect;
    } else {
      state.cols = Number(el.colsInput.value);
      state.rows = Number(el.rowsInput.value);
      state.fontSize = Number(el.fontSizeInput.value);
      state.fg = el.fgColorInput.value;
      state.bg = el.bgColorInput.value;
      state.cells = makeEmptyGrid(state.rows, state.cols);
    }

    buildPalette();
    el.brushPreview.textContent = state.brush === " " ? "␣" : state.brush;

    const savedImage = loadReferenceImage();
    if (savedImage && state.referenceVisible) {
      el.referenceImage.src = savedImage;
      el.referenceImage.classList.add("visible");
      el.referenceImage.classList.remove("fit-cover", "fit-stretch");
      if (el.referenceFitInput.value === "cover") el.referenceImage.classList.add("fit-cover");
      if (el.referenceFitInput.value === "stretch") el.referenceImage.classList.add("fit-stretch");
    } else {
      state.referenceVisible = false;
    }
    el.referenceImage.style.opacity = Number(el.referenceOpacityInput.value) / 100;

    buildGridDom();
    setMode(saved && saved.mode ? saved.mode : "type");
    updateAspectHint();
    updatePositionReadout();
    pushHistory();
  }

  init();
})();
