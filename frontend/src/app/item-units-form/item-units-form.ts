import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { unitsError, UnitsFormModel } from '../core/item-schema';
import { Item, parseUnits, unitsInside } from '../core/item.model';

/** What the form is opened for. Each one has its own title, buttons and maximum. */
export type ItemUnitsMode = 'take-out' | 'put-back' | 'used';

/** What the user asked to do with the units. "Take out" offers two of them. */
export type ItemUnitsAction = 'take-out' | 'put-back' | 'used-from-out' | 'used-from-inside';

/** The action the user chose and how many units it is for. */
export interface ItemUnitsSubmitted {
  action: ItemUnitsAction;
  units: number;
}

/**
 * The small form of take out, put back and used: one quantity field, pre-filled with all the
 * units that can be moved (the units inside for "take out", the units out for the other two).
 * It does not save anything: it emits what the user asked for and the page saves.
 * The "take out" form has two actions for the same quantity: "Take out", which the Enter key
 * runs because it can be reverted with "Put back", and "Mark as used", which needs a click.
 */
@Component({
  selector: 'app-item-units-form',
  imports: [FormField],
  templateUrl: './item-units-form.html',
  styleUrl: './item-units-form.scss',
})
export class ItemUnitsForm {
  /** The item whose units are moved. */
  readonly item = input.required<Item>();
  readonly mode = input.required<ItemUnitsMode>();

  /** The user chose an action with a valid quantity. */
  readonly submitted = output<ItemUnitsSubmitted>();
  /** The user closed the form ("Cancel" or the Escape key). */
  readonly closed = output<void>();

  /** The most units the action can move: the units inside, or the units that are out. */
  protected readonly max = computed(() =>
    this.mode() === 'take-out' ? unitsInside(this.item()) : this.item().quantityOut,
  );

  protected readonly title = computed(() => {
    const name = this.item().name;
    switch (this.mode()) {
      case 'take-out':
        return `Take out or use ${name}`;
      case 'put-back':
        return `Put back ${name}`;
      case 'used':
        return `Mark ${name} as used`;
    }
  });

  /** The text of the button that the Enter key runs. */
  protected readonly primaryLabel = computed(() => {
    switch (this.mode()) {
      case 'take-out':
        return 'Take out';
      case 'put-back':
        return 'Put back';
      case 'used':
        return 'Used';
    }
  });

  /** A linked signal, because the starting value comes from the inputs: all the units. */
  protected readonly model = linkedSignal<UnitsFormModel>(() => ({ units: String(this.max()) }));
  protected readonly unitsForm = form(this.model, (path) => {
    validate(path.units, ({ value }) => unitsError(value(), this.max()));
  });

  private readonly unitsField = viewChild.required<ElementRef<HTMLInputElement>>('unitsField');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // When the form opens, bring it into view and put the keyboard focus on the quantity, with
    // its text selected so that typing a number replaces the pre-filled one.
    afterNextRender(() => {
      host.scrollIntoView?.({ block: 'nearest' });
      const field = this.unitsField().nativeElement;
      field.focus();
      field.select();
    });
  }

  /** The Enter key and the first button: the action that gives the form its name. */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    const mode = this.mode();
    this.run(mode === 'used' ? 'used-from-out' : mode);
  }

  /** "Mark as used" of the "take out" form: uses units that are inside, without taking them out. */
  protected markUsed(): void {
    this.run('used-from-inside');
  }

  private run(action: ItemUnitsAction): void {
    // submit() marks the field as touched (so errors show) and only runs the action if it is valid.
    void submit(this.unitsForm, async () => {
      const units = parseUnits(this.model().units, this.max());
      if (units !== null) {
        this.submitted.emit({ action, units });
      }
    });
  }
}
