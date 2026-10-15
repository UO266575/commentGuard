// YouTube's dark theme is a per-site preference the user sets from their account menu,
// independent of the OS/browser's `prefers-color-scheme` — verified live on 2026-10-15:
// toggling YouTube's own "Oscuro" setting left `matchMedia('(prefers-color-scheme: dark)')`
// at `false` while YouTube itself rendered dark. The only reliable signal is YouTube's own
// `dark` attribute on `<html>`; its CSS custom properties (--yt-spec-*) turned out NOT to
// be plain inherited values either (they read back empty even in light mode), so this
// extension's theme is self-contained rather than borrowed from the host page.
function isYouTubeDarkThemeActive(): boolean {
  return document.documentElement.hasAttribute("dark");
}

// Calls `onChange` immediately with the current theme, then again whenever the user
// toggles YouTube's theme while this UI is mounted. Returns a cleanup function.
export function watchYouTubeTheme(onChange: (isDark: boolean) => void): () => void {
  onChange(isYouTubeDarkThemeActive());

  const observer = new MutationObserver(() => onChange(isYouTubeDarkThemeActive()));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });

  return () => observer.disconnect();
}
