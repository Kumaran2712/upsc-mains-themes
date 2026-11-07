/** Shared controls keep native dialog keyboard behavior and persist only a theme preference. */
export function initialiseWorkspace() {
  const root = document.documentElement;
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')!;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference: string | null = null;
  try { preference = localStorage.getItem('upscthemes-theme'); } catch { /* Storage may be disabled. */ }
  function paint() {
    const dark = preference === 'dark' || (preference !== 'light' && system.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content = dark ? '#121210' : '#fafaf9';
  }
  toggle.addEventListener('click', () => {
    preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('upscthemes-theme', preference); } catch { /* The current page still changes. */ }
    paint();
  });
  system.addEventListener('change', paint);
  window.addEventListener('storage', (event) => { if (event.key === 'upscthemes-theme' || event.key === null) { preference = event.newValue; paint(); } });
  window.addEventListener('pageshow', () => { try { preference = localStorage.getItem('upscthemes-theme'); } catch {} paint(); });
  paint();
  const menu = document.querySelector<HTMLDialogElement>('#workspace-menu')!;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-menu-open]');
  buttons.forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => { menu.showModal(); buttons.forEach((b) => b.setAttribute('aria-expanded', 'true')); });
  });
  document.querySelector('[data-menu-close]')!.addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => buttons.forEach((b) => b.setAttribute('aria-expanded', 'false')));
  menu.addEventListener('click', (event) => {
    const rect = menu.getBoundingClientRect();
    if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) menu.close();
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches && menu.open) menu.close(); });
}
