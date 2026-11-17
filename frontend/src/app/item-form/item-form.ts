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
  signal,
  viewChild,
} from '@angular/core';
import { apply, form, FormField, submit, validate } from '@angular/forms/signals';
import { ItemFormModel, itemFormSchema, quantityBelowOutError } from '../core/item-schema';
import {
  Item,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_QUANTITY_DEFAULT,
  ItemDraft,
  parseItemQuantity,
} from '../core/item.model';
import { PhotoError, PhotoProcessor } from '../core/photo-processor';
import { PHOTO_SAVE_ERROR, PHOTO_UNREADABLE_ERROR } from '../core/photo-size';
import { PhotoStore, ProcessedPhoto } from '../core/photo-store';
import { loadedPhoto, objectUrl } from '../core/photo-url';
import { TouchScreen } from '../core/touch-screen';

/** The buttons of the photo field that open a file picker or the camera. */
type PhotoOpener = 'add' | 'replace' | 'camera';

const PHOTO_OPENER_SELECTOR: Record<PhotoOpener, string> = {
  add: '.photo-add',
  replace: '.photo-replace',
  camera: '.photo-camera',
};

/** The form as it opens to add an item: everything empty and the quantity pre-filled with 1. */
function emptyForm(): ItemFormModel {
  return { name: '', quantity: String(ITEM_QUANTITY_DEFAULT), description: '', category: '' };
}

/** The form as it opens to edit an item: filled with the data of the item. */
function formOf(item: Item): ItemFormModel {
  return {
    name: item.name,
    quantity: String(item.quantity),
    description: item.description,
    category: item.category,
  };
}

