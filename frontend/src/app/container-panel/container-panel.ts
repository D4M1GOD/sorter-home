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
import { ItemDraft } from '../core/item.model';
import { ItemForm } from '../item-form/item-form';
import { ItemList } from '../item-list/item-list';

/**
 * Details of the selected container: its type (read only), an editable name, the list of its
 * stack (when it has more than one container), Rotate 90°, a message area, its items with the
 * "Add item" form, and Delete with an inline confirmation. It does not save anything: it emits
 * events and the page saves.
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
   * True while the "Add item" form is open in place of the "Add item" button. It closes, and what
   * was typed is discarded, when another container is selected. Adding an item changes the
   * container but not its id, so the form stays open.
   */
  protected readonly addingItem = linkedSignal({
    source: this.containerId,
    computation: () => false,
  });

  private readonly addItemButton = viewChild<ElementRef<HTMLButtonElement>>('addItemButton');
  private readonly injector = inject(Injector);

  protected openItemForm(): void {
    this.addingItem.set(true);
  }

  /**
   * Closes the form and gives the keyboard focus back to the "Add item" button, which is drawn
   * again in the next render. Without this the focus would be lost with the form.
   */
  protected closeItemForm(): void {
    this.addingItem.set(false);
    afterNextRender(() => this.addItemButton()?.nativeElement.focus(), {
      injector: this.injector,
    });
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
