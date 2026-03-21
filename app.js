(function () {
  "use strict";

  var STORAGE_KEY = "cadence-rsvp-state-v2";
  var TAB_ORDER = ["prepare", "reader", "settings"];
  var ui = {
    body: document.body,
    sourceText: document.getElementById("sourceText"),
    fileInput: document.getElementById("fileInput"),
    filePreview: document.getElementById("filePreview"),
    urlInput: document.getElementById("urlInput"),
    linkPreview: document.getElementById("linkPreview"),
    sourceButtons: Array.prototype.slice.call(document.querySelectorAll("[data-source]")),
    prepareButton: document.getElementById("prepareButton"),
    toReaderButton: document.getElementById("toReaderButton"),
    clearSourceButton: document.getElementById("clearSourceButton"),
    importStatus: document.getElementById("importStatus"),
    readerWord: document.getElementById("readerWord"),
    readerContext: document.getElementById("readerContext"),
    readerPanel: document.querySelector(".reader-panel"),
    readerUtilityBar: document.getElementById("readerUtilityBar"),
    readerMenuButton: document.getElementById("readerMenuButton"),
    readerFloatingHint: document.getElementById("readerFloatingHint"),
    focusLine: document.getElementById("focusLine"),
    focusArrows: document.getElementById("focusArrows"),
    playPauseButton: document.getElementById("playPauseButton"),
    backButton: document.getElementById("backButton"),
    forwardButton: document.getElementById("forwardButton"),
    wpmRange: document.getElementById("wpmRange"),
    chunkSizeRange: document.getElementById("chunkSizeRange"),
    fontScaleRange: document.getElementById("fontScaleRange"),
    punctuationPause: document.getElementById("punctuationPause"),
    themeSelect: document.getElementById("themeSelect"),
    drawerThemeSelect: document.getElementById("drawerThemeSelect"),
    fontSelect: document.getElementById("fontSelect"),
    drawerFontSelect: document.getElementById("drawerFontSelect"),
    showControlsToggle: document.getElementById("showControlsToggle"),
    showFocusControlsToggle: document.getElementById("showFocusControlsToggle"),
    settingsFocusColorInput: document.getElementById("settingsFocusColorInput"),
    focusColorInput: document.getElementById("focusColorInput"),
    drawerWpmRange: document.getElementById("drawerWpmRange"),
    drawerChunkSizeRange: document.getElementById("drawerChunkSizeRange"),
    drawerFontScaleRange: document.getElementById("drawerFontScaleRange"),
    showFocusLineToggle: document.getElementById("showFocusLineToggle"),
    showFocusArrowsToggle: document.getElementById("showFocusArrowsToggle"),
    settingsShowFocusLineToggle: document.getElementById("settingsShowFocusLineToggle"),
    settingsShowFocusArrowsToggle: document.getElementById("settingsShowFocusArrowsToggle"),
    wpmValue: document.getElementById("wpmValue"),
    chunkSizeValue: document.getElementById("chunkSizeValue"),
    fontScaleValue: document.getElementById("fontScaleValue"),
    drawerWpmValue: document.getElementById("drawerWpmValue"),
    drawerChunkSizeValue: document.getElementById("drawerChunkSizeValue"),
    drawerFontScaleValue: document.getElementById("drawerFontScaleValue"),
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
    punctuationPause: true,
    activeTab: "prepare",
    theme: "light",
    font: "serif",
    activeSource: "text",
    showIdleControls: true,
    showFocusControls: false,
    focusLetterColor: "#c83a32",
    showFocusLine: true,
    showFocusArrows: false,
    controlsOpen: false
  };

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

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rawText: state.rawText,
          index: state.index,
          wpm: state.wpm,
          chunkSize: state.chunkSize,
          fontScale: state.fontScale,
          punctuationPause: state.punctuationPause,
          activeTab: state.activeTab,
          theme: state.theme,
          font: state.font,
          activeSource: state.activeSource,
          showIdleControls: state.showIdleControls,
          showFocusControls: state.showFocusControls,
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
      state.punctuationPause = parsed.punctuationPause !== false;
      state.activeTab = parsed.activeTab === "reader" || parsed.activeTab === "settings" ? parsed.activeTab : "prepare";
      state.theme = parsed.theme === "dark" ? "dark" : "light";
      state.font = parsed.font === "sans" || parsed.font === "mono" ? parsed.font : "serif";
      state.activeSource = parsed.activeSource === "file" || parsed.activeSource === "link" ? parsed.activeSource : "text";
      state.showIdleControls = parsed.showIdleControls !== false;
      state.showFocusControls = parsed.showFocusControls === true;
      state.focusLetterColor =
        typeof parsed.focusLetterColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.focusLetterColor)
          ? parsed.focusLetterColor
          : "#c83a32";
      state.showFocusLine = parsed.showFocusLine !== false;
      state.showFocusArrows = parsed.showFocusArrows === true;
      state.controlsOpen = parsed.controlsOpen === true;
    } catch (error) {
      console.warn("Unable to load saved state.", error);
    }
  }

  function setStatus(message) {
    ui.importStatus.textContent = message;
  }

  function syncPrepareActions() {
    ui.toReaderButton.disabled = state.chunks.length === 0;
  }

  function setActiveTab(tab) {
    if (tab !== "reader" && state.controlsOpen) {
      state.controlsOpen = false;
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

  function updateTheme() {
    ui.body.setAttribute("data-theme", state.theme);
    ui.body.setAttribute("data-font", state.font);
    document.documentElement.style.setProperty("--reader-scale", String(state.fontScale));
    document.documentElement.style.setProperty("--focus-letter", state.focusLetterColor);
    ui.body.classList.toggle("hide-idle-controls", !state.showIdleControls && !state.playing);
    ui.body.classList.toggle("show-focus-controls", state.showFocusControls);
    ui.readerPanel.classList.toggle("controls-open", state.controlsOpen);
    ui.readerMenuButton.setAttribute("aria-expanded", state.controlsOpen ? "true" : "false");
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
    ui.wpmRange.value = String(state.wpm);
    ui.drawerWpmRange.value = String(state.wpm);
    ui.chunkSizeRange.value = String(state.chunkSize);
    ui.drawerChunkSizeRange.value = String(state.chunkSize);
    ui.fontScaleRange.value = state.fontScale.toFixed(1);
    ui.drawerFontScaleRange.value = state.fontScale.toFixed(1);
    ui.punctuationPause.checked = state.punctuationPause;
    ui.themeSelect.value = state.theme;
    ui.drawerThemeSelect.value = state.theme;
    ui.fontSelect.value = state.font;
    ui.drawerFontSelect.value = state.font;
    ui.showControlsToggle.checked = state.showIdleControls;
    ui.showFocusControlsToggle.checked = state.showFocusControls;
    ui.settingsFocusColorInput.value = state.focusLetterColor;
    ui.focusColorInput.value = state.focusLetterColor;
    ui.showFocusLineToggle.checked = state.showFocusLine;
    ui.showFocusArrowsToggle.checked = state.showFocusArrows;
    ui.settingsShowFocusLineToggle.checked = state.showFocusLine;
    ui.settingsShowFocusArrowsToggle.checked = state.showFocusArrows;
    ui.wpmValue.textContent = String(state.wpm);
    ui.drawerWpmValue.textContent = String(state.wpm);
    ui.chunkSizeValue.textContent = String(state.chunkSize);
    ui.drawerChunkSizeValue.textContent = String(state.chunkSize);
    ui.fontScaleValue.textContent = state.fontScale.toFixed(1);
    ui.drawerFontScaleValue.textContent = state.fontScale.toFixed(1);
    updateTheme();
    updateSourceUI();
    updateReader();
  }

  function updateUrlNotice() {
    var value = ui.urlInput.value.trim();
    if (!value) {
      setStatus("Paste text, load a file, or add a link to prepare the reader.");
      return;
    }

    if (/^https?:\/\//i.test(value)) {
      setStatus("Link detected. If extraction is unavailable, paste the cleaned article text directly.");
      return;
    }

    setStatus("That does not look like a valid web link yet.");
  }

  function setActiveSource(source) {
    state.activeSource = source === "file" || source === "link" ? source : "text";
    updateSourceUI();
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
      ui.readerContext.textContent = "Load text in Prepare, then switch back here to read.";
      ui.progressText.textContent = "0 of 0 chunks";
      ui.remainingText.textContent = "Estimated remaining: 0s";
      ui.readerFloatingHint.textContent = "Prepare text to begin.";
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
    ui.readerContext.textContent = state.playing ? "Focused playback is active." : "Prepared and ready.";
    ui.readerFloatingHint.textContent = state.playing
      ? ""
      : "Space play. Arrows step. Tap to pause.";
    ui.progressText.textContent = position + " of " + state.chunks.length + " chunks";
    ui.remainingText.textContent = "Estimated remaining: " + formatSeconds(estimatedSeconds);
    ui.progressBar.max = String(Math.max(0, state.chunks.length - 1));
    ui.progressBar.value = String(state.index);
    ui.playPauseButton.disabled = false;
    ui.backButton.disabled = state.index === 0;
    ui.forwardButton.disabled = state.index >= state.chunks.length - 1;
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
      state.index += 1;
      saveState();
      updateReader();
      scheduleNextTick();
    }, delay);
  }

  function startPlayback() {
    if (!state.chunks.length) {
      setStatus("Prepare some text before starting playback.");
      setActiveTab("prepare");
      return;
    }
    state.playing = true;
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

  function prepareReader() {
    stopPlayback();
    if (state.activeSource === "file") {
      var fileSource = normalizeText(ui.filePreview.value);
      if (!fileSource) {
        setStatus("Choose a file first, then prepare it.");
        return;
      }
      state.rawText = fileSource;
      rebuildChunks(false);
      setStatus("File prepared.");
      setActiveTab("reader");
      return;
    }

    if (state.activeSource === "link") {
      var url = ui.urlInput.value.trim();
      if (!/^https?:\/\//i.test(url)) {
        setStatus("Paste a valid link first.");
        return;
      }
      setStatus("Fetching link text...");
      ui.prepareButton.disabled = true;
      fetchLinkText(url)
        .then(function (text) {
          if (!text) {
            throw new Error("No readable text found at that link.");
          }
          ui.linkPreview.value = text;
          state.rawText = text;
          rebuildChunks(false);
          setStatus("Link prepared.");
          setActiveTab("reader");
        })
        .catch(function (error) {
          setStatus(error && error.message ? error.message : "Link import failed. Paste the article text instead.");
        })
        .finally(function () {
          ui.prepareButton.disabled = false;
        });
      return;
    }

    var source = normalizeText(ui.sourceText.value);
    if (!source) {
      state.rawText = "";
      rebuildChunks(false);
      setStatus("Paste text or import a file to prepare the reader.");
      return;
    }
    state.rawText = source;
    rebuildChunks(false);
    setStatus("Text prepared.");
    setActiveTab("reader");
  }

  function clearTextOnly() {
    ui.sourceText.value = "";
    state.rawText = "";
    state.chunks = [];
    state.index = 0;
    rebuildChunks(false);
    setStatus("Text cleared.");
    syncPrepareActions();
  }

  function clearFileOnly() {
    ui.fileInput.value = "";
    ui.filePreview.value = "";
    setStatus("File selection cleared.");
    if (state.activeSource === "file") {
      state.rawText = "";
      rebuildChunks(false);
    }
  }

  function clearLinkOnly() {
    ui.urlInput.value = "";
    ui.linkPreview.value = "";
    if (state.activeSource === "link") {
      state.rawText = "";
      rebuildChunks(false);
    }
    updateUrlNotice();
  }

  function readFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      var result = typeof event.target.result === "string" ? event.target.result : "";
      ui.filePreview.value = normalizeText(result);
      setActiveSource("file");
      setStatus("Loaded " + file.name + ". Prepare the reader when ready.");
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

    ui.prepareButton.addEventListener("click", prepareReader);
    ui.toReaderButton.addEventListener("click", function () {
      if (ui.toReaderButton.disabled) return;
      setActiveTab("reader");
    });
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
    ui.urlInput.addEventListener("input", updateUrlNotice);
    ui.sourceText.addEventListener("input", function () {
      if (normalizeText(ui.sourceText.value)) {
        setActiveSource("text");
      }
      setStatus("Text updated. Prepare the reader to apply changes.");
    });
    ui.progressBar.addEventListener("input", function () {
      handleProgressJump(ui.progressBar.value);
    });

    ui.wpmRange.addEventListener("input", function () {
      handleWpmChange(ui.wpmRange.value);
    });
    ui.drawerWpmRange.addEventListener("input", function () {
      handleWpmChange(ui.drawerWpmRange.value);
    });

    ui.chunkSizeRange.addEventListener("input", function () {
      handleChunkSizeChange(ui.chunkSizeRange.value);
    });
    ui.drawerChunkSizeRange.addEventListener("input", function () {
      handleChunkSizeChange(ui.drawerChunkSizeRange.value);
    });

    ui.fontScaleRange.addEventListener("input", function () {
      handleFontScaleChange(ui.fontScaleRange.value);
    });
    ui.drawerFontScaleRange.addEventListener("input", function () {
      handleFontScaleChange(ui.drawerFontScaleRange.value);
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
    ui.themeSelect.addEventListener("change", function () {
      state.theme = ui.themeSelect.value === "dark" ? "dark" : "light";
      updateSettingsUI();
      saveState();
    });
    ui.drawerThemeSelect.addEventListener("change", function () {
      state.theme = ui.drawerThemeSelect.value === "dark" ? "dark" : "light";
      updateSettingsUI();
      saveState();
    });

    ui.fontSelect.addEventListener("change", function () {
      var value = ui.fontSelect.value;
      state.font = value === "sans" || value === "mono" ? value : "serif";
      updateSettingsUI();
      saveState();
    });
    ui.drawerFontSelect.addEventListener("change", function () {
      var value = ui.drawerFontSelect.value;
      state.font = value === "sans" || value === "mono" ? value : "serif";
      updateSettingsUI();
      saveState();
    });

    ui.showControlsToggle.addEventListener("change", function () {
      state.showIdleControls = ui.showControlsToggle.checked;
      updateSettingsUI();
      saveState();
    });

    ui.showFocusControlsToggle.addEventListener("change", function () {
      state.showFocusControls = ui.showFocusControlsToggle.checked;
      updateSettingsUI();
      saveState();
    });
    ui.settingsFocusColorInput.addEventListener("input", function () {
      state.focusLetterColor = ui.settingsFocusColorInput.value;
      updateSettingsUI();
      saveState();
    });
    ui.focusColorInput.addEventListener("input", function () {
      state.focusLetterColor = ui.focusColorInput.value;
      updateSettingsUI();
      saveState();
    });
    ui.showFocusLineToggle.addEventListener("change", function () {
      state.showFocusLine = ui.showFocusLineToggle.checked;
      updateSettingsUI();
      saveState();
    });
    ui.settingsShowFocusLineToggle.addEventListener("change", function () {
      state.showFocusLine = ui.settingsShowFocusLineToggle.checked;
      updateSettingsUI();
      saveState();
    });
    ui.showFocusArrowsToggle.addEventListener("change", function () {
      state.showFocusArrows = ui.showFocusArrowsToggle.checked;
      updateSettingsUI();
      saveState();
    });
    ui.settingsShowFocusArrowsToggle.addEventListener("change", function () {
      state.showFocusArrows = ui.settingsShowFocusArrowsToggle.checked;
      updateSettingsUI();
      saveState();
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
      } else if (event.key === "Escape" && state.playing) {
        event.preventDefault();
        stopPlayback();
      }
    });

    ui.readerPanel.addEventListener("pointerdown", function (event) {
      if (!state.playing) return;
      event.preventDefault();
      interruptPlayback();
    });

  }

  function init() {
    loadState();
    ui.sourceText.value = state.rawText;
    updateSettingsUI();
    rebuildChunks(true);
    updateUrlNotice();
    attachEvents();
    setActiveTab(state.activeTab);
    syncPrepareActions();

    if (state.rawText) {
      setStatus("Restored your last session.");
    } else {
      setStatus("Waiting for content.");
    }
    ui.readerFloatingHint.textContent = "Space play. Arrows step. Menu to tune.";
  }

  init();
})();
