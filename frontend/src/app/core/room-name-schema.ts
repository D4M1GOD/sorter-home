import { maxLength, schema, validate } from '@angular/forms/signals';
import { isValidRoomName, ROOM_NAME_MAX_LENGTH } from './room.model';

/**
 * Validation rules for a room name field, shared by every form that edits a room name.
 * Use it with `apply(path.name, roomNameSchema)` inside a form schema.
 */
export const roomNameSchema = schema<string>((path) => {
  // Also sets the maxlength attribute on the input.
  maxLength(path, ROOM_NAME_MAX_LENGTH);
  validate(path, ({ value }) => {
    const name = value();
    if (isValidRoomName(name)) {
      return undefined;
    }
    return {
      kind: 'roomName',
      message:
        name.trim().length === 0
          ? 'Room name is required.'
          : `Room name must have at most ${ROOM_NAME_MAX_LENGTH} characters.`,
    };
  });
});
