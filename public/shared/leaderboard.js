// ─── Shared Leaderboard Module ───────────────────────────────────
// Attach to window.Leaderboard for use by any game.

(function () {
  const API_URL = "/api/scores";

  function getSavedName() {
    return localStorage.getItem("arcadeName") || "";
  }

  function setSavedName(name) {
    localStorage.setItem("arcadeName", name);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function renderLeaderboard(container, entries) {
    if (!entries || entries.length === 0) {
      container.innerHTML = '<div class="lb-loading">No scores yet. Be the first!</div>';
      return;
    }
    let html = '<div class="lb-title">LEADERBOARD</div>';
    entries.forEach(function (entry, i) {
      const name = entry.name.split("::")[0];
      html +=
        '<div class="lb-row">' +
        '<span class="lb-rank">' + (i + 1) + '.</span>' +
        '<span class="lb-name">' + escapeHtml(name) + '</span>' +
        '<span class="lb-score">' + entry.score + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  async function fetchLeaderboard(gameId, containerId) {
    var container =
      typeof containerId === "string"
        ? document.getElementById(containerId)
        : containerId;
    if (!container) return;
    container.innerHTML = '<div class="lb-loading">Loading...</div>';
    try {
      var res = await fetch(API_URL + "?game=" + encodeURIComponent(gameId));
      if (!res.ok) throw new Error("Failed");
      var data = await res.json();
      renderLeaderboard(container, data.leaderboard);
    } catch (_e) {
      container.innerHTML = '<div class="lb-loading">Leaderboard unavailable</div>';
    }
  }

  async function submitScore(gameId, name, score) {
    var res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: gameId, name: name, score: score }),
    });
    if (!res.ok) throw new Error("Failed to submit score");
    var data = await res.json();
    return data.leaderboard;
  }

  window.Leaderboard = {
    fetchLeaderboard: fetchLeaderboard,
    submitScore: submitScore,
    renderLeaderboard: renderLeaderboard,
    getSavedName: getSavedName,
    setSavedName: setSavedName,
  };
})();
