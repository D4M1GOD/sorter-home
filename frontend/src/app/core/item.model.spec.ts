import {
  createItem,
  isValidItemCategory,
  isValidItemDescription,
  isValidItemDraft,
  isValidItemName,
  isValidItemQuantity,
  Item,
  ItemDraft,
  parseItemQuantity,
  sortItemsByName,
} from './item.model';

describe('item model', () => {
  const draft: ItemDraft = { name: 'Nails', quantity: 100, description: '', category: '' };

  describe('name', () => {
    it('is required', () => {
      expect(isValidItemName('')).toBe(false);
      expect(isValidItemName('   ')).toBe(false);
      expect(isValidItemName('Nails')).toBe(true);
    });

    it('has at most 60 characters after trimming', () => {
      expect(isValidItemName('a'.repeat(60))).toBe(true);
      expect(isValidItemName('a'.repeat(61))).toBe(false);
      expect(isValidItemName(`  ${'a'.repeat(60)}  `)).toBe(true);
    });
  });

  describe('quantity', () => {
    it('is a whole number from 0 to 9999', () => {
      expect(isValidItemQuantity(0)).toBe(true);
      expect(isValidItemQuantity(1)).toBe(true);
      expect(isValidItemQuantity(9999)).toBe(true);
      expect(isValidItemQuantity(-1)).toBe(false);
      expect(isValidItemQuantity(10000)).toBe(false);
      expect(isValidItemQuantity(1.5)).toBe(false);
      expect(isValidItemQuantity(Number.NaN)).toBe(false);
      expect(isValidItemQuantity('3')).toBe(false);
      expect(isValidItemQuantity(undefined)).toBe(false);
    });

    it('is read from text made only of digits, ignoring surrounding spaces', () => {
      expect(parseItemQuantity('0')).toBe(0);
      expect(parseItemQuantity('1')).toBe(1);
      expect(parseItemQuantity(' 9999 ')).toBe(9999);
      expect(parseItemQuantity('007')).toBe(7);
    });

    it('is not read from anything else, and nothing is rounded', () => {
      for (const text of [
        '',
        '   ',
        '1.5',
        '1,5',
        '-1',
        '+1',
        '1e2',
        'abc',
        '12a',
        '1 2',
        '10000',
      ]) {
        expect(parseItemQuantity(text)).toBeNull();
      }
    });
  });

  describe('description and category', () => {
    it('allows an empty description and at most 500 characters after trimming', () => {
      expect(isValidItemDescription('')).toBe(true);
      expect(isValidItemDescription('a'.repeat(500))).toBe(true);
      expect(isValidItemDescription(` ${'a'.repeat(500)} `)).toBe(true);
      expect(isValidItemDescription('a'.repeat(501))).toBe(false);
    });

    it('allows an empty category and at most 40 characters once cleaned', () => {
      expect(isValidItemCategory('')).toBe(true);
      expect(isValidItemCategory('a'.repeat(40))).toBe(true);
      expect(isValidItemCategory('a'.repeat(41))).toBe(false);
      // 41 characters as typed, 40 once the two spaces become one.
      expect(isValidItemCategory(`${'a'.repeat(20)}  ${'b'.repeat(19)}`)).toBe(true);
    });
  });

  describe('createItem', () => {
    it('creates an item with an id and the values of the draft', () => {
      const item = createItem({
        name: 'Nails',
        quantity: 100,
        description: 'Box of 100',
        category: 'Hardware',
      });
      expect(item).toEqual({
        id: item.id,
        name: 'Nails',
        quantity: 100,
        description: 'Box of 100',
        category: 'Hardware',
      });
      expect(item.id).toBeTruthy();
    });

    it('gives each item its own id', () => {
      expect(createItem(draft).id).not.toBe(createItem(draft).id);
    });

    it('trims the name and the description, and keeps the line breaks inside the description', () => {
      const item = createItem({ ...draft, name: '  Nails  ', description: '\n Line 1\nLine 2 \n' });
      expect(item.name).toBe('Nails');
      expect(item.description).toBe('Line 1\nLine 2');
    });

    it('cleans the category: trimmed, and runs of spaces become one space', () => {
      expect(createItem({ ...draft, category: '  Power   tools ' }).category).toBe('Power tools');
    });

    it('accepts the quantity 0 and an item without description or category', () => {
      const item = createItem({ ...draft, quantity: 0 });
      expect(item.quantity).toBe(0);
      expect(item.description).toBe('');
      expect(item.category).toBe('');
    });

    it('throws when a field is not valid', () => {
      expect(() => createItem({ ...draft, name: '   ' })).toThrow();
      expect(() => createItem({ ...draft, name: 'a'.repeat(61) })).toThrow();
      expect(() => createItem({ ...draft, quantity: 1.5 })).toThrow();
      expect(() => createItem({ ...draft, quantity: 10000 })).toThrow();
      expect(() => createItem({ ...draft, description: 'a'.repeat(501) })).toThrow();
      expect(() => createItem({ ...draft, category: 'a'.repeat(41) })).toThrow();
    });

    it('agrees with isValidItemDraft', () => {
      expect(isValidItemDraft(draft)).toBe(true);
      expect(isValidItemDraft({ ...draft, quantity: -1 })).toBe(false);
    });
  });

  describe('sortItemsByName', () => {
    const named = (...names: string[]): Item[] =>
      names.map((name, index) => ({ ...draft, id: `id-${index}`, name }));

    it('orders by name, ignoring upper/lower case', () => {
      const sorted = sortItemsByName(named('nails', 'Batteries', 'cables', 'Zip ties'));
      expect(sorted.map((item) => item.name)).toEqual(['Batteries', 'cables', 'nails', 'Zip ties']);
    });

    it('keeps the order of items with the same name', () => {
      const sorted = sortItemsByName(named('Cable', 'Nails', 'cable'));
      expect(sorted.map((item) => item.id)).toEqual(['id-0', 'id-2', 'id-1']);
    });

    it('does not change the list it receives', () => {
      const items = named('B', 'A');
      sortItemsByName(items);
      expect(items.map((item) => item.name)).toEqual(['B', 'A']);
    });
  });
});
