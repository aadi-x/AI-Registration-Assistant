/* =========================================================
   FlowTune — API layer
   Fetches ad-free, license-safe music from:
   - Internet Archive (no key)
   - Jamendo (optional key)
   ========================================================= */

/* fetch with a timeout so a down source fails fast instead of hanging. */
async function fetchJSON(url, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Archive stream health ----------
   archive.org download servers intermittently return 503 (throttling).
   We track health so dead streams are filtered out fast and the player
   can jump to working sources. */
let archiveUnhealthy = false;
function markArchiveUnhealthy() { archiveUnhealthy = true; }
function markArchiveHealthy() { archiveUnhealthy = false; }
function isArchiveUnhealthy() { return archiveUnhealthy; }

/* Lightweight check that a stream URL actually serves audio. */
async function streamOK(url, timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (ct && !ct.startsWith("audio/")) return false;
    return true;
  } catch (e) {
    return false;
  }
}

const ArchiveAPI = {
  base: "https://archive.org",

  async search(cat, count = 20, start = 0) {
    const params = new URLSearchParams();
    params.set("q", cat.archive.q);
    params.set("fl[]", "identifier");
    params.set("fl[]", "title");
    params.set("fl[]", "creator");
    params.set("rows", String(count));
    params.set("output", "json");
    if (start > 0) params.set("start", String(start));
    if (cat.archive.fq) params.set("fq", cat.archive.fq);
    if (cat.archive.sort) params.set("sort[]", cat.archive.sort);

    const url = `${this.base}/advancedsearch.php?${params.toString()}`;
    const data = await fetchJSON(url);
    return (data.response && data.response.docs) || [];
  },

  /* Resolve a single archive item into playable track info. */
  async resolve(item) {
    const meta = await fetchJSON(`${this.base}/metadata/${item.identifier}`);

    const files = (meta.files || []).filter(f =>
      f.format &&
      (/MP3|VBR MP3|Ogg Vorbis/i.test(f.format)) &&
      !f.format.includes("Item Tile") &&
      !/\.(jpg|jpeg|png|gif|txt|zip|xml)$/i.test(f.name)
    );
    if (!files.length) return null;

    /* Prefer shorter files (songs over full albums) and MP3. */
    files.sort((a, b) => {
      const aMp3 = /mp3/i.test(a.format) ? 0 : 1;
      const bMp3 = /mp3/i.test(b.format) ? 0 : 1;
      if (aMp3 !== bMp3) return aMp3 - bMp3;
      return (parseFloat(a.length) || Infinity) - (parseFloat(b.length) || Infinity);
    });

    const file = files[0];
    const title = (item.title || item.identifier).split("(")[0].trim();
    const artist = item.creator || "Unknown Artist";

    const track = {
      id: `archive-${item.identifier}`,
      title: title.slice(0, 60),
      artist: artist.slice(0, 40),
      src: `${this.base}/download/${item.identifier}/${encodeURIComponent(file.name)}`,
      art: `${this.base}/services/img/${item.identifier}`,
      source: "Archive",
      duration: parseFloat(file.length) || 0
    };

    /* Only return tracks whose stream actually serves audio (archive.org
       returns 503 for downloads when throttled). Self-heals when healthy. */
    if (await streamOK(track.src)) {
      markArchiveHealthy();
      return track;
    }
    markArchiveUnhealthy();
    return null;
  }
};

const JamendoAPI = {
  base: "https://api.jamendo.com/v3.0",

  isEnabled() {
    return Boolean(JAMENDO_CLIENT_ID);
  },

  async search(cat, count = 20) {
    const params = new URLSearchParams();
    params.set("client_id", JAMENDO_CLIENT_ID);
    params.set("format", "json");
    params.set("limit", String(count));
    params.set("include", "musicinfo");
    params.set("audioformat", "mp32");
    if (cat.jamendo.tags) params.set("tags", cat.jamendo.tags);
    if (cat.jamendo.order) params.set("order", cat.jamendo.order);

    const res = await fetch(`${this.base}/tracks/?${params.toString()}`);
    if (!res.ok) throw new Error("Jamendo search failed");
    const data = await res.json();
    return (data.results || []).map(t => ({
      id: `jamendo-${t.id}`,
      title: t.name,
      artist: t.artist_name,
      src: t.audio,
      art: (t.album_image || "").replace("-96x96", "-500x500"),
      source: "Jamendo",
      duration: t.duration
    }));
  }
};

/* Fetch tracks for a category, merging sources. */
async function fetchTracks(categoryKey) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return [];

  try {
    const tracks = await fetchTracksLive(categoryKey, cat);
    /* All sources filtered out (e.g. archive throttling) => fall back. */
    if (!tracks.length) throw new Error("no playable tracks");
    cacheTracks(categoryKey, tracks);
    return tracks;
  } catch (e) {
    const cached = loadCache(categoryKey);
    /* Don't serve cached Archive tracks while archive.org is throttled —
       they would all be silent. */
    const usable = isArchiveUnhealthy() ? (cached || []).filter(t => t.source !== "Archive") : cached;
    if (usable && usable.length) return usable;

    /* Last resort: built-in Wikimedia playlist (works even if Archive is down). */
    const fallback = FALLBACK_TRACKS.filter(t => t.moods.includes(categoryKey));
    const list = fallback.length ? fallback : FALLBACK_TRACKS.filter(t => t.moods.includes("trending"));
    cacheTracks(categoryKey, list);
    return list;
  }
}

/* Fetch the next page of tracks for a category (Load More). */
async function fetchMoreTracks(categoryKey, start) {
  const cat = CATEGORIES[categoryKey];
  if (!cat || !cat.archive) return [];
  try {
    return await fetchTracksLive(categoryKey, cat, start);
  } catch (e) {
    return [];
  }
}

async function fetchTracksLive(categoryKey, cat, start = 0) {
  const tasks = [ArchiveAPI.search(cat, 30, start)];

  if (JamendoAPI.isEnabled()) {
    tasks.push(JamendoAPI.search(cat));
  }

  const [archiveDocs] = await Promise.all(tasks);
  let archiveTracks = [];

  /* Resolve archive items in small batches to stay light.
     If archive is known down, probe fewer items to fail fast. */
  const batch = archiveDocs.slice(0, isArchiveUnhealthy() ? 6 : 18);
  for (const item of batch) {
    try {
      const t = await ArchiveAPI.resolve(item);
      if (t) archiveTracks.push(t);
    } catch (e) { /* skip broken item */ }
  }

  let jamendoTracks = [];
  if (JamendoAPI.isEnabled()) {
    try { jamendoTracks = await JamendoAPI.search(cat); } catch (e) {}
  }

  /* Interleave sources for variety: Archive, Jamendo, Archive, ... */
  const merged = [];
  const max = Math.max(archiveTracks.length, jamendoTracks.length);
  for (let i = 0; i < max; i++) {
    if (archiveTracks[i]) merged.push(archiveTracks[i]);
    if (jamendoTracks[i]) merged.push(jamendoTracks[i]);
  }

  return merged;
}

/* ---------- Offline cache (survives source outages) ---------- */
const CACHE_PREFIX = "ft.cache.";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; /* 7 days */

function cacheTracks(key, tracks) {
  try {
    if (!tracks || !tracks.length) return;
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      ts: Date.now(),
      tracks
    }));
  } catch (e) {}
}

function loadCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.ts > CACHE_TTL) return null;
    return obj.tracks || null;
  } catch (e) {
    return null;
  }
}