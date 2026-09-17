/* =========================================================
   FlowTune — Config
   Multiple ad-free, legal music sources:
   1. Internet Archive  (free, no API key required)
   2. Jamendo           (free, needs a free client_id)
   3. Local uploads     (your own audio files)
   ========================================================= */

// Get a FREE Jamendo client_id from: https://devportal.jamendo.com
// Paste it below to enable Jamendo as an extra source.
// Leave empty ("") to use Internet Archive only.
const JAMENDO_CLIENT_ID = "";

// Get a FREE YouTube Data API v3 key from Google Cloud Console:
// https://console.cloud.google.com/apis/library/youtube.googleapis.com
// (Create a project -> enable "YouTube Data API v3" -> Credentials -> API key)
// Paste it below to enable 90s Hindi/Bollywood song search.
// Leave empty ("") if you don't want YouTube songs.
const YOUTUBE_API_KEY = "AIzaSyAWRyMqDMqfxEYIyZbKegtJIarBVkQrLVs";

// Multi-language song searches (rotated for variety + radio).
// Each language drives its own 90s-style song recommendations.
const LANGUAGES = [
  {
    name: "Hindi",
    queries: [
      "90s hindi songs hits",
      "kumar sanu 90s hits",
      "udit narayan 90s hits",
      "alka yagnik old hindi songs",
      "sadabahar hindi songs 90s"
    ]
  },
  {
    name: "Tamil",
    queries: [
      "90s tamil songs hits",
      "illayaraja tamil hits",
      "spb tamil songs 90s",
      "ar rahman 90s tamil songs"
    ]
  },
  {
    name: "Telugu",
    queries: [
      "90s telugu songs hits",
      "spb telugu hits 90s",
      "chiranjeevi songs 90s",
      "telugu melody songs old"
    ]
  },
  {
    name: "Punjabi",
    queries: [
      "punjabi old songs hits",
      "gurdas maan hits",
      "punjabi sad songs 90s",
      "90s punjabi songs hits"
    ]
  },
  {
    name: "Marathi",
    queries: [
      "marathi old songs hits",
      "marathi hits 90s",
      "90s marathi songs hits"
    ]
  },
  {
    name: "Bengali",
    queries: [
      "bengali old songs hits",
      "kishore kumar bengali songs",
      "90s bengali songs hits"
    ]
  },
  {
    name: "English",
    queries: [
      "90s english songs hits",
      "90s pop hits",
      "90s love songs english",
      "90s rock hits"
    ]
  }
];

