import './style.css';
import { MemoryKV, browserKV } from './storage/kv';
import { Library } from './storage/library';
import { flushEditor, renderEditor } from './ui/editor-view';
import { renderLibrary } from './ui/library-view';
import { renderPrint } from './ui/print-view';
import { h } from './ui/dom';

const kv = browserKV();
const lib = new Library(kv ?? new MemoryKV());

const banner = document.querySelector<HTMLElement>('#banner')!;
if (!kv) {
  banner.append(
    h(
      'div',
      { class: 'banner-warning' },
      'Browser storage is unavailable, so changes will not be kept after you close or reload this page. Use Export to keep a copy.',
    ),
  );
}

const app = document.querySelector<HTMLElement>('#app')!;

function route() {
  flushEditor(); // write any debounced edit before the next view reads storage
  app.replaceChildren();
  window.scrollTo(0, 0);
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'wb' && parts[1]) {
    if (parts[2] === 'print') renderPrint(app, lib, parts[1]);
    else renderEditor(app, lib, parts[1]);
  } else {
    renderLibrary(app, lib);
  }
}

window.addEventListener('hashchange', route);
route();
