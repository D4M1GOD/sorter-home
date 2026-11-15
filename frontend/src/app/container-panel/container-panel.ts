import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { apply, form, FormField } from '@angular/forms/signals';
import { ContainerStack } from '../container-stack/container-stack';
import { containerNameSchema } from '../core/container-name-schema';
import { Container, getContainerType, isValidContainerName } from '../core/container.model';
import { containerDeleteQuestion } from '../core/delete-question';
import {
  Item,
  ItemDraft,
  markUsedFromInside,
  markUsedFromOut,
  putBack,
  sortItemsByName,
  takeOut,
  unitsInside,
} from '../core/item.model';
import { ItemForm } from '../item-form/item-form';
import { ItemList, ItemRowControl, ItemUnitsRequested } from '../item-list/item-list';
import { ItemUnitsMode, ItemUnitsSubmitted } from '../item-units-form/item-units-form';

/** The new values of an item the user edited, and the id of that item. */
export interface ItemEdited {
  itemId: string;
  draft: ItemDraft;
}

/** What is open in the items section of the panel. Only one thing at a time. */
type ItemAction =
  | { kind: 'none' }
  | { kind: 'adding' }
  | { kind: 'editing'; itemId: string }
  | { kind: 'deleting'; itemId: string }
  | { kind: 'units'; itemId: string; mode: ItemUnitsMode };

/** The action the user chose for some units of an item, and the id of that item. */
export interface ItemUnitsChanged extends ItemUnitsSubmitted {
  itemId: string;
}

const NO_ITEM_ACTION: ItemAction = { kind: 'none' };

/**
 * The button of the row that takes the focus after a take out, put back or used. It is the
 * button that opened the form when the row still has it. "Take out" is only there while units
 * are inside, and "Put back" and "Used" only while units are out, so when the button is gone
 * the focus goes to the nearest one: "Put back" after the last units inside left, "Take out"
 * after the last units out came back or were used, and "Edit" (always there) when no unit is left.
 */
function controlAfterUnits(mode: ItemUnitsMode, after: Item): ItemRowControl {
  const inside = unitsInside(after) > 0;
  const out = after.quantityOut > 0;
  if (mode === 'take-out') {
    return inside ? 'take-out' : out ? 'put-back' : 'edit';
  }
  return out ? mode : inside ? 'take-out' : 'edit';
}

/**
 * Details of the selected container: its type (read only), an editable name, the list of its
 * stack (when it has more than one container), Rotate 90°, a message area, its items (with the
 * "Add item" form, and the edit form, the delete confirmation and the take out, put back and
 * used forms of each item), and Delete with an inline confirmation. It does not save anything: it emits events and the page saves.
 */
@Component({
  selector: 'app-container-panel',
  imports: [ContainerStack, FormField, ItemForm, ItemList],
  templateUrl: './container-panel.html',
  styleUrl: './container-panel.scss',
})
export class ContainerPanel {
  readonly container = input.required<Container>();

  /**
   * The containers of the stack of this container, from the bottom to the top. The stack list
   * and its buttons are shown only when there is more than one.
   */
  readonly stack = input<readonly Container[]>([]);

  /**
   * A message for the user, for example when a rotation was blocked for lack of space. It is empty
   * when there is nothing to say. The page decides the text and when to clear it.
   */
  readonly notice = input('');

  /** The categories already in use in any room: the suggestions of the "Add item" form. */
  readonly categories = input<readonly string[]>([]);

  /** The user asked to rotate the container 90°. The page checks that it fits and saves. */
  readonly rotated = output<void>();
  /** The user chose another container of the stack in the list. */
  readonly stackItemSelected = output<string>();
  /** The user asked to move the container one level up in its stack. */
  readonly movedUp = output<void>();
  /** The user asked to move the container one level down in its stack. */
  readonly movedDown = output<void>();
  /** The user asked to take the container out of its stack. */
  readonly removedFromStack = output<void>();

  /** The user filled in the "Add item" form with valid values. The page creates and saves the item. */
  readonly itemAdded = output<ItemDraft>();
  /** The user saved the edit form of an item with valid values. The page saves the item. */
  readonly itemEdited = output<ItemEdited>();
  /** The user confirmed the delete of the item with this id. The page removes it. */
  readonly itemRemoved = output<string>();
  /** The user took out, put back or marked as used some units of an item. The page saves it. */
  readonly itemUnitsChanged = output<ItemUnitsChanged>();

  /** The new, trimmed name. Only emitted when the name is valid and changed. */
  readonly renamed = output<string>();
  /** The user confirmed the delete. */
  readonly deleted = output<void>();

  protected readonly typeLabel = computed(
    () => getContainerType(this.container().typeId)?.label ?? 'Unknown type',
  );

  /** The field starts with the current name and resets when another container is selected. */
  private readonly model = linkedSignal(() => ({ name: this.container().name }));
  protected readonly nameForm = form(this.model, (path) => {
    apply(path.name, containerNameSchema);
  });

  /** Asking "are you sure?" is reset when another container is selected. */
  protected readonly confirming = linkedSignal({
    source: () => this.container().id,
    computation: () => false,
  });

  /** The delete question says how many items the container has, because they are deleted too. */
  protected readonly deleteQuestion = computed(() => containerDeleteQuestion(this.container()));

  /**
   * The id alone, as its own signal: it only changes when another container is selected, not
   * when the selected container changes (for example when an item is added to it).
   */
  private readonly containerId = computed(() => this.container().id);

  /**
   * What is open in the items section: the "Add item" form, the edit form of one item, the
   * delete confirmation of one item, or the take out, put back or used form of one item. Only
   * one at a time: starting another closes the one before
   * and discards what was typed. It also closes when another container is selected. Changing the
   * container (for example adding an item to it) does not change its id, so it stays open.
   */
  private readonly itemAction = linkedSignal<string, ItemAction>({
    source: this.containerId,
    computation: () => NO_ITEM_ACTION,
  });

  /** True while the "Add item" form is open in place of the "Add item" button. */
  protected readonly addingItem = computed(() => this.itemAction().kind === 'adding');
  /** The id of the item whose row shows the edit form, or null. */
  protected readonly editingItemId = computed(() => {
    const action = this.itemAction();
    return action.kind === 'editing' ? action.itemId : null;
  });
  /** The id of the item whose row shows the delete confirmation, or null. */
  protected readonly deletingItemId = computed(() => {
    const action = this.itemAction();
    return action.kind === 'deleting' ? action.itemId : null;
  });

  /** The row that shows the take out, put back or used form, and which of the three, or null. */
  protected readonly itemUnitsAction = computed<ItemUnitsRequested | null>(() => {
    const action = this.itemAction();
    return action.kind === 'units' ? { itemId: action.itemId, mode: action.mode } : null;
  });

  /**
   * What the last action on an item did: "Saved <name>", "Deleted <name>", "Took out 20 of
   * <name>", "Put back 5 of <name>" or "Marked 15 of <name> as used". It is cleared when another
   * action starts and when another container is selected.
   */
  protected readonly itemNotice = linkedSignal({
    source: this.containerId,
    computation: () => '',
  });

  private readonly addItemButton = viewChild<ElementRef<HTMLButtonElement>>('addItemButton');
  private readonly itemList = viewChild(ItemList);
  private readonly injector = inject(Injector);

  protected openItemForm(): void {
    this.itemAction.set({ kind: 'adding' });
    this.itemNotice.set('');
  }

  /**
   * Closes the form and gives the keyboard focus back to the "Add item" button, which is drawn
   * again in the next render. Without this the focus would be lost with the form.
   */
  protected closeItemForm(): void {
    this.itemAction.set(NO_ITEM_ACTION);
    this.focusAfterRender(() => this.addItemButton()?.nativeElement.focus());
  }

  /** Opens the edit form in the row of the item. The form puts the focus on its name field. */
  protected startItemEdit(itemId: string): void {
    this.itemAction.set({ kind: 'editing', itemId });
    this.itemNotice.set('');
  }

  /**
   * Passes the edited values up, closes the form and gives the focus to the "Edit" button of
   * that row, wherever it is now (a new name can move the row in the alphabetical order).
   */
  protected saveItemEdit(draft: ItemDraft): void {
    const itemId = this.editingItemId();
    if (itemId === null) {
      return;
    }
    this.itemEdited.emit({ itemId, draft });
    this.itemAction.set(NO_ITEM_ACTION);
    this.itemNotice.set(`Saved ${draft.name.trim()}`);
    this.focusAfterRender(() => this.itemList()?.focusControl(itemId, 'edit'));
  }

  /** Closes the edit form without saving and gives the focus back to the "Edit" button of the row. */
  protected cancelItemEdit(): void {
    const itemId = this.editingItemId();
    this.itemAction.set(NO_ITEM_ACTION);
    if (itemId !== null) {
      this.focusAfterRender(() => this.itemList()?.focusControl(itemId, 'edit'));
    }
  }

  /**
   * Opens the delete confirmation in the row of the item, with the focus on "Cancel": the
   * "Delete" button that had the focus is replaced by the confirmation, and "Cancel" is the safe
   * place (pressing Enter twice does not delete).
   */
  protected askItemDelete(itemId: string): void {
    this.itemAction.set({ kind: 'deleting', itemId });
    this.itemNotice.set('');
    this.focusAfterRender(() => this.itemList()?.focusControl(itemId, 'cancel-delete'));
  }

  /** Closes the confirmation without deleting and gives the focus back to the "Delete" button of the row. */
  protected cancelItemDelete(): void {
    const itemId = this.deletingItemId();
    this.itemAction.set(NO_ITEM_ACTION);
    if (itemId !== null) {
      this.focusAfterRender(() => this.itemList()?.focusControl(itemId, 'delete'));
    }
  }

  /**
   * Passes the delete up. The row disappears with the button that had the focus, so the focus
   * goes to the "Edit" button of the next row, which takes the place of the deleted one; to the
   * row before when the last row was deleted; and to "Add item" when the list is left empty.
   */
  protected confirmItemDelete(itemId: string): void {
    const rows = sortItemsByName(this.container().items);
    const index = rows.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }
    const neighbor = rows[index + 1] ?? rows[index - 1];
    this.itemRemoved.emit(itemId);
    this.itemAction.set(NO_ITEM_ACTION);
    this.itemNotice.set(`Deleted ${rows[index].name}`);
    this.focusAfterRender(() => {
      if (neighbor) {
        this.itemList()?.focusControl(neighbor.id, 'edit');
      } else {
        this.addItemButton()?.nativeElement.focus();
      }
    });
  }

  /**
   * Opens the take out, put back or used form in the row of the item. The form puts the focus
   * on its quantity field.
   */
  protected startItemUnits(requested: ItemUnitsRequested): void {
    this.itemAction.set({ kind: 'units', itemId: requested.itemId, mode: requested.mode });
    this.itemNotice.set('');
  }

  /** Closes the form without changing anything and gives the focus back to the button that opened it. */
  protected cancelItemUnits(): void {
    const action = this.itemUnitsAction();
    this.itemAction.set(NO_ITEM_ACTION);
    if (action) {
      this.focusAfterRender(() => this.itemList()?.focusControl(action.itemId, action.mode));
    }
  }

  /**
   * Passes the action up, closes the form and says what was done. The focus goes back to the
   * button that opened the form when the row still has it, and to the nearest one when it does
   * not (see `controlAfterUnits`). Nothing happens if the units are not valid for the item.
   */
  protected submitItemUnits(submitted: ItemUnitsSubmitted): void {
    const action = this.itemUnitsAction();
    const item = this.container().items.find((i) => i.id === action?.itemId);
    if (!action || !item) {
      return;
    }
    const { units } = submitted;
    // The same pure functions the store uses, to know how the item will be after the change.
    let after: Item | null;
    let notice: string;
    switch (submitted.action) {
      case 'take-out':
        after = takeOut(item, units);
        notice = `Took out ${units} of ${item.name}`;
        break;
      case 'put-back':
        after = putBack(item, units);
        notice = `Put back ${units} of ${item.name}`;
        break;
      case 'used-from-out':
        after = markUsedFromOut(item, units);
        notice = `Marked ${units} of ${item.name} as used`;
        break;
      case 'used-from-inside':
        after = markUsedFromInside(item, units);
        notice = `Marked ${units} of ${item.name} as used`;
        break;
    }
    if (!after) {
      return;
    }
    const control = controlAfterUnits(action.mode, after);
    this.itemUnitsChanged.emit({ itemId: item.id, ...submitted });
    this.itemAction.set(NO_ITEM_ACTION);
    this.itemNotice.set(notice);
    this.focusAfterRender(() => this.itemList()?.focusControl(item.id, control));
  }

  /** Runs `focus` once the page is drawn again, when the element to focus exists. */
  private focusAfterRender(focus: () => void): void {
    afterNextRender(focus, { injector: this.injector });
  }

  /**
   * Saves the name when the user leaves the field (blur) or presses Enter, not on every key.
   * That avoids saving half-typed names, and with a backend it will be one request, not one per
   * letter. An invalid name is not saved: the error stays visible so the user can fix it.
   */
  protected commitName(): void {
    this.nameForm.name().markAsTouched();
    const name = this.model().name;
    if (isValidContainerName(name) && name.trim() !== this.container().name) {
      this.renamed.emit(name.trim());
    }
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.commitName();
  }

  protected askDelete(): void {
    this.confirming.set(true);
  }

  protected cancelDelete(): void {
    this.confirming.set(false);
  }

  protected confirmDelete(): void {
    this.confirming.set(false);
    this.deleted.emit();
  }
}
