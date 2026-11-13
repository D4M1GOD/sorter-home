import { Component, computed, input, output } from '@angular/core';
import { Container } from '../core/container.model';

/**
 * The stack of the selected container, listed from the top to the bottom with the level of each
 * one, plus Move up, Move down and Remove from stack. It is how the user reaches the containers
 * hidden under the top one. It does not save anything: it emits events and the page saves.
 */
@Component({
  selector: 'app-container-stack',
  templateUrl: './container-stack.html',
  styleUrl: './container-stack.scss',
})
export class ContainerStack {
  /** The containers of the stack, from the bottom (level 1) to the top. */
  readonly members = input.required<readonly Container[]>();
  /** Id of the selected container, which is highlighted in the list. */
  readonly selectedId = input.required<string>();

  /** The user chose another container of the stack in the list. */
  readonly selected = output<string>();
  /** The user asked to move the selected container one level up. */
  readonly movedUp = output<void>();
  /** The user asked to move the selected container one level down. */
  readonly movedDown = output<void>();
  /** The user asked to take the selected container out of the stack. */
  readonly removed = output<void>();

  /** The list from the top to the bottom. The level the user sees is the stack position + 1. */
  protected readonly rows = computed(() =>
    [...this.members()].reverse().map((member) => ({
      id: member.id,
      name: member.name,
      level: member.stackPosition + 1,
      current: member.id === this.selectedId(),
    })),
  );

  private readonly selectedIndex = computed(() =>
    this.members().findIndex((member) => member.id === this.selectedId()),
  );
  protected readonly atTop = computed(() => this.selectedIndex() === this.members().length - 1);
  protected readonly atBottom = computed(() => this.selectedIndex() <= 0);

  /**
   * At the end of the stack the button is not `disabled` but `aria-disabled`: a disabled button
   * loses the keyboard focus, and the user would have to find their place again. The click is
   * ignored here instead.
   */
  protected moveUp(): void {
    if (!this.atTop()) {
      this.movedUp.emit();
    }
  }

  protected moveDown(): void {
    if (!this.atBottom()) {
      this.movedDown.emit();
    }
  }
}
