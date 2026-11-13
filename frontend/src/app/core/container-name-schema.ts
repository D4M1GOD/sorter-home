import { maxLength, schema, validate } from '@angular/forms/signals';
import { CONTAINER_NAME_MAX_LENGTH, isValidContainerName } from './container.model';

/**
 * Validation rules for a container name field. Same rules as room names, with its own messages.
 * Use it with `apply(path.name, containerNameSchema)` inside a form schema.
 */
export const containerNameSchema = schema<string>((path) => {
  // Also sets the maxlength attribute on the input.
  maxLength(path, CONTAINER_NAME_MAX_LENGTH);
  validate(path, ({ value }) => {
    const name = value();
    if (isValidContainerName(name)) {
      return undefined;
    }
    return {
      kind: 'containerName',
      message:
        name.trim().length === 0
          ? 'Container name is required.'
          : `Container name must have at most ${CONTAINER_NAME_MAX_LENGTH} characters.`,
    };
  });
});
