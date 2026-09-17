/* =========================================================
   FlowTune — App / UI layer (v4, minimalist)
   Search any song/artist -> results -> click to play.
   No tabs, no uploads, no autoplay of everything.
   ========================================================= */

const App = (() => {
  const grid = document.getElementById("trackGrid");
  const sectionTitle = document.getElementById("sectionTitle");
  const sectionSub = document.getElementById("sectionSub");
  const searchInput = document.getElementById("searchInput");

  let currentTracks = [];
  let currentFilter = "";
  let lastSearchQ = "";

  /* ---------- Rendering ---------- */
  const showLoading = () => {
    grid.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Searching...</p>
      </div>`;
  };

  const showError = msg => {
    grid.innerHTML = `
      <div class="loading">
        <p style="font-size:40px">&#128532;</p>
        <p>${msg}</p>
        <button class="btn btn-upload" id="retryBtn">&#10227; Retry</button>
      </div>`;
    const btn = document.getElementById("retryBtn");
    if (btn) btn.addEventListener("click", () => {
      if (lastSearchQ) globalSearch(lastSearchQ);
    });
  };

  const showEmpty = msg => {
    grid.innerHTML = `
      <div class="loading">
        <p style="font-size:44px">&#127911;</p>
        <p>${msg || "No results. Spelling check karo ya koi aur naam try karo."}</p>
      </div>`;
  };

  const esc = s => String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  const fmtDur = s => {
    if (!s || !isFinite(s) || s <= 0) return "";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return ` \u00B7 ${m}:${String(sec).padStart(2, "0")}`;
  };

  const artFallback = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="#101a16"/><text x="50%" y="54%" fill="#6f8f83" font-size="60" text-anchor="middle" font-family="Arial">&#9835;</text></svg>`;

  const cardHTML = (t, isPlaying) => {
    const art = t.art
      ? `<img src="${esc(t.art)}" alt="" loading="lazy" onerror="this.src='data:image/svg+xml,${encodeURIComponent(artFallback)}'">`
      : `<div style="width:100%;height:100%;display:grid;place-items:center;background:#101a16;font-size:52px;color:#6f8f83">&#9835;</div>`;

    return `
      <div class="track-card${isPlaying ? " playing" : ""}" data-id="${esc(t.id)}">
        <div class="art-wrap">${art}
          <div class="play-overlay"><div class="play-ico">${isPlaying ? "&#10074;&#10074;" : "&#9654;"}</div></div>
        </div>
        <span class="card-src">${esc(t.source)}</span>
        <div class="card-body">
          <div class="card-title" title="${esc(t.title)}">${esc(t.title)}</div>
          <div class="card-artist" title="${esc(t.artist)}">${esc(t.artist)}${fmtDur(t.duration)}</div>
        </div>
      </div>`;
  };

  const render = () => {
    const list = currentTracks.filter(t => {
      if (!currentFilter) return true;
      const q = currentFilter.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    });

    if (!list.length) { showEmpty("No results. Spelling check karo ya koi aur naam try karo."); return; }

    const playingId = Player.state.current ? Player.state.current.id : null;
    grid.innerHTML = list.map(t => cardHTML(t, t.id === playingId)).join("");
  };

  /* ---------- Global search ---------- */
  const searchArchive = async (q, count = 10) => {
    try {
      const docs = await ArchiveAPI.search({ archive: { q: `title:${q} OR creator:${q}` } }, count, 0);
      const out = [];
      for (const item of docs.slice(0, 8)) {
        try {
          const t = await ArchiveAPI.resolve(item);
          if (t) out.push(t);
        } catch (e) {}
      }
      return out;
    } catch (e) {
      return [];
    }
  };

  const globalSearch = async q => {
    lastSearchQ = q;
    currentFilter = "";
    sectionTitle.textContent = `Results for "${q}"`;
    sectionSub.textContent = "Jo gaana chuno, wahi bajega";
    showLoading();
    try {
      const [ytTracks, arcTracks] = await Promise.all([
        YOUTUBE_API_KEY ? searchYouTube(q, 15).catch(() => []) : Promise.resolve([]),
        searchArchive(q, 10)
      ]);
      const seen = new Set();
      const tracks = [...ytTracks, ...arcTracks].filter(t =>
        seen.has(t.id) ? false : (seen.add(t.id), true));
      currentTracks = tracks;
      if (!tracks.length) {
        showEmpty(`No results for "${q}". Spelling check karo ya koi aur naam try karo.`);
      } else {
        render();
      }
    } catch (e) {
      console.error(e);
      showError("Search failed. Check your connection.");
    }
  };

  searchInput.addEventListener("input", () => {
    currentFilter = searchInput.value.trim();
    if (currentTracks.length) render();
  });
  searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = searchInput.value.trim();
      if (q) globalSearch(q);
    }
  });

  /* ---------- Grid events: click = play that one track ---------- */
  grid.addEventListener("click", e => {
    const card = e.target.closest(".track-card");
    if (!card) return;
    const track = currentTracks.find(t => t.id === card.dataset.id);
    if (!track) return;

    if (Player.state.current && Player.state.current.id === track.id) Player.toggle();
    else {
      Player.playQueue([track], 0);
      Player.toast(`Playing: ${track.title}`);
      /* Watchdog: if the track never actually starts, tell the user. */
      const clickedId = track.id;
      setTimeout(() => {
        const cur = Player.state.current;
        if (!cur || cur.id !== clickedId) return;
        if (!Player.isPlaying()) {
          Player.toast("Track start nahi ho raha. Dobara click karo ya koi aur gaana try karo.");
        }
      }, 9000);
    }
  });

  /* ---------- Escape closes overlays ---------- */
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      ["sleepPopup", "eqPopup"].forEach(id => { const p = document.getElementById(id); p.hidden = true; });
      const m = document.getElementById("nowModal");
      if (!m.hidden) m.hidden = true;
    }
  });

  /* Highlight the playing card when the track changes. */
  document.addEventListener("ft:trackchange", () => render());

  /* ---------- Init ---------- */
  const init = () => {
    Player.init();
    searchInput.focus();
  };

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => App.init());