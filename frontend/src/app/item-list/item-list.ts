import { Component, computed, ElementRef, inject, input, output, signal } from '@angular/core';
import { itemDeleteQuestion } from '../core/delete-question';
import {
  Item,
  ItemDraft,
  itemOutText,
  itemQuantityText,
  sortItemsByName,
  unitsInside,
} from '../core/item.model';
import { ItemForm } from '../item-form/item-form';
import { ItemPhoto } from '../item-photo/item-photo';
import {
  ItemUnitsForm,
  ItemUnitsMode,
  ItemUnitsSubmitted,
} from '../item-units-form/item-units-form';

/** A control of a row that can take the keyboard focus (see `focusControl`). */
export type ItemRowControl =
  | 'edit'
  | 'delete'
  | 'cancel-delete'
  | 'take-out'
  | 'put-back'
  | 'used'
  | 'add-photo'
  | 'photo'
  | 'row';

/** The row and the form the user asked for: take out, put back or used. */
export interface ItemUnitsRequested {
  itemId: string;
  mode: ItemUnitsMode;
}

/**
 * The items of the selected container, in natural-number order by name, ignoring upper/lower
 * case (`Item 2` comes before `Item 10`; see `sortItemsByName`). Each row shows the name, the
 * quantity ("Qty 3", or "None left" when it is 0), the category and the full description, with
 * the thumbnail of its photo on the left; a row without a photo has an "Add photo" button. When
 * units are out of the container the row says how many ("20 of 100 out") and has the "Put back"
 * and "Used" buttons. Below are the icon buttons: "Take out" (only when units are inside),
 * "Edit" and "Delete". The row being edited shows the item form in its place; the row being
 * deleted shows the confirmation in place of its buttons, and so does the small form of take
 * out, put back and used.
 * It does not change the items and it does not decide which row is open: it emits what the user
 * asks for, and the panel decides.
 */
@Component({
  selector: 'app-item-list',
  imports: [ItemForm, ItemPhoto, ItemUnitsForm],
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

  /** The item whose row shows the small form of take out, put back or used. Null when none does. */
  readonly unitsAction = input<ItemUnitsRequested | null>(null);

  /** The user pressed "Take out", "Put back" or "Used" on a row. Nothing changes yet. */
  readonly unitsRequested = output<ItemUnitsRequested>();
  /** The user chose an action in the small form, with a valid quantity. */
  readonly unitsSubmitted = output<ItemUnitsSubmitted>();
  /** The user closed the small form without doing anything ("Cancel" or the Escape key). */
  readonly unitsCancelled = output<void>();

  /** The field of the edit form that takes the focus when it opens. */
  readonly editFocus = input<'name' | 'photo'>('name');

  /** The user pressed "Add photo" on the row of this item id. */
  readonly photoAddRequested = output<string>();
  /** The user pressed the thumbnail of this item id, to see the full photo. */
  readonly photoOpened = output<string>();

  /**
   * The photo ids that turned out not to exist in the photo store. Their rows are shown as rows
   * without a photo; the id saved in the item is not touched.
   */
  private readonly missingPhotoIds = signal<ReadonlySet<string>>(new Set());

  protected onPhotoMissing(photoId: string): void {
    this.missingPhotoIds.update((ids) => new Set(ids).add(photoId));
  }

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
      quantity: itemQuantityText(item),
      // "20 of 100 out", also when all the units are out ("4 of 4 out"). Empty when none is out.
      outLabel: itemOutText(item),
      hasOut: item.quantityOut > 0,
      hasInside: unitsInside(item) > 0,
      // The photo to show, or null: no photo, or a photo that does not exist any more.
      photoId:
        item.photoId !== null && !this.missingPhotoIds().has(item.photoId) ? item.photoId : null,
      category: item.category,
      description: item.description,
      deleteQuestion: itemDeleteQuestion(item),
    })),
  );

  /**
   * Puts the keyboard focus on a control of the row of an item: one of its buttons ("Take out",
   * "Put back", "Used", "Add photo", "Edit", "Delete"), its thumbnail, or the "Cancel" button of
   * its delete confirmation. It does nothing if the row or the control
   * is not drawn. The panel calls it after a form or a confirmation closes, so the focus is not
   * lost with the element that had it. 'row' is the row itself: it takes the focus (and the
   * browser scrolls it into view) when the user arrives from a search result.
   */
  focusControl(itemId: string, control: ItemRowControl): void {
    const row = Array.from(this.host.querySelectorAll<HTMLElement>('li.item')).find(
      (li) => li.dataset['itemId'] === itemId,
    );
    if (control === 'row') {
      if (row) {
        // A row cannot take the focus by itself. tabindex="-1" lets the code give it the focus
        // without making it a stop of the Tab key. It is removed when the focus leaves, so a
        // click on the text of a row does not focus the row.
        row.tabIndex = -1;
        row.addEventListener('blur', () => row.removeAttribute('tabindex'), { once: true });
        row.focus();
      }
    } else {
      row?.querySelector<HTMLElement>(`.item-${control}`)?.focus();
    }
  }
}
