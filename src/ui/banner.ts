import { h } from './dom';

/** Show a warning at the top of the page. The same text is not shown twice. */
export function showBanner(text: string): void {
  const banner = document.querySelector<HTMLElement>('#banner');
  if (!banner) return;
  if ([...banner.children].some((c) => c.textContent === text)) return;
  banner.append(h('div', { class: 'banner-warning', role: 'alert' }, text));
}
