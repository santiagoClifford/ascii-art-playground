(() => {
  "use strict";

  const el = {
    grid: document.getElementById("grid"),
    colsInput: document.getElementById("colsInput"),
    rowsInput: document.getElementById("rowsInput"),
    resizeBtn: document.getElementById("resizeBtn"),
    modeTypeBtn: document.getElementById("modeTypeBtn"),
    modePaintBtn: document.getElementById("modePaintBtn"),
    modeEraseBtn: document.getElementById("modeEraseBtn"),
    modeHint: document.getElementById("modeHint"),
    brushInput: document.getElementById("brushInput"),
    brushPreview: document.getElementById("brushPreview"),
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
  };

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
    fontSize: 16,
    fg: "#00ff66",
    bg: "#0b0f14",
    cursor: { r: 0, c: 0 },
    isMouseDown: false,
    history: [],
    historyIndex: -1,
  };

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
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) return;
    state.historyIndex += 1;
    state.cells = cloneGrid(state.history[state.historyIndex]);
    renderGrid();
    updateHistoryButtons();
  }

  function buildGridDom() {
    el.grid.innerHTML = "";
    el.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellWidth()}px)`;
    el.grid.style.gridTemplateRows = `repeat(${state.rows}, ${cellHeight()}px)`;

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
        div.style.background = state.bg;
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
      type: "Haz clic en una celda y escribe con el teclado. Usa las flechas para moverte.",
      paint: "Haz clic o arrastra sobre el lienzo para pintar con el pincel actual.",
      erase: "Haz clic o arrastra sobre el lienzo para borrar (espacio en blanco).",
    };
    el.modeHint.textContent = hints[mode];
    document.getElementById("positionGroup").style.display = mode === "type" ? "" : "none";
    renderGrid();
  }

  function applyAppearance() {
    el.grid.style.gridTemplateColumns = `repeat(${state.cols}, ${cellWidth()}px)`;
    el.grid.style.gridTemplateRows = `repeat(${state.rows}, ${cellHeight()}px)`;
    Array.from(el.grid.children).forEach((div) => {
      div.style.width = `${cellWidth()}px`;
      div.style.height = `${cellHeight()}px`;
      div.style.fontSize = `${state.fontSize}px`;
      div.style.color = state.fg;
      div.style.background = state.bg;
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

  function paintAt(r, c) {
    const ch = state.mode === "erase" ? " " : state.brush;
    setCell(r, c, ch);
  }

  // ---- Event wiring ----

  el.grid.addEventListener("mousedown", (e) => {
    const target = e.target.closest(".cell");
    if (!target) return;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);

    if (state.mode === "type") {
      moveCursor(r, c);
    } else {
      state.isMouseDown = true;
      paintAt(r, c);
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
    paintAt(r, c);
  });

  window.addEventListener("mouseup", () => {
    if (state.isMouseDown) {
      state.isMouseDown = false;
      pushHistory();
    }
  });

  el.grid.addEventListener("keydown", (e) => {
    if (state.mode !== "type") return;

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
  });

  [el.modeTypeBtn, el.modePaintBtn, el.modeEraseBtn].forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  el.resizeBtn.addEventListener("click", () => {
    const newCols = Math.max(4, Math.min(200, Number(el.colsInput.value) || state.cols));
    const newRows = Math.max(2, Math.min(120, Number(el.rowsInput.value) || state.rows));
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
    buildGridDom();
    updatePositionReadout();
    pushHistory();
  });

  el.fontSizeInput.addEventListener("input", () => {
    state.fontSize = Number(el.fontSizeInput.value);
    applyAppearance();
  });

  el.fgColorInput.addEventListener("input", () => {
    state.fg = el.fgColorInput.value;
    applyAppearance();
  });

  el.bgColorInput.addEventListener("input", () => {
    state.bg = el.bgColorInput.value;
    applyAppearance();
  });

  el.undoBtn.addEventListener("click", undo);
  el.redoBtn.addEventListener("click", redo);

  el.clearBtn.addEventListener("click", () => {
    if (!confirm("¿Limpiar todo el lienzo?")) return;
    state.cells = makeEmptyGrid(state.rows, state.cols);
    renderGrid();
    pushHistory();
  });

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
    const cw = cellWidth();
    const ch = cellHeight();
    const canvas = document.createElement("canvas");
    canvas.width = cw * state.cols;
    canvas.height = ch * state.rows;
    const ctx = canvas.getContext("2d");

    if (!el.transparentBgInput.checked) {
      ctx.fillStyle = state.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = state.fg;
    ctx.font = `${state.fontSize}px "Courier New", Consolas, monospace`;
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
    state.cols = Number(el.colsInput.value);
    state.rows = Number(el.rowsInput.value);
    state.fontSize = Number(el.fontSizeInput.value);
    state.fg = el.fgColorInput.value;
    state.bg = el.bgColorInput.value;
    state.cells = makeEmptyGrid(state.rows, state.cols);
    buildPalette();
    buildGridDom();
    setMode("type");
    updatePositionReadout();
    pushHistory();
  }

  init();
})();
