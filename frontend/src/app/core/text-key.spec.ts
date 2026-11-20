import { categoryKey } from './item-category';
import { textKey } from './text-key';

describe('textKey', () => {
  it('ignores upper/lower case', () => {
    expect(textKey('CABLE')).toBe('cable');
    expect(textKey('Cable')).toBe(textKey('cAbLe'));
  });

  it('ignores accents', () => {
    expect(textKey('Jardín')).toBe('jardin');
    expect(textKey('Décor Ñandú')).toBe('decor nandu');
  });

  it('ignores surrounding and repeated spaces, and treats line breaks and tabs as spaces', () => {
    expect(textKey('  Power   tools ')).toBe('power tools');
    expect(textKey('USB-C cable\n2 m,\twhite')).toBe('usb-c cable 2 m, white');
  });

  it('gives an empty key for a text without letters', () => {
    expect(textKey('')).toBe('');
    expect(textKey(' \n ')).toBe('');
  });

  it('keeps digits and punctuation', () => {
    expect(textKey('Item 10 (USB-C)')).toBe('item 10 (usb-c)');
  });

  it('is the normalization of the categories: both give the same key', () => {
    for (const text of ['Jardín', ' JARDIN ', 'Power   tools', '', 'Navidad\n2026']) {
      expect(categoryKey(text)).toBe(textKey(text));
    }
  });
});
