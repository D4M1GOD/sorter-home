import { Container, createContainer, TOUGH_BOX_27_GAL } from './container.model';
import { Item } from './item.model';
import {
  EMPTY_QUERY,
  isEmptyQuery,
  locationLabel,
  locationText,
  matchesFilters,
  matchesWords,
  paramsOfQuery,
  queryFromParams,
  resultQuantityText,
  resultsCountText,
  sameQuery,
  SEARCH_PAGE_SIZE,
  searchItems,
  SearchQuery,
  SearchResult,
  searchStatusText,
  searchWords,
} from './item-search';
import { createRoom, Room } from './room.model';

describe('item search', () => {
  let nextId = 1;

  function item(name: string, values: Partial<Item> = {}): Item {
    return {
      id: `item-${nextId++}`,
      name,
      quantity: 1,
      quantityOut: 0,
      description: '',
      category: '',
      photoId: null,
      ...values,
    };
  }

  function box(name: string, items: Item[], values: Partial<Container> = {}): Container {
    return { ...createContainer(TOUGH_BOX_27_GAL.id, name, 0, 0), items, ...values };
  }

  function room(name: string, containers: Container[]): Room {
    return { ...createRoom(name), containers };
  }

  const query = (values: Partial<SearchQuery>): SearchQuery => ({ ...EMPTY_QUERY, ...values });

  /** The names of the results of a search, in order. */
  function found(rooms: Room[], values: Partial<SearchQuery>): string[] {
    return searchItems(rooms, query(values)).map((result) => result.item.name);
  }

  /** One room with one container that holds these items. */
  function garage(...items: Item[]): Room[] {
    return [room('Garage', [box('Toys', items)])];
  }

  describe('searchWords', () => {
    it('gives the words of the text, normalized', () => {
      expect(searchWords('  Cable   USB-C ')).toEqual(['cable', 'usb-c']);
      expect(searchWords('JARDÍN')).toEqual(['jardin']);
    });

    it('gives no words for an empty text', () => {
      expect(searchWords('')).toEqual([]);
      expect(searchWords('   ')).toEqual([]);
    });
  });

  describe('text', () => {
    it('finds a word in the name', () => {
      expect(found(garage(item('Cable'), item('Hammer')), { text: 'cable' })).toEqual(['Cable']);
    });

    it('finds a word in the description', () => {
      const items = garage(item('Box of things', { description: 'USB-C cable, 2 m' }), item('Hammer'));
      expect(found(items, { text: 'cable' })).toEqual(['Box of things']);
    });

    it('ignores upper/lower case and accents, in the text and in the items', () => {
      const items = garage(item('Jardín'), item('CABLE'));
      expect(found(items, { text: 'jardin' })).toEqual(['Jardín']);
      expect(found(items, { text: 'JARDÍN' })).toEqual(['Jardín']);
      expect(found(items, { text: 'cable' })).toEqual(['CABLE']);
    });

    it('ignores repeated spaces, also the line breaks inside a description', () => {
      const items = garage(item('Lamp', { description: 'white\n\nLED   bulb' }));
      expect(found(items, { text: '  led   bulb ' })).toEqual(['Lamp']);
      expect(found(items, { text: 'white led' })).toEqual(['Lamp']);
    });

    it('matches a word anywhere in the text, not only at the start of a word', () => {
      const items = garage(item('Cable'));
      expect(found(items, { text: 'cab' })).toEqual(['Cable']);
      expect(found(items, { text: 'able' })).toEqual(['Cable']);
    });

    it('needs every word, in any order', () => {
      const items = garage(item('USB cable'), item('USB charger'), item('Power cable'));
      expect(found(items, { text: 'cable usb' })).toEqual(['USB cable']);
      expect(found(items, { text: 'usb' })).toEqual(['USB cable', 'USB charger']);
      expect(found(items, { text: 'usb hdmi' })).toEqual([]);
    });

    it('takes each word from the name or from the description', () => {
      const items = garage(item('Cable', { description: 'USB-C, white' }));
      expect(found(items, { text: 'white cable' })).toEqual(['Cable']);
      expect(matchesWords(items[0].containers[0].items[0], ['cable', 'white'])).toBe(true);
      expect(matchesWords(items[0].containers[0].items[0], ['cable', 'black'])).toBe(false);
    });

    it('does not look in the category', () => {
      const items = garage(item('Hammer', { category: 'Tools' }));
      expect(found(items, { text: 'tools' })).toEqual([]);
    });

    it('searches all the rooms and all their containers', () => {
      const rooms = [
        room('Garage', [box('A', [item('Cable 1')]), box('B', [item('Cable 2')])]),
        room('Attic', [box('C', [item('Cable 3')])]),
      ];
      expect(found(rooms, { text: 'cable' })).toEqual(['Cable 1', 'Cable 2', 'Cable 3']);
    });
  });

  describe('an empty search', () => {
    it('is empty with no text and no filter, and lists nothing', () => {
      expect(isEmptyQuery(EMPTY_QUERY)).toBe(true);
      expect(isEmptyQuery(query({ text: '   ' }))).toBe(true);
      expect(searchItems(garage(item('Cable')), EMPTY_QUERY)).toEqual([]);
      expect(searchItems(garage(item('Cable')), query({ text: '  ' }))).toEqual([]);
    });

    it('is not empty with a text or with any one filter', () => {
      const parts: Partial<SearchQuery>[] = [
        { text: 'a' },
        { category: 'Tools' },
        { noCategory: true },
        { roomId: 'room-1' },
        { out: true },
        { toComplete: true },
      ];
      for (const part of parts) {
        expect(isEmptyQuery(query(part))).toBe(false);
      }
    });

    it('lists the items of a filter when there is no text', () => {
      const items = garage(item('Nails', { quantity: 100, quantityOut: 20 }), item('Hammer'));
      expect(found(items, { out: true })).toEqual(['Nails']);
    });
  });

  describe('filters', () => {
    const tools = item('Hammer', { category: 'Tools' });
    const garden = item('Hose', { category: 'Jardín' });
    const plain = item('Plain');

    describe('category', () => {
      it('keeps the items of that category, compared like categories are', () => {
        const items = garage(tools, garden, plain);
        expect(found(items, { category: 'Tools' })).toEqual(['Hammer']);
        expect(found(items, { category: ' JARDIN ' })).toEqual(['Hose']);
      });

      it('leaves out the items without a category when a category is chosen', () => {
        expect(found(garage(tools, plain), { category: 'Tools' })).toEqual(['Hammer']);
      });

      it('"no category" keeps only the items without a category', () => {
        const blank = item('Blank', { category: '   ' });
        expect(found(garage(tools, garden, plain, blank), { noCategory: true })).toEqual([
          'Blank',
          'Plain',
        ]);
      });

      it('"no category" wins when a category is given with it', () => {
        expect(found(garage(tools, plain), { noCategory: true, category: 'Tools' })).toEqual(['Plain']);
      });
    });

    it('room keeps the items of that room', () => {
      const first = room('Garage', [box('A', [item('Cable 1')])]);
      const second = room('Garage', [box('B', [item('Cable 2')])]); // the same name, another room
      expect(found([first, second], { roomId: second.id })).toEqual(['Cable 2']);
      expect(found([first, second], { roomId: 'unknown' })).toEqual([]);
    });

    it('"out of the container" keeps the items with units out', () => {
      const items = garage(
        item('Nails', { quantity: 100, quantityOut: 20 }),
        item('Lights', { quantity: 4, quantityOut: 4 }),
        item('Hammer'),
        item('Empty', { quantity: 0 }),
      );
      expect(found(items, { out: true })).toEqual(['Lights', 'Nails']);
    });

    it('"to complete" keeps the items that keep an automatic name', () => {
      const items = garage(item('Item 1'), item('item 12'), item('Item 01'), item('Item one'), item('Nails'));
      expect(found(items, { toComplete: true })).toEqual(['Item 1', 'item 12']);
    });

    it('combines every filter that is set, and the text, with "and"', () => {
      const attic = room('Attic', [
        box('C', [
          item('Item 3', { category: 'Tools', quantity: 5, quantityOut: 2, description: 'red' }),
          item('Item 4', { category: 'Tools', quantity: 5, quantityOut: 2, description: 'blue' }),
          item('Item 5', { category: 'Tools', description: 'red' }), // none out
          item('Saw', { category: 'Tools', quantity: 5, quantityOut: 2, description: 'red' }),
          item('Item 6', { category: 'Toys', quantity: 5, quantityOut: 2, description: 'red' }),
        ]),
      ]);
      const garageRoom = room('Garage', [
        box('A', [item('Item 7', { category: 'Tools', quantity: 5, quantityOut: 2, description: 'red' })]),
      ]);
      const all = { category: 'Tools', roomId: attic.id, out: true, toComplete: true, text: 'red' };
      expect(found([attic, garageRoom], all)).toEqual(['Item 3']);
      expect(found([attic, garageRoom], { ...all, text: '' })).toEqual(['Item 3', 'Item 4']);
    });

    it('matchesFilters does not look at the text', () => {
      expect(matchesFilters(tools, 'room-1', query({ text: 'nothing like it' }))).toBe(true);
    });
  });

  describe('order', () => {
    it('puts first the items that match in the name, then the ones that match in the description', () => {
      const items = garage(
        item('Adapter', { description: 'for a cable' }),
        item('Cable'),
        item('Bag', { description: 'cable ties' }),
        item('USB cable'),
      );
      expect(found(items, { text: 'cable' })).toEqual(['Cable', 'USB cable', 'Adapter', 'Bag']);
    });

    it('with several words, the first group has every word in the name', () => {
      const items = garage(
        item('Cable', { description: 'usb' }), // "usb" only in the description
        item('USB cable'),
        item('Cable USB long'),
        item('Aaa', { description: 'usb cable' }),
      );
      expect(found(items, { text: 'usb cable' })).toEqual(['Cable USB long', 'USB cable', 'Aaa', 'Cable']);
    });

    it('orders each group by name in natural order, ignoring upper/lower case', () => {
      const items = garage(item('Item 10'), item('item 2'), item('Item 1'), item('ITEM 11'));
      expect(found(items, { text: 'item' })).toEqual(['Item 1', 'item 2', 'Item 10', 'ITEM 11']);
    });

    it('is one group, by name, when there is no text', () => {
      const items = garage(item('Nails 10'), item('Hammer'), item('Nails 2'));
      expect(found(items, { noCategory: true })).toEqual(['Hammer', 'Nails 2', 'Nails 10']);
    });

    it('keeps the order of the rooms for items with the same name', () => {
      const rooms = [
        room('Garage', [box('A', [item('Cable', { description: 'first' })])]),
        room('Attic', [box('B', [item('Cable', { description: 'second' })])]),
      ];
      const results = searchItems(rooms, query({ text: 'cable' }));
      expect(results.map((result) => result.item.description)).toEqual(['first', 'second']);
    });
  });

  describe('where a result is', () => {
    it('has the room and the container of the item, and no level for a container that is alone', () => {
      const cable = item('Cable');
      const container = box('Toys', [cable]);
      const garageRoom = room('Garage', [container]);
      expect(searchItems([garageRoom], query({ text: 'cable' }))).toEqual([
        {
          item: cable,
          roomId: garageRoom.id,
          roomName: 'Garage',
          containerId: container.id,
          containerName: 'Toys',
          level: null,
        },
      ]);
    });

    it('has the level of the container, counted from 1, when it is in a stack with others', () => {
      const bottom = box('Bottom', [item('Cable 1')], { stackPosition: 0 });
      const middle = box('Middle', [item('Cable 2')], { stackPosition: 1 });
      const top = box('Top', [item('Cable 3')], { stackPosition: 2 });
      const alone = box('Alone', [item('Cable 4')], { xMm: 2000 });
      const results = searchItems(
        [room('Garage', [bottom, middle, top, alone])],
        query({ text: 'cable' }),
      );
      expect(results.map((result) => [result.containerName, result.level])).toEqual([
        ['Bottom', 1],
        ['Middle', 2],
        ['Top', 3],
        ['Alone', null],
      ]);
    });

    const result = (level: number | null): SearchResult => ({
      item: item('Cable'),
      roomId: 'r',
      roomName: 'Garage',
      containerId: 'c',
      containerName: 'Container 1',
      level,
    });

    it('is written "Room → Container", with the level only in a stack', () => {
      expect(locationText(result(null))).toBe('Garage → Container 1');
      expect(locationText(result(2))).toBe('Garage → Container 1 → Level 2');
    });

    it('has a text without arrows for screen readers', () => {
      expect(locationLabel(result(null))).toBe('Garage, Container 1');
      expect(locationLabel(result(2))).toBe('Garage, Container 1, Level 2');
    });
  });

  describe('texts', () => {
    it('shows the quantity as "Qty N", "None left" or "N of M out"', () => {
      expect(resultQuantityText(item('A', { quantity: 3 }))).toBe('Qty 3');
      expect(resultQuantityText(item('A', { quantity: 0 }))).toBe('None left');
      expect(resultQuantityText(item('A', { quantity: 100, quantityOut: 20 }))).toBe('20 of 100 out');
      expect(resultQuantityText(item('A', { quantity: 4, quantityOut: 4 }))).toBe('4 of 4 out');
    });

    it('counts the results with the singular and the plural', () => {
      expect(resultsCountText(0)).toBe('No results');
      expect(resultsCountText(1)).toBe('1 result');
      expect(resultsCountText(12)).toBe('12 results');
    });

    it('says how many are shown when not all of them are', () => {
      expect(SEARCH_PAGE_SIZE).toBe(50);
      expect(searchStatusText(12, 12)).toBe('12 results');
      expect(searchStatusText(0, 0)).toBe('No results');
      expect(searchStatusText(50, 312)).toBe('Showing 50 of 312 results');
      expect(searchStatusText(100, 312)).toBe('Showing 100 of 312 results');
    });
  });

  describe('the search in the address', () => {
    const known = { roomIds: ['room-1', 'room-2'], categories: ['Jardín', 'Tools'] };
    const read = (params: Record<string, string>) =>
      queryFromParams((name) => params[name] ?? null, known);

    it('writes only the parts that are set', () => {
      expect(paramsOfQuery(EMPTY_QUERY)).toEqual({});
      expect(paramsOfQuery(query({ text: 'cable' }))).toEqual({ q: 'cable' });
      expect(
        paramsOfQuery(query({ text: 'usb cable', category: 'Tools', roomId: 'room-1', out: true, toComplete: true })),
      ).toEqual({ q: 'usb cable', category: 'Tools', room: 'room-1', out: '1', todo: '1' });
      expect(paramsOfQuery(query({ noCategory: true }))).toEqual({ nocategory: '1' });
    });

    it('writes the text without surrounding or repeated spaces, and nothing for a text of spaces', () => {
      expect(paramsOfQuery(query({ text: '  usb   cable ' }))).toEqual({ q: 'usb cable' });
      expect(paramsOfQuery(query({ text: '   ' }))).toEqual({});
    });

    it('writes "no category" and not a category when both are set', () => {
      expect(paramsOfQuery(query({ noCategory: true, category: 'Tools' }))).toEqual({ nocategory: '1' });
    });

    it('reads back what it wrote', () => {
      const searches = [
        EMPTY_QUERY,
        query({ text: 'usb cable' }),
        query({ category: 'Tools', roomId: 'room-2' }),
        query({ noCategory: true, out: true }),
        query({ text: 'red', category: 'Jardín', roomId: 'room-1', out: true, toComplete: true }),
      ];
      for (const search of searches) {
        expect(read(paramsOfQuery(search))).toEqual(search);
      }
    });

    it('reads an empty search from an address without parameters', () => {
      expect(read({})).toEqual(EMPTY_QUERY);
    });

    it('ignores a room that does not exist', () => {
      expect(read({ room: 'deleted-room', q: 'cable' })).toEqual(query({ text: 'cable' }));
    });

    it('ignores a category that no item uses, and takes the spelling in use of one that is', () => {
      expect(read({ category: 'Unknown' })).toEqual(EMPTY_QUERY);
      expect(read({ category: 'jardin' })).toEqual(query({ category: 'Jardín' }));
      expect(read({ category: '   ' })).toEqual(EMPTY_QUERY);
    });

    it('ignores the values and the parameters it does not know', () => {
      expect(read({ out: 'yes', todo: 'true', nocategory: '0', other: 'x' })).toEqual(EMPTY_QUERY);
    });

    it('reads "no category" and drops a category given with it', () => {
      expect(read({ nocategory: '1', category: 'Tools' })).toEqual(query({ noCategory: true }));
    });

    it('sameQuery compares what the searches ask for, not how the text was typed', () => {
      expect(sameQuery(query({ text: 'usb  cable ' }), query({ text: 'usb cable' }))).toBe(true);
      expect(sameQuery(query({ text: 'usb' }), query({ text: 'usb', out: true }))).toBe(false);
      expect(sameQuery(EMPTY_QUERY, query({ text: '  ' }))).toBe(true);
    });
  });
});
