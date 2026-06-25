/* ==========================================================================
 *  Bacillerna — Bakgrundsmusik (återanvändbar modul)
 * --------------------------------------------------------------------------
 *  Lägg till i valfritt spel med EN rad, t.ex:
 *
 *    <script src="bg-musik.js" data-track="ljud/spelmusik.mp3"></script>
 *
 *  Funktioner:
 *   • Loopar musik lågt (under ljudeffekterna)
 *   • Flytande på/av-knapp (🎵 / 🔇) — stor och barnvänlig
 *   • Kommer ihåg valet (localStorage) mellan besök
 *   • Startar tyst och slår på vid första touch (webbläsarregler för autoplay)
 *   • Kräver inget av spelet — bara att MP3:n finns
 *
 *  Inställningar via data-attribut på <script>-taggen:
 *   data-track   = sökväg till MP3 (obligatorisk)
 *   data-volume  = 0.0–1.0 (standard 0.25)
 *   data-pos     = "bottom-left" | "bottom-right" | "top-left" | "top-right"
 * ========================================================================== */
(function () {
  'use strict';

  var script  = document.currentScript;
  var track   = script && script.getAttribute('data-track');
  if (!track) { console.warn('[bg-musik] data-track saknas — ingen musik laddad.'); return; }

  var volume  = parseFloat(script.getAttribute('data-volume')) || 0.25;
  var pos     = script.getAttribute('data-pos') || 'bottom-left';
  var label   = script.getAttribute('data-label') || 'Slå på eller av musik';
  var KEY     = 'bacillerna-musik'; // 'on' (standard) eller 'off'

  var audio = new Audio(track);
  audio.loop = true;
  audio.volume = volume;
  audio.preload = 'auto';

  // 'off' bara om föräldern/barnet uttryckligen stängt av tidigare
  var wantsMusic = localStorage.getItem(KEY) !== 'off';

  // ---- På/av-knapp -------------------------------------------------------
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  var corners = {
    'bottom-left':  'bottom:14px;left:14px;',
    'bottom-right': 'bottom:14px;right:14px;',
    'top-left':     'top:14px;left:14px;',
    'top-right':    'top:14px;right:14px;'
  };
  btn.style.cssText =
    'position:fixed;z-index:99999;' + (corners[pos] || corners['bottom-left']) +
    'width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;' +
    'font-size:26px;line-height:54px;text-align:center;padding:0;' +
    'background:rgba(255,255,255,0.9);color:#2D8659;' +
    'box-shadow:0 3px 10px rgba(0,0,0,0.2);' +
    '-webkit-tap-highlight-color:transparent;transition:transform .1s;';
  btn.onpointerdown = function () { btn.style.transform = 'scale(0.9)'; };
  btn.onpointerup   = function () { btn.style.transform = 'scale(1)'; };

  function render() {
    btn.textContent = wantsMusic ? '🎵' : '🔇';
    btn.style.opacity = wantsMusic ? '1' : '0.6';
  }

  function play() {
    if (!wantsMusic) return;
    var p = audio.play();
    if (p) p.catch(function () { /* väntar på touch */ });
  }

  function toggle() {
    wantsMusic = !wantsMusic;
    localStorage.setItem(KEY, wantsMusic ? 'on' : 'off');
    if (wantsMusic) { play(); } else { audio.pause(); }
    render();
  }

  btn.addEventListener('click', toggle);

  // ---- Autoplay-upplåsning: starta vid första interaktionen --------------
  function unlock() {
    play();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  }
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false });

  // Pausa när fliken/appen göms, återuppta när man kommer tillbaka
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { audio.pause(); }
    else { play(); }
  });

  function init() {
    document.body.appendChild(btn);
    render();
    play(); // försöker direkt; faller tillbaka på unlock() om blockerat
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
