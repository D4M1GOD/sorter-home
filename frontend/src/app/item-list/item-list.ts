import { Component, computed, ElementRef, inject, input, output } from '@angular/core';
import { itemDeleteQuestion } from '../core/delete-question';
import { Item, ItemDraft, sortItemsByName } from '../core/item.model';
import { ItemForm } from '../item-form/item-form';

/** A control of a row that can take the keyboard focus (see `focusControl`). */
export type ItemRowControl = 'edit' | 'delete' | 'cancel-delete';

/**
 * The items of the selected container, in alphabetical order. Each row shows the name, the
 * quantity ("Qty 3", or "None left" when it is 0), the category and the full description, and
 * below them the "Edit" and "Delete" icon buttons. The row being edited shows the item form in
 * its place, and the row being deleted shows the confirmation in place of its buttons.
 * It does not change the items and it does not decide which row is open: it emits what the user
 * asks for, and the panel decides.
 */
@Component({
  selector: 'app-item-list',
  imports: [ItemForm],
  templateUrl: './item-list.html',
  styleUrl: './item-list.scss',
})
export class ItemList {
  /** The items of the container, in the order they are stored (the order they were added in). */
  readonly items = input.required<readonly Item[]>();
  /** The id of the item being edited: its row shows the form. Null when none is. */
  readonly editingId = input<string | null>(null);
  /** The id of the item waiting for the delete confirmation. Null when none is. */
  readonly deletingId = input<string | null>(null);
  /** The categories already in use, offered as suggestions in the edit form. */
  readonly categories = input<readonly string[]>([]);

  /** The user pressed "Edit" on the row of this item id. */
  readonly editRequested = output<string>();
  /** The user saved the edit form with valid values. */
  readonly editSaved = output<ItemDraft>();
  /** The user closed the edit form without saving ("Cancel" or the Escape key). */
  readonly editCancelled = output<void>();
  /** The user pressed "Delete" on the row of this item id. Nothing is deleted yet. */
  readonly deleteRequested = output<string>();
  /** The user confirmed the delete of this item id. */
  readonly deleteConfirmed = output<string>();
  /** The user closed the delete confirmation without deleting. */
  readonly deleteCancelled = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly rows = computed(() =>
    sortItemsByName(this.items()).map((item) => ({
      id: item.id,
      item,
      name: item.name,
      quantity: item.quantity === 0 ? 'None left' : `Qty ${item.quantity}`,
      category: item.category,
      description: item.description,
      deleteQuestion: itemDeleteQuestion(item),
    })),
  );

  /**
   * Puts the keyboard focus on a control of the row of an item: its "Edit" or "Delete" button,
   * or the "Cancel" button of its delete confirmation. It does nothing if the row or the control
   * is not drawn. The panel calls it after a form or a confirmation closes, so the focus is not
   * lost with the element that had it.
   */
  focusControl(itemId: string, control: ItemRowControl): void {
    const row = Array.from(this.host.querySelectorAll<HTMLElement>('li.item')).find(
      (li) => li.dataset['itemId'] === itemId,
    );
    row?.querySelector<HTMLElement>(`.item-${control}`)?.focus();
  }
}
