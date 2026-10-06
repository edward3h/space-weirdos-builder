import type { ModelSpec, Warband } from '../model/types';
import { lookup } from '../rules/catalog';
import { contextOf, displayCost, displayStats, warbandCost } from '../rules/engine';
import type { Library } from '../storage/library';
import { h } from './dom';
import { itemTables } from './item-tables';

const MIN_FONT_PX = 8;

const nameOf = (kind: Parameters<typeof lookup>[0], id: string) =>
  lookup(kind, id)?.name ?? `Unknown (${id})`;

function line(label: string, text: string) {
  return h('div', { class: 'line' }, h('b', {}, `${label}: `), text);
}

function unitCard(m: ModelSpec, wb: Warband) {
  const ctx = contextOf(wb);
  const s = displayStats(m);
  const trait = m.leaderTrait ? nameOf('leaderTraits', m.leaderTrait) : '';

  return h(
    'div',
    { class: 'card' },
    h(
      'div',
      { class: 'card-body' },
      h(
        'div',
        { class: 'card-head' },
        h('b', {}, m.name || 'Unnamed'),
        m.isLeader && h('span', { class: 'tag' }, trait ? `Leader · ${trait}` : 'Leader'),
        m.powerful && h('span', { class: 'tag' }, 'Powerful'),
        h('span', { class: 'pts' }, `${displayCost(m, ctx)} pts`),
      ),
      h(
        'div',
        { class: 'stats' },
        ...(
          [
            ['Spd', s.spd],
            ['Def', s.def],
            ['FP', s.fp],
            ['Prw', s.prw],
            ['Will', s.will],
          ] as const
        ).map(([k, v]) => h('div', {}, h('small', {}, k), h('b', {}, v))),
      ),
      ...itemTables(m),
    ),
  );
}

function summaryCard(wb: Warband) {
  const trait = wb.warbandTrait ? lookup('warbandTraits', wb.warbandTrait) : undefined;
  const leader = wb.models.find((m) => m.isLeader);
  const leaderTrait = leader?.leaderTrait ? lookup('leaderTraits', leader.leaderTrait) : undefined;
  return h(
    'div',
    { class: 'card summary' },
    h(
      'div',
      { class: 'card-body' },
      h(
        'div',
        { class: 'card-head' },
        h('b', {}, wb.name || 'Unnamed warband'),
        h('span', { class: 'pts' }, `${warbandCost(wb)} / ${wb.target} pts`),
      ),
      trait ? line(`Warband trait: ${trait.name}`, trait.effect) : line('Warband trait', 'none'),
      leaderTrait && line(`Leader trait: ${leaderTrait.name}`, leaderTrait.effect),
      line('Models', String(wb.models.length)),
    ),
  );
}

/** Shrink text in any card whose content overflows, down to a floor; flag it if still too big. */
export function fitCards(root: HTMLElement) {
  for (const card of root.querySelectorAll<HTMLElement>('.card')) {
    const body = card.querySelector<HTMLElement>('.card-body')!;
    body.style.fontSize = '';
    let size = parseFloat(getComputedStyle(body).fontSize);
    while (body.scrollHeight > card.clientHeight && size > MIN_FONT_PX) {
      size -= 0.5;
      body.style.fontSize = `${size}px`;
    }
    card.classList.toggle('overflow', body.scrollHeight > card.clientHeight);
  }
}

let detachCurrent: (() => void) | undefined;

export function renderPrint(root: HTMLElement, lib: Library, id: string): void {
  detachCurrent?.(); // drop the previous print view's beforeprint listener
  const wb = lib.get(id);
  if (!wb) {
    root.append(h('p', {}, 'Warband not found. '), h('a', { href: '#/' }, 'Back to the library'));
    return;
  }
  // The leader's card comes first, as in the editor
  const ordered = [...wb.models].sort((a, b) => Number(b.isLeader) - Number(a.isLeader));
  const cards = [summaryCard(wb), ...ordered.map((m) => unitCard(m, wb))];
  const pages: HTMLElement[] = [];
  for (let i = 0; i < cards.length; i += 8) {
    pages.push(h('div', { class: 'sheet' }, ...cards.slice(i, i + 8)));
  }

  const status = h('span', { class: 'status-warning', 'data-overflow': true });
  root.append(
    h(
      'div',
      { class: 'toolbar no-print' },
      h('a', { href: `#/wb/${wb.id}` }, '← Back to editor'),
      h('span', { class: 'spacer' }),
      status,
      h('button', { class: 'primary', onClick: () => window.print() }, 'Print'),
    ),
    h(
      'p',
      { class: 'muted no-print' },
      'Cards print 8 to a page (2 × 4) in portrait, 3.5 × 2.5 in each. Set scale to 100% in the print dialogue.',
    ),
    h('div', { class: 'sheets' }, ...pages),
  );

  const refit = () => {
    fitCards(root);
    const n = root.querySelectorAll('.card.overflow').length;
    status.textContent = n > 0 ? `${n} card(s) have more text than fits.` : '';
  };
  refit();
  window.addEventListener('beforeprint', refit);
  detachCurrent = () => window.removeEventListener('beforeprint', refit);
}
