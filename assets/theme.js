/* CIVOLTEN — preferencia visual local, sem alterar dados de orcamentos. */
(function () {
  'use strict';
  var storageKey = 'civolten-theme';
  var media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function savedTheme() {
    try {
      var saved = window.localStorage.getItem(storageKey);
      return saved === 'dark' || saved === 'light' ? saved : null;
    } catch (_) {
      return null;
    }
  }

  var preference = savedTheme();

  function activeTheme() {
    return preference || (media && media.matches ? 'dark' : 'light');
  }

  function applyTheme() {
    var theme = activeTheme();
    var dark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1726' : '#08182b');

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      button.setAttribute('title', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      var icon = button.querySelector('.theme-icon');
      var label = button.querySelector('.theme-label');
      if (icon) icon.textContent = dark ? '☀' : '☾';
      if (label) label.textContent = dark ? 'Modo claro' : 'Modo escuro';
    });
  }

  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    preference = theme;
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (_) {
      // O controle funciona mesmo quando o armazenamento do navegador e bloqueado.
    }
    applyTheme();
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest
      ? event.target.closest('[data-theme-toggle]') : null;
    if (!button) return;
    event.preventDefault();
    setTheme(activeTheme() === 'dark' ? 'light' : 'dark');
  });

  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', function () {
      if (!preference) applyTheme();
    });
  }

  document.addEventListener('DOMContentLoaded', applyTheme);
  applyTheme();
  window.CIVOLTEN_THEME = { get: activeTheme, set: setTheme };
}());
