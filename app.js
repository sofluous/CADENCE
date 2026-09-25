(function () {
  "use strict";

  var STORAGE_KEY = "cadence-rsvp-state-v2";
  var TAB_ORDER = ["library", "reader", "settings"];
  var ui = {
    body: document.body,
    sourceText: document.getElementById("sourceText"),
    fileInput: document.getElementById("fileInput"),
    filePreview: document.getElementById("filePreview"),
    urlInput: document.getElementById("urlInput"),
    linkPreview: document.getElementById("linkPreview"),
    saveLibraryButton: document.getElementById("saveLibraryButton"),
    reloadSourceButtons: Array.prototype.slice.call(document.querySelectorAll("[data-reload-source]")),
    openAddButton: document.getElementById("openAddButton"),
    cancelAddButton: document.getElementById("cancelAddButton"),
    addPanel: document.getElementById("addPanel"),
    clearLibraryButton: document.getElementById("clearLibraryButton"),
    libraryMenuButton: document.getElementById("libraryMenuButton"),
    libraryMenu: document.getElementById("libraryMenu"),
    previewPanel: document.getElementById("previewPanel"),
    previewTitle: document.getElementById("previewTitle"),
    previewText: document.getElementById("previewText"),
    closePreviewButton: document.getElementById("closePreviewButton"),
    librarySearch: document.getElementById("librarySearch"),
    libraryViewList: document.getElementById("libraryViewList"),
    libraryViewGrid: document.getElementById("libraryViewGrid"),
    librarySummary: document.getElementById("librarySummary"),
    libraryList: document.getElementById("libraryList"),
    sourceButtons: Array.prototype.slice.call(document.querySelectorAll("[data-source]")),
    clearSourceButton: document.getElementById("clearSourceButton"),
    importStatus: document.getElementById("importStatus"),
    readerWord: document.getElementById("readerWord"),
    readerStage: document.querySelector(".reader-stage"),
    readerMeasure: document.getElementById("readerMeasure"),
    readerContext: document.getElementById("readerContext"),
    readerPanel: document.querySelector(".reader-panel"),
    readerMenuButton: document.getElementById("readerMenuButton"),
    focusLine: document.getElementById("focusLine"),
    focusArrows: document.getElementById("focusArrows"),
    playPauseButton: document.getElementById("playPauseButton"),
    backButton: document.getElementById("backButton"),
    forwardButton: document.getElementById("forwardButton"),
    wpmRange: document.getElementById("wpmRange"),
    chunkSizeSelect: document.getElementById("chunkSizeSelect"),
    fontScaleSelect: document.getElementById("fontScaleSelect"),
    punctuationPause: document.getElementById("punctuationPause"),
    themeLightButton: document.getElementById("themeLightButton"),
    themeDarkButton: document.getElementById("themeDarkButton"),
    drawerThemeLightButton: document.getElementById("drawerThemeLightButton"),
    drawerThemeDarkButton: document.getElementById("drawerThemeDarkButton"),
    fontSelect: document.getElementById("fontSelect"),
    drawerFontSelect: document.getElementById("drawerFontSelect"),
    showControlsToggle: document.getElementById("showControlsToggle"),
    settingsFocusColorInput: document.getElementById("settingsFocusColorInput"),
    focusColorInput: document.getElementById("focusColorInput"),
    drawerWpmRange: document.getElementById("drawerWpmRange"),
    drawerWpmMinus: document.getElementById("drawerWpmMinus"),
    drawerWpmPlus: document.getElementById("drawerWpmPlus"),
    drawerChunkSizeSelect: document.getElementById("drawerChunkSizeSelect"),
    drawerFontScaleSelect: document.getElementById("drawerFontScaleSelect"),
    showFocusLineToggle: document.getElementById("showFocusLineToggle"),
    showFocusArrowsToggle: document.getElementById("showFocusArrowsToggle"),
    settingsShowFocusLineToggle: document.getElementById("settingsShowFocusLineToggle"),
    settingsShowFocusArrowsToggle: document.getElementById("settingsShowFocusArrowsToggle"),
    wpmValue: document.getElementById("wpmValue"),
    drawerWpmValue: document.getElementById("drawerWpmValue"),
    progressText: document.getElementById("progressText"),
    remainingText: document.getElementById("remainingText"),
    progressBar: document.getElementById("progressBar"),
    sourcePanels: Array.prototype.slice.call(document.querySelectorAll("[data-source-panel]")),
    tabButtons: Array.prototype.slice.call(document.querySelectorAll("[data-tab]")),
    tabPanels: Array.prototype.slice.call(document.querySelectorAll("[data-panel]"))
  };

  var state = {
    rawText: "",
    chunks: [],
    index: 0,
    playing: false,
    timer: null,
    wpm: 320,
    chunkSize: 1,
    fontScale: 1,
    effectiveScale: 1,
    maxSafeScale: 1.6,
    punctuationPause: true,
    activeTab: "library",
    theme: "light",
    font: "serif",
    activeSource: "text",
    library: [],
    currentLibraryId: "",
    currentSourceLabel: "",
    currentSourceType: "text",
    sourceSnapshotText: "",
    sourceDirty: false,
    showIdleControls: true,
    focusLetterColor: "#c83a32",
    showFocusLine: true,
    showFocusArrows: false,
    controlsOpen: false,
    preparingLink: false,
    addPanelOpen: false,
    librarySearch: "",
    libraryView: "list",
    libraryMenuOpen: false,
    itemMenuId: "",
    previewItemId: "",
    fitStatus: "unmeasured",
    widestChunkText: "",
    widestChunkWidth: 0,
    availableWidth: 0
  };
  var lastLibraryTap = { id: "", time: 0 };
  var currentFile = null;

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findFocusIndex(chunk) {
    var cleaned = chunk.trim();
    if (!cleaned) return -1;
    var lettersOnly = cleaned.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    if (!lettersOnly) return 0;
    var pivot = Math.min(lettersOnly.length - 1, Math.max(0, Math.floor((lettersOnly.length - 1) * 0.38)));
    var count = -1;
    for (var index = 0; index < cleaned.length; index += 1) {
      if (/[A-Za-z0-9]/.test(cleaned.charAt(index))) {
        count += 1;
        if (count === pivot) return index;
      }
    }
    return Math.min(cleaned.length - 1, pivot);
  }

  function renderChunkMarkup(chunk) {
    if (!chunk) return "Ready";
    var focusIndex = findFocusIndex(chunk);
    if (focusIndex < 0) return escapeHtml(chunk);
    var before = escapeHtml(chunk.slice(0, focusIndex));
    var focus = escapeHtml(chunk.charAt(focusIndex));
    var after = escapeHtml(chunk.slice(focusIndex + 1));
    return (
      '<span class="reader-chunk">' +
      '<span class="chunk-pre">' + before + "</span>" +
      '<span class="chunk-focus"><span class="focus-letter">' + focus + "</span></span>" +
      '<span class="chunk-post">' + after + "</span>" +
      "</span>"
    );
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function normalizeText(input) {
    return input.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim();
  }

  function tokenize(rawText, chunkSize) {
    var words = rawText
      .split(/\s+/)
      .map(function (word) {
        return word.trim();
      })
      .filter(Boolean);
    var chunks = [];
    for (var index = 0; index < words.length; index += chunkSize) {
      chunks.push(words.slice(index, index + chunkSize).join(" "));
    }
    return chunks;
  }

  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function wordCount(text) {
    return tokenize(normalizeText(text || ""), 1).length;
  }

  function formatDuration(milliseconds) {
    var totalSeconds = Math.floor(milliseconds / 1000);
    if (totalSeconds < 60) return totalSeconds + "s";
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    if (minutes < 60) return minutes + "m " + seconds + "s";
    var hours = Math.floor(minutes / 60);
    var restMinutes = minutes % 60;
    return hours + "h " + restMinutes + "m";
  }

  function getSourceLabel(sourceType, fallbackText) {
    if (sourceType === "link") {
      try {
        return new URL(ui.urlInput.value.trim()).hostname;
      } catch (error) {
        return "Saved link";
      }
    }
    if (sourceType === "file" && state.currentSourceLabel) return state.currentSourceLabel;
    var firstLine = normalizeText(fallbackText || "").split("\n")[0] || "Untitled text";
    return firstLine.slice(0, 72);
  }

  function createLibraryItem(text, sourceType, sourceLabel) {
    var normalized = normalizeText(text || "");
    var now = new Date().toISOString();
    return {
      id: makeId("item"),
      title: getSourceLabel(sourceType, normalized),
      sourceType: sourceType,
      sourceLabel: sourceLabel || getSourceLabel(sourceType, normalized),
      text: normalized,
      createdAt: now,
      updatedAt: now,
      lastReadAt: "",
      lastIndex: 0,
      wordCount: wordCount(normalized),
      chunkCount: tokenize(normalized, state.chunkSize).length,
      metrics: {
        sessions: 0,
        timeSpentMs: 0,
        chunksRead: 0,
        weightedSpeed: 0
      }
    };
  }

  function getCurrentLibraryItem() {
    if (!state.currentLibraryId) return null;
    return state.library.find(function (item) {
      return item.id === state.currentLibraryId;
    }) || null;
  }

  function averageSpeed(item) {
    if (!item || !item.metrics || !item.metrics.chunksRead) return 0;
    return Math.round(item.metrics.weightedSpeed / item.metrics.chunksRead);
  }

  function libraryTotals() {
    return state.library.reduce(
      function (totals, item) {
        totals.words += item.wordCount || 0;
        totals.timeSpentMs += item.metrics ? item.metrics.timeSpentMs || 0 : 0;
        totals.sessions += item.metrics ? item.metrics.sessions || 0 : 0;
        return totals;
      },
      { words: 0, timeSpentMs: 0, sessions: 0 }
    );
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rawText: state.rawText,
          index: state.index,
          library: state.library,
          currentLibraryId: state.currentLibraryId,
          currentSourceLabel: state.currentSourceLabel,
          currentSourceType: state.currentSourceType,
          sourceSnapshotText: state.sourceSnapshotText,
          sourceDirty: state.sourceDirty,
          wpm: state.wpm,
          chunkSize: state.chunkSize,
          fontScale: state.fontScale,
          effectiveScale: state.effectiveScale,
          maxSafeScale: state.maxSafeScale,
          punctuationPause: state.punctuationPause,
          activeTab: state.activeTab,
          addPanelOpen: state.addPanelOpen,
          librarySearch: state.librarySearch,
          libraryView: state.libraryView,
          libraryMenuOpen: state.libraryMenuOpen,
          itemMenuId: state.itemMenuId,
          previewItemId: state.previewItemId,
          theme: state.theme,
          font: state.font,
          activeSource: state.activeSource,
          showIdleControls: state.showIdleControls,
          focusLetterColor: state.focusLetterColor,
          showFocusLine: state.showFocusLine,
          showFocusArrows: state.showFocusArrows,
          controlsOpen: state.controlsOpen
        })
      );
    } catch (error) {
      console.warn("Unable to save state.", error);
    }
  }

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      var parsed = JSON.parse(saved);
      state.rawText = typeof parsed.rawText === "string" ? parsed.rawText : "";
      state.index = Number.isInteger(parsed.index) ? parsed.index : 0;
      state.wpm = clampNumber(parsed.wpm, 120, 900, 320);
      state.chunkSize = clampNumber(parsed.chunkSize, 1, 5, 1);
      state.fontScale = clampNumber(parsed.fontScale, 0.8, 1.6, 1);
      state.effectiveScale = clampNumber(parsed.effectiveScale, 0.8, 1.6, state.fontScale);
      state.maxSafeScale = clampNumber(parsed.maxSafeScale, 0.8, 1.6, 1.6);
      state.punctuationPause = parsed.punctuationPause !== false;
      state.activeTab =
        parsed.activeTab === "reader" || parsed.activeTab === "settings"
          ? parsed.activeTab
          : "library";
      state.theme = parsed.theme === "dark" ? "dark" : "light";
      state.font = parsed.font === "sans" || parsed.font === "mono" ? parsed.font : "serif";
      state.activeSource = parsed.activeSource === "file" || parsed.activeSource === "link" ? parsed.activeSource : "text";
      state.library = Array.isArray(parsed.library) ? parsed.library.filter(function (item) {
        return item && typeof item.id === "string" && typeof item.text === "string";
      }) : [];
      state.currentLibraryId = typeof parsed.currentLibraryId === "string" ? parsed.currentLibraryId : "";
      state.currentSourceLabel = typeof parsed.currentSourceLabel === "string" ? parsed.currentSourceLabel : "";
      state.currentSourceType =
        parsed.currentSourceType === "file" || parsed.currentSourceType === "link" || parsed.currentSourceType === "library"
          ? parsed.currentSourceType
          : "text";
      state.sourceSnapshotText = typeof parsed.sourceSnapshotText === "string" ? parsed.sourceSnapshotText : "";
      state.sourceDirty = parsed.sourceDirty === true;
      state.showIdleControls = parsed.showIdleControls !== false;
      state.focusLetterColor =
        typeof parsed.focusLetterColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.focusLetterColor)
          ? parsed.focusLetterColor
          : "#c83a32";
      state.showFocusLine = parsed.showFocusLine !== false;
      state.showFocusArrows = parsed.showFocusArrows === true;
      state.controlsOpen = parsed.controlsOpen === true;
      state.addPanelOpen = parsed.addPanelOpen === true;
      state.librarySearch = typeof parsed.librarySearch === "string" ? parsed.librarySearch : "";
      state.libraryView = parsed.libraryView === "grid" ? "grid" : "list";
      state.libraryMenuOpen = parsed.libraryMenuOpen === true;
      state.itemMenuId = typeof parsed.itemMenuId === "string" ? parsed.itemMenuId : "";
      state.previewItemId = typeof parsed.previewItemId === "string" ? parsed.previewItemId : "";
    } catch (error) {
      console.warn("Unable to load saved state.", error);
    }
  }

  function activeSourceHasContent() {
    if (state.activeSource === "file") {
      return Boolean(normalizeText(ui.filePreview.value));
    }
    if (state.activeSource === "link") {
      return /^https?:\/\//i.test(ui.urlInput.value.trim()) || Boolean(normalizeText(ui.linkPreview.value));
    }
    return Boolean(normalizeText(ui.sourceText.value));
  }

  function setStatus(message) {
    ui.importStatus.textContent = message;
  }

  function currentEditableSourceText() {
    if (state.activeSource === "file") return ui.filePreview.value;
    if (state.activeSource === "link") return ui.linkPreview.value;
    return ui.sourceText.value;
  }

  function setSourceSnapshot(text) {
    state.sourceSnapshotText = normalizeText(text || "");
    state.sourceDirty = false;
    syncPrepareActions();
  }

  function updateSourceDirty() {
    if (state.activeSource === "file" || state.activeSource === "link") {
      state.sourceDirty = normalizeText(currentEditableSourceText()) !== state.sourceSnapshotText;
    } else {
      state.sourceDirty = false;
    }
    syncPrepareActions();
    saveState();
  }

  function reloadActiveSource() {
    if (state.activeSource === "file") {
      if (!currentFile) {
        setStatus("Choose the file again to reload it.");
        return;
      }
      readFile(currentFile);
    } else if (state.activeSource === "link") {
      var url = ui.urlInput.value.trim();
      if (!/^https?:\/\//i.test(url)) {
        setStatus("Paste a valid link before reloading.");
        return;
      }
      setStatus("Reloading link text...");
      state.preparingLink = true;
      syncPrepareActions();
      fetchLinkText(url)
        .then(function (text) {
          if (!text) throw new Error("No readable text found at that link.");
          ui.linkPreview.value = text;
          setSourceSnapshot(text);
          state.currentSourceType = "link";
          state.currentSourceLabel = url;
          refreshPreparedText(text, "Reloaded link text.");
        })
        .catch(function (error) {
          setStatus(error && error.message ? error.message : "Unable to reload that link.");
        })
        .finally(function () {
          state.preparingLink = false;
          syncPrepareActions();
        });
    }
  }

  function renderLibrary() {
    var totals = libraryTotals();
    var query = normalizeText(state.librarySearch || "").toLowerCase();
    var visibleItems = state.library
      .filter(function (item) {
        if (!query) return true;
        return (
          String(item.title || "").toLowerCase().indexOf(query) >= 0 ||
          String(item.sourceLabel || "").toLowerCase().indexOf(query) >= 0 ||
          String(item.sourceType || "").toLowerCase().indexOf(query) >= 0
        );
      })
      .sort(function (left, right) {
        return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
      });

    ui.librarySummary.textContent =
      state.library.length +
      " items, " +
      totals.words +
      " words, " +
      formatDuration(totals.timeSpentMs) +
      " reading time.";
    updateLibraryViewControls();

    if (!state.library.length) {
      ui.libraryList.innerHTML = '<p class="empty-library">Saved texts, links, and files will appear here.</p>';
      ui.clearLibraryButton.disabled = true;
      return;
    }

    ui.clearLibraryButton.disabled = false;
    if (!visibleItems.length) {
      ui.libraryList.innerHTML = '<p class="empty-library">No library items match that search.</p>';
      return;
    }

    ui.libraryList.innerHTML = visibleItems
      .map(function (item) {
        var progress = item.chunkCount ? Math.round(((item.lastIndex || 0) / item.chunkCount) * 100) : 0;
        var metrics = item.metrics || {};
        var activeClass = item.id === state.currentLibraryId ? " is-active" : "";
        var menuOpen = item.id === state.itemMenuId;
        return (
          '<article class="library-item' + activeClass + '" tabindex="0" data-library-item="' + escapeHtml(item.id) + '">' +
          '<div class="library-item-main">' +
          '<h3>' + escapeHtml(item.title || "Untitled") + "</h3>" +
          '<p>' +
          escapeHtml(item.sourceType || "text") +
          " &middot; " +
          (item.wordCount || 0) +
          " words &middot; " +
          progress +
          "% read" +
          "</p>" +
          '<p class="library-metrics">' +
          (metrics.sessions || 0) +
          " sessions &middot; " +
          formatDuration(metrics.timeSpentMs || 0) +
          " spent &middot; avg " +
          (averageSpeed(item) || "-") +
          " cpm" +
          "</p>" +
          "</div>" +
          '<div class="library-item-menu-wrap">' +
          '<button class="icon-button item-menu-button" type="button" aria-label="Item actions" aria-expanded="' + (menuOpen ? "true" : "false") + '" data-item-menu="' + escapeHtml(item.id) + '">' +
          '<span aria-hidden="true">&#8942;</span>' +
          "</button>" +
          '<div class="item-menu' + (menuOpen ? " is-open" : "") + '" aria-hidden="' + (menuOpen ? "false" : "true") + '">' +
          '<button class="menu-action" type="button" data-library-preview="' + escapeHtml(item.id) + '">Preview</button>' +
          '<button class="menu-action" type="button" data-library-mark-read="' + escapeHtml(item.id) + '">Mark as read</button>' +
          '<button class="menu-action" type="button" data-library-mark-unread="' + escapeHtml(item.id) + '">Mark as unread</button>' +
          '<button class="menu-action menu-action-danger" type="button" data-library-delete="' + escapeHtml(item.id) + '">Delete</button>' +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function upsertCurrentLibraryItem(text, sourceType, sourceLabel) {
    var normalized = normalizeText(text || "");
    if (!normalized) return null;
    var existing = getCurrentLibraryItem();
    if (existing) {
      existing.text = normalized;
      existing.title = existing.title || getSourceLabel(sourceType, normalized);
      existing.sourceType = sourceType;
      existing.sourceLabel = sourceLabel || existing.sourceLabel;
      existing.updatedAt = new Date().toISOString();
      existing.wordCount = wordCount(normalized);
      existing.chunkCount = tokenize(normalized, state.chunkSize).length;
      existing.lastIndex = Math.min(state.index, Math.max(0, existing.chunkCount - 1));
      return existing;
    }
    var item = createLibraryItem(normalized, sourceType, sourceLabel);
    state.library.unshift(item);
    state.currentLibraryId = item.id;
    return item;
  }

  function savePreparedToLibrary() {
    return prepareActiveSource().then(function (ready) {
      if (!ready) return false;
      var item = upsertCurrentLibraryItem(state.rawText, state.currentSourceType, state.currentSourceLabel);
      if (!item) return false;
      setStatus("Saved to Library.");
      setAddPanelOpen(false);
      resetPreparedSource();
      renderLibrary();
      saveState();
      return true;
    });
  }

  function loadLibraryItem(id) {
    var item = state.library.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;
    stopPlayback();
    state.currentLibraryId = item.id;
    state.currentSourceType = "library";
    state.currentSourceLabel = item.title || "Library item";
    state.rawText = item.text;
    state.index = clampNumber(item.lastIndex, 0, Math.max(0, tokenize(item.text, state.chunkSize).length - 1), 0);
    rebuildChunks(true);
    setStatus("Loaded from Library.");
    setActiveTab("reader");
    renderLibrary();
    saveState();
  }

  function selectLibraryItem(id) {
    var item = state.library.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;
    state.currentLibraryId = item.id;
    state.currentSourceType = "library";
    state.currentSourceLabel = item.title || "Library item";
    state.rawText = item.text;
    state.index = clampNumber(item.lastIndex, 0, Math.max(0, tokenize(item.text, state.chunkSize).length - 1), 0);
    rebuildChunks(true);
    renderLibrary();
    saveState();
  }

  function setItemMenuOpen(id) {
    state.itemMenuId = state.itemMenuId === id ? "" : id;
    renderLibrary();
    saveState();
  }

  function openPreview(id) {
    var item = state.library.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;
    state.previewItemId = id;
    ui.previewTitle.textContent = item.title || "Preview";
    ui.previewText.value = item.text || "";
    ui.previewPanel.setAttribute("aria-hidden", "false");
    state.itemMenuId = "";
    renderLibrary();
    saveState();
  }

  function closePreview() {
    state.previewItemId = "";
    state.itemMenuId = "";
    ui.previewPanel.setAttribute("aria-hidden", "true");
    ui.previewText.value = "";
    renderLibrary();
    saveState();
  }

  function markLibraryItem(id, read) {
    var item = state.library.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return;
    item.lastIndex = read ? Math.max(0, (item.chunkCount || tokenize(item.text, state.chunkSize).length) - 1) : 0;
    item.updatedAt = new Date().toISOString();
    state.itemMenuId = "";
    renderLibrary();
    saveState();
  }

  function resetPreparedSource() {
    ui.sourceText.value = "";
    ui.fileInput.value = "";
    ui.filePreview.value = "";
    ui.urlInput.value = "";
    ui.linkPreview.value = "";
    currentFile = null;
    state.rawText = "";
    state.chunks = [];
    state.index = 0;
    state.activeSource = "text";
    state.currentLibraryId = "";
    state.currentSourceType = "text";
    state.currentSourceLabel = "";
    state.sourceSnapshotText = "";
    state.sourceDirty = false;
    updateSourceUI();
    updateReader();
    syncPrepareActions();
    setStatus("Waiting for content.");
  }

  function deleteLibraryItem(id) {
    state.library = state.library.filter(function (item) {
      return item.id !== id;
    });
    if (state.currentLibraryId === id) {
      state.currentLibraryId = "";
    }
    renderLibrary();
    saveState();
  }

  function recordReadStep(milliseconds) {
    var item = getCurrentLibraryItem();
    if (!item) return;
    item.metrics = item.metrics || { sessions: 0, timeSpentMs: 0, chunksRead: 0, weightedSpeed: 0 };
    item.metrics.timeSpentMs += milliseconds;
    item.metrics.chunksRead += 1;
    item.metrics.weightedSpeed += state.wpm;
    item.lastIndex = state.index;
    item.lastReadAt = new Date().toISOString();
    item.updatedAt = item.lastReadAt;
  }

  function setFont(font) {
    state.font = font === "sans" || font === "mono" ? font : "serif";
    updateSettingsUI();
    saveState();
  }

  function setFocusLetterColor(color) {
    state.focusLetterColor = color;
    updateSettingsUI();
    saveState();
  }

  function setGuideVisibility(key, visible) {
    state[key] = visible;
    updateSettingsUI();
    saveState();
  }

  function setShowIdleControls(visible) {
    state.showIdleControls = visible;
    updateSettingsUI();
    saveState();
  }

  function bindMirroredInputs(inputs, eventName, callback) {
    inputs.forEach(function (input) {
      if (!input) return;
      input.addEventListener(eventName, function () {
        callback(input);
      });
    });
  }

  function syncPrepareActions() {
    var reloadDisabled =
      state.preparingLink ||
      !state.sourceDirty ||
      (state.activeSource !== "file" && state.activeSource !== "link");
    ui.saveLibraryButton.disabled = state.preparingLink || !activeSourceHasContent();
    ui.reloadSourceButtons.forEach(function (button) {
      button.disabled = reloadDisabled;
    });
  }

  function setAddPanelOpen(open) {
    state.addPanelOpen = Boolean(open);
    if (state.addPanelOpen && state.libraryMenuOpen) {
      state.libraryMenuOpen = false;
      applyLibraryMenuState();
    }
    ui.body.classList.toggle("add-panel-open", state.addPanelOpen);
    ui.addPanel.setAttribute("aria-hidden", state.addPanelOpen ? "false" : "true");
    ui.openAddButton.setAttribute("aria-expanded", state.addPanelOpen ? "true" : "false");
    saveState();
  }

  function applyLibraryMenuState() {
    ui.libraryMenu.classList.toggle("is-open", state.libraryMenuOpen);
    ui.libraryMenu.setAttribute("aria-hidden", state.libraryMenuOpen ? "false" : "true");
    ui.libraryMenuButton.setAttribute("aria-expanded", state.libraryMenuOpen ? "true" : "false");
  }

  function setLibraryMenuOpen(open) {
    state.libraryMenuOpen = Boolean(open);
    applyLibraryMenuState();
    saveState();
  }

  function updateLibraryViewControls() {
    ui.librarySearch.value = state.librarySearch;
    ui.libraryList.setAttribute("data-view", state.libraryView);
    applyLibraryMenuState();
    [
      [ui.libraryViewList, "list"],
      [ui.libraryViewGrid, "grid"]
    ].forEach(function (entry) {
      var button = entry[0];
      var view = entry[1];
      var active = state.libraryView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setActiveTab(tab) {
    if (tab !== "reader" && state.controlsOpen) {
      state.controlsOpen = false;
    }
    if (tab !== "library" && state.addPanelOpen) {
      setAddPanelOpen(false);
    }
    state.activeTab = tab;
    ui.body.setAttribute("data-active-tab", tab);
    var activeIndex = TAB_ORDER.indexOf(tab);
    ui.tabButtons.forEach(function (button) {
      var isActive = button.getAttribute("data-tab") === tab;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    ui.tabPanels.forEach(function (panel) {
      var panelTab = panel.getAttribute("data-panel");
      var panelIndex = TAB_ORDER.indexOf(panelTab);
      var isActive = panelTab === tab;
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      panel.setAttribute("data-state", panelIndex < activeIndex ? "before" : panelIndex > activeIndex ? "after" : "active");
    });
    saveState();
  }

  function getMeasurementCandidates(chunks) {
    if (chunks.length <= 600) return chunks.slice();
    return chunks
      .slice()
      .sort(function (left, right) {
        return right.length - left.length;
      })
      .slice(0, 80);
  }

  function measureTextWidth(text) {
    if (!ui.readerMeasure) return 0;
    ui.readerMeasure.textContent = text;
    return ui.readerMeasure.getBoundingClientRect().width;
  }

  function measureAvailableReaderWidth() {
    if (!ui.readerStage) return 0;
    var stageRect = ui.readerStage.getBoundingClientRect();
    var stageStyle = window.getComputedStyle(ui.readerStage);
    var stagePadding =
      parseFloat(stageStyle.paddingLeft || "0") +
      parseFloat(stageStyle.paddingRight || "0");
    var isMobile = window.innerWidth <= 760;
    var stageWidth = Math.max(0, stageRect.width - stagePadding);
    var widthFactor = 0.9;

    if (isMobile) {
      if (state.chunkSize >= 4) {
        widthFactor = 0.64;
      } else if (state.chunkSize === 3) {
        widthFactor = 0.7;
      } else if (state.chunkSize === 2) {
        widthFactor = 0.78;
      } else {
        widthFactor = 0.86;
      }
    } else if (state.chunkSize >= 4) {
      widthFactor = 0.76;
    } else if (state.chunkSize === 3) {
      widthFactor = 0.82;
    }

    return Math.max(0, stageWidth * widthFactor);
  }

  function recalculateChunkFit() {
    if (!state.chunks.length) {
      state.availableWidth = 0;
      state.widestChunkText = "";
      state.widestChunkWidth = 0;
      state.maxSafeScale = 1.6;
      state.effectiveScale = state.fontScale;
      state.fitStatus = "unmeasured";
      return;
    }

    var candidates = getMeasurementCandidates(state.chunks);
    var widestChunkText = "";
    var widestChunkWidth = 0;
    candidates.forEach(function (chunk) {
      var width = measureTextWidth(chunk);
      if (width > widestChunkWidth) {
        widestChunkWidth = width;
        widestChunkText = chunk;
      }
    });

    var availableWidth = measureAvailableReaderWidth();
    var rawMaxSafeScale = widestChunkWidth > 0 ? availableWidth / widestChunkWidth : 1.6;
    var maxSafeScale = clampNumber(rawMaxSafeScale, 0.45, 1.6, 1.6);
    state.availableWidth = availableWidth;
    state.widestChunkText = widestChunkText;
    state.widestChunkWidth = widestChunkWidth;
    state.maxSafeScale = maxSafeScale;
    state.effectiveScale = Math.min(state.fontScale, maxSafeScale);
    state.fitStatus = state.effectiveScale < state.fontScale ? "clamped" : "ok";
  }

  function updateTheme() {
    ui.body.setAttribute("data-theme", state.theme);
    ui.body.setAttribute("data-font", state.font);
    document.documentElement.style.setProperty("--reader-scale", String(state.effectiveScale));
    document.documentElement.style.setProperty("--focus-letter", state.focusLetterColor);
    ui.body.classList.toggle("hide-idle-controls", !state.showIdleControls && !state.playing);
    ui.readerPanel.classList.toggle("controls-open", state.controlsOpen);
    ui.readerMenuButton.classList.toggle("is-active", state.controlsOpen);
    ui.readerMenuButton.setAttribute("aria-expanded", state.controlsOpen ? "true" : "false");
    ui.readerMenuButton.setAttribute("aria-pressed", state.controlsOpen ? "true" : "false");
    ui.focusLine.hidden = !state.showFocusLine;
    ui.focusArrows.hidden = !state.showFocusArrows;
  }

  function updateSourceUI() {
    ui.sourceButtons.forEach(function (button) {
      var isActive = button.getAttribute("data-source") === state.activeSource;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    ui.sourcePanels.forEach(function (panel) {
      var isActive = panel.getAttribute("data-source-panel") === state.activeSource;
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  }

  function updateSettingsUI() {
    ui.body.setAttribute("data-theme", state.theme);
    ui.body.setAttribute("data-font", state.font);
    document.documentElement.style.setProperty("--focus-letter", state.focusLetterColor);
    recalculateChunkFit();
    ui.wpmRange.value = String(state.wpm);
    ui.drawerWpmRange.value = String(state.wpm);
    ui.chunkSizeSelect.value = String(state.chunkSize);
    ui.drawerChunkSizeSelect.value = String(state.chunkSize);
    ui.fontScaleSelect.value = state.fontScale.toFixed(1);
    ui.drawerFontScaleSelect.value = state.fontScale.toFixed(1);
    ui.punctuationPause.checked = state.punctuationPause;
    ui.fontSelect.value = state.font;
    ui.drawerFontSelect.value = state.font;
    ui.showControlsToggle.checked = state.showIdleControls;
    ui.settingsFocusColorInput.value = state.focusLetterColor;
    ui.focusColorInput.value = state.focusLetterColor;
    ui.showFocusLineToggle.checked = state.showFocusLine;
    ui.showFocusArrowsToggle.checked = state.showFocusArrows;
    ui.settingsShowFocusLineToggle.checked = state.showFocusLine;
    ui.settingsShowFocusArrowsToggle.checked = state.showFocusArrows;
    ui.wpmValue.textContent = String(state.wpm);
    ui.drawerWpmValue.textContent = state.wpm + " cpm";
    ui.fontScaleSelect.title = state.fitStatus === "clamped" ? "Max safe: " + state.maxSafeScale.toFixed(1) + "x" : "";
    ui.drawerFontScaleSelect.title = state.fitStatus === "clamped" ? "Max safe: " + state.maxSafeScale.toFixed(1) + "x" : "";
    syncThemeButtons();
    updateTheme();
    updateSourceUI();
    updateReader();
  }

  function syncThemeButtons() {
    [
      [ui.themeLightButton, "light"],
      [ui.themeDarkButton, "dark"],
      [ui.drawerThemeLightButton, "light"],
      [ui.drawerThemeDarkButton, "dark"]
    ].forEach(function (entry) {
      var button = entry[0];
      var theme = entry[1];
      if (!button) return;
      var isActive = state.theme === theme;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function updateUrlNotice() {
    var value = ui.urlInput.value.trim();
    if (!value) {
      setStatus("Paste text, load a file, or add a link to prepare the reader.");
      state.rawText = "";
      rebuildChunks(false);
      return;
    }

    if (/^https?:\/\//i.test(value)) {
      setStatus("Link detected. Read will fetch and load it.");
      return;
    }

    setStatus("That does not look like a valid web link yet.");
    state.rawText = "";
    rebuildChunks(false);
  }

  function setActiveSource(source) {
    state.activeSource = source === "file" || source === "link" ? source : "text";
    state.currentLibraryId = "";
    updateSourceUI();
    syncPrepareActions();
    saveState();
  }

  function extractTextFromHtml(markup) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(markup, "text/html");
    var preferred = doc.querySelector("article, main, [role='main'], .post-content, .entry-content, .article-body");
    var root = preferred || doc.body;
    if (!root) return "";

    var junk = root.querySelectorAll("script, style, noscript, nav, header, footer, aside, form, button");
    Array.prototype.forEach.call(junk, function (node) {
      node.remove();
    });

    var blocks = Array.prototype.slice.call(root.querySelectorAll("p, h1, h2, h3, h4, li, blockquote"));
    var text = blocks
      .map(function (node) {
        return normalizeText(node.textContent || "");
      })
      .filter(Boolean)
      .join("\n\n");

    if (text) return text;
    return normalizeText(root.textContent || "");
  }

  function fetchLinkText(url) {
    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Unable to fetch that link.");
        }
        return Promise.all([Promise.resolve(response.headers.get("content-type") || ""), response.text()]);
      })
      .then(function (result) {
        var contentType = result[0];
        var body = result[1];
        if (/text\/plain|text\/markdown/i.test(contentType)) {
          return normalizeText(body);
        }
        return extractTextFromHtml(body);
      });
  }

  function stripRtf(input) {
    return normalizeText(
      input
        .replace(/\\par[d]?/g, "\n")
        .replace(/\\'[0-9a-fA-F]{2}/g, " ")
        .replace(/[{}]/g, "")
        .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    );
  }

  function extractTextFromDocumentMarkup(markup) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(markup, "application/xhtml+xml");
    if (doc.querySelector("parsererror")) {
      doc = parser.parseFromString(markup, "text/html");
    }
    Array.prototype.forEach.call(
      doc.querySelectorAll("script, style, nav, aside, header, footer, metadata"),
      function (node) {
        node.remove();
      }
    );
    var blocks = Array.prototype.slice.call(doc.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, blockquote"));
    var text = blocks
      .map(function (node) {
        return normalizeText(node.textContent || "");
      })
      .filter(Boolean)
      .join("\n\n");
    return text || normalizeText((doc.body || doc.documentElement).textContent || "");
  }

  function pathDirectory(path) {
    var index = path.lastIndexOf("/");
    return index >= 0 ? path.slice(0, index + 1) : "";
  }

  function resolveZipPath(basePath, relativePath) {
    var parts = (pathDirectory(basePath) + relativePath).split("/");
    var resolved = [];
    parts.forEach(function (part) {
      if (!part || part === ".") return;
      if (part === "..") {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    });
    return resolved.join("/");
  }

  function extractEpubText(file) {
    if (!window.JSZip) {
      return Promise.reject(new Error("EPUB import needs JSZip bundled before it can extract text."));
    }

    return window.JSZip.loadAsync(file)
      .then(function (zip) {
        var containerFile = zip.file("META-INF/container.xml");
        if (!containerFile) throw new Error("That EPUB is missing its container metadata.");
        return containerFile.async("text").then(function (containerXml) {
          var containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
          var rootfile = containerDoc.querySelector("rootfile");
          var opfPath = rootfile && rootfile.getAttribute("full-path");
          if (!opfPath || !zip.file(opfPath)) throw new Error("That EPUB is missing its package document.");
          return zip.file(opfPath).async("text").then(function (opfXml) {
            return { zip: zip, opfPath: opfPath, opfXml: opfXml };
          });
        });
      })
      .then(function (data) {
        var opfDoc = new DOMParser().parseFromString(data.opfXml, "application/xml");
        var manifest = {};
        Array.prototype.forEach.call(opfDoc.querySelectorAll("manifest item"), function (item) {
          manifest[item.getAttribute("id")] = {
            href: item.getAttribute("href"),
            mediaType: item.getAttribute("media-type") || ""
          };
        });
        var spineItems = Array.prototype.slice.call(opfDoc.querySelectorAll("spine itemref"))
          .map(function (itemref) {
            return manifest[itemref.getAttribute("idref")];
          })
          .filter(function (item) {
            return item && /xhtml|html/i.test(item.mediaType || item.href || "");
          });
        if (!spineItems.length) throw new Error("No readable EPUB text files were found.");
        return Promise.all(
          spineItems.map(function (item) {
            var path = resolveZipPath(data.opfPath, item.href);
            var entry = data.zip.file(path);
            if (!entry) return "";
            return entry.async("text").then(extractTextFromDocumentMarkup);
          })
        );
      })
      .then(function (sections) {
        var text = normalizeText(sections.filter(Boolean).join("\n\n"));
        if (!text) throw new Error("No readable EPUB text was found.");
        return text;
      });
  }

  function extractPdfText(file) {
    var pdfjs = window.pdfjsLib;
    if (!pdfjs) {
      return Promise.reject(new Error("PDF import needs PDF.js bundled before it can extract text."));
    }

    return file.arrayBuffer()
      .then(function (buffer) {
        return pdfjs.getDocument({ data: buffer }).promise;
      })
      .then(function (pdf) {
        var pageReads = [];
        for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          pageReads.push(
            pdf.getPage(pageNumber)
              .then(function (page) {
                return page.getTextContent();
              })
              .then(function (content) {
                return normalizeText(
                  content.items
                    .map(function (item) {
                      return item.str || "";
                    })
                    .join(" ")
                );
              })
          );
        }
        return Promise.all(pageReads);
      })
      .then(function (pages) {
        var text = normalizeText(pages.filter(Boolean).join("\n\n"));
        if (!text) {
          throw new Error("No selectable PDF text was found. Scanned PDFs are not supported.");
        }
        return text;
      });
  }

  function supportedTextFileKind(file) {
    var name = (file.name || "").toLowerCase();
    if (/\.(txt|md|markdown)$/.test(name) || /^text\/(plain|markdown)/i.test(file.type)) return "text";
    if (/\.rtf$/.test(name) || /rtf/i.test(file.type)) return "rtf";
    if (/\.pdf$/.test(name) || /pdf/i.test(file.type)) return "pdf";
    if (/\.epub$/.test(name) || /epub/i.test(file.type)) return "epub";
    return "unknown";
  }

  function currentChunk() {
    if (!state.chunks.length) return "";
    return state.chunks[Math.min(state.index, state.chunks.length - 1)] || "";
  }

  function nextDelay(chunk) {
    var baseDelay = 60000 / state.wpm;
    if (!state.punctuationPause) return baseDelay;
    if (/[.!?]["')\]]?$/.test(chunk)) return baseDelay * 1.9;
    if (/[,:;]["')\]]?$/.test(chunk)) return baseDelay * 1.45;
    return baseDelay;
  }

  function formatSeconds(totalSeconds) {
    if (totalSeconds < 60) return totalSeconds + "s";
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + "m " + seconds + "s";
  }

  function updateReader() {
    var chunk = currentChunk();
    ui.readerWord.innerHTML = renderChunkMarkup(chunk);

    if (!state.chunks.length) {
      ui.readerContext.textContent = "Open a library item to read.";
      ui.progressText.textContent = "0 of 0 chunks";
      ui.remainingText.textContent = "Estimated remaining: 0s";
      ui.progressBar.max = "0";
      ui.progressBar.value = "0";
      ui.playPauseButton.disabled = true;
      ui.backButton.disabled = true;
      ui.forwardButton.disabled = true;
      syncPrepareActions();
      return;
    }

    var position = Math.min(state.index + 1, state.chunks.length);
    var remainingChunks = Math.max(0, state.chunks.length - position);
    var estimatedSeconds = Math.ceil((remainingChunks * 60000) / state.wpm / 1000);
    ui.readerContext.textContent = state.playing
      ? "Focused playback is active."
      : state.fitStatus === "clamped" && state.maxSafeScale < 0.7
        ? "Prepared and ready. Large chunks are very tight on this screen."
        : state.fitStatus === "clamped"
          ? "Prepared and ready. Scale limited to " + state.maxSafeScale.toFixed(1) + "x."
          : "Prepared and ready.";
    ui.progressText.textContent = position + " of " + state.chunks.length + " chunks";
    ui.remainingText.textContent = "Estimated remaining: " + formatSeconds(estimatedSeconds);
    ui.progressBar.max = String(Math.max(0, state.chunks.length - 1));
    ui.progressBar.value = String(state.index);
    ui.playPauseButton.disabled = false;
    ui.backButton.disabled = state.index === 0;
    ui.forwardButton.disabled = state.index >= state.chunks.length - 1;
    var item = getCurrentLibraryItem();
    if (item) {
      item.lastIndex = state.index;
      item.chunkCount = state.chunks.length;
      item.wordCount = wordCount(state.rawText);
      renderLibrary();
    }
    syncPrepareActions();
  }

  function enterPlaybackMode() {
    ui.body.classList.add("playing-focus");
    setActiveTab("reader");
    state.controlsOpen = false;
    updateTheme();
  }

  function exitPlaybackMode() {
    ui.body.classList.remove("playing-focus");
    updateTheme();
  }

  function stopPlayback() {
    state.playing = false;
    window.clearTimeout(state.timer);
    state.timer = null;
    ui.playPauseButton.textContent = "Play";
    exitPlaybackMode();
    updateReader();
    saveState();
  }

  function scheduleNextTick() {
    if (!state.playing || !state.chunks.length) return;
    var delay = nextDelay(currentChunk());
    state.timer = window.setTimeout(function () {
      if (state.index >= state.chunks.length - 1) {
        stopPlayback();
        return;
      }
      recordReadStep(delay);
      state.index += 1;
      saveState();
      updateReader();
      scheduleNextTick();
    }, delay);
  }

  function startPlayback() {
    if (!state.chunks.length) {
      setStatus("Add or open a library item before starting playback.");
      setActiveTab("library");
      return;
    }
    state.playing = true;
    var item = getCurrentLibraryItem();
    if (item) {
      item.metrics = item.metrics || { sessions: 0, timeSpentMs: 0, chunksRead: 0, weightedSpeed: 0 };
      item.metrics.sessions += 1;
      item.lastReadAt = new Date().toISOString();
      item.updatedAt = item.lastReadAt;
    }
    ui.playPauseButton.textContent = "Pause";
    enterPlaybackMode();
    updateReader();
    scheduleNextTick();
  }

  function togglePlayback() {
    if (state.playing) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function rebuildChunks(preserveProgress) {
    var normalized = normalizeText(state.rawText);
    state.rawText = normalized;
    state.chunks = normalized ? tokenize(normalized, state.chunkSize) : [];
    if (!preserveProgress) {
      state.index = 0;
    }
    if (state.index >= state.chunks.length) {
      state.index = Math.max(0, state.chunks.length - 1);
    }
    saveState();
    updateReader();
    syncPrepareActions();
  }

  function prepareActiveSource() {
    stopPlayback();
    if (state.activeSource === "file") {
      var fileSource = normalizeText(ui.filePreview.value);
      if (!fileSource) {
        setStatus("Choose a file first, then prepare it.");
        return Promise.resolve(false);
      }
      state.currentSourceType = "file";
      refreshPreparedText(fileSource, "File ready.");
      return Promise.resolve(true);
    }

    if (state.activeSource === "link") {
      var url = ui.urlInput.value.trim();
      var reviewedLinkText = normalizeText(ui.linkPreview.value);
      if (reviewedLinkText) {
        state.currentSourceType = "link";
        state.currentSourceLabel = url || "Reviewed link text";
        refreshPreparedText(reviewedLinkText, "Link text ready.");
        return Promise.resolve(true);
      }
      if (!/^https?:\/\//i.test(url)) {
        setStatus("Paste a valid link first.");
        return Promise.resolve(false);
      }
      setStatus("Fetching link text...");
      state.preparingLink = true;
      return fetchLinkText(url)
        .then(function (text) {
          if (!text) {
            throw new Error("No readable text found at that link.");
          }
          ui.linkPreview.value = text;
          setSourceSnapshot(text);
          state.currentSourceType = "link";
          state.currentSourceLabel = url;
          refreshPreparedText(text, "Link ready.");
          return true;
        })
        .catch(function (error) {
          state.rawText = "";
          rebuildChunks(false);
          setStatus(error && error.message ? error.message : "Link import failed. Paste the article text instead.");
          return false;
        })
        .finally(function () {
          state.preparingLink = false;
          syncPrepareActions();
        });
    }

    var source = normalizeText(ui.sourceText.value);
    if (!source) {
      refreshPreparedText("", "Paste text or import a file to prepare the reader.");
      return Promise.resolve(false);
    }
    state.currentSourceType = "text";
    state.currentSourceLabel = "Pasted text";
    refreshPreparedText(source, "Text ready.");
    return Promise.resolve(true);
  }

  function handleReadAction() {
    prepareActiveSource().then(function (ready) {
      if (!ready) return;
      setActiveTab("reader");
    });
  }

  function handleSaveLibraryAction() {
    savePreparedToLibrary();
  }

  function clearTextOnly() {
    ui.sourceText.value = "";
    state.rawText = "";
    state.chunks = [];
    state.index = 0;
    state.currentLibraryId = "";
    state.currentSourceType = "text";
    state.currentSourceLabel = "";
    rebuildChunks(false);
    setStatus("Text cleared.");
    syncPrepareActions();
  }

  function clearFileOnly() {
    ui.fileInput.value = "";
    ui.filePreview.value = "";
    currentFile = null;
    state.sourceSnapshotText = "";
    state.sourceDirty = false;
    setStatus("File selection cleared.");
    if (state.activeSource === "file") {
      state.rawText = "";
      state.currentLibraryId = "";
      rebuildChunks(false);
    }
    syncPrepareActions();
  }

  function clearLinkOnly() {
    ui.urlInput.value = "";
    ui.linkPreview.value = "";
    state.sourceSnapshotText = "";
    state.sourceDirty = false;
    if (state.activeSource === "link") {
      state.rawText = "";
      state.currentLibraryId = "";
      rebuildChunks(false);
    }
    updateUrlNotice();
    syncPrepareActions();
  }

  function readFile(file) {
    if (!file) return;
    currentFile = file;
    var kind = supportedTextFileKind(file);
    if (kind === "unknown") {
      setActiveSource("file");
      ui.filePreview.value = "";
      setStatus("That file type is not readable yet. Try TXT, Markdown, or RTF.");
      syncPrepareActions();
      return;
    }
    if (kind === "pdf" || kind === "epub") {
      setActiveSource("file");
      ui.filePreview.value = "";
      setStatus("Extracting " + kind.toUpperCase() + " text...");
      (kind === "pdf" ? extractPdfText(file) : extractEpubText(file))
        .then(function (text) {
          ui.filePreview.value = text;
          setSourceSnapshot(text);
          state.currentSourceType = "file";
          state.currentSourceLabel = file.name;
          refreshPreparedText(text, "Loaded " + file.name + ".");
          syncPrepareActions();
        })
        .catch(function (error) {
          setStatus(error && error.message ? error.message : "Unable to extract readable text from that file.");
          syncPrepareActions();
        });
      return;
    }
    var reader = new FileReader();
    reader.onload = function (event) {
      var result = typeof event.target.result === "string" ? event.target.result : "";
      ui.filePreview.value = kind === "rtf" ? stripRtf(result) : normalizeText(result);
      setSourceSnapshot(ui.filePreview.value);
      state.currentSourceType = "file";
      state.currentSourceLabel = file.name;
      setActiveSource("file");
      refreshPreparedText(ui.filePreview.value, "Loaded " + file.name + ".");
      syncPrepareActions();
    };
    reader.onerror = function () {
      setStatus("Unable to read that file.");
    };
    reader.readAsText(file);
  }

  function handleTabClick(event) {
    var tab = event.currentTarget.getAttribute("data-tab");
    if (state.playing && tab !== "reader") return;
    setActiveTab(tab);
  }

  function setControlsOpen(open) {
    state.controlsOpen = open;
    updateTheme();
    saveState();
  }

  function handleWpmChange(value) {
    state.wpm = clampNumber(value, 120, 900, 320);
    updateSettingsUI();
    saveState();
    if (state.playing) {
      window.clearTimeout(state.timer);
      scheduleNextTick();
    }
  }

  function handleChunkSizeChange(value) {
    state.chunkSize = clampNumber(value, 1, 5, 1);
    stopPlayback();
    updateSettingsUI();
    rebuildChunks(true);
    setStatus("Chunk size updated.");
  }

  function handleFontScaleChange(value) {
    state.fontScale = clampNumber(value, 0.8, 1.6, 1);
    updateSettingsUI();
    saveState();
  }

  function setTheme(theme) {
    state.theme = theme === "dark" ? "dark" : "light";
    updateSettingsUI();
    saveState();
  }

  function refreshPreparedText(text, statusMessage) {
    state.rawText = normalizeText(text || "");
    rebuildChunks(false);
    setStatus(statusMessage);
  }

  function handleProgressJump(value) {
    if (!state.chunks.length) return;
    stopPlayback();
    state.index = clampNumber(value, 0, state.chunks.length - 1, state.index);
    saveState();
    updateReader();
  }

  function interruptPlayback() {
    if (!state.playing) return false;
    stopPlayback();
    return true;
  }

  function attachEvents() {
    ui.tabButtons.forEach(function (button) {
      button.addEventListener("click", handleTabClick);
    });
    ui.sourceButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveSource(button.getAttribute("data-source"));
      });
    });

    ui.openAddButton.addEventListener("click", function () {
      setActiveTab("library");
      setAddPanelOpen(true);
    });
    ui.cancelAddButton.addEventListener("click", function () {
      setAddPanelOpen(false);
    });
    ui.reloadSourceButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (button.disabled) return;
        reloadActiveSource();
      });
    });
    ui.saveLibraryButton.addEventListener("click", function () {
      if (ui.saveLibraryButton.disabled) return;
      handleSaveLibraryAction();
    });
    ui.librarySearch.addEventListener("input", function () {
      state.librarySearch = ui.librarySearch.value;
      renderLibrary();
      saveState();
    });
    ui.libraryViewList.addEventListener("click", function () {
      state.libraryView = "list";
      renderLibrary();
      saveState();
    });
    ui.libraryViewGrid.addEventListener("click", function () {
      state.libraryView = "grid";
      renderLibrary();
      saveState();
    });
    ui.libraryMenuButton.addEventListener("click", function () {
      setLibraryMenuOpen(!state.libraryMenuOpen);
    });
    ui.clearLibraryButton.addEventListener("click", function () {
      if (!state.library.length) return;
      if (!window.confirm("Clear all saved library items and metrics?")) return;
      state.library = [];
      state.currentLibraryId = "";
      setLibraryMenuOpen(false);
      renderLibrary();
      saveState();
    });
    ui.libraryList.addEventListener("click", function (event) {
      var menuButton = event.target.closest("[data-item-menu]");
      var previewButton = event.target.closest("[data-library-preview]");
      var markReadButton = event.target.closest("[data-library-mark-read]");
      var markUnreadButton = event.target.closest("[data-library-mark-unread]");
      var deleteButton = event.target.closest("[data-library-delete]");
      var itemEl = event.target.closest("[data-library-item]");
      if (menuButton) {
        event.stopPropagation();
        setItemMenuOpen(menuButton.getAttribute("data-item-menu"));
      } else if (previewButton) {
        event.stopPropagation();
        openPreview(previewButton.getAttribute("data-library-preview"));
      } else if (markReadButton) {
        event.stopPropagation();
        markLibraryItem(markReadButton.getAttribute("data-library-mark-read"), true);
      } else if (markUnreadButton) {
        event.stopPropagation();
        markLibraryItem(markUnreadButton.getAttribute("data-library-mark-unread"), false);
      } else if (deleteButton) {
        event.stopPropagation();
        deleteLibraryItem(deleteButton.getAttribute("data-library-delete"));
      } else if (itemEl) {
        if (event.detail >= 2) {
          loadLibraryItem(itemEl.getAttribute("data-library-item"));
        } else {
          selectLibraryItem(itemEl.getAttribute("data-library-item"));
        }
      }
    });
    ui.libraryList.addEventListener("pointerup", function (event) {
      if (event.pointerType === "mouse") return;
      var itemEl = event.target.closest("[data-library-item]");
      if (!itemEl || event.target.closest("button")) return;
      var id = itemEl.getAttribute("data-library-item");
      var now = Date.now();
      if (lastLibraryTap.id === id && now - lastLibraryTap.time < 420) {
        loadLibraryItem(id);
        lastLibraryTap = { id: "", time: 0 };
      } else {
        lastLibraryTap = { id: id, time: now };
      }
    });
    ui.libraryList.addEventListener("keydown", function (event) {
      var itemEl = event.target.closest("[data-library-item]");
      if (!itemEl) return;
      if (event.key === "Enter") {
        event.preventDefault();
        loadLibraryItem(itemEl.getAttribute("data-library-item"));
      } else if (event.key === " ") {
        event.preventDefault();
        selectLibraryItem(itemEl.getAttribute("data-library-item"));
      }
    });
    ui.closePreviewButton.addEventListener("click", closePreview);
    ui.clearSourceButton.addEventListener("click", function () {
      if (state.activeSource === "file") {
        clearFileOnly();
      } else if (state.activeSource === "link") {
        clearLinkOnly();
      } else {
        clearTextOnly();
      }
    });
    ui.readerMenuButton.addEventListener("click", function () {
      setControlsOpen(!state.controlsOpen);
    });

    ui.playPauseButton.addEventListener("click", togglePlayback);
    ui.backButton.addEventListener("click", function () {
      stopPlayback();
      state.index = Math.max(0, state.index - 1);
      saveState();
      updateReader();
    });
    ui.forwardButton.addEventListener("click", function () {
      if (!state.chunks.length) return;
      stopPlayback();
      state.index = Math.min(state.chunks.length - 1, state.index + 1);
      saveState();
      updateReader();
    });

    ui.fileInput.addEventListener("change", function (event) {
      readFile(event.target.files && event.target.files[0]);
    });
    ui.filePreview.addEventListener("input", function () {
      if (state.activeSource !== "file") setActiveSource("file");
      refreshPreparedText(ui.filePreview.value, normalizeText(ui.filePreview.value) ? "File text edited." : "Edit or reload the file text.");
      updateSourceDirty();
    });
    ui.urlInput.addEventListener("input", updateUrlNotice);
    ui.urlInput.addEventListener("input", syncPrepareActions);
    ui.linkPreview.addEventListener("input", function () {
      if (state.activeSource !== "link") setActiveSource("link");
      refreshPreparedText(ui.linkPreview.value, normalizeText(ui.linkPreview.value) ? "Link text edited." : "Edit or reload the link text.");
      updateSourceDirty();
    });
    ui.sourceText.addEventListener("input", function () {
      if (normalizeText(ui.sourceText.value)) {
        setActiveSource("text");
      }
      refreshPreparedText(
        ui.sourceText.value,
        normalizeText(ui.sourceText.value) ? "Text ready." : "Paste text or import a file to prepare the reader."
      );
    });
    ui.progressBar.addEventListener("input", function () {
      handleProgressJump(ui.progressBar.value);
    });

    bindMirroredInputs([ui.wpmRange, ui.drawerWpmRange], "input", function (input) {
      handleWpmChange(input.value);
    });
    ui.drawerWpmMinus.addEventListener("click", function () {
      handleWpmChange(state.wpm - 10);
    });
    ui.drawerWpmPlus.addEventListener("click", function () {
      handleWpmChange(state.wpm + 10);
    });

    bindMirroredInputs([ui.chunkSizeSelect, ui.drawerChunkSizeSelect], "change", function (input) {
      handleChunkSizeChange(input.value);
    });

    bindMirroredInputs([ui.fontScaleSelect, ui.drawerFontScaleSelect], "change", function (input) {
      handleFontScaleChange(input.value);
    });

    ui.punctuationPause.addEventListener("change", function () {
      state.punctuationPause = ui.punctuationPause.checked;
      updateSettingsUI();
      saveState();
      if (state.playing) {
        window.clearTimeout(state.timer);
        scheduleNextTick();
      }
    });
    [ui.themeLightButton, ui.drawerThemeLightButton].forEach(function (button) {
      button.addEventListener("click", function () { setTheme("light"); });
    });
    [ui.themeDarkButton, ui.drawerThemeDarkButton].forEach(function (button) {
      button.addEventListener("click", function () { setTheme("dark"); });
    });

    bindMirroredInputs([ui.fontSelect, ui.drawerFontSelect], "change", function (input) {
      setFont(input.value);
    });

    ui.showControlsToggle.addEventListener("change", function () {
      setShowIdleControls(ui.showControlsToggle.checked);
    });

    bindMirroredInputs([ui.settingsFocusColorInput, ui.focusColorInput], "input", function (input) {
      setFocusLetterColor(input.value);
    });
    bindMirroredInputs([ui.showFocusLineToggle, ui.settingsShowFocusLineToggle], "change", function (input) {
      setGuideVisibility("showFocusLine", input.checked);
    });
    bindMirroredInputs([ui.showFocusArrowsToggle, ui.settingsShowFocusArrowsToggle], "change", function (input) {
      setGuideVisibility("showFocusArrows", input.checked);
    });

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      if (isTyping) return;

      if (
        state.playing &&
        event.key !== "Shift" &&
        event.key !== "Control" &&
        event.key !== "Alt" &&
        event.key !== "Meta"
      ) {
        event.preventDefault();
        interruptPlayback();
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        ui.backButton.click();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        ui.forwardButton.click();
      } else if (event.key.toLowerCase() === "m" && state.activeTab === "reader") {
        event.preventDefault();
        setControlsOpen(!state.controlsOpen);
      } else if (event.key === "Escape" && state.libraryMenuOpen) {
        event.preventDefault();
        setLibraryMenuOpen(false);
      } else if (event.key === "Escape" && state.previewItemId) {
        event.preventDefault();
        closePreview();
      } else if (event.key === "Escape" && state.addPanelOpen) {
        event.preventDefault();
        setAddPanelOpen(false);
      } else if (event.key === "Escape" && state.playing) {
        event.preventDefault();
        stopPlayback();
      }
    });

    document.addEventListener("pointerdown", function (event) {
      if (!state.libraryMenuOpen) return;
      if (ui.libraryMenu.contains(event.target) || ui.libraryMenuButton.contains(event.target)) return;
      setLibraryMenuOpen(false);
    });

    document.addEventListener("pointerdown", function (event) {
      if (!state.itemMenuId) return;
      if (event.target.closest(".item-menu") || event.target.closest("[data-item-menu]")) return;
      state.itemMenuId = "";
      renderLibrary();
      saveState();
    });

    ui.readerPanel.addEventListener("pointerdown", function (event) {
      if (!state.playing) return;
      event.preventDefault();
      interruptPlayback();
    });

    window.addEventListener("resize", function () {
      updateSettingsUI();
    });

    window.addEventListener("orientationchange", function () {
      updateSettingsUI();
    });

  }

  function init() {
    loadState();
    ui.sourceText.value = state.rawText;
    ui.librarySearch.value = state.librarySearch;
    updateSettingsUI();
    rebuildChunks(true);
    renderLibrary();
    attachEvents();
    setActiveTab(state.activeTab);
    setAddPanelOpen(state.activeTab === "library" && state.addPanelOpen);
    applyLibraryMenuState();
    syncPrepareActions();

    if (state.rawText) {
      setStatus("Restored your last session.");
    } else {
      setStatus("Waiting for content.");
    }
    window.requestAnimationFrame(function () {
      updateSettingsUI();
    });
  }

  init();
})();
