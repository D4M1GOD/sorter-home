import {
  createItem,
  isValidItemCategory,
  isValidItemDescription,
  isValidItemDraft,
  isValidItemName,
  isValidItemQuantity,
  isValidQuantityOut,
  Item,
  ItemDraft,
  markUsedFromInside,
  markUsedFromOut,
  parseItemQuantity,
  parseUnits,
  putBack,
  sortItemsByName,
  takeOut,
  unitsInside,
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
        quantityOut: 0,
        description: 'Box of 100',
        category: 'Hardware',
      });
      expect(item.id).toBeTruthy();
    });

    it('creates the item with no units out, whatever the draft carries', () => {
      const withOut = { ...draft, quantityOut: 5 } as ItemDraft;
      expect(createItem(withOut).quantityOut).toBe(0);
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

  describe('units out of the container', () => {
    /** "Nails" with a total of `quantity` units, `quantityOut` of them out. */
    function nails(quantity: number, quantityOut: number): Item {
      return { ...draft, id: 'item-1', quantity, quantityOut };
    }

    const notWholeUnits = [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '3' as unknown as number];

    it('are valid when they are a whole number from 0 to the quantity', () => {
      expect(isValidQuantityOut(0, 100)).toBe(true);
      expect(isValidQuantityOut(100, 100)).toBe(true);
      expect(isValidQuantityOut(0, 0)).toBe(true);
      expect(isValidQuantityOut(101, 100)).toBe(false);
      expect(isValidQuantityOut(-1, 100)).toBe(false);
      expect(isValidQuantityOut(1.5, 100)).toBe(false);
      expect(isValidQuantityOut('3', 100)).toBe(false);
      expect(isValidQuantityOut(undefined, 100)).toBe(false);
    });

    it('unitsInside is the quantity minus the units out', () => {
      expect(unitsInside(nails(100, 0))).toBe(100);
      expect(unitsInside(nails(100, 20))).toBe(80);
      expect(unitsInside(nails(4, 4))).toBe(0);
      expect(unitsInside(nails(0, 0))).toBe(0);
    });

    it('parseUnits reads a whole number from 1 to the maximum, and rounds nothing', () => {
      expect(parseUnits('1', 80)).toBe(1);
      expect(parseUnits(' 80 ', 80)).toBe(80);
      expect(parseUnits('020', 80)).toBe(20);
      for (const text of ['', '   ', '0', '81', '1.5', '-1', '+1', '1e1', 'abc', '2 0']) {
        expect(parseUnits(text, 80)).toBeNull();
      }
      expect(parseUnits('1', 0)).toBeNull();
    });

    describe('takeOut', () => {
      it('counts the units as out and keeps the quantity', () => {
        expect(takeOut(nails(100, 0), 20)).toEqual(nails(100, 20));
        expect(takeOut(nails(100, 20), 1)).toEqual(nails(100, 21));
      });

      it('can take out all the units inside, and no more', () => {
        expect(takeOut(nails(100, 20), 80)).toEqual(nails(100, 100));
        expect(takeOut(nails(100, 20), 81)).toBeNull();
        expect(takeOut(nails(4, 4), 1)).toBeNull();
        expect(takeOut(nails(0, 0), 1)).toBeNull();
      });

      it('gives null for units that are not a whole number from 1 up', () => {
        for (const units of notWholeUnits) {
          expect(takeOut(nails(100, 20), units)).toBeNull();
        }
      });

      it('does not change the item it receives, and keeps its other fields', () => {
        const item = { ...nails(100, 0), description: 'Box', category: 'Hardware' };
        const after = takeOut(item, 20);
        expect(item.quantityOut).toBe(0);
        expect(after).toEqual({ ...item, quantityOut: 20 });
      });
    });

    describe('putBack', () => {
      it('lowers the units out and keeps the quantity', () => {
        expect(putBack(nails(100, 20), 5)).toEqual(nails(100, 15));
        expect(putBack(nails(4, 4), 4)).toEqual(nails(4, 0));
      });

      it('cannot put back more than the units that are out', () => {
        expect(putBack(nails(100, 20), 21)).toBeNull();
        expect(putBack(nails(100, 0), 1)).toBeNull();
      });

      it('gives null for units that are not a whole number from 1 up', () => {
        for (const units of notWholeUnits) {
          expect(putBack(nails(100, 20), units)).toBeNull();
        }
      });
    });

    describe('markUsedFromOut', () => {
      it('lowers the quantity and the units out by the same number', () => {
        expect(markUsedFromOut(nails(100, 20), 15)).toEqual(nails(85, 5));
      });

      it('can use all the units out, also the last units of the item', () => {
        expect(markUsedFromOut(nails(100, 20), 20)).toEqual(nails(80, 0));
        expect(markUsedFromOut(nails(4, 4), 4)).toEqual(nails(0, 0));
      });

      it('cannot use more than the units that are out', () => {
        expect(markUsedFromOut(nails(100, 20), 21)).toBeNull();
        expect(markUsedFromOut(nails(100, 0), 1)).toBeNull();
      });

      it('gives null for units that are not a whole number from 1 up', () => {
        for (const units of notWholeUnits) {
          expect(markUsedFromOut(nails(100, 20), units)).toBeNull();
        }
      });
    });

    describe('markUsedFromInside', () => {
      it('lowers the quantity and does not change the units out', () => {
        expect(markUsedFromInside(nails(100, 0), 15)).toEqual(nails(85, 0));
        expect(markUsedFromInside(nails(100, 20), 15)).toEqual(nails(85, 20));
      });

      it('can use all the units inside, and no more', () => {
        expect(markUsedFromInside(nails(100, 20), 80)).toEqual(nails(20, 20));
        expect(markUsedFromInside(nails(100, 0), 100)).toEqual(nails(0, 0));
        expect(markUsedFromInside(nails(100, 20), 81)).toBeNull();
        expect(markUsedFromInside(nails(4, 4), 1)).toBeNull();
      });

      it('gives null for units that are not a whole number from 1 up', () => {
        for (const units of notWholeUnits) {
          expect(markUsedFromInside(nails(100, 20), units)).toBeNull();
        }
      });
    });

    it('follows the example of the requirements, with and without taking out first', () => {
      // Take out 20, use 15, put back 5.
      const out = takeOut(nails(100, 0), 20) as Item;
      const used = markUsedFromOut(out, 15) as Item;
      expect(putBack(used, 5)).toEqual(nails(85, 0));
      // The shortcut: use 15 without taking them out.
      expect(markUsedFromInside(nails(100, 0), 15)).toEqual(nails(85, 0));
    });
  });

  describe('sortItemsByName', () => {
    const named = (...names: string[]): Item[] =>
      names.map((name, index) => ({ ...draft, id: `id-${index}`, name, quantityOut: 0 }));

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
