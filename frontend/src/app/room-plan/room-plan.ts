import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { gridLinePositions } from '../core/grid';
import { Room } from '../core/room.model';
import { formatFeetInches } from '../core/units';

@Component({
  selector: 'app-room-plan',
  templateUrl: './room-plan.html',
  styleUrl: './room-plan.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomPlan {
  readonly room = input.required<Room>();

  /** Text size and outer margin scale with the room, so labels stay readable at any room size. */
  protected readonly labelSize = computed(
    () => Math.max(this.room().widthMm, this.room().depthMm) * 0.03,
  );
  protected readonly margin = computed(() => this.labelSize() * 3);

  /** The drawing uses millimeters as units, with a margin around the room for the labels. */
  protected readonly viewBox = computed(() => {
    const m = this.margin();
    const { widthMm, depthMm } = this.room();
    return `${-m} ${-m} ${widthMm + 2 * m} ${depthMm + 2 * m}`;
  });

  protected readonly verticalLines = computed(() => gridLinePositions(this.room().widthMm));
  protected readonly horizontalLines = computed(() => gridLinePositions(this.room().depthMm));

  protected readonly widthLabel = computed(() => formatFeetInches(this.room().widthMm));
  protected readonly depthLabel = computed(() => formatFeetInches(this.room().depthMm));
  protected readonly depthLabelPos = computed(() => ({
    x: -this.margin() * 0.7,
    y: this.room().depthMm / 2,
  }));
}