import type { Library } from '../storage/library';
export function renderPrint(root: HTMLElement, _lib: Library, _id: string): void {
  root.textContent = 'Print';
}
