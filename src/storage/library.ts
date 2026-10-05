import { newId } from '../model/factory';
import type { Warband } from '../model/types';
import type { KV } from './kv';
import { parseWarband } from './validate';

const PREFIX = 'weirdos:wb:';
const FORMAT = 'space-weirdos-warbands';

export interface ImportResult {
  imported: number;
  errors: string[];
}

export class Library {
  constructor(private kv: KV) {}

  list(): { warbands: Warband[]; errors: string[] } {
    const warbands: Warband[] = [];
    const errors: string[] = [];
    for (const key of this.kv.keys().filter((k) => k.startsWith(PREFIX))) {
      try {
        warbands.push(parseWarband(JSON.parse(this.kv.getItem(key) ?? '')));
      } catch (e) {
        errors.push(`${key.slice(PREFIX.length)}: ${(e as Error).message}`);
      }
    }
    warbands.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { warbands, errors };
  }

  get(id: string): Warband | null {
    const text = this.kv.getItem(PREFIX + id);
    if (text === null) return null;
    try {
      return parseWarband(JSON.parse(text));
    } catch {
      return null;
    }
  }

  /** Throws if the browser refuses the write (quota). Callers show a warning. */
  save(wb: Warband): void {
    wb.updatedAt = new Date().toISOString();
    this.kv.setItem(PREFIX + wb.id, JSON.stringify(wb));
  }

  remove(id: string): void {
    this.kv.removeItem(PREFIX + id);
  }

  duplicate(id: string): Warband | null {
    const wb = this.get(id);
    if (!wb) return null;
    const copy: Warband = {
      ...structuredClone(wb),
      id: newId(),
      name: `${wb.name} (copy)`,
    };
    copy.models = copy.models.map((m) => ({ ...m, id: newId() }));
    this.save(copy);
    return copy;
  }

  exportOne(id: string): string | null {
    const wb = this.get(id);
    return wb ? wrap([wb]) : null;
  }

  exportAll(): string {
    return wrap(this.list().warbands);
  }

  importText(text: string): ImportResult {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { imported: 0, errors: ['The file is not valid JSON.'] };
    }
    const items: unknown[] =
      typeof data === 'object' &&
      data !== null &&
      Array.isArray((data as { warbands?: unknown }).warbands)
        ? (data as { warbands: unknown[] }).warbands
        : [data];
    const result: ImportResult = { imported: 0, errors: [] };
    items.forEach((raw, i) => {
      try {
        const wb = parseWarband(raw);
        const idClash = this.get(wb.id) !== null;
        const nameClash = this.list().warbands.some((w) => w.name === wb.name);
        if (idClash) wb.id = newId();
        if (idClash || nameClash) wb.name = `${wb.name} (copy)`;
        this.save(wb);
        result.imported++;
      } catch (e) {
        result.errors.push(`Warband ${i + 1}: ${(e as Error).message}`);
      }
    });
    return result;
  }
}

function wrap(warbands: Warband[]): string {
  return JSON.stringify({ format: FORMAT, version: 1, warbands }, null, 2);
}
