// Tema claro/escuro e acessibilidade: aplica a preferência guardada (ou a do sistema) antes da primeira pintura, para não piscar.
(function () {
  try {
    var saved = localStorage.getItem('opy-theme');
    // Padrão é o tema Dia; o tema Noite só entra quando a pessoa escolhe (menu Recursos ou Configurações).
    var theme = saved === 'dark' || saved === 'terra' ? saved : 'light';
    document.documentElement.dataset.theme = theme;
    // Acessibilidade (Configurações): texto maior e menos movimento, também antes da pintura.
    document.documentElement.dataset.text = localStorage.getItem('opy-text') === 'large' ? 'large' : 'normal';
    document.documentElement.dataset.motion = localStorage.getItem('opy-motion') === 'reduce' ? 'reduce' : 'auto';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
