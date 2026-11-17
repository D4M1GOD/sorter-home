/**
 * The rules of the photos of the items that do not need the browser: the sizes of the two saved
 * versions, the checks on the chosen file and the texts of the errors.
 */

/** The long side, in pixels, of the small version shown in the item list. */
export const PHOTO_THUMBNAIL_LONG_SIDE = 320;
/** The long side, in pixels, of the version shown when the photo is opened. */
export const PHOTO_FULL_LONG_SIDE = 1280;
/** JPEG quality (0 to 1) of each version. The thumbnail weighs about 20 KB. */
export const PHOTO_THUMBNAIL_QUALITY = 0.7;
export const PHOTO_FULL_QUALITY = 0.8;
/** Both versions are saved as JPEG, whatever the chosen file was. */
export const PHOTO_TYPE = 'image/jpeg';
/** The biggest file the user can choose. Bigger files are not even decoded. */
export const PHOTO_MAX_FILE_MB = 30;
export const PHOTO_MAX_FILE_BYTES = PHOTO_MAX_FILE_MB * 1024 * 1024;

export const PHOTO_NOT_IMAGE_ERROR = 'This file is not an image.';
export const PHOTO_TOO_LARGE_ERROR = `This photo is too large. The maximum is ${PHOTO_MAX_FILE_MB} MB.`;
export const PHOTO_UNREADABLE_ERROR = "Couldn't read this image. Try a JPEG or PNG photo.";
export const PHOTO_SAVE_ERROR = "Couldn't save the photo.";

/** A width and a height in whole pixels. */
export interface PixelSize {
  width: number;
  height: number;
}

/**
 * The size of an image scaled so that its long side is at most `maxLongSide`, keeping its
 * proportions. A smaller image keeps its size: it is never enlarged. Both sides are whole
 * numbers of at least 1 pixel.
 */
export function scaledSize(width: number, height: number, maxLongSide: number): PixelSize {
  const longSide = Math.max(width, height);
  const scale = longSide > maxLongSide ? maxLongSide / longSide : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Checks the chosen file before it is decoded. Gives the text of the error, or null when the
 * file can be tried: it says it is an image and it is not too large.
 */
export function photoFileProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) {
    return PHOTO_NOT_IMAGE_ERROR;
  }
  if (file.size > PHOTO_MAX_FILE_BYTES) {
    return PHOTO_TOO_LARGE_ERROR;
  }
  return null;
}

/** A list of rooms, reduced to what is needed to read the photo ids of their items. */
type RoomsWithPhotos = readonly {
  containers: readonly { items: readonly { photoId: string | null }[] }[];
}[];

/** The ids of the photos that the items of all the rooms use. */
export function usedPhotoIds(rooms: RoomsWithPhotos): Set<string> {
  const ids = new Set<string>();
  for (const room of rooms) {
    for (const container of room.containers) {
      for (const item of container.items) {
        if (item.photoId !== null) {
          ids.add(item.photoId);
        }
      }
    }
  }
  return ids;
}
