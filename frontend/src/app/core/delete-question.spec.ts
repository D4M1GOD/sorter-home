import {
  containerDeleteQuestion,
  itemDeleteQuestion,
  roomDeleteQuestion,
} from './delete-question';
import { Item } from './item.model';

describe('delete questions', () => {
  function items(count: number, quantity = 1): Item[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `item-${index}`,
      name: `Item ${index}`,
      quantity,
      quantityOut: 0,
      description: '',
      category: '',
    }));
  }

  describe('item', () => {
    it('asks with the name of the item, whatever its quantity', () => {
      expect(itemDeleteQuestion({ name: 'Hammer' })).toBe(
        'Delete "Hammer"? This cannot be undone.',
      );
      expect(itemDeleteQuestion(items(1, 50)[0])).toBe('Delete "Item 0"? This cannot be undone.');
    });

    it('says how many units are out of the container', () => {
      expect(itemDeleteQuestion({ name: 'Nails', quantity: 100, quantityOut: 20 })).toBe(
        'Delete "Nails"? 20 of 100 are out of the container. This cannot be undone.',
      );
      expect(itemDeleteQuestion({ name: 'Lights', quantity: 4, quantityOut: 4 })).toBe(
        'Delete "Lights"? 4 of 4 are out of the container. This cannot be undone.',
      );
    });

    it('keeps the short question when no unit is out', () => {
      expect(itemDeleteQuestion({ name: 'Nails', quantity: 100, quantityOut: 0 })).toBe(
        'Delete "Nails"? This cannot be undone.',
      );
    });
  });

  describe('container', () => {
    it('keeps the short question for a container without items', () => {
      expect(containerDeleteQuestion({ name: 'Container 1', items: [] })).toBe(
        'Delete "Container 1"? This cannot be undone.',
      );
    });

    it('says how many items are deleted with the container', () => {
      expect(containerDeleteQuestion({ name: 'Container 1', items: items(5) })).toBe(
        '"Container 1" has 5 items. Delete it and its items? This cannot be undone.',
      );
    });

    it('uses the singular for one item', () => {
      expect(containerDeleteQuestion({ name: 'Container 1', items: items(1) })).toBe(
        '"Container 1" has 1 item. Delete it and its item? This cannot be undone.',
      );
    });

    it('counts items (rows), not the sum of their quantities', () => {
      expect(containerDeleteQuestion({ name: 'Toys', items: items(2, 50) })).toContain(
        'has 2 items',
      );
    });
  });

  describe('room', () => {
    const container = (count: number) => ({ items: items(count) });

    it('keeps the short question for an empty room', () => {
      expect(roomDeleteQuestion({ name: 'Garage', containers: [] })).toBe(
        'Delete "Garage"? This cannot be undone.',
      );
    });

    it('says how many containers and items the room has', () => {
      const containers = [container(5), container(7), container(0)];
      expect(roomDeleteQuestion({ name: 'Garage', containers })).toBe(
        '"Garage" has 3 containers and 12 items. Delete it and everything inside? This cannot be undone.',
      );
    });

    it('uses the singular for one container and for one item', () => {
      expect(roomDeleteQuestion({ name: 'Garage', containers: [container(1)] })).toBe(
        '"Garage" has 1 container and 1 item. Delete it and everything inside? This cannot be undone.',
      );
      expect(roomDeleteQuestion({ name: 'Garage', containers: [container(3)] })).toBe(
        '"Garage" has 1 container and 3 items. Delete it and everything inside? This cannot be undone.',
      );
    });

    it('does not mention items when the containers are empty', () => {
      const containers = [container(0), container(0)];
      expect(roomDeleteQuestion({ name: 'Garage', containers })).toBe(
        '"Garage" has 2 containers. Delete it and everything inside? This cannot be undone.',
      );
      expect(roomDeleteQuestion({ name: 'Garage', containers: [container(0)] })).toBe(
        '"Garage" has 1 container. Delete it and everything inside? This cannot be undone.',
      );
    });
  });
});
