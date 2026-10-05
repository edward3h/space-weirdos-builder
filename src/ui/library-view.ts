import { newWarband } from '../model/factory';
import { warbandCost } from '../rules/engine';
import type { Library } from '../storage/library';
import { h } from './dom';

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderLibrary(root: HTMLElement, lib: Library): void {
  const draw = () => {
    root.replaceChildren();
    const { warbands, errors } = lib.list();

    const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const result = lib.importText(await file.text());
      const lines = [`Imported ${result.imported} warband(s).`, ...result.errors];
      alert(lines.join('\n'));
      draw();
    });

    root.append(
      h('h1', {}, 'Space Weirdos warbands'),
      h(
        'div',
        { class: 'toolbar' },
        h(
          'button',
          {
            class: 'primary',
            onClick: () => {
              const wb = newWarband();
              lib.save(wb);
              location.hash = `#/wb/${wb.id}`;
            },
          },
          'New warband',
        ),
        h('button', { onClick: () => fileInput.click() }, 'Import JSON'),
        h(
          'button',
          {
            disabled: warbands.length === 0,
            onClick: () => download('space-weirdos-warbands.json', lib.exportAll()),
          },
          'Export all',
        ),
        fileInput,
      ),
    );

    if (errors.length > 0) {
      root.append(
        h(
          'div',
          { class: 'panel' },
          h('strong', {}, 'Some saved warbands could not be read:'),
          h('ul', { class: 'warnings' }, ...errors.map((e) => h('li', { class: 'warning' }, e))),
        ),
      );
    }

    if (warbands.length === 0) {
      root.append(h('p', { class: 'muted' }, 'No warbands yet. Create one to get started.'));
      return;
    }

    const table = h('table', { class: 'list' });
    table.append(
      h('thead', {}, h('tr', {}, ...['Name', 'Points', 'Models', ''].map((t) => h('th', {}, t)))),
    );
    const body = h('tbody');
    for (const wb of warbands) {
      const total = warbandCost(wb);
      body.append(
        h(
          'tr',
          {},
          h('td', {}, h('a', { href: `#/wb/${wb.id}` }, wb.name || '(unnamed)')),
          h('td', { class: total > wb.target ? 'total over' : '' }, `${total} / ${wb.target}`),
          h('td', {}, String(wb.models.length)),
          h(
            'td',
            { class: 'actions' },
            h(
              'button',
              {
                'aria-label': `Print “${wb.name}”`,
                onClick: () => (location.hash = `#/wb/${wb.id}/print`),
              },
              'Print',
            ),
            h(
              'button',
              {
                'aria-label': `Duplicate “${wb.name}”`,
                onClick: () => {
                  lib.duplicate(wb.id);
                  draw();
                },
              },
              'Duplicate',
            ),
            h(
              'button',
              {
                'aria-label': `Rename “${wb.name}”`,
                onClick: () => {
                  const name = prompt('Rename warband', wb.name);
                  if (name === null) return;
                  wb.name = name;
                  lib.save(wb);
                  draw();
                },
              },
              'Rename',
            ),
            h(
              'button',
              {
                'aria-label': `Export “${wb.name}”`,
                onClick: () => download(`${wb.name || 'warband'}.json`, lib.exportOne(wb.id)!),
              },
              'Export',
            ),
            h(
              'button',
              {
                'aria-label': `Delete “${wb.name}”`,
                onClick: () => {
                  if (confirm(`Delete “${wb.name}”? This cannot be undone.`)) {
                    lib.remove(wb.id);
                    draw();
                  }
                },
              },
              'Delete',
            ),
          ),
        ),
      );
    }
    table.append(body);
    root.append(table);
  };
  draw();
}
