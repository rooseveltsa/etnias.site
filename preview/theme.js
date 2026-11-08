// Tema claro/escuro: aplica a preferência guardada (ou a do sistema) antes da primeira pintura, para não piscar.
(function () {
  try {
    var saved = localStorage.getItem('opy-theme');
    var theme = saved === 'dark' || saved === 'light' ? saved : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
