import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { apply, form, FormField } from '@angular/forms/signals';
import { containerNameSchema } from '../core/container-name-schema';
import { Container, getContainerType, isValidContainerName } from '../core/container.model';

/**
 * Details of the selected container: its type (read only), an editable name and Delete with an
 * inline confirmation. It does not save anything: it emits events and the page saves.
 */
@Component({
  selector: 'app-container-panel',
  imports: [FormField],
  templateUrl: './container-panel.html',
  styleUrl: './container-panel.scss',
})
export class ContainerPanel {
  readonly container = input.required<Container>();

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
