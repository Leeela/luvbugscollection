(function () {
  if (!sessionStorage.getItem('luvbugs_app')) return;
  function inject() {
    var btn = document.createElement('a');
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
