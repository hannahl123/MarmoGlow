(function () {
  // Theme Toggle Implementation
  const storageKey = "marmoglow-theme";

  // Polling state for submission scores
  const PENDING_POLL_INTERVAL_MS = 10000; // check every 10s while pending
  const PENDING_POLL_MAX_ATTEMPTS = 18;   // give up after ~3 minutes
  const FULL_REFRESH_INTERVAL_MS = 15000; // re-fetch page every 15s
  let fullRefreshTimer = null;
  let pollAttempt = 0;

  function setTheme(theme) {
    console.log("[MarmoGlow] Setting theme to:", theme);
    document.documentElement.setAttribute("data-theme", theme);
    chrome.storage.local.set({ [storageKey]: theme });

    // Update Icon
    const toggleBtn = document.getElementById("marmoglow-toggle");
    if (toggleBtn) {
      if (theme === "dark") {
        // Moon Icon
        toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.1,22c-0.3,0-0.6,0-0.9,0c-5.5-0.2-9.9-4.7-9.9-10.2c0-5.4,4.3-9.8,9.7-10c0.4,0,0.8,0,1.2,0.1c0.2,0,0.3,0.2,0.4,0.4 c0.1,0.2,0,0.4-0.1,0.5c-1.1,1.1-1.7,2.5-1.7,4.1c0,3.1,2.5,5.7,5.7,5.7c1.5,0,2.9-0.6,3.9-1.6c0.2-0.2,0.4-0.2,0.6-0.1 c0.2,0.1,0.3,0.3,0.3,0.5c-0.2,5.1-4.3,9.2-9.4,9.4C12.7,22,12.4,22,12.1,22z"></path></svg>`;
      } else {
        // Sun Icon
        toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12,7c-2.8,0-5,2.2-5,5s2.2,5,5,5s5-2.2,5-5S14.8,7,12,7z M12,15c-1.7,0-3-1.3-3-3s1.3-3,3-3s3,1.3,3,3S13.7,15,12,15z M12,6 c0.3,0,0.5-0.2,0.5-0.5v-3c0-0.3-0.2-0.5-0.5-0.5s-0.5,0.2-0.5,0.5v3C11.5,5.8,11.7,6,12,6z M12,18c-0.3,0-0.5,0.2-0.5,0.5v3 c0,0.3,0.2,0.5,0.5,0.5s0.5-0.2,0.5-0.5v-3C12.5,18.2,12.3,18,12,18z M22,12c0-0.3-0.2-0.5-0.5-0.5h-3c-0.3,0-0.5,0.2-0.5,0.5 s0.2,0.5,0.5,0.5h3C21.8,12.5,22,12.3,22,12z M6,12c0-0.3-0.2-0.5-0.5-0.5h-3C2.2,11.5,2,11.7,2,12s0.2,0.5,0.5,0.5h3 C5.8,12.5,6,12.3,6,12z M18.4,5.6c0.2-0.2,0.2-0.5,0-0.7c-0.2-0.2-0.5-0.2-0.7,0l-2.1,2.1c-0.2,0.2-0.2,0.5,0,0.7 c0.1,0.1,0.2,0.1,0.4,0.1s0.3-0.1,0.4-0.1L18.4,5.6z M7.8,16.2c-0.2-0.2-0.5-0.2-0.7,0c-0.2,0.2-0.2,0.5,0,0.7l2.1,2.1 c0.1,0.1,0.2,0.1,0.4,0.1s0.3-0.1,0.4-0.1c0.2-0.2,0.2-0.5,0-0.7L7.8,16.2z M18.4,18.4c0.2,0.2,0.5,0.2,0.7,0c0.2-0.2,0.2-0.5,0-0.7 l-2.1-2.1c-0.2-0.2-0.5-0.2-0.7,0s-0.2,0.5,0,0.7L18.4,18.4z M7.8,7.8c0.2,0.2,0.5,0.2,0.7,0s0.2-0.5,0-0.7L6.3,4.9 c-0.2-0.2-0.5-0.2-0.7,0s-0.2,0.5,0,0.7L7.8,7.8z"></path></svg>`;
      }
    }
  }

  function toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }

  /** Create a score badge element. */
  function createBadge(scoreText) {
    const badge = document.createElement("span");
    badge.className = "marmoglow-score";
    badge.textContent = scoreText;

    const lowerScore = scoreText.toLowerCase();

    if (scoreText.includes("/")) {
      const parts = scoreText.split("/");
      const got = parseInt(parts[0].trim());
      const total = parseInt(parts[1].trim());
      if (got === total && total > 0) {
        badge.classList.add("passed");
      } else if (got < total || got === 0) {
        badge.classList.add("failed");
      }
    } else if (lowerScore.includes("error") || lowerScore.includes("not compile")) {
      badge.classList.add("error");
    } else if (lowerScore.includes("fail")) {
      badge.classList.add("failed");
    } else if (lowerScore.includes("pass")) {
      badge.classList.add("passed");
    } else if (scoreText === "Testing...") {
      badge.classList.add("testing");
    }

    return badge;
  }

  /**
   * Refresh scores by re-fetching the current page and comparing.
   * If any row's score changed, reload the page so Marmoset re-renders natively.
   */
  async function refreshScores() {
    pollAttempt++;

    try {
      // Re-fetch the current page
      const sep = window.location.href.includes("?") ? "&" : "?";
      const pageUrl = window.location.href + sep + "t=" + Date.now();
      const response = await fetch(pageUrl, {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) return;

      const html = await response.text();
      const parser = new DOMParser();
      const fetchedDoc = parser.parseFromString(html, "text/html");

      // Extract scores from fetched page
      const fetchedRows = fetchedDoc.querySelectorAll("tr.r0, tr.r1");
      const fetchedScores = [];
      let hasPending = false;

      for (const row of fetchedRows) {
        const cells = Array.from(row.querySelectorAll("td"));
        let scoreText = (cells[2]?.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!scoreText) scoreText = "No Score";
        fetchedScores.push(scoreText);
        if (scoreText.toLowerCase().includes("not tested yet")) hasPending = true;
      }

      // Extract current DOM scores for comparison
      const domRows = document.querySelectorAll("tr.r0, tr.r1");
      const oldScores = [];
      for (const row of domRows) {
        const cells = Array.from(row.querySelectorAll("td"));
        // Get raw text, excluding our injected badges
        const badge = cells[2]?.querySelector(".marmoglow-score");
        const rawText = badge
          ? badge.textContent
          : (cells[2]?.textContent ?? "").replace(/\s+/g, " ").trim();
        oldScores.push(rawText || "No Score");
      }

      // Compare: did anything change (row count or any score value)?
      let changed = fetchedScores.length !== oldScores.length;
      if (!changed) {
        for (let i = 0; i < fetchedScores.length; i++) {
          if (fetchedScores[i] !== oldScores[i]) {
            changed = true;
            console.log(
              `[MarmoGlow] Change detected: row ${i + 1}: "${oldScores[i]}" -> "${fetchedScores[i]}"`
            );
            break;
          }
        }
      }

      if (changed) {
        console.log("[MarmoGlow] Reloading page to show updated results...");
        window.location.reload();
        return;
      }

      // If nothing changed and nothing is pending, stop polling
      if (!hasPending && pollAttempt > 3) {
        console.log("[MarmoGlow] All scores settled. Stopping refresh loop.");
        clearInterval(fullRefreshTimer);
        fullRefreshTimer = null;
        return;
      }

      console.log(`[MarmoGlow] No changes (attempt ${pollAttempt})${hasPending ? ", still pending..." : ""}`);
    } catch (e) {
      console.error("[MarmoGlow] Refresh failed:", e);
    }
  }

  /** Start the periodic refresh timer. */
  function startRefreshLoop() {
    fullRefreshTimer = setInterval(refreshScores, FULL_REFRESH_INTERVAL_MS);
  }

  /** Initial run: fetch individual submission pages to show badges. */
  async function showInitialScores() {
    const allLinks = Array.from(document.querySelectorAll("a"));
    const viewLinks = allLinks.filter((a) =>
      a.href.includes("submission.jsp") &&
      a.textContent.trim().toLowerCase() === "view"
    );

    console.log(`[MarmoGlow] Fetching scores for ${viewLinks.length} submissions...`);

    for (const link of viewLinks) {
      try {
        const fetchUrl = link.href + (link.href.includes("?") ? "&" : "?") + "t=" + Date.now();
        const response = await fetch(fetchUrl, { cache: "no-store" });
        if (!response.ok) continue;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const firstRow = doc.querySelector("tr.r0, tr.r1");
        if (firstRow) {
          const cells = Array.from(firstRow.querySelectorAll("td"));
          let scoreText = (cells[2]?.textContent ?? "").replace(/\s+/g, " ").trim();

          if (!scoreText) {
            const bodyLower = doc.body?.textContent?.toLowerCase() ?? "";
            scoreText = bodyLower.includes("not tested yet")
              ? "Testing..."
              : "No Score";
          }

          const badge = createBadge(scoreText);
          link.appendChild(badge);
          console.log(`[MarmoGlow] ${link.href}: ${scoreText}`);
        }
      } catch (e) {
        console.error("[MarmoGlow] Failed to fetch:", link.href, e);
      }
    }
  }

  function init() {
    // Load saved theme
    chrome.storage.local.get([storageKey], (result) => {
      const savedTheme = result[storageKey];
      if (savedTheme) {
        setTheme(savedTheme);
      } else if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        setTheme("dark");
      } else {
        setTheme("light");
      }
    });

    // Create Toggle Button
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "marmoglow-toggle";
    toggleBtn.title = "Toggle Theme";
    toggleBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7-7 1.5 1.5-7 7-1.5-1.5z"/>
      </svg>
    `;
    toggleBtn.addEventListener("click", toggleTheme);
    document.body.appendChild(toggleBtn);

    // Load scores initially, then start polling for changes
    showInitialScores();
    startRefreshLoop();

    // Clean up on page unload
    window.addEventListener("pagehide", () => {
      if (fullRefreshTimer) clearInterval(fullRefreshTimer);
    }, { once: true });
  }

  // Wait for body to be available
  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
