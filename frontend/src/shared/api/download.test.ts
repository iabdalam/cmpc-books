import { describe, expect, it, vi } from 'vitest';
import { downloadFile, downloadName } from './download';

describe('CSV download', () => {
  it.each([
    [null, 'books.csv'], ['attachment; filename="inventario.csv"', 'inventario.csv'],
    ["attachment; filename*=UTF-8''libros%20actuales.csv", 'libros actuales.csv'],
    ['attachment; filename=plain.csv', 'plain.csv'], ['attachment; filename="../../safe.csv"', 'safe.csv'],
    ["attachment; filename*=UTF-8''%XX; filename=fallback.csv", 'fallback.csv'],
    ['attachment; filename="unsafe.html"', 'books.csv'], ['attachment; filename="/"', 'books.csv'],
  ])('uses a safe server filename for %s', (header, expected) => { expect(downloadName(header)).toBe(expected); });
  it('starts a download and revokes its object URL', () => {
    vi.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    let name = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { name = this.download; expect(this.href).toBe('blob:test'); });
    downloadFile(new Blob(['csv']), 'attachment; filename="data.csv"');
    expect(name).toBe('data.csv'); expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
