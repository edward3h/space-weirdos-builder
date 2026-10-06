type Child = Node | string | null | false | undefined;

const APP_TITLE = 'Space Weirdos Builder';

/** Name the current view in the browser tab and the screen reader's page announcement. */
export function setTitle(view: string): void {
  document.title = `${view} – ${APP_TITLE}`;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== false && c !== undefined) el.append(c);
  return el;
}

export function select<T extends string>(
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
): HTMLSelectElement {
  const el = h('select', { onChange: () => onChange(el.value as T) });
  for (const o of options) el.append(h('option', { value: o.value }, o.label));
  el.value = value;
  return el;
}
