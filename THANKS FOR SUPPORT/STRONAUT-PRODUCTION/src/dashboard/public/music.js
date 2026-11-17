/* STRONAUT — background music (file lokal, tanpa YouTube)
   Lagu : Different Heaven — Safe And Sound (Instrumental) · NCS
   File : /audio/safe-and-sound.mp3
   - Loop otomatis, volume & status jeda diingat lintas halaman
   - Posisi lagu dilanjutkan saat pindah halaman / refresh
   - Browser memblokir autoplay, jadi lagu mulai pada interaksi pertama (klik/tap/tombol) */
(function () {
  var SRC = '/audio/safe-and-sound.mp3';
  var KEY = 'stronaut_music';
  var TITLE = 'Safe And Sound (Instrumental)';
  var ARTIST = 'Different Heaven · NCS';

  var want = true, vol = 40, resumeAt = 0;
  try {
    var s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.paused) want = false;
    if (typeof s.vol === 'number') vol = Math.min(100, Math.max(0, s.vol));
    if (typeof s.t === 'number' && s.t > 0) resumeAt = s.t;
  } catch (e) {}

  var audio = new Audio();
  audio.src = SRC;
  audio.loop = true;
  audio.preload = 'metadata';
  audio.volume = vol / 100;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        paused: !want, vol: vol, t: Math.floor(audio.currentTime || 0)
      }));
    } catch (e) {}
  }

  var ui = document.createElement('div');
  ui.className = 'music';
  ui.innerHTML =
    '<button type="button" id="mBtn" aria-label="Putar/jeda musik">▶</button>' +
    '<span class="eq"><i></i><i></i><i></i><i></i></span>' +
    '<small id="mTxt">Ketuk untuk musik</small>' +
    '<input id="mVol" type="range" min="0" max="100" aria-label="Volume">';

  function paint(on) {
    ui.classList.toggle('on', on);
    var b = document.getElementById('mBtn'), t = document.getElementById('mTxt');
    if (b) b.textContent = on ? '❚❚' : '▶';
    if (t) t.textContent = on ? 'Safe And Sound' : (want ? 'Ketuk untuk musik' : 'Musik dijeda');
  }

  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* diblokir browser: tunggu interaksi */ });
  }

  function arm() {
    var names = ['pointerdown', 'keydown', 'touchstart'];
    function go() {
      if (want && audio.paused) play();
      names.forEach(function (n) { document.removeEventListener(n, go, true); });
    }
    names.forEach(function (n) { document.addEventListener(n, go, true); });
  }

  function fail() {
    ui.innerHTML = '<small>Musik tidak dapat diputar</small>';
    ui.classList.remove('on');
  }

  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    document.body.appendChild(ui);

    var v = document.getElementById('mVol');
    v.value = vol;
    v.oninput = function () { vol = +v.value; audio.volume = vol / 100; save(); };
    document.getElementById('mBtn').onclick = function (e) {
      e.stopPropagation();
      if (audio.paused) { want = true; play(); } else { want = false; audio.pause(); }
      save(); paint(!audio.paused);
    };

    audio.addEventListener('play', function () { paint(true); });
    audio.addEventListener('pause', function () { paint(false); });
    audio.addEventListener('error', fail);
    audio.addEventListener('loadedmetadata', function () {
      if (resumeAt > 0 && resumeAt < (audio.duration || 0) - 2) {
        try { audio.currentTime = resumeAt; } catch (e) {}
      }
    });

    setInterval(function () { if (!audio.paused) save(); }, 1500);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: TITLE, artist: ARTIST, album: 'STRONAUT' });
        navigator.mediaSession.setActionHandler('play', function () { want = true; play(); save(); });
        navigator.mediaSession.setActionHandler('pause', function () { want = false; audio.pause(); save(); });
      } catch (e) {}
    }

    paint(false);
    if (want) { play(); arm(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
