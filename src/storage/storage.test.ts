import { describe, expect, it } from 'vitest';
import { newModel, newWarband } from '../model/factory';
import { Library } from './library';
import { MemoryKV } from './kv';
import { parseWarband } from './validate';

const make = () => new Library(new MemoryKV());

describe('parseWarband', () => {
  it('accepts a valid warband and round-trips it', () => {
    const wb = newWarband('Test');
    wb.models.push({ ...newModel(), powers: ['unknown-future-power'] });
    expect(parseWarband(JSON.parse(JSON.stringify(wb)))).toEqual(wb);
  });

  it('rejects bad data with a helpful path', () => {
    const wb: any = newWarband();
    wb.models[0].speed = 7;
    expect(() => parseWarband(wb)).toThrow(/models\[0\]\.speed/);
    expect(() => parseWarband({})).toThrow(/id/);
    expect(() => parseWarband(null)).toThrow(/object/);
  });

  it('makes model ids unique, regenerating empty and duplicate ids', () => {
    const wb: any = newWarband('Dupes');
    wb.models = [newModel(), newModel(), newModel()];
    wb.models[0].id = 'same';
    wb.models[1].id = 'same';
    wb.models[2].id = '';
    const ids = parseWarband(JSON.parse(JSON.stringify(wb))).models.map((m) => m.id);
    expect(ids[0]).toBe('same');
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id !== '')).toBe(true);
  });

  it('rejects an unsupported future schema version', () => {
    const wb: any = { ...newWarband(), schemaVersion: 99 };
    expect(() => parseWarband(wb)).toThrow(/version/i);
  });
});

describe('Library', () => {
  it('saves, lists, gets and removes warbands', () => {
    const lib = make();
    const a = newWarband('A');
    const b = newWarband('B');
    lib.save(a);
    lib.save(b);
    expect(
      lib
        .list()
        .warbands.map((w) => w.name)
        .sort(),
    ).toEqual(['A', 'B']);
    expect(lib.get(a.id)?.name).toBe('A');
    lib.remove(a.id);
    expect(lib.get(a.id)).toBeNull();
    expect(lib.list().warbands).toHaveLength(1);
  });

  it('survives a reload (a new Library over the same store)', () => {
    const kv = new MemoryKV();
    new Library(kv).save(newWarband('Persisted'));
    expect(new Library(kv).list().warbands[0]?.name).toBe('Persisted');
  });

  it('skips a corrupt entry and reports it, without losing the others', () => {
    const kv = new MemoryKV();
    const lib = new Library(kv);
    lib.save(newWarband('Good'));
    kv.setItem('weirdos:wb:broken', '{not json');
    const { warbands, errors } = lib.list();
    expect(warbands.map((w) => w.name)).toEqual(['Good']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/broken/);
  });

  it('updates updatedAt on save', () => {
    const lib = make();
    const wb = newWarband();
    wb.updatedAt = '2000-01-01T00:00:00.000Z';
    lib.save(wb);
    expect(lib.get(wb.id)!.updatedAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('duplicates with a new id and a (copy) suffix', () => {
    const lib = make();
    const wb = newWarband('Orig');
    lib.save(wb);
    const copy = lib.duplicate(wb.id)!;
    expect(copy.id).not.toBe(wb.id);
    expect(copy.name).toBe('Orig (copy)');
    expect(lib.list().warbands).toHaveLength(2);
  });
});

describe('export and import', () => {
  it('round-trips one warband and a whole library', () => {
    const lib = make();
    const a = newWarband('A');
    const b = newWarband('B');
    lib.save(a);
    lib.save(b);
    const text = lib.exportAll();
    const other = make();
    const result = other.importText(text);
    expect(result.errors).toEqual([]);
    expect(
      other
        .list()
        .warbands.map((w) => w.name)
        .sort(),
    ).toEqual(['A', 'B']);
    expect(JSON.parse(lib.exportOne(a.id)!).warbands).toHaveLength(1);
  });

  it('gives imported warbands with clashing ids a new id and a (copy) suffix', () => {
    const lib = make();
    const a = newWarband('A');
    lib.save(a);
    const result = lib.importText(lib.exportAll());
    expect(result.imported).toBe(1);
    const names = lib
      .list()
      .warbands.map((w) => w.name)
      .sort();
    expect(names).toEqual(['A', 'A (copy)']);
  });

  it('also adds (copy) when a different warband has the same name', () => {
    const lib = make();
    lib.save(newWarband('Same name'));
    const other = newWarband('Same name'); // different id, same name
    const result = lib.importText(JSON.stringify(other));
    expect(result.imported).toBe(1);
    expect(lib.get(other.id)?.name).toBe('Same name (copy)');
  });

  it('accepts a bare warband object as well as the wrapper format', () => {
    const lib = make();
    const result = lib.importText(JSON.stringify(newWarband('Bare')));
    expect(result.imported).toBe(1);
  });

  it('reports invalid JSON and invalid warbands without throwing', () => {
    const lib = make();
    expect(lib.importText('nope').errors[0]).toMatch(/not valid JSON/i);
    const bad = JSON.stringify({
      format: 'space-weirdos-warbands',
      version: 1,
      warbands: [{ id: 'x' }],
    });
    const r = lib.importText(bad);
    expect(r.imported).toBe(0);
    expect(r.errors).toHaveLength(1);
  });
});
