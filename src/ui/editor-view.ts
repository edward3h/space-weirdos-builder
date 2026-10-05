import type { Library } from '../storage/library';
export function renderEditor(root: HTMLElement, _lib: Library, _id: string): void {
  root.textContent = 'Editor';
}
