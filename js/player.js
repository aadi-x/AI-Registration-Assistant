/* =========================================================
   FlowTune — Player core (v2)
   Continuous playback + queue + shuffle + repeat + sleep
   timer + crossfade + equalizer + visualizer + likes +
   endless radio + keyboard shortcuts + Now Playing modal.
   ========================================================= */

const Player = (() => {
  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = 1;
  /* CRITICAL: required for sound when routed through the Web Audio graph.
     Without this, cross-origin streams (archive.org, wikimedia) play SILENT. */
  audio.crossOrigin = "anonymous";

  /* ---------- Web Audio graph (EQ + volume + visualizer) ---------- */
  let audioCtx = null;
  let source = null;
  let masterGain = null;
  let analyser = null;
  let eqFilters = [];
  let hasGraph = false;
  let targetVolume = 0.8;

  const EQ_PRESETS = {
    flat:    [],
    bass:    [{ type: "lowshelf", frequency: 110, gain: 7 }, { type: "peaking", frequency: 250, gain: 2, q: 0.8 }],
    soft:    [{ type: "lowshelf", frequency: 200, gain: -2 }, { type: "highshelf", frequency: 5000, gain: -4 }],
    vocal:   [{ type: "peaking", frequency: 1000, gain: 5, q: 1.2 }, { type: "peaking", frequency: 400, gain: 1.5, q: 0.8 }],
    treble:  [{ type: "highshelf", frequency: 6000, gain: 6 }, { type: "peaking", frequency: 3000, gain: 2, q: 0.9 }],
    acoustic:[{ type: "peaking", frequency: 500, gain: 3, q: 0.7 }, { type: "peaking", frequency: 2000, gain: 2.5, q: 1 }]
  };
  let currentEq = "flat";

  function initAudioGraph() {
    if (hasGraph || !window.AudioContext) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      source = audioCtx.createMediaElementSource(audio);
      masterGain = audioCtx.createGain();
      masterGain.gain.value = targetVolume;
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);
      hasGraph = true;
      applyEq(currentEq);
    } catch (e) {
      hasGraph = false;
    }
  }

  function applyEq(preset) {
    currentEq = preset;
    if (!hasGraph) return;
    eqFilters.forEach(f => { try { f.disconnect(); } catch (e) {} });
    eqFilters = [];
    if (preset === "flat" || !EQ_PRESETS[preset]) {
      source.disconnect();
      source.connect(masterGain);
      return;
    }
    source.disconnect();
    let prev = source;
    EQ_PRESETS[preset].forEach(cfg => {
      const f = audioCtx.createBiquadFilter();
      f.type = cfg.type;
      f.frequency.value = cfg.frequency;
      if (cfg.gain !== undefined) f.gain.value = cfg.gain;
      if (cfg.q !== undefined) f.Q.value = cfg.q;
      prev.connect(f);
      prev = f;
      eqFilters.push(f);
    });
    prev.connect(masterGain);
  }

  function fadeTo(val, dur) {
    if (!hasGraph) return;
    const now = audioCtx.currentTime;
    const g = masterGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(val, now + dur);
  }

  function resumeCtx() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  }

  /* ---------- State ---------- */
  const state = {
    queue: [],
    index: -1,
    current: null,
    platform: "audio", // 'audio' | 'yt'
    shuffle: false,
    repeat: "off",
    history: [],
    sleepEndsAt: null,
    sleepInterval: null
  };

  let radio = true;
  let onQueueEnd = null;
  let extending = false;
  let fadeInNext = false;
  let likedTracks = [];
  let vizStarted = false;
  let consecutiveErrors = 0;

  const el = {
    playBtn: document.getElementById("playBtn"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    repeatBtn: document.getElementById("repeatBtn"),
    sleepTimerBtn: document.getElementById("sleepTimerBtn"),
    playerTitle: document.getElementById("playerTitle"),
    playerArtist: document.getElementById("playerArtist"),
    playerArt: document.getElementById("playerArt"),
    seekBar: document.getElementById("seekBar"),
    volumeBar: document.getElementById("volumeBar"),
    currentTime: document.getElementById("currentTime"),
    totalTime: document.getElementById("totalTime"),
    queueCount: document.getElementById("queueCount"),
    nowPlayingLine: document.getElementById("nowPlayingLine"),
    miniEq: document.getElementById("miniEq"),
    likeBtn: document.getElementById("likeBtn"),
    eqBtn: document.getElementById("eqBtn"),
    expandBtn: document.getElementById("expandBtn"),
    openModalBtn: document.getElementById("openModalBtn"),
    nowModal: document.getElementById("nowModal"),
    modalClose: document.getElementById("modalClose"),
    vizCanvas: document.getElementById("vizCanvas"),
    modalArt: document.getElementById("modalArt"),
    modalTitle: document.getElementById("modalTitle"),
    modalArtist: document.getElementById("modalArtist"),
    mPlayBtn: document.getElementById("mPlayBtn"),
    mNextBtn: document.getElementById("mNextBtn"),
    mPrevBtn: document.getElementById("mPrevBtn"),
    mShuffleBtn: document.getElementById("mShuffleBtn"),
    mRepeatBtn: document.getElementById("mRepeatBtn"),
    mSeek: document.getElementById("mSeek"),
    mCurrent: document.getElementById("mCurrent"),
    mTotal: document.getElementById("mTotal"),
    mLikeBtn: document.getElementById("mLikeBtn"),
    mEqBtn: document.getElementById("mEqBtn"),
    mSleepBtn: document.getElementById("mSleepBtn"),
    mRadioBtn: document.getElementById("mRadioBtn"),
    eqPopup: document.getElementById("eqPopup")
  };

  /* ---------- Helpers ---------- */
  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const toast = msg => {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  const saveState = () => {
    try {
      const q = state.queue.map(t => ({ ...t, art: t.art || "", src: t.src }));
      localStorage.setItem("ft.queue", JSON.stringify(q));
      localStorage.setItem("ft.index", String(state.index));
      localStorage.setItem("ft.shuffle", String(state.shuffle));
      localStorage.setItem("ft.repeat", state.repeat);
      localStorage.setItem("ft.volume", String(targetVolume));
      localStorage.setItem("ft.eq", currentEq);
      localStorage.setItem("ft.radio", String(radio));
      if (state.current) {
        localStorage.setItem("ft.pos", String(audio.currentTime || 0));
        localStorage.setItem("ft.playing", String(!audio.paused));
      }
    } catch (e) {}
  };

  const loadState = () => {
    try {
      targetVolume = parseFloat(localStorage.getItem("ft.volume")) || 0.8;
      targetVolume = Math.min(1, Math.max(0, targetVolume));
      el.volumeBar.value = targetVolume;
      updateVolumeUI();
      state.shuffle = localStorage.getItem("ft.shuffle") === "true";
      state.repeat = localStorage.getItem("ft.repeat") || "off";
      /* Endless radio is off by default: only what you select plays. */
      radio = false;
      currentEq = localStorage.getItem("ft.eq") || "flat";
      const q = JSON.parse(localStorage.getItem("ft.queue") || "[]");
      if (q.length) {
        state.queue = q;
        state.index = parseInt(localStorage.getItem("ft.index")) || 0;
        if (state.queue[state.index]) {
          state.current = state.queue[state.index];
          renderNowPlaying();
          const pos = parseFloat(localStorage.getItem("ft.pos")) || 0;
          const shouldPlay = localStorage.getItem("ft.playing") === "true";
          if (state.current.videoId || state.current.source === "YouTube") {
            state.platform = "yt";
            YTPlayer.load(state.current.videoId);
            if (shouldPlay) setTimeout(() => YTPlayer.play(), 800);
          } else {
            state.platform = "audio";
            audio.src = state.current.src;
            try { audio.currentTime = pos; } catch (e) {}
            if (shouldPlay) {
              audio.play().catch(() => {});
            }
          }
          updateQueueCount();
        }
      }
    } catch (e) {}
    loadLiked();
  };

  const updateVolumeUI = () => {
    const pct = (el.volumeBar.value - el.volumeBar.min) / (el.volumeBar.max - el.volumeBar.min) * 100;
    el.volumeBar.style.setProperty("--fill", pct + "%");
  };

  const updateSeekUI = () => {
    const cur = getCurrent();
    const dur = getDuration();
    if (!dur) return;
    const pct = (cur / dur) * 100;
    el.seekBar.value = pct;
    el.seekBar.style.setProperty("--fill", pct + "%");
    el.currentTime.textContent = fmt(cur);
    el.totalTime.textContent = fmt(dur);
    el.nowPlayingLine.style.width = pct + "%";
    el.mSeek.value = pct;
    el.mSeek.style.setProperty("--fill", pct + "%");
    el.mCurrent.textContent = fmt(cur);
    el.mTotal.textContent = fmt(dur);
  };

  const getCurrent = () => state.platform === "yt" ? YTPlayer.getTime() : audio.currentTime;
  const getDuration = () => state.platform === "yt" ? YTPlayer.getDuration() : audio.duration;

  const renderNowPlaying = () => {
    const t = state.current;
    if (!t) return;
    el.playerTitle.textContent = t.title;
    el.playerArtist.textContent = t.artist;
    el.playerArt.src = t.art || "";
    el.playerArt.alt = t.title;
    el.modalTitle.textContent = t.title;
    el.modalArtist.textContent = t.artist;
    el.modalArt.src = t.art || "";
    document.title = `${t.title} — FlowTune by Aadix`;
    updateLikeButtons();
  };

  const updateQueueCount = () => {
    if (el.queueCount) el.queueCount.textContent = `${state.queue.length} in queue`;
  };

  const setPlayIcon = playing => {
    el.playBtn.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
    el.mPlayBtn.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
    el.miniEq.classList.toggle("paused", !playing);
  };

  /* ---------- Likes ---------- */
  const loadLiked = () => {
    try { likedTracks = JSON.parse(localStorage.getItem("ft.liked") || "[]"); }
    catch (e) { likedTracks = []; }
  };

  const saveLiked = () => {
    try { localStorage.setItem("ft.liked", JSON.stringify(likedTracks)); }
    catch (e) {}
  };

  const isLiked = id => likedTracks.some(t => t.id === id);

  const getLiked = () => likedTracks.slice();

  const updateLikeButtons = () => {
    const liked = state.current && isLiked(state.current.id);
    if (el.likeBtn) {
      el.likeBtn.classList.toggle("liked", !!liked);
      el.likeBtn.innerHTML = liked ? "&#9829;" : "&#9825;";
    }
    if (el.mLikeBtn) {
      el.mLikeBtn.classList.toggle("liked", !!liked);
      el.mLikeBtn.innerHTML = liked ? "&#9829;" : "&#9825;";
    }
  };

  const toggleLike = track => {
    const i = likedTracks.findIndex(t => t.id === track.id);
    if (i >= 0) {
      likedTracks.splice(i, 1);
      toast("Removed from Liked");
    } else {
      likedTracks.push({ id: track.id, title: track.title, artist: track.artist, art: track.art || "", src: track.src, source: track.source, videoId: track.videoId });
      toast("Added to Liked");
    }
    saveLiked();
    updateLikeButtons();
    document.dispatchEvent(new CustomEvent("ft:likechange"));
  };

  /* ---------- Track counting (trending ranking) ---------- */
  const trackPlayed = track => {
    if (!track || !track.id) return;
    try {
      const key = "ft.plays." + track.id;
      localStorage.setItem(key, String((parseInt(localStorage.getItem(key)) || 0) + 1));
    } catch (e) {}
  };

  const getPlayCount = track => {
    if (!track || !track.id) return 0;
    try { return parseInt(localStorage.getItem("ft.plays." + track.id)) || 0; } catch (e) { return 0; }
  };

  /* ---------- Playback ---------- */
  const playIndex = (i, opts = {}) => {
    if (!state.queue.length || i < 0 || i >= state.queue.length) return;
    state.index = i;
    state.current = state.queue[i];
    renderNowPlaying();
    const isYt = !!(state.current.videoId || state.current.source === "YouTube");
    if (isYt) {
      playYTTrack(state.current);
    } else {
      playAudioTrack(state.current);
    }
    updateQueueCount();
    saveState();
    if (opts.announce) toast(`Now playing: ${state.current.title}`);
    trackPlayed(state.current);
    document.dispatchEvent(new CustomEvent("ft:trackchange", { detail: state.current }));
  };

  const playAudioTrack = track => {
    state.platform = "audio";
    if (YTPlayer.isPlaying()) YTPlayer.pause();
    audio.src = track.src;
    audio.oncanplay = () => {
      if (fadeInNext && hasGraph) {
        fadeTo(targetVolume, 0.5);
        fadeInNext = false;
      }
    };
    audio.play().catch(e => {
      toast("Browser blocked auto-play. Tap the play button to start.");
    });
    resumeCtx();
  };

  const playYTTrack = track => {
    state.platform = "yt";
    audio.pause();
    if (!track.videoId) {
      toast("This YouTube track is missing its video ID.");
      setTimeout(() => next(true), 400);
      return;
    }
    YTPlayer.load(track.videoId);
  };

  const play = () => {
    if (!state.current && state.queue.length) playIndex(state.index >= 0 ? state.index : 0);
    else if (state.platform === "yt") { YTPlayer.play(); }
    else {
      audio.play().catch(() => {});
      resumeCtx();
      if (hasGraph) fadeTo(targetVolume, 0.2);
    }
  };

  const pause = () => {
    if (state.platform === "yt") { YTPlayer.pause(); return; }
    if (hasGraph) {
      fadeTo(0, 0.2);
      setTimeout(() => { if (!audio.paused) audio.pause(); }, 200);
    } else {
      audio.pause();
    }
  };

  const toggle = () => {
    if (!state.current && !state.queue.length) {
      toast("No music in the queue yet.");
      return;
    }
    if (state.platform === "yt") {
      if (YTPlayer.isPlaying()) YTPlayer.pause(); else YTPlayer.play();
      return;
    }
    if (audio.paused) play(); else pause();
  };

  const seek = sec => {
    if (state.platform === "yt") {
      YTPlayer.seekTo(YTPlayer.getTime() + sec);
      return;
    }
    if (!audio.duration) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + sec));
  };

  const handleEnded = () => {
    state.history.push(state.index);
    if (state.repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    next(true);
  };

  /* Pre-fetch more tracks before the queue runs out (never-stop radio). */
  const maybeExtend = () => {
    if (!radio || extending || typeof onQueueEnd !== "function") return;
    const remaining = state.queue.length - state.index - 1;
    if (remaining > 3) return;
    extending = true;
    onQueueEnd().then(more => {
      extending = false;
      if (more && more.length) {
        const ids = new Set(state.queue.map(t => t.id));
        const fresh = more.filter(t => !ids.has(t.id));
        if (fresh.length) {
          state.queue = state.queue.concat(fresh);
          updateQueueCount();
          saveState();
        }
      }
    });
  };

  const next = auto => {
    if (!state.queue.length) return;
    let nextIdx;
    if (state.shuffle) {
      if (state.queue.length === 1) nextIdx = 0;
      else {
        do { nextIdx = Math.floor(Math.random() * state.queue.length); }
        while (nextIdx === state.index);
      }
    } else {
      nextIdx = state.index + 1;
      if (nextIdx >= state.queue.length) {
        if (state.repeat === "all") { playIndex(0); return; }
        if (radio && typeof onQueueEnd === "function") {
          onQueueEnd().then(more => {
            if (more && more.length) {
              state.queue = state.queue.concat(more);
              updateQueueCount();
              playIndex(state.index + 1);
              saveState();
            } else {
              audio.pause();
              setPlayIcon(false);
              toast("Radio found no more tracks.");
            }
          });
          return;
        }
        audio.pause();
        setPlayIcon(false);
        toast("Track finished. Select karke koi aur gaana chalao.");
        return;
      }
    }
    playIndex(nextIdx);
    maybeExtend();
  };

  const prev = () => {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    const prevIdx = state.shuffle ? (state.history.pop() ?? Math.max(0, state.index - 1)) : Math.max(0, state.index - 1);
    playIndex(prevIdx);
  };

  const toggleMute = () => {
    const muted = el.volumeBar.value == 0;
    el.volumeBar.value = muted ? 0.8 : 0;
    targetVolume = parseFloat(el.volumeBar.value);
    if (state.platform === "yt") YTPlayer.setVolume(targetVolume);
    else if (hasGraph) masterGain.gain.value = targetVolume;
    updateVolumeUI();
    saveState();
  };

  /* ---------- Radio ---------- */
  const updateRadioUI = () => {
    const btn = document.getElementById("radioToggle");
    if (btn) {
      btn.classList.toggle("active", radio);
      btn.textContent = radio ? "&#128260; Radio: On" : "&#128260; Radio: Off";
      btn.innerHTML = btn.textContent;
    }
    if (el.mRadioBtn) el.mRadioBtn.classList.toggle("active", radio);
  };

  const setRadio = on => { radio = on; updateRadioUI(); saveState(); };

  const setQueueExtender = fn => { onQueueEnd = fn; };

  /* ---------- Equalizer UI ---------- */
  const updateEqUI = () => {
    document.querySelectorAll(".eq-opt").forEach(b => {
      b.classList.toggle("active", b.dataset.eq === currentEq);
    });
    const t = document.getElementById("eqActive");
    if (t) t.textContent = `Active: ${currentEq}`;
  };

  /* ---------- Sleep timer ---------- */
  el.sleepTimerBtn.addEventListener("click", () => togglePopup("sleepPopup"));
  el.mSleepBtn.addEventListener("click", () => { el.nowModal.hidden = true; togglePopup("sleepPopup"); });

  const togglePopup = id => {
    const pop = document.getElementById(id);
    pop.hidden = !pop.hidden;
    if (id === "eqPopup") updateEqUI();
    if (id === "sleepPopup") updateSleepCount();
  };

  document.querySelectorAll(".sleep-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.id === "cancelSleep") {
        clearSleepTimer();
        document.getElementById("sleepPopup").hidden = true;
        return;
      }
      const mins = parseInt(btn.dataset.min);
      state.sleepEndsAt = Date.now() + mins * 60 * 1000;
      if (!state.sleepInterval) state.sleepInterval = setInterval(checkSleep, 1000);
      toast(`Sleep timer set: ${mins} minutes`);
      updateSleepCount();
    });
  });

  document.querySelectorAll(".eq-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      applyEq(btn.dataset.eq);
      updateEqUI();
      saveState();
      toast(`Equalizer: ${btn.dataset.eq}`);
    });
  });

  const closeEqBtn = document.getElementById("closeEq");
  if (closeEqBtn) closeEqBtn.addEventListener("click", () => { el.eqPopup.hidden = true; });

  const clearSleepTimer = () => {
    state.sleepEndsAt = null;
    if (state.sleepInterval) { clearInterval(state.sleepInterval); state.sleepInterval = null; }
    const c = document.getElementById("sleepCount");
    if (c) c.textContent = "";
    toast("Sleep timer cancelled");
  };

  const checkSleep = () => {
    updateSleepCount();
    if (state.sleepEndsAt && Date.now() >= state.sleepEndsAt) {
      pause();
      toast("Sleep timer finished. Music paused. Good night!");
      clearSleepTimer();
    }
  };

  const updateSleepCount = () => {
    const c = document.getElementById("sleepCount");
    if (!c) return;
    if (!state.sleepEndsAt) { c.textContent = ""; return; }
    const remain = Math.max(0, Math.ceil((state.sleepEndsAt - Date.now()) / 1000));
    c.textContent = `Stops in ${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`;
  };

  /* ---------- Visualizer ---------- */
  const startVisualizer = () => {
    if (!el.vizCanvas || vizStarted) return;
    vizStarted = true;
    const ctx2d = el.vizCanvas.getContext("2d");
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);

    const draw = () => {
      requestAnimationFrame(draw);
      const w = el.vizCanvas.width, h = el.vizCanvas.height;
      ctx2d.clearRect(0, 0, w, h);
      if (analyser) analyser.getByteFrequencyData(data);
      const bars = 48;
      const bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = analyser ? data[Math.floor(i * data.length / bars)] / 255 : 0;
        const bh = Math.max(2, v * h * 0.92);
        const x = i * bw;
        ctx2d.globalAlpha = 0.35 + v * 0.65;
        const grad = ctx2d.createLinearGradient(0, h - bh, 0, h);
        grad.addColorStop(0, "#10b981");
        grad.addColorStop(1, "#38bdf8");
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x + 1, h - bh, bw - 2, bh);
      }
      ctx2d.globalAlpha = 1;
    };
    draw();
  };

  /* ---------- Now Playing modal ---------- */
  const openModal = () => {
    el.nowModal.hidden = false;
    startVisualizer();
  };
  const closeModal = () => { el.nowModal.hidden = true; };

  el.openModalBtn.addEventListener("click", openModal);
  el.expandBtn.addEventListener("click", openModal);
  el.modalClose.addEventListener("click", closeModal);
  el.nowModal.addEventListener("click", e => { if (e.target === el.nowModal) closeModal(); });

  el.mPlayBtn.addEventListener("click", toggle);
  el.mNextBtn.addEventListener("click", () => next(false));
  el.mPrevBtn.addEventListener("click", prev);

  el.mShuffleBtn.addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    el.mShuffleBtn.classList.toggle("active", state.shuffle);
    el.shuffleBtn.classList.toggle("active", state.shuffle);
    toast(state.shuffle ? "Shuffle on" : "Shuffle off");
    saveState();
  });

  el.mRepeatBtn.addEventListener("click", () => {
    const modes = ["off", "all", "one"];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    el.mRepeatBtn.classList.toggle("active", state.repeat !== "off");
    el.repeatBtn.classList.toggle("active", state.repeat !== "off");
    el.repeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    el.mRepeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    toast(`Repeat: ${state.repeat === "all" ? "all" : state.repeat === "one" ? "one" : "off"}`);
    saveState();
  });

  el.mSeek.addEventListener("input", () => {
    const dur = getDuration();
    if (!dur) return;
    if (state.platform === "yt") YTPlayer.seekTo((parseFloat(el.mSeek.value) / 100) * dur);
    else audio.currentTime = (parseFloat(el.mSeek.value) / 100) * dur;
    el.mSeek.style.setProperty("--fill", el.mSeek.value + "%");
  });

  if (el.mLikeBtn) el.mLikeBtn.addEventListener("click", () => { if (state.current) toggleLike(state.current); });
  if (el.likeBtn) el.likeBtn.addEventListener("click", () => { if (state.current) toggleLike(state.current); });

  el.eqBtn.addEventListener("click", () => togglePopup("eqPopup"));
  el.mEqBtn.addEventListener("click", () => { el.nowModal.hidden = true; togglePopup("eqPopup"); });

  if (el.mRadioBtn) el.mRadioBtn.addEventListener("click", () => { setRadio(!radio); toast(radio ? "Endless Radio on" : "Endless Radio off"); });

  /* ---------- Controls ---------- */
  el.playBtn.addEventListener("click", toggle);
  el.nextBtn.addEventListener("click", () => next(false));
  el.prevBtn.addEventListener("click", prev);

  el.shuffleBtn.addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    el.shuffleBtn.classList.toggle("active", state.shuffle);
    el.mShuffleBtn.classList.toggle("active", state.shuffle);
    toast(state.shuffle ? "Shuffle on" : "Shuffle off");
    saveState();
  });

  el.repeatBtn.addEventListener("click", () => {
    const modes = ["off", "all", "one"];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    el.repeatBtn.classList.toggle("active", state.repeat !== "off");
    el.mRepeatBtn.classList.toggle("active", state.repeat !== "off");
    el.repeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    el.mRepeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    toast(`Repeat: ${state.repeat === "all" ? "all" : state.repeat === "one" ? "one" : "off"}`);
    saveState();
  });

  el.seekBar.addEventListener("input", () => {
    const dur = getDuration();
    if (!dur) return;
    if (state.platform === "yt") YTPlayer.seekTo((parseFloat(el.seekBar.value) / 100) * dur);
    else audio.currentTime = (parseFloat(el.seekBar.value) / 100) * dur;
    el.seekBar.style.setProperty("--fill", el.seekBar.value + "%");
  });

  el.volumeBar.addEventListener("input", () => {
    targetVolume = parseFloat(el.volumeBar.value);
    if (state.platform === "yt") YTPlayer.setVolume(targetVolume);
    else if (hasGraph) fadeTo(targetVolume, 0.05);
    updateVolumeUI();
    saveState();
  });

  /* ---------- Audio events ---------- */
  audio.addEventListener("timeupdate", updateSeekUI);
  audio.addEventListener("loadedmetadata", () => {
    el.totalTime.textContent = fmt(audio.duration);
    updateSeekUI();
  });
  audio.addEventListener("ended", () => {
    if (state.platform !== "audio") return;
    if (state.repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else if (hasGraph) {
      fadeTo(0, 0.35);
      fadeInNext = true;
      setTimeout(handleEnded, 350);
    } else {
      handleEnded();
    }
  });
  audio.addEventListener("play", () => { setPlayIcon(true); resumeCtx(); });
  audio.addEventListener("playing", () => { consecutiveErrors = 0; });
  audio.addEventListener("pause", () => setPlayIcon(false));
  audio.addEventListener("error", () => {
    if (state.platform !== "audio") return;
    consecutiveErrors++;
    const src = state.current && state.current.source;
    if (src === "Archive") markArchiveUnhealthy();
    /* archive.org throttling => streams 503. Jump to working sources fast
       instead of skipping silently through a dead queue. */
    if (consecutiveErrors >= 2) {
      const n = state.queue.length;
      for (let k = 1; k <= n; k++) {
        const i = (state.index + k) % n;
        if (state.queue[i] && state.queue[i].source !== "Archive") {
          playIndex(i);
          toast("Some tracks unavailable — playing working ones");
          return;
        }
      }
    }
    toast("Stream failed. Skipping to next track...");
    setTimeout(() => next(true), 600);
  });

  /* ---------- Keyboard shortcuts ---------- */
  document.addEventListener("keydown", e => {
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    switch (e.key) {
      case " ": e.preventDefault(); toggle(); break;
      case "ArrowRight": e.preventDefault(); seek(10); break;
      case "ArrowLeft": e.preventDefault(); seek(-10); break;
      case "l": case "L": if (state.current) toggleLike(state.current); break;
      case "m": case "M": toggleMute(); break;
    }
  });

  /* ---------- Queue API ---------- */
  const playQueue = (tracks, startIdx = 0) => {
    state.queue = tracks;
    state.index = -1;
    state.history = [];
    updateQueueCount();
    playIndex(startIdx);
  };

  const addToQueue = (track, autoplay = false) => {
    const idx = state.queue.findIndex(t => t.id === track.id);
    if (idx >= 0) { playIndex(idx); return; }
    state.queue.push(track);
    updateQueueCount();
    if (autoplay || state.index === -1) playIndex(state.queue.length - 1);
    else toast(`Added to queue: ${track.title}`);
    saveState();
  };

  const clearQueue = () => {
    audio.pause();
    state.queue = [];
    state.index = -1;
    state.current = null;
    updateQueueCount();
    el.playerTitle.textContent = "Nothing playing";
    el.playerArtist.textContent = "Select a song to begin";
    el.playerArt.src = "";
    el.modalTitle.textContent = "Nothing playing";
    el.modalArtist.textContent = "Select a song to begin";
    el.modalArt.src = "";
    document.title = "FlowTune by Aadix";
    saveState();
  };

  /* ---------- Init ---------- */
  const tick = () => {
    requestAnimationFrame(tick);
    if (state.platform === "yt" && YTPlayer.isReady()) updateSeekUI();
  };

  const init = () => {
    initAudioGraph();
    YTPlayer.init();
    YTPlayer.setCallbacks({
      onEnded: handleEnded,
      onPlay: () => setPlayIcon(true),
      onPause: () => setPlayIcon(false)
    });
    loadState();
    applyEq(currentEq);
    if (hasGraph) masterGain.gain.value = targetVolume;
    el.shuffleBtn.classList.toggle("active", state.shuffle);
    el.mShuffleBtn.classList.toggle("active", state.shuffle);
    el.repeatBtn.classList.toggle("active", state.repeat !== "off");
    el.mRepeatBtn.classList.toggle("active", state.repeat !== "off");
    el.repeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    el.mRepeatBtn.innerHTML = state.repeat === "one" ? "&#128257;1" : "&#128257;";
    el.volumeBar.addEventListener("change", saveState);
    if (hasGraph) {
      setTimeout(() => { if (state.platform === "audio" && !audio.paused) fadeTo(targetVolume, 0.2); }, 300);
    }
    updateRadioUI();
    updateEqUI();
    tick();
  };

  return {
    init, playQueue, addToQueue, clearQueue,
    toggle, next, prev, play, pause, seek,
    getPlayCount, saveState, toast,
    isLiked, toggleLike, getLiked,
    setRadio, getRadio: () => radio, setQueueExtender,
    applyEq,
    isPlaying: () => state.platform === "yt" ? YTPlayer.isPlaying() : !audio.paused,
    get state() { return state; }
  };
})();