/**
 * The item form: name, quantity, description, category (with suggestions) and photo. It does
 * not save the item: it emits what the user filled in and the page saves. The photo is the
 * exception: a photo chosen here is saved in the photo store when the user presses "Add" or
 * "Save", before anything is emitted, because saving it can fail and then the item must not be
 * saved ("Couldn't save the photo."). The form emits the id of the saved photo with the item.
 * It has two uses:
 * - "Add item" (no `item`): after each item the form stays open and clean, so several items can
 *   be added in a row; "Done" or Escape closes it.
 * - "Edit item" (with `item`): the form starts with the data of the item; "Save" emits the new
 *   values once, and "Cancel" or Escape closes it. Whoever shows the form closes it after saving.
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
  /** The item to edit. Without it, the form adds a new item. */
  readonly item = input<Item | null>(null);
  /** The field that takes the keyboard focus when the form opens. */
  readonly focusOn = input<'name' | 'photo'>('name');

  /** The user asked to add an item. Only emitted when every field is valid. */
  readonly added = output<ItemDraft>();
  /** The user asked to save the edited item. Only emitted when every field is valid. */
  readonly saved = output<ItemDraft>();
  /** The user closed the form ("Done" or "Cancel", or the Escape key). */
  readonly closed = output<void>();

  protected readonly descriptionMaxLength = ITEM_DESCRIPTION_MAX_LENGTH;

  protected readonly editing = computed(() => this.item() !== null);

  /** A linked signal, because the starting values come from an input (the item to edit). */
  protected readonly model = linkedSignal<ItemFormModel>(() => {
    const item = this.item();
    return item ? formOf(item) : emptyForm();
  });
  /** The units of the edited item that are out of its container. 0 when adding. */
  protected readonly quantityOut = computed(() => this.item()?.quantityOut ?? 0);

  protected readonly itemForm = form(this.model, (path) => {
    apply(path, itemFormSchema);
    // The quantity is the total: it cannot go below the units that are out of the container.
    validate(path.quantity, ({ value }) => quantityBelowOutError(value(), this.quantityOut()));
  });

  /** "Added <name>" after each item. It is empty until the first one is added. */
  protected readonly message = signal('');

  private readonly photos = inject(PhotoStore);
  private readonly processor = inject(PhotoProcessor);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly photoInput = viewChild.required<ElementRef<HTMLInputElement>>('photoInput');
  /** The field that opens the camera. It is only in the form on touch screens. */
  private readonly cameraInput = viewChild<ElementRef<HTMLInputElement>>('cameraInput');
  /** Whether to show the "Take photo" button: only on touch screens, where "capture" works. */
  protected readonly touchScreen = inject(TouchScreen);

  /** The button the user pressed to choose the photo, to put the focus back on it. */
  private photoOpener: PhotoOpener = 'add';

  /**
   * The photo the item already has (when editing), until the user removes it. It is not deleted
   * here: if the item is saved without it, the photo cleanup deletes it.
   */
  private readonly savedPhotoId = linkedSignal(() => this.item()?.photoId ?? null);
  /** A photo the user chose in this form. It is only in memory until "Add" or "Save". */
  private readonly chosenPhoto = signal<ProcessedPhoto | null>(null);

  private readonly chosenPhotoUrl = objectUrl(() => this.chosenPhoto()?.thumbnail ?? null);
  /** The saved photo is only loaded while it is the one shown. */
  private readonly savedPhoto = loadedPhoto(
    this.photos,
    () => (this.chosenPhoto() === null ? this.savedPhotoId() : null),
    'thumbnail',
  );

  /**
   * True when the form has a photo to show: one just chosen, or the saved one. A saved photo
   * that does not exist any more counts as no photo.
   */
  protected readonly hasPhoto = computed(
    () =>
      this.chosenPhoto() !== null ||
      (this.savedPhotoId() !== null && this.savedPhoto().status !== 'missing'),
  );
  /** The address of the preview image, or null while it loads. */
  protected readonly previewUrl = computed(() => this.chosenPhotoUrl() ?? this.savedPhoto().url);

  /** True while the chosen file is being reduced in size. */
  protected readonly preparingPhoto = signal(false);
  /** The problem with the chosen file, or with saving the photo. Empty when there is none. */
  protected readonly photoError = signal('');
  /** True while "Add" or "Save" is saving the photo, so a second press does nothing. */
  private saving = false;

  constructor() {
    // When the form opens, bring it into view (on phones it is below the plan) and put the
    // keyboard focus on the name, or on the photo field when the form was opened to add a photo.
    // `scrollIntoView` does nothing if the form is already visible.
    afterNextRender(() => {
      this.host.scrollIntoView?.({ block: 'nearest' });
      if (this.focusOn() === 'photo') {
        this.focusPhotoButton('.photo-add, .photo-replace');
      } else {
        this.itemForm.name().focusBoundControl();
      }
    });
  }

  /** Opens the file picker of the browser: the gallery or the files, without the camera. */
  protected choosePhoto(opener: 'add' | 'replace'): void {
    this.photoOpener = opener;
    this.photoInput().nativeElement.click();
  }

  /** "Take photo": opens the camera of the phone (the field with "capture"). Touch screens only. */
  protected takePhoto(): void {
    this.photoOpener = 'camera';
    this.cameraInput()?.nativeElement.click();
  }

  /**
   * Prepares the file the user chose, with the file picker or with the camera: it is reduced in
   * size here, so the preview and any error show at once. Nothing is saved yet. A file with a
   * problem leaves the photo as it was.
   */
  protected async onPhotoChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Empty the field, so choosing the same file again fires "change" again.
    input.value = '';
    if (!file || this.preparingPhoto()) {
      return;
    }
    const opener = this.photoOpener;
    const hadPhoto = this.hasPhoto();
    this.photoError.set('');
    this.preparingPhoto.set(true);
    try {
      this.chosenPhoto.set(await this.processor.process(file));
      // The button that opened the picker keeps the focus when it is still there: that is so
      // for "Replace" and "Take photo" when the form already had a photo. "Add photo" (and
      // "Take photo" when there was no photo) is replaced by the preview: the focus goes to
      // "Replace".
      const stays = hadPhoto && opener !== 'add';
      this.focusPhotoButton(stays ? [PHOTO_OPENER_SELECTOR[opener], '.photo-replace'] : '.photo-replace', true);
    } catch (error) {
      this.photoError.set(error instanceof PhotoError ? error.message : PHOTO_UNREADABLE_ERROR);
      // Back to the button that opened the picker, which is still there: the photo did not change.
      this.focusPhotoButton(PHOTO_OPENER_SELECTOR[opener], true);
    } finally {
      this.preparingPhoto.set(false);
    }
  }

  /** Takes the photo out of the form. The saved photo is not deleted until "Save". */
  protected removePhoto(): void {
    this.chosenPhoto.set(null);
    this.savedPhotoId.set(null);
    this.photoError.set('');
    // The preview and its buttons are replaced by "Add photo": the focus goes to it.
    this.focusPhotoButton('.photo-add', true);
  }

  /** Focuses the first of these buttons that is in the form. */
  private focusPhotoButton(selectors: string | readonly string[], afterRender = false): void {
    const focus = () => {
      for (const selector of typeof selectors === 'string' ? [selectors] : selectors) {
        const button = this.host.querySelector<HTMLElement>(selector);
        if (button) {
          button.focus();
          return;
        }
      }
    };
    if (afterRender) {
      afterNextRender(focus, { injector: this.injector });
    } else {
      focus();
    }
  }

  /**
   * The photo id to save with the item. A photo chosen in this form is saved now, before the
   * item: if that fails, this throws and the item is not saved.
   */
  private async photoIdToSave(): Promise<string | null> {
    const chosen = this.chosenPhoto();
    if (chosen !== null) {
      return this.photos.save(chosen);
    }
    return this.hasPhoto() ? this.savedPhotoId() : null;
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // submit() marks the fields as touched (so errors show) and only runs the action if the form is valid.
    void submit(this.itemForm, async () => {
      const value = this.model();
      const quantity = parseItemQuantity(value.quantity);
      // Nothing happens while the chosen photo is being prepared or a save is under way.
      if (quantity === null || this.preparingPhoto() || this.saving) {
        return;
      }
      this.saving = true;
      this.photoError.set('');
      let photoId: string | null;
      try {
        photoId = await this.photoIdToSave();
      } catch {
        this.photoError.set(PHOTO_SAVE_ERROR);
        return;
      } finally {
        this.saving = false;
      }
      const name = value.name.trim();
      const draft: ItemDraft = {
        name,
        quantity,
        description: value.description,
        category: value.category,
        photoId,
      };
      if (this.editing()) {
        this.saved.emit(draft);
        return;
      }
      this.added.emit(draft);
      this.message.set(`Added ${name}`);
      // Back to an empty, untouched form with the focus on the name, ready for the next item.
      this.itemForm().reset(emptyForm());
      this.chosenPhoto.set(null);
      this.photoError.set('');
      this.itemForm.name().focusBoundControl();
    });
  }
}
