import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { form, FormField, submit } from '@angular/forms/signals';
import { ItemFormModel, itemFormSchema } from '../core/item-schema';
import {
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_QUANTITY_DEFAULT,
  ItemDraft,
  parseItemQuantity,
} from '../core/item.model';

/** The form as it opens: everything empty and the quantity pre-filled with 1. */
function emptyForm(): ItemFormModel {
  return { name: '', quantity: String(ITEM_QUANTITY_DEFAULT), description: '', category: '' };
}

/**
 * The "Add item" form: name, quantity, description and category (with suggestions). It does not
 * save anything: it emits what the user filled in and the page saves. After each item the form
 * stays open and clean, so several items can be added in a row; "Done" or Escape closes it.
 */
@Component({
  selector: 'app-item-form',
  imports: [FormField],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemForm {
  /** The categories already in use, offered as suggestions for the category field. */
  readonly categories = input<readonly string[]>([]);

  /** The user asked to add an item. Only emitted when every field is valid. */
  readonly added = output<ItemDraft>();
  /** The user closed the form ("Done" or the Escape key). */
  readonly closed = output<void>();

  protected readonly descriptionMaxLength = ITEM_DESCRIPTION_MAX_LENGTH;

  protected readonly model = signal<ItemFormModel>(emptyForm());
  protected readonly itemForm = form(this.model, itemFormSchema);

  /** "Added <name>" after each item. It is empty until the first one is added. */
  protected readonly message = signal('');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // When the form opens, bring it into view (on phones it is below the plan) and put the
    // keyboard focus on the name. `scrollIntoView` does nothing if the form is already visible.
    afterNextRender(() => {
      host.scrollIntoView?.({ block: 'nearest' });
      this.itemForm.name().focusBoundControl();
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // submit() marks the fields as touched (so errors show) and only runs the action if the form is valid.
    void submit(this.itemForm, async () => {
      const value = this.model();
      const quantity = parseItemQuantity(value.quantity);
      if (quantity === null) {
        return;
      }
      const name = value.name.trim();
      this.added.emit({
        name,
        quantity,
        description: value.description,
        category: value.category,
      });
      this.message.set(`Added ${name}`);
      // Back to an empty, untouched form with the focus on the name, ready for the next item.
      this.itemForm().reset(emptyForm());
      this.itemForm.name().focusBoundControl();
    });
  }
}
