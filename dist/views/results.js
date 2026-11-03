import { escapeHtml as h, formatNumber } from './common.js';

// Una representación compartida para cualquier balance de partidas al tablero.
export function renderResults(record, labels, locale = 'es-AR', defaults = labels) {
  const text = (key) => labels?.[key] ?? defaults[key];
  if ([record.wins, record.draws, record.losses].some((value) => value == null))
    return `<span class="result-breakdown-empty">${h(text('noDetail'))}</span>`;
  const played = record.played ?? record.wins + record.draws + record.losses;
  const segments = [
    ['wins', 'winOne', 'players-results-win', record.wins],
    ['draws', 'drawOne', 'players-results-draw', record.draws],
    ['losses', 'lossOne', 'players-results-loss', record.losses],
  ];
  const share = (count) => (count / (played || 1) * 100).toFixed(2);
  let offset = 0;
  const bar = segments.map(([, , className, count]) => {
    const rect = `<rect class="${className}" x="${share(offset)}" width="${share(count)}" height="8"></rect>`;
    offset += count;
    return rect;
  }).join('');
  const legend = segments.map(([plural, singular, className, count]) =>
    `<li><span class="${className}" aria-hidden="true"></span>${h(formatNumber(count, locale))} ${h(count === 1 ? text(singular) : text(plural).toLocaleLowerCase(locale))}</li>`).join('');
  return `<div class="result-breakdown"><strong>${h(text('gamesSample')(played, locale))}</strong>
    <svg class="players-results-bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">${bar}</svg>
    <ul class="players-results-key">${legend}</ul></div>`;
}
