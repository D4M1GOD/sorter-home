/** What the questions need to know about a container: its name and how many items it has. */
interface NamedContainer {
  name: string;
  items: readonly unknown[];
}

/** What the questions need to know about a room: its name and what its containers hold. */
interface NamedRoom {
  name: string;
  containers: readonly { items: readonly unknown[] }[];
}

/** "1 item", "5 items": the number with the singular or the plural word. */
function counted(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

/**
 * The question of the inline confirmation before deleting an item. When some of its units are
 * out of the container the question says so, because those objects lose their recorded place.
 */
export function itemDeleteQuestion(item: {
  name: string;
  quantity?: number;
  quantityOut?: number;
}): string {
  const out = item.quantityOut ?? 0;
  if (out === 0) {
    return `Delete "${item.name}"? This cannot be undone.`;
  }
  return `Delete "${item.name}"? ${out} of ${item.quantity} are out of the container. This cannot be undone.`;
}

/**
 * The question of the inline confirmation before deleting a container. Deleting a container
 * deletes its items too, so the question says how many it has. The number is the count of items
 * (rows), not the sum of their quantities.
 */
export function containerDeleteQuestion(container: NamedContainer): string {
  const count = container.items.length;
  if (count === 0) {
    return `Delete "${container.name}"? This cannot be undone.`;
  }
  const its = count === 1 ? 'its item' : 'its items';
  return `"${container.name}" has ${counted(count, 'item')}. Delete it and ${its}? This cannot be undone.`;
}

/**
 * The question of the inline confirmation before deleting a room. Deleting a room deletes its
 * containers and their items, so the question says what the room contains.
 */
export function roomDeleteQuestion(room: NamedRoom): string {
  const containers = room.containers.length;
  if (containers === 0) {
    return `Delete "${room.name}"? This cannot be undone.`;
  }
  const items = room.containers.reduce((total, container) => total + container.items.length, 0);
  const contents =
    items === 0
      ? counted(containers, 'container')
      : `${counted(containers, 'container')} and ${counted(items, 'item')}`;
  return `"${room.name}" has ${contents}. Delete it and everything inside? This cannot be undone.`;
}
