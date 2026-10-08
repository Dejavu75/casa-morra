import test from 'node:test';
import assert from 'node:assert/strict';

test('el catálogo español resuelve claves y prepara un idioma futuro con respaldo', async () => {
  const { es, resolveLocale, translate, resolveViewMessages } = await import('../dist/i18n/index.js');
  const available = {
    es: { ...es, views: { ...es.views, puzzle: { ...es.views.puzzle, feedback: { correct: 'Correcto', incorrect: 'Incorrecto' } } } },
    en: {
      'nav.home': 'Home',
      views: { puzzle: { checkMove: 'Check', feedback: { correct: 'Correct' } } },
    },
  };

  assert.equal(resolveLocale('en-US', available), 'en');
  assert.equal(resolveLocale('fr', available), 'es');
  assert.equal(translate('nav.home', 'en-US', available), 'Home');
  assert.equal(translate('nav.players', 'en-US', available), es['nav.players']);
  assert.equal(translate('missing.key', 'en-US', available), 'missing.key');
  const messages = resolveViewMessages('puzzle', 'en-US', available);
  assert.equal(messages.checkMove, 'Check');
  assert.equal(messages.feedback.correct, 'Correct');
  assert.equal(messages.feedback.incorrect, 'Incorrecto');
  assert.equal(messages.reveal, es.views.puzzle.reveal);
});

test('las traducciones actualizan texto y atributos sin cambiar identificadores de dominio', async () => {
  const { applyTranslations, es } = await import('../dist/i18n/index.js');
  const makeElement = (dataset) => ({ dataset, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
  const label = makeElement({ i18n: 'nav.home' });
  const aria = makeElement({ i18nAria: 'brand.home' });
  const placeholder = makeElement({ i18nPlaceholder: 'nav.players' });
  const meta = makeElement({ i18nContent: 'meta.description' });
  const root = {
    documentElement: { lang: 'es' },
    querySelectorAll(selector) {
      return {
        '[data-i18n]': [label],
        '[data-i18n-aria]': [aria],
        '[data-i18n-placeholder]': [placeholder],
        '[data-i18n-content]': [meta],
      }[selector];
    },
  };
  const available = { es, en: { 'nav.home': 'Home' } };

  assert.equal(applyTranslations(root, 'en-GB', available), 'en');
  assert.equal(root.documentElement.lang, 'en');
  assert.equal(label.textContent, 'Home');
  assert.equal(aria.attributes['aria-label'], es['brand.home']);
  assert.equal(placeholder.attributes.placeholder, es['nav.players']);
  assert.equal(meta.attributes.content, es['meta.description']);
  assert.equal(label.dataset.i18n, 'nav.home');
});

test('el tema usa almacenamiento propio y funciona aunque el navegador lo bloquee', async () => {
  const { THEME_KEY, nextTheme, readTheme, saveTheme, applyTheme } = await import('../dist/assets/theme.js');
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };

  assert.equal(THEME_KEY, 'casa-morra:tema');
  assert.equal(readTheme(storage), null);
  assert.equal(saveTheme(storage, 'oscuro'), true);
  assert.equal(readTheme(storage), 'oscuro');
  assert.equal(nextTheme('oscuro'), 'claro');
  assert.equal(readTheme(blocked), null);
  assert.equal(saveTheme(blocked, 'claro'), false);
  const root = { documentElement: { dataset: {}, style: {} } };
  applyTheme(root, 'oscuro');
  assert.equal(root.documentElement.dataset.theme, 'oscuro');
  assert.equal(root.documentElement.style.colorScheme, 'dark');
});
