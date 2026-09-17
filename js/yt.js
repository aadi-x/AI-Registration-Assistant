/* =========================================================
   FlowTune — YouTube integration
   - searchYouTube() via free YouTube Data API v3 key
   - YTPlayer: official iframe embed (free, cloud streaming)
   No download needed — everything streams from YouTube.
   ========================================================= */

/* ISO 8601 duration ("PT4M32S") -> seconds */
function isoDurationToSec(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

/* Search YouTube for embeddable videos. */
async function searchYouTube(query, max = 20) {
  if (!YOUTUBE_API_KEY) throw new Error("NO_KEY");
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(max),
    q: query,
    videoEmbeddable: "true",
    videoDuration: "medium",
    key: YOUTUBE_API_KEY
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const data = await fetchJSON(url, 10000);
  const items = (data && data.items) || [];

  /* Fetch durations in one batch for nicer UI. */
  const ids = items.map(i => i.id && i.id.videoId).filter(Boolean);
  let durations = {};
  if (ids.length) {
    try {
      const dur = await fetchJSON(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(ids.join(","))}&key=${YOUTUBE_API_KEY}`,
        10000
      );
      (dur.items || []).forEach(v => { durations[v.id] = isoDurationToSec(v.contentDetails.duration); });
    } catch (e) {}
  }

  return items
    .filter(i => i.id && i.id.videoId)
    .map(i => {
      const sn = i.snippet || {};
      const th = sn.thumbnails || {};
      const art = (th.high && th.high.url) || (th.medium && th.medium.url) || (th.default && th.default.url) || "";
      return {
        id: "yt-" + i.id.videoId,
        videoId: i.id.videoId,
        title: (sn.title || "Unknown").slice(0, 60),
        artist: (sn.channelTitle || "YouTube").slice(0, 40),
        src: "",
        art,
        source: "YouTube",
        duration: durations[i.id.videoId] || 0
      };
    });
}

/* =========================================================
   YTPlayer — wrapper around the official YouTube IFrame API
   ========================================================= */
const YTPlayer = (() => {
  let apiReady = false;
  let playerReady = false;
  let player = null;
  let pendingVideoId = null;
  let videoId = null;
  let playing = false;

  const cbs = { onEnded: null, onPlay: null, onPause: null };

  function loadAPI() {
    if (window.YT || document.getElementById("yt-api-script")) return;
    const s = document.createElement("script");
    s.id = "yt-api-script";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }

  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    createPlayer();
  };

  function createPlayer() {
    if (!document.getElementById("ytHost")) {
      const div = document.createElement("div");
      div.id = "ytHost";
      div.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;opacity:0;pointer-events:none;";
      document.body.appendChild(div);
    }
    player = new YT.Player("ytHost", {
      width: "0",
      height: "0",
      playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          playerReady = true;
          if (pendingVideoId) {
            player.loadVideoById(pendingVideoId);
            player.playVideo();
            pendingVideoId = null;
          }
        },
        onStateChange: e => {
          if (e.data === YT.PlayerState.PLAYING) {
            playing = true;
            if (cbs.onPlay) cbs.onPlay();
          } else if (e.data === YT.PlayerState.PAUSED) {
            playing = false;
            if (cbs.onPause) cbs.onPause();
          } else if (e.data === YT.PlayerState.ENDED) {
            playing = false;
            if (cbs.onEnded) cbs.onEnded();
          }
        },
        onError: () => {
          playing = false;
          if (cbs.onEnded) cbs.onEnded();
        }
      }
    });
  }

  return {
    init() { loadAPI(); },
    isReady() { return playerReady; },
    isPlaying() { return playing; },
    getVideoId() { return videoId; },
    load(id) {
      videoId = id;
      if (playerReady && player) {
        player.loadVideoById(id);
        player.playVideo();
      } else {
        pendingVideoId = id;
      }
    },
    play() { if (playerReady && player) player.playVideo(); },
    pause() { if (playerReady && player) player.pauseVideo(); },
    seekTo(sec) { if (playerReady && player) player.seekTo(sec, true); },
    getTime() { return (playerReady && player.getCurrentTime) ? player.getCurrentTime() : 0; },
    getDuration() { return (playerReady && player.getDuration) ? player.getDuration() : 0; },
    setVolume(v) { if (playerReady && player) player.setVolume(Math.max(0, Math.min(100, Math.round(v * 100)))); },
    setCallbacks(c) { Object.assign(cbs, c); }
  };
})();