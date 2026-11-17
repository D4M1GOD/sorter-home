import {
  createItem,
  isValidItemCategory,
  isValidItemDescription,
  isValidItemDraft,
  isValidItemName,
  isValidItemQuantity,
  isValidPhotoId,
  isValidQuantityOut,
  Item,
  ItemDraft,
  markUsedFromInside,
  markUsedFromOut,
  nextItemName,
  parseItemQuantity,
  parseUnits,
  putBack,
  sortItemsByName,
  takeOut,
  unitsInside,
} from './item.model';

describe('item model', () => {
  const draft: ItemDraft = {
    name: 'Nails',
    quantity: 100,
    description: '',
    category: '',
    photoId: null,
  };

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
        photoId: 'photo-1',
      });
      expect(item).toEqual({
        id: item.id,
        name: 'Nails',
        quantity: 100,
        quantityOut: 0,
        description: 'Box of 100',
        category: 'Hardware',
        photoId: 'photo-1',
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

    it('creates an item without a photo when the draft has none', () => {
      expect(createItem(draft).photoId).toBeNull();
    });

    it('accepts no photo (null) or a photo id that is a text, and nothing else', () => {
      expect(isValidPhotoId(null)).toBe(true);
      expect(isValidPhotoId('photo-1')).toBe(true);
      for (const photoId of ['', undefined, 7, {}, ['photo-1']]) {
        expect(isValidPhotoId(photoId)).toBe(false);
        const withPhoto = { ...draft, photoId } as ItemDraft;
        expect(isValidItemDraft(withPhoto)).toBe(false);
        expect(() => createItem(withPhoto)).toThrow();
      }
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

    describe('natural order: the numbers inside a name are compared by value', () => {
      const sortedNames = (...names: string[]) =>
        sortItemsByName(named(...names)).map((item) => item.name);

      it('puts "Item 2" before "Item 10"', () => {
        expect(sortedNames('Item 10', 'Item 2', 'Item 1', 'Item 11')).toEqual([
          'Item 1',
          'Item 2',
          'Item 10',
          'Item 11',
        ]);
      });

      it('does it for any name, not only "Item"', () => {
        expect(sortedNames('Nails 10', 'Nails 2', 'Nails')).toEqual(['Nails', 'Nails 2', 'Nails 10']);
      });

      it('still ignores upper/lower case', () => {
        expect(sortedNames('item 10', 'ITEM 2', 'Item 1')).toEqual(['Item 1', 'ITEM 2', 'item 10']);
      });

      it('compares every number of a name in turn', () => {
        expect(sortedNames('Box 10 Shelf 1', 'Box 2 Shelf 10', 'Box 2 Shelf 9')).toEqual([
          'Box 2 Shelf 9',
          'Box 2 Shelf 10',
          'Box 10 Shelf 1',
        ]);
      });

      it('still puts the other names in alphabetical order around the numbered ones', () => {
        expect(sortedNames('Nails', 'Item 10', 'Hammer', 'Item 2')).toEqual([
          'Hammer',
          'Item 2',
          'Item 10',
          'Nails',
        ]);
      });

      it('keeps the order they were added in for names that have the same number', () => {
        const items = named('Item 2', 'Item 02', 'Item 2');
        expect(sortItemsByName(items).map((item) => item.id)).toEqual(['id-0', 'id-1', 'id-2']);
      });
    });
  });

  describe('nextItemName', () => {
    const itemsNamed = (...names: string[]) => names.map((name) => ({ name }));

    it('starts with "Item 1" in a container without items', () => {
      expect(nextItemName([])).toBe('Item 1');
    });

    it('takes the lowest number that is not used, filling the gaps', () => {
      expect(nextItemName(itemsNamed('Item 1', 'Item 3'))).toBe('Item 2');
      expect(nextItemName(itemsNamed('Item 2', 'Item 3'))).toBe('Item 1');
      expect(nextItemName(itemsNamed('Item 1', 'Item 2', 'Item 3'))).toBe('Item 4');
    });

    it('works with numbers of more than one digit', () => {
      const twelve = Array.from({ length: 12 }, (_, index) => `Item ${index + 1}`);
      expect(nextItemName(itemsNamed(...twelve))).toBe('Item 13');
      expect(nextItemName(itemsNamed(...twelve.filter((name) => name !== 'Item 10')))).toBe('Item 10');
    });

    it('only counts the names that are exactly "Item N"', () => {
      expect(
        nextItemName(itemsNamed('Nails', 'Item', 'Item 1a', 'Item 01', 'Item  1', 'My Item 1', 'Item 1 ')),
      ).toBe('Item 1');
    });

    it('ignores upper/lower case: a renamed "item 1" still counts as used', () => {
      expect(nextItemName(itemsNamed('item 1', 'ITEM 2'))).toBe('Item 3');
    });

    it('counts the names it gave before, so a batch gets one number after another', () => {
      const items: { name: string }[] = [];
      for (let i = 0; i < 5; i++) {
        items.push({ name: nextItemName(items) });
      }
      expect(items.map((item) => item.name)).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
    });

    it('gives names that are valid for an item', () => {
      const many = Array.from({ length: 9999 }, (_, index) => `Item ${index + 1}`);
      expect(isValidItemName(nextItemName(itemsNamed(...many)))).toBe(true);
    });
  });
});
