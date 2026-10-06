import { isPristine, newModel } from '../model/factory';
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
import { itemFacts } from './item-info';
import { modelSummary } from './model-summary';

const DICE = ['2d6', '2d8', '2d10'] as const;
const TARGET_PRESETS = [75, 125];

let flushCurrent: (() => void) | undefined;
let detachCurrent: (() => void) | undefined;

/** Write any pending debounced edit now and drop the editor's listeners. main.ts calls this before it changes view. */
export function flushEditor(): void {
  flushCurrent?.();
  detachCurrent?.();
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
  // Mobile browsers may not fire pagehide when the page is backgrounded, so also use visibilitychange
  const flushIfHidden = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', flushIfHidden);
  detachCurrent = () => {
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', flushIfHidden);
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
  const panels = new Map<
    ModelSpec,
    { el: HTMLElement; cost: HTMLElement; warnings: HTMLElement }
  >();

  /**
   * Models being edited. Everything else shows the read-only summary. Not saved: after a
   * reload only models that are still untouched (waiting to be filled in) open for editing.
   */
  const editing = new Set<ModelSpec>(state.models.filter(isPristine));

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
   * Chosen items for one category, each in its own drop-down (names only) with its details
   * underneath, plus a "+" button that reveals a drop-down for the next one. Reads and writes the selection
   * through get/set and redraws only itself, so the rest of the editor keeps its focus and
   * scroll position. Chosen items that are not in `items` (expansion switched off, unknown
   * ids) stay listed, so nothing is silently dropped.
   */
  function itemPicker(
    kind: 'ranged' | 'close' | 'equipment' | 'powers',
    noun: string,
    items: Item[],
    get: () => string[],
    set: (next: string[]) => void,
    ctx: Context,
  ) {
    const names = items.map((i) => ({ value: i.id, label: i.name }));
    const box = h('div', { class: 'picker' });
    let adding = false;

    const details = (item: Item | undefined, id: string) => {
      if (!item)
        return h('div', { class: 'details muted' }, `Unknown item “${id}” (kept as saved).`);
      return h(
        'div',
        { class: 'details muted' },
        h('div', {}, itemFacts(kind, item, ctx)),
        item.notes && h('div', {}, item.notes),
      );
    };

    const draw = () => {
      const rows = get().map((id, index) => {
        const item = lookup(kind, id) as Item | undefined;
        const inList = names.some((n) => n.value === id);
        const options = inList
          ? names
          : [...names, { value: id, label: item ? `${item.name} (expansion)` : `Unknown (${id})` }];
        const picked = select(options, id, (v) => {
          const next = [...get()];
          next[index] = v;
          set(next);
          draw();
        });
        picked.setAttribute('aria-label', `${noun[0]!.toUpperCase()}${noun.slice(1)} ${index + 1}`);
        const remove = h(
          'button',
          {
            type: 'button',
            'aria-label': `Remove ${item?.name ?? id}`,
            onClick: () => {
              set(get().filter((_, i) => i !== index));
              draw();
            },
          },
          'Remove',
        );
        return h(
          'div',
          { class: 'picked' },
          h('div', { class: 'picked-head' }, picked, remove),
          details(item, id),
        );
      });
      // A "+" button; pressing it shows a drop-down of names to choose from
      let adder: HTMLElement;
      if (adding) {
        const choose = select([{ value: '', label: `Choose ${noun}…` }, ...names], '', (v) => {
          adding = false;
          if (v !== '') set([...get(), v]);
          draw();
        });
        choose.setAttribute('aria-label', `Choose ${noun}`);
        choose.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            adding = false;
            draw();
          }
        });
        choose.addEventListener('blur', () => {
          if (!adding) return;
          adding = false;
          draw();
        });
        adder = choose;
      } else {
        adder = h(
          'button',
          {
            type: 'button',
            class: 'add',
            title: `Add ${noun}`,
            'aria-label': `Add ${noun}`,
            onClick: () => {
              adding = true;
              draw();
              box.querySelector<HTMLElement>('select[aria-label^="Choose"]')?.focus();
            },
          },
          '+',
        );
      }
      box.replaceChildren(...rows, adder);
    };
    draw();
    return box;
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

  function editPanel(m: ModelSpec, ctx: Context) {
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
    const saveLabel = () => `Save ${m.name || 'model'}`;
    const saveButton = h(
      'button',
      {
        type: 'button',
        class: 'primary save',
        'aria-label': saveLabel(),
        onClick: () => {
          editing.delete(m);
          flush(); // write a pending name edit before the card is redrawn
          swap(m, 'button.edit');
        },
      },
      'Save',
    );
    nameInput.addEventListener('input', () => saveButton.setAttribute('aria-label', saveLabel()));

    const el = h(
      'div',
      { class: 'panel model-panel editing' },
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
        (state.expansion || m.powerful) &&
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
        saveButton,
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
      h('h3', {}, 'Ranged weapons'),
      itemPicker(
        'ranged',
        'ranged weapon',
        available(catalog.ranged, state.expansion),
        () => m.rangedWeapons,
        (n) => {
          m.rangedWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Close combat weapons'),
      itemPicker(
        'close',
        'close combat weapon',
        available(catalog.close, state.expansion),
        () => m.closeWeapons,
        (n) => {
          m.closeWeapons = n;
          touched();
        },
        ctx,
      ),
      h('h3', {}, 'Equipment'),
      itemPicker(
        'equipment',
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
      itemPicker(
        'powers',
        'psychic power',
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
    panels.set(m, { el, cost: costEl, warnings: warningsEl });
    return el;
  }

  /** The read-only card: name, cost, stats, weapons, equipment and powers, with an Edit button. */
  function viewPanel(m: ModelSpec, ctx: Context) {
    const costEl = h('span', { class: 'total' }, '');
    const warningsEl = h('ul', { class: 'warnings' });
    const trait = m.leaderTrait ? lookup('leaderTraits', m.leaderTrait) : undefined;
    const el = h(
      'div',
      { class: 'panel model-panel' },
      h(
        'div',
        { class: 'row' },
        h('b', { class: 'model-name' }, m.name || 'Unnamed'),
        m.isLeader && h('span', { class: 'tag' }, trait ? `Leader · ${trait.name}` : 'Leader'),
        m.powerful && h('span', { class: 'tag' }, 'Powerful'),
        costEl,
        h(
          'button',
          {
            type: 'button',
            class: 'edit',
            'aria-label': `Edit ${m.name || 'model'}`,
            onClick: () => {
              editing.add(m);
              swap(m, 'input[aria-label="Model name"]');
            },
          },
          'Edit',
        ),
      ),
      modelSummary(m),
      warningsEl,
    );
    panels.set(m, { el, cost: costEl, warnings: warningsEl });
    return el;
  }

  const modelPanel = (m: ModelSpec, ctx: Context) =>
    editing.has(m) ? editPanel(m, ctx) : viewPanel(m, ctx);

  /** Redraw one card in place (so the rest of the page keeps its scroll position and focus). */
  function swap(m: ModelSpec, focus: string) {
    const old = panels.get(m);
    if (!old) return;
    const next = modelPanel(m, contextOf(state));
    old.el.replaceWith(next);
    refreshStatus();
    next.querySelector<HTMLElement>(focus)?.focus();
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
      // Keep the previous target while the field is empty or not a positive whole number
      const text = targetInput.value.trim();
      if (!/^\d+$/.test(text) || Number(text) <= 0) return;
      state.target = Number(text);
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
        h('span', { class: 'status-warning', 'data-save-status': true }),
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              flush();
              if (saveFailed) doSave(); // try again before deciding
              if (
                saveFailed &&
                !confirm(
                  'Your changes could not be saved, so the print view would show the last saved version. Print anyway?',
                )
              )
                return;
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
              const added = newModel(false);
              state.models.push(added);
              editing.add(added); // a new model is waiting to be filled in
              changed();
              panels
                .get(added)
                ?.el.querySelector<HTMLElement>('input[aria-label="Model name"]')
                ?.focus();
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
