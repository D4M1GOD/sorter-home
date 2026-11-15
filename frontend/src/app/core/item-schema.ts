import { maxLength, schema, validate } from '@angular/forms/signals';
import {
  ITEM_CATEGORY_MAX_LENGTH,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_NAME_MAX_LENGTH,
  ITEM_QUANTITY_MAX,
  ITEM_QUANTITY_MIN,
  isValidItemName,
  parseItemQuantity,
  parseUnits,
} from './item.model';

/**
 * The fields of the "Add item" form. The quantity is text because the field is a text input
 * (with a numeric keyboard on phones): `parseItemQuantity` turns it into a number.
 */
export interface ItemFormModel {
  name: string;
  quantity: string;
  description: string;
  category: string;
}

/** An error of a form field: `kind` tells the errors apart and `message` is shown to the user. */
export interface FieldError {
  kind: string;
  message: string;
}

/**
 * The extra rule of the quantity when an item is edited: the quantity is the total, so it cannot
 * be lower than the units that are out of the container. Gives the error, or undefined when the
 * quantity is fine or is not a valid number (that case has its own error).
 */
export function quantityBelowOutError(quantity: string, quantityOut: number): FieldError | undefined {
  const parsed = parseItemQuantity(quantity);
  if (parsed === null || parsed >= quantityOut) {
    return undefined;
  }
  return {
    kind: 'itemQuantityBelowOut',
    message: `Quantity can't be lower than the units that are out (${quantityOut}).`,
  };
}

/** The field of the small form of take out, put back and used. It is text, like the quantity. */
export interface UnitsFormModel {
  units: string;
}

/**
 * The rule of the units of take out, put back and used: a whole number from 1 to `max` (the
 * units inside, or the units out). Nothing is rounded. Gives the error, or undefined.
 */
export function unitsError(units: string, max: number): FieldError | undefined {
  if (parseUnits(units, max) !== null) {
    return undefined;
  }
  if (units.trim().length === 0) {
    return { kind: 'itemUnits', message: 'Quantity is required.' };
  }
  return {
    kind: 'itemUnits',
    message: max === 1 ? 'Quantity must be 1.' : `Quantity must be a whole number from 1 to ${max}.`,
  };
}

/** Validation rules for the "Add item" form. Use it with `form(model, itemFormSchema)`. */
export const itemFormSchema = schema<ItemFormModel>((path) => {
  // maxLength also sets the maxlength attribute on the field, so the browser stops the typing.
  maxLength(path.name, ITEM_NAME_MAX_LENGTH);
  validate(path.name, ({ value }) => {
    const name = value();
    if (isValidItemName(name)) {
      return undefined;
    }
    return {
      kind: 'itemName',
      message:
        name.trim().length === 0
          ? 'Item name is required.'
          : `Item name must have at most ${ITEM_NAME_MAX_LENGTH} characters.`,
    };
  });

  validate(path.quantity, ({ value }) => {
    const quantity = value();
    if (parseItemQuantity(quantity) !== null) {
      return undefined;
    }
    return {
      kind: 'itemQuantity',
      message:
        quantity.trim().length === 0
          ? 'Quantity is required.'
          : `Quantity must be a whole number from ${ITEM_QUANTITY_MIN} to ${ITEM_QUANTITY_MAX}.`,
    };
  });

  maxLength(path.description, ITEM_DESCRIPTION_MAX_LENGTH);
  maxLength(path.category, ITEM_CATEGORY_MAX_LENGTH);
});