// Built-in fallback playlist from Wikimedia Commons (CORS-enabled,
// CC-licensed). Used only when other sources are down, so the site
// ALWAYS has music to play. "moods" decides which category shows them.
const FALLBACK_TRACKS = [
  { id: "wm-exit", title: "Exit the Premises", artist: "Kevin MacLeod", duration: 0, moods: ["trending", "drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Exit_the_Premises_%28ISRC_USUAN1500029%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-lobby", title: "Lobby Time", artist: "Kevin MacLeod", duration: 0, moods: ["trending", "drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Lobby_Time_%28ISRC_USUAN1600054%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-road", title: "Long Road Ahead", artist: "Kevin MacLeod", duration: 0, moods: ["drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/0/02/Long_Road_Ahead_%28ISRC_USUAN1100588%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-pilot", title: "Pilot Error", artist: "Kevin MacLeod", duration: 0, moods: ["drive", "work"],
    src: "https://upload.wikimedia.org/wikipedia/commons/3/33/Pilot_Error_%28ISRC_USUAN1100112%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-redletter", title: "Redletter", artist: "Kevin MacLeod", duration: 0, moods: ["drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/7/78/Redletter_%28ISRC_USUAN1100714%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-ujangong", title: "Ujangong Mix", artist: "Kevin MacLeod", duration: 0, moods: ["drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Ujangong_Mix_%28ISRC_USUAN1100484%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-merrygo", title: "Merry Go", artist: "Kevin MacLeod", duration: 0, moods: ["trending", "drive"],
    src: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Merry_Go_%28ISRC_USUAN1100731%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-studyrelax", title: "Study And Relax", artist: "Kevin MacLeod", duration: 223, moods: ["trending", "study", "relax", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Study_And_Relax_by_Kevin_MacLeod.ogg", art: "", source: "Wikimedia" },
  { id: "wm-silver", title: "Silver Blue Light", artist: "Kevin MacLeod", duration: 0, moods: ["relax", "study", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/8/85/Kevin_MacLeod_-_Silver_Blue_Light.ogg", art: "", source: "Wikimedia" },
  { id: "wm-impromptu", title: "Impromptu in Quarter Comma Meantone", artist: "Kevin MacLeod", duration: 0, moods: ["study", "work", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/Kevin_MacLeod_-_Impromptu_in_Quarter_Comma_Meantone.ogg", art: "", source: "Wikimedia" },
  { id: "wm-prelude", title: "Prelude in C (BWV 846)", artist: "J.S. Bach / Kevin MacLeod", duration: 0, moods: ["study", "relax", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Prelude_in_C_%28BWV_846%29_%28ISRC_USUAN1100689%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-interloper", title: "Interloper", artist: "Kevin MacLeod", duration: 0, moods: ["work", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/5/57/Interloper_%28MacLeod%2C_Kevin%29_%28ISRC_USUAN1100401%29.oga", art: "", source: "Wikimedia" },
  { id: "wm-texture", title: "Texture for Violincello and Pianoforte No. 2", artist: "Kevin MacLeod", duration: 0, moods: ["work", "study", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/4/4d/Texture_for_Violincello_and_Pianoforte_No._2_%28ISRC_USUAN1100505%29.mp3", art: "", source: "Wikimedia" },
  { id: "wm-forest", title: "Forest (relaxing music)", artist: "SoundAudio", duration: 152, moods: ["relax", "study", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/3/31/SoundAudio_-_Forest_%28relaxing_music%29.opus", art: "", source: "Wikimedia" },
  { id: "wm-atmosphere", title: "Fantastic Atmosphere", artist: "Oleg Mazur", duration: 470, moods: ["relax", "work", "lofi"],
    src: "https://upload.wikimedia.org/wikipedia/commons/1/12/Oleg_Mazur_-_Fantastic_Atmosphere_%28Ambient_Deep_House_Background_Music%29.opus", art: "", source: "Wikimedia" }
];

/* Category definitions.
   Each category is a "mood" with:
   - title/subtitle shown in the UI
   - archive:   search query + filter passed to Internet Archive's open API
   - jamendo:   musicinfo tag + language passed to Jamendo API
*/
const CATEGORIES = {
  trending: {
    title: "Trending Now",
    sub: "Curated ad-free tracks across all moods",
    archive: {
      q: "best of instrumental",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 24
    },
    jamendo: { tags: "instrumental", order: "popularity_desc", count: 24 }
  },
  drive: {
    title: "Long Drive",
    sub: "Highway beats that never quit",
    archive: {
      q: "upbeat instrumental rock",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 20
    },
    jamendo: { tags: "rock", order: "popularity_desc", count: 20 }
  },
  study: {
    title: "Deep Study",
    sub: "Focus-friendly sounds for long sessions",
    archive: {
      q: "lo-fi study music",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 20
    },
    jamendo: { tags: "lofi", order: "popularity_desc", count: 20 }
  },
  relax: {
    title: "Relaxation",
    sub: "Calm, soothing and peaceful",
    archive: {
      q: "relaxing ambient nature sounds",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 20
    },
    jamendo: { tags: "ambient", order: "popularity_desc", count: 20 }
  },
  work: {
    title: "Work Flow",
    sub: "Deep concentration instrumentals",
    archive: {
      q: "instrumental electronic focus",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 20
    },
    jamendo: { tags: "electronic", order: "popularity_desc", count: 20 }
  },
  lofi: {
    title: "Lofi Beats",
    sub: "Chill lofi for relaxed vibes",
    archive: {
      q: "lofi hip hop beats",
      fq: "mediatype:(audio)",
      sort: "downloads desc",
      count: 20
    },
    jamendo: { tags: "lofi", order: "popularity_desc", count: 20 }
  },
  bollywood: {
    title: "Bollywood 90s",
    sub: "Old Hindi songs streamed from YouTube (official uploads)"
  }
};