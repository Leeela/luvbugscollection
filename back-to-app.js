(function () {
  // App-läge = installerad PWA (standalone), Android-app (TWA), eller om man
  // kom in via en /app/-sida i samma flik (sessionStorage-flaggan).
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  var isTWA = document.referrer.startsWith('android-app://');
  var fromAppPage = !!sessionStorage.getItem('luvbugs_app');
  if (!(isStandalone || isTWA || fromAppPage)) return;

  // Behåll flaggan så app-läget följer med när man navigerar mellan spelen.
  sessionStorage.setItem('luvbugs_app', '1');

  // Huvudsajtens sidor → app-versionerna. Annars hamnar man på
  // luvbugscollection.com med vanlig header/Shop/meny när man trycker
  // "Back to Games" / "Home" inne i ett spel.
  var APP_MAP = {
    '/': '/app/',
    '/index.html': '/app/',
    '/games.html': '/app/games.html',
    '/watch.html': '/app/watch.html',
    '/stories.html': '/app/stories.html'
  };

  function apply() {
    document.querySelectorAll('a').forEach(function (a) {
      if (a.origin !== location.origin) return;

      // Skriv om nav-länkar till app-versionen → håll kvar i appen.
      if (APP_MAP[a.pathname]) {
        a.setAttribute('href', APP_MAP[a.pathname]);
        return;
      }

      // Barnsäkert: dölj alla Shop-länkar i appläge.
      if (/\/shop(\.html)?$/i.test(a.pathname)) {
        a.style.display = 'none';
      }
    });

    // Flytande reservknapp tillbaka till spelportalen (för spel som saknar
    // egen tillbaka-länk, t.ex. Dentist).
    if (!document.getElementById('back-to-app-btn')) {
      var btn = document.createElement('a');
      btn.id = 'back-to-app-btn';
      btn.href = '/app/games.html';
      btn.innerHTML = '&#8592; Games';
      btn.setAttribute('style',
        'position:fixed;bottom:20px;left:16px;z-index:99999;' +
        'background:#7BC142;color:#fff;padding:10px 20px;' +
        'border-radius:999px;font-family:Nunito,sans-serif;font-weight:700;' +
        'font-size:14px;text-decoration:none;' +
        'box-shadow:0 3px 12px rgba(0,0,0,0.25);' +
        'display:inline-flex;align-items:center;gap:6px;'
      );
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
