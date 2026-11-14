import { Component, computed, input } from '@angular/core';
import { Item, sortItemsByName } from '../core/item.model';

/**
 * The items of the selected container, in alphabetical order. Each row shows the name, the
 * quantity ("Qty 3", or "None left" when it is 0), the category and the full description.
 * It only shows the items: it does not change them.
 */
@Component({
  selector: 'app-item-list',
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
})
export class ItemList {
  /** The items of the container, in the order they are stored (the order they were added in). */
  readonly items = input.required<readonly Item[]>();

  protected readonly rows = computed(() =>
    sortItemsByName(this.items()).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity === 0 ? 'None left' : `Qty ${item.quantity}`,
      category: item.category,
      description: item.description,
    })),
  );
}
