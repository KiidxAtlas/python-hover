(function () {
  const vscode = acquireVsCodeApi();
  const restored = vscode.getState() || {};
  const restoredScrollY =
    typeof restored.scrollY === "number" ? restored.scrollY : 0;
  let focusId = typeof restored.focusId === "string" ? restored.focusId : "";

  function escapeSelectorValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function restoreFocus() {
    if (!focusId) {
      return;
    }

    const target = document.querySelector(
      '[data-focus-id="' + escapeSelectorValue(focusId) + '"]',
    );
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
    }
  }

  function getEventElement(target) {
    if (target instanceof Element) {
      return target;
    }

    if (
      target &&
      typeof target === "object" &&
      "parentElement" in target &&
      target.parentElement instanceof Element
    ) {
      return target.parentElement;
    }

    return null;
  }

  // ── Sidebar navigation: built from the sections already in the DOM ──────
  const nav = document.getElementById("studio-nav");
  const sections = Array.from(document.querySelectorAll(".section"));

  // Every setting/reorder change causes the extension to re-render the whole
  // panel HTML from scratch (webview.html = ...), which would otherwise reset
  // every <details> back to the server's hardcoded "first two sections open"
  // default — collapsing whatever the user had open mid-edit. Persist which
  // sections are open across re-renders the same way scroll position and
  // focus already are, and restore it immediately (before first paint) so
  // there's no visible flash of the wrong state.
  const restoredOpenSections = Array.isArray(restored.openSections)
    ? restored.openSections
    : null;
  let openSectionIds = new Set(restoredOpenSections || []);
  if (restoredOpenSections) {
    sections.forEach(function (section) {
      section.open = openSectionIds.has(section.id);
    });
  } else {
    // First-ever render for this panel instance — seed persisted state from
    // whatever the server defaulted to open, so the very next re-render
    // (e.g. the user's first toggle click) doesn't collapse everything.
    sections.forEach(function (section) {
      if (section.open) {
        openSectionIds.add(section.id);
      }
    });
  }

  sections.forEach(function (section) {
    section.addEventListener("toggle", function () {
      if (section.open) {
        openSectionIds.add(section.id);
      } else {
        openSectionIds.delete(section.id);
      }
      schedulePanelState();
    });
  });

  function buildNav() {
    if (!nav) {
      return;
    }
    const links = sections.map(function (section) {
      const heading = section.querySelector(".section-head-text h2");
      const label = heading ? heading.textContent : section.id;
      const accent = section.style.getPropertyValue("--section-accent");
      const link = document.createElement("button");
      link.type = "button";
      link.className = "nav-link";
      link.setAttribute("data-nav-target", section.id);
      link.style.setProperty("--nav-accent", accent);
      const dot = document.createElement("span");
      dot.className = "nav-dot";
      const text = document.createElement("span");
      text.textContent = label;
      link.appendChild(dot);
      link.appendChild(text);
      link.addEventListener("click", function () {
        section.open = true;
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return link;
    });
    links.forEach(function (link) {
      nav.appendChild(link);
    });
  }
  buildNav();

  function setActiveNavLink(sectionId) {
    if (!nav) {
      return;
    }
    Array.from(nav.querySelectorAll(".nav-link")).forEach(function (link) {
      link.classList.toggle(
        "active",
        link.getAttribute("data-nav-target") === sectionId,
      );
    });
  }

  if ("IntersectionObserver" in window && sections.length > 0) {
    const observer = new IntersectionObserver(
      function (entries) {
        const visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return a.boundingClientRect.top - b.boundingClientRect.top;
          });
        if (visible.length > 0) {
          setActiveNavLink(visible[0].target.id);
        }
      },
      { rootMargin: "-52px 0px -70% 0px", threshold: 0 },
    );
    sections.forEach(function (section) {
      observer.observe(section);
    });
    if (sections[0]) {
      setActiveNavLink(sections[0].id);
    }
  }

  // ── Search: filters rows by title/description text, auto-expands any
  // section containing a match, hides sections/rows with none. ──────────
  const searchInput = document.getElementById("studio-search");
  const searchClear = document.getElementById("studio-search-clear");
  const noResults = document.getElementById("studio-no-results");
  const allRows = Array.from(document.querySelectorAll(".row"));
  const rowSectionMap = allRows.map(function (row) {
    return { row: row, section: row.closest(".section") };
  });
  const sectionWasOpen = new Map(
    sections.map(function (section) {
      return [section, section.open];
    }),
  );

  function applySearch(query) {
    const normalized = query.trim().toLowerCase();
    if (searchClear) {
      searchClear.style.display = normalized ? "block" : "none";
    }

    if (!normalized) {
      allRows.forEach(function (row) {
        row.removeAttribute("data-hidden");
        row.classList.remove("search-match");
      });
      sections.forEach(function (section) {
        section.removeAttribute("data-hidden");
        section.open = sectionWasOpen.get(section) ?? false;
      });
      if (noResults) {
        noResults.style.display = "none";
      }
      return;
    }

    const sectionsWithMatches = new Set();
    rowSectionMap.forEach(function (entry) {
      const text = entry.row.textContent.toLowerCase();
      const matches = text.indexOf(normalized) !== -1;
      entry.row.toggleAttribute("data-hidden", !matches);
      entry.row.classList.toggle("search-match", matches);
      if (matches && entry.section) {
        sectionsWithMatches.add(entry.section);
      }
    });

    let anyVisible = false;
    sections.forEach(function (section) {
      const hasMatch = sectionsWithMatches.has(section);
      section.toggleAttribute("data-hidden", !hasMatch);
      if (hasMatch) {
        section.open = true;
        anyVisible = true;
      }
    });

    if (noResults) {
      noResults.style.display = anyVisible ? "none" : "block";
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      applySearch(searchInput.value);
    });
  }
  if (searchClear) {
    searchClear.addEventListener("click", function () {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      applySearch("");
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && searchInput && document.activeElement === searchInput) {
      searchInput.value = "";
      applySearch("");
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      if (searchInput) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  window.addEventListener(
    "load",
    function () {
      if (restoredScrollY > 0) {
        window.scrollTo({ top: restoredScrollY, behavior: "auto" });
      }
      restoreFocus();
    },
    { once: true },
  );

  let scrollStateTimer;
  function schedulePanelState() {
    clearTimeout(scrollStateTimer);
    scrollStateTimer = setTimeout(function () {
      vscode.setState({
        scrollY: window.scrollY,
        focusId: focusId,
        openSections: Array.from(openSectionIds),
      });
    }, 40);
  }

  window.addEventListener(
    "scroll",
    function () {
      schedulePanelState();
    },
    { passive: true },
  );

  document.addEventListener("focusin", function (event) {
    const source = getEventElement(event.target);
    const target = source ? source.closest("[data-focus-id]") : null;
    if (!target) {
      return;
    }

    focusId = target.getAttribute("data-focus-id") || focusId;
    schedulePanelState();
  });

  document.addEventListener("keydown", function (event) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (event.key === ",") {
      event.preventDefault();
      vscode.postMessage({ type: "open-settings", query: "python-hover" });
      return;
    }

    if (key === "b" && !event.shiftKey) {
      event.preventDefault();
      vscode.postMessage({
        type: "run-command",
        command: "python-hover.browseModule",
      });
      return;
    }

    if (key === "d" && event.shiftKey) {
      event.preventDefault();
      vscode.postMessage({
        type: "run-command",
        command: "python-hover.searchDocs",
      });
    }
  });

  document.addEventListener("click", function (event) {
    const source = getEventElement(event.target);
    const button = source ? source.closest("button") : null;
    if (!button) {
      return;
    }

    const command = button.getAttribute("data-run-command");
    if (command) {
      vscode.postMessage({ type: "run-command", command: command });
      return;
    }

    const query = button.getAttribute("data-open-settings");
    if (query !== null) {
      vscode.postMessage({ type: "open-settings", query: query });
      return;
    }

    const preset = button.getAttribute("data-preset");
    if (preset) {
      vscode.postMessage({ type: "apply-preset", preset: preset });
      return;
    }

    const choiceKey = button.getAttribute("data-choice-key");
    const choiceValue = button.getAttribute("data-choice-value");
    if (choiceKey && choiceValue !== null) {
      vscode.postMessage({
        type: "update-setting",
        key: choiceKey,
        value: choiceValue,
      });
      return;
    }

    const hoverSectionId = button.getAttribute("data-hover-section-id");
    const hoverSectionMove = button.getAttribute("data-hover-section-move");
    if (
      hoverSectionId &&
      (hoverSectionMove === "up" || hoverSectionMove === "down")
    ) {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage({
        type: "reorder-hover-section",
        section: hoverSectionId,
        direction: hoverSectionMove,
      });
      return;
    }

    const numberKey = button.getAttribute("data-number-key");
    if (!numberKey) {
      return;
    }

    const current = Number(button.getAttribute("data-number-value"));
    const min = Number(button.getAttribute("data-number-min"));
    const max = Number(button.getAttribute("data-number-max"));
    const step = Number(button.getAttribute("data-number-step"));
    if (
      Number.isNaN(current) ||
      Number.isNaN(min) ||
      Number.isNaN(max) ||
      Number.isNaN(step)
    ) {
      return;
    }

    const next = Math.min(max, Math.max(min, current + step));
    vscode.postMessage({ type: "update-setting", key: numberKey, value: next });
  });

  document.addEventListener("change", function (event) {
    const input =
      event.target instanceof HTMLInputElement ? event.target : null;
    if (!input) {
      return;
    }

    const key = input.getAttribute("data-toggle-key");
    if (key) {
      vscode.postMessage({
        type: "update-setting",
        key: key,
        value: input.checked,
      });
    }
  });
})();
