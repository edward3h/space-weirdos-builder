import { newModel } from '../model/factory';
import type { ModelSpec, Warband } from '../model/types';
import { available, catalog, lookup } from '../rules/catalog';
import {
  adjustedCost,
  contextOf,
  displayCost,
  validateWarband,
  warbandCost,
  type Context,
  type Warning,
} from '../rules/engine';
import type { Item } from '../rules/types';
import type { Library } from '../storage/library';
import { h, select } from './dom';

const DICE = ['2d6', '2d8', '2d10'] as const;
const TARGET_PRESETS = [75, 125];

let flushCurrent: (() => void) | undefined;
let detachCurrent: (() => void) | undefined;

/** Write any pending debounced edit now. main.ts calls this before it changes view. */
export function flushEditor(): void {
  flushCurrent?.();
}

export function renderEditor(root: HTMLElement, lib: Library, id: string): void {
  detachCurrent?.();
  const wb = lib.get(id);
  if (!wb) {
    root.append(h('p', {}, 'Warband not found. '), h('a', { href: '#/' }, 'Back to the library'));
    return;
  }
  const state: Warband = wb;
  let saveTimer: number | undefined;
  let saveFailed = false;

  const doSave = () => {
    try {
      lib.save(state);
      saveFailed = false;
    } catch {
      saveFailed = true;
    }
    refreshStatus();
  };
  /** Debounced save, for text inputs. */
  const save = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = undefined;
      doSave();
    }, 250);
  };
  const flush = () => {
    if (saveTimer === undefined) return;
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
    doSave();
  };
  flushCurrent = flush;
  window.addEventListener('pagehide', flush);
  detachCurrent = () => {
    window.removeEventListener('pagehide', flush);
    flushCurrent = undefined;
  };

  /** A change that keeps the editor's structure: save now and refresh totals and warnings. */
  const touched = () => doSave();
  /** A structural change: save now and redraw everything. */
  const changed = () => {
    doSave();
    draw();
  };

  /** Per-model elements from the latest draw, keyed by the model object (ids are not selector-safe). */
  const panels = new Map<ModelSpec, { cost: HTMLElement; warnings: HTMLElement }>();

  const warningsList = (ws: Warning[]) => ws.map((w) => h('li', { class: w.level }, w.message));

  function refreshStatus() {
    const ctx = contextOf(state);
    const total = warbandCost(state);
    const all = validateWarband(state);
    const totalEl = root.querySelector<HTMLElement>('[data-total]');
    if (totalEl) {
      totalEl.textContent = `${total} / ${state.target} points`;
      totalEl.classList.toggle('over', total > state.target);
    }
    root
      .querySelector<HTMLElement>('[data-warband-warnings]')
      ?.replaceChildren(...warningsList(all.filter((w) => w.scope === 'warband')));
    for (const m of state.models) {
      const els = panels.get(m);
      if (!els) continue;
      els.cost.textContent = `${displayCost(m, ctx)} pts`;
      els.warnings.replaceChildren(...warningsList(all.filter((w) => w.scope === m.id)));
    }
    const saveEl = root.querySelector<HTMLElement>('[data-save-status]');
    if (saveEl) saveEl.textContent = saveFailed ? 'Could not save! Use Export to keep a copy.' : '';
  }

  /**
   * A list of tick boxes. Reads and writes the selection through get/set so that ticking
   * does not need a redraw. Selected items that are not in `items` (expansion switched off,
   * unknown ids) are still listed, so nothing is silently dropped.
   */
  function checklist(
    kind: 'ranged' | 'close' | 'equipment' | 'powers',
    items: Item[],
    get: () => string[],
    set: (next: string[]) => void,
    ctx: Context,
  ) {
    const costKind = (
      { ranged: 'ranged', close: 'close', equipment: 'equipment', powers: 'power' } as const
    )[kind];
    const known = new Set(items.map((i) => i.id));
    const extra = get().filter((s) => !known.has(s));
    const rows = [
      ...items.map((i) => ({ item: i as Item | undefined, id: i.id })),
      ...extra.map((e) => ({ item: lookup(kind, e) as Item | undefined, id: e })),
    ];
    return h(
      'div',
      { class: 'checklist' },
      ...rows.map(({ item, id: itemId }) => {
        const box = h('input', { type: 'checkbox' });
        box.checked = get().includes(itemId);
        box.addEventListener('change', () => {
          const current = get();
          set(box.checked ? [...current, itemId] : current.filter((s) => s !== itemId));
        });
        const cost = item ? adjustedCost(item, costKind, ctx) : 0;
        return h(
          'label',
          { title: item?.notes ?? '' },
          box,
          h(
            'span',
            { class: 'item' },
            h('span', {}, item ? item.name : `Unknown (${itemId})`),
            item?.notes && h('small', { class: 'muted' }, item.notes),
          ),
          h('span', { class: 'cost' }, String(cost)),
        );
      }),
    );
  }

  /** Trait picker with the chosen trait's rules text shown underneath. */
  const traitPicker = (
    kind: 'leaderTraits' | 'warbandTraits',
    value: string | null,
    onChange: (v: string | null) => void,
  ) => {
    const shown = available(catalog[kind], state.expansion);
    const hiddenSelected = value !== null && !shown.some((t) => t.id === value);
    const known = value ? lookup(kind, value) : undefined;
    const options = [
      { value: '', label: '(none)' },
      ...shown.map((t) => ({ value: t.id, label: t.name })),
      ...(hiddenSelected
        ? [{ value: value!, label: known ? `${known.name} (expansion)` : `Unknown (${value})` }]
        : []),
    ];
    return h(
      'div',
      { class: 'trait' },
      select(options, value ?? '', (v) => onChange(v === '' ? null : v)),
      h('small', { class: 'muted' }, known?.effect ?? ''),
    );
  };

  const toggle = (label: string, checked: boolean, onToggle: (v: boolean) => void) => {
    const box = h('input', { type: 'checkbox' });
    box.checked = checked;
    box.addEventListener('change', () => onToggle(box.checked));
    return h('label', { class: 'inline' }, box, label);
  };

  function modelPanel(m: ModelSpec, ctx: Context) {
    const dieSelect = <T extends string>(opts: readonly T[], value: T, set: (v: T) => void) =>
      select(
        opts.map((o) => ({ value: o, label: o })),
        value,
        (v) => {
          set(v);
          touched();
        },
      );
    const defOpts = (
      state.expansion || m.defense === '2d4' ? ['2d4', ...DICE] : [...DICE]
    ) as ModelSpec['defense'][];
    const fpOpts = [
      'none',
      ...(state.expansion || m.firepower === '2d6' ? ['2d6'] : []),
      '2d8',
      '2d10',
    ] as ModelSpec['firepower'][];
    const field = (label: string, el: Node) => h('label', {}, label, el);

    const nameInput = h('input', { value: m.name, 'aria-label': 'Model name' });
    nameInput.addEventListener('input', () => {
      m.name = nameInput.value;
      save();
    });

    const costEl = h('span', { class: 'total' }, '');
    const warningsEl = h('ul', { class: 'warnings' });
    panels.set(m, { cost: costEl, warnings: warningsEl });

    return h(
      'div',
      { class: 'panel' },
      h(
        'div',
        { class: 'row' },
        field('Name', nameInput),
        costEl,
        toggle('Leader', m.isLeader, (v) => {
          m.isLeader = v;
          if (!v) m.leaderTrait = null;
          changed();
        }),
        state.expansion &&
          toggle('Powerful', m.powerful, (v) => {
            m.powerful = v;
            changed();
          }),
        h(
          'button',
          {
            onClick: () => {
              state.models = state.models.filter((x) => x !== m);
              changed();
            },
          },
          'Remove',
        ),
      ),
      m.isLeader &&
        h(
          'div',
          { class: 'row' },
          field(
            'Leader trait',
            traitPicker('leaderTraits', m.leaderTrait, (v) => {
              m.leaderTrait = v;
              changed();
            }),
          ),
        ),
      h(
        'div',
        { class: 'row' },
        field(
          'Speed',
          dieSelect(
            ['1', '2', '3'] as const,
            String(m.speed) as '1',
            (v) => (m.speed = Number(v) as 1),
          ),
        ),
        field(
          'Defence',
          dieSelect(defOpts, m.defense, (v) => (m.defense = v)),
        ),
        field(
          'Firepower',
          dieSelect(fpOpts, m.firepower, (v) => (m.firepower = v)),
        ),
        field(
          'Prowess',
          dieSelect(DICE, m.prowess, (v) => (m.prowess = v)),
        ),
        field(
          'Willpower',
          dieSelect(DICE, m.willpower, (v) => (m.willpower = v)),
        ),
      ),
      h('h3', {}, 'Ranged weapon'),
      checklist(
        'ranged',
        available(catalog.ranged, state.expansion),
        () => m.rangedWeapons,
        (n) => {
          m.rangedWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Close combat weapon'),
      checklist(
        'close',
        available(catalog.close, state.expansion),
        () => m.closeWeapons,
        (n) => {
          m.closeWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Equipment'),
      checklist(
        'equipment',
        available(catalog.equipment, state.expansion),
        () => m.equipment,
        (n) => {
          m.equipment = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Psychic powers'),
      checklist(
        'powers',
        available(catalog.powers, state.expansion),
        () => m.powers,
        (n) => {
          m.powers = n;
          touched();
        },
        ctx,
      ),
      warningsEl,
    );
  }

  function draw() {
    root.replaceChildren();
    panels.clear();
    const ctx = contextOf(state);

    const nameInput = h('input', { value: state.name, 'aria-label': 'Warband name' });
    nameInput.addEventListener('input', () => {
      state.name = nameInput.value;
      save();
    });
    const targetInput = h('input', {
      type: 'text',
      inputmode: 'numeric',
      list: 'targets',
      value: String(state.target),
      style: 'width:6em',
    });
    targetInput.addEventListener('input', () => {
      state.target = Number(targetInput.value) || 0;
      save();
      refreshStatus();
    });

    // The leader is shown first
    const ordered = [...state.models].sort((a, b) => Number(b.isLeader) - Number(a.isLeader));

    root.append(
      h(
        'div',
        { class: 'toolbar' },
        h('a', { href: '#/', onClick: flush }, '← Library'),
        h('span', { class: 'spacer' }),
        h('span', { class: 'warnings warning', 'data-save-status': true }),
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              flush();
              location.hash = `#/wb/${state.id}/print`;
            },
          },
          'Print',
        ),
      ),
      h(
        'div',
        { class: 'panel' },
        h(
          'div',
          { class: 'row' },
          h('label', {}, 'Warband name', nameInput),
          h('label', {}, 'Points target', targetInput),
          h(
            'datalist',
            { id: 'targets' },
            ...TARGET_PRESETS.map((n) => h('option', { value: String(n) })),
          ),
          toggle('Include fan expansion', state.expansion, (v) => {
            state.expansion = v;
            changed();
          }),
          h(
            'label',
            {},
            'Warband trait',
            traitPicker('warbandTraits', state.warbandTrait, (v) => {
              state.warbandTrait = v;
              changed();
            }),
          ),
          h('span', { class: 'total', 'data-total': true }),
        ),
        h('ul', { class: 'warnings', 'data-warband-warnings': true }),
      ),
      h('div', { class: 'models' }, ...ordered.map((m) => modelPanel(m, ctx))),
      h(
        'div',
        { class: 'toolbar' },
        h(
          'button',
          {
            onClick: () => {
              state.models.push(newModel(false));
              changed();
            },
          },
          'Add model',
        ),
      ),
    );
    refreshStatus();
  }

  draw();
}
