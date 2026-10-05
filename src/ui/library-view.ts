import type { Library } from '../storage/library';
export function renderLibrary(root: HTMLElement, _lib: Library): void {
  root.textContent = 'Library';
}
