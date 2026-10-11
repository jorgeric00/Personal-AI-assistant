// Aplica el tema guardado antes de pintar la página para evitar un destello de color.
try {
  var theme = localStorage.getItem('lifeos.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // Sin acceso a localStorage: se usa el tema del sistema.
}
