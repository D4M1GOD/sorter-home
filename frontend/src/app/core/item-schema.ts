import { maxLength, schema, validate } from '@angular/forms/signals';
import {
  ITEM_CATEGORY_MAX_LENGTH,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_NAME_MAX_LENGTH,
  ITEM_QUANTITY_MAX,
  ITEM_QUANTITY_MIN,
  isValidItemName,
  parseItemQuantity,
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
