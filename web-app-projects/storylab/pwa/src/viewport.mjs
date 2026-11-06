// Hosted WebViews may report zero for CSS viewport-height units after attachment.
// Keep a pixel-based limit in sync with real layout and keyboard changes.
export function installViewport(window, document) {
  const update = () => {
    const height = Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 640);
    document.documentElement.style.setProperty('--app-height', `${Math.max(1, height)}px`);
  };
  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  return update;
}
