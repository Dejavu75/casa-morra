export const THEME_KEY = 'casa-morra:tema';
export const nextTheme = (current) => current === 'oscuro' ? 'claro' : 'oscuro';

export function readTheme(storage) {
  try {
    const saved = storage?.getItem(THEME_KEY);
    return saved === 'claro' || saved === 'oscuro' ? saved : null;
  } catch {
    return null;
  }
}

export function saveTheme(storage, theme) {
  try {
    storage?.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(root, theme) {
  root.documentElement.dataset.theme = theme;
  root.documentElement.style.colorScheme = theme === 'oscuro' ? 'dark' : 'light';
}
