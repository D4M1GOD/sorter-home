import { canonicalCategory, categoryKey, cleanCategory, usedCategories } from './item-category';

describe('item categories', () => {
  /** Rooms with one container each, whose items have the given categories. */
  function rooms(...categoriesPerRoom: string[][]) {
    return categoriesPerRoom.map((categories) => ({
      containers: [{ items: categories.map((category) => ({ category })) }],
    }));
  }

  describe('cleanCategory', () => {
    it('trims and makes runs of spaces one space', () => {
      expect(cleanCategory('  Power   tools ')).toBe('Power tools');
      expect(cleanCategory('Power\t tools')).toBe('Power tools');
      expect(cleanCategory('   ')).toBe('');
    });

    it('keeps the upper/lower case and the accents', () => {
      expect(cleanCategory('Jardín')).toBe('Jardín');
    });
  });

  describe('categoryKey', () => {
    it('ignores upper/lower case', () => {
      expect(categoryKey('Navidad')).toBe(categoryKey('navidad'));
      expect(categoryKey('NAVIDAD')).toBe(categoryKey('navidad'));
    });

    it('ignores accents', () => {
      expect(categoryKey('Jardín')).toBe(categoryKey('jardin'));
      expect(categoryKey('Jardín')).toBe(categoryKey('Jardin'));
      expect(categoryKey('Décor')).toBe(categoryKey('decor'));
    });

    it('ignores surrounding and repeated spaces', () => {
      expect(categoryKey('  Power   tools ')).toBe(categoryKey('power tools'));
    });

    it('still tells different categories apart', () => {
      expect(categoryKey('Tools')).not.toBe(categoryKey('Tool'));
      expect(categoryKey('Power tools')).not.toBe(categoryKey('Powertools'));
    });
  });

  describe('usedCategories', () => {
    it('is empty when there are no items or no item has a category', () => {
      expect(usedCategories([])).toEqual([]);
      expect(usedCategories(rooms(['', '   ']))).toEqual([]);
    });

    it('lists the categories of all the rooms in alphabetical order', () => {
      expect(usedCategories(rooms(['Tools', 'christmas'], ['Books']))).toEqual([
        'Books',
        'christmas',
        'Tools',
      ]);
    });

    it('has no repeats, ignoring case, accents and spaces: the first spelling found is kept', () => {
      expect(
        usedCategories(rooms(['Jardín', 'jardin'], ['JARDIN', ' Jardin '], ['Tools'])),
      ).toEqual(['Jardín', 'Tools']);
    });

    it('stops listing a category when its last item is gone', () => {
      expect(usedCategories(rooms(['Tools', 'Books']))).toEqual(['Books', 'Tools']);
      expect(usedCategories(rooms(['Books']))).toEqual(['Books']);
    });
  });

  describe('canonicalCategory', () => {
    const used = ['Jardín', 'Navidad', 'Power tools'];

    it('reuses the spelling of the existing category', () => {
      expect(canonicalCategory('navidad', used)).toBe('Navidad');
      expect(canonicalCategory('jardin', used)).toBe('Jardín');
      expect(canonicalCategory('JARDIN', used)).toBe('Jardín');
      expect(canonicalCategory(' power   TOOLS ', used)).toBe('Power tools');
    });

    it('cleans a category that is new', () => {
      expect(canonicalCategory('  Camping   gear ', used)).toBe('Camping gear');
    });

    it('keeps no category as no category', () => {
      expect(canonicalCategory('', used)).toBe('');
      expect(canonicalCategory('   ', used)).toBe('');
    });
  });
});
