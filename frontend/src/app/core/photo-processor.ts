import { Service } from '@angular/core';
import {
  PHOTO_FULL_LONG_SIDE,
  PHOTO_FULL_QUALITY,
  PHOTO_THUMBNAIL_LONG_SIDE,
  PHOTO_THUMBNAIL_QUALITY,
  PHOTO_TYPE,
  PHOTO_UNREADABLE_ERROR,
  photoFileProblem,
  PixelSize,
  scaledSize,
} from './photo-size';
import { ProcessedPhoto } from './photo-store';

/** A problem with the chosen file. Its message is written for the user. */
export class PhotoError extends Error {}

/** Draws `source` scaled to `size` on a new canvas, over a white background. */
function drawScaled(source: CanvasImageSource, size: PixelSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new PhotoError(PHOTO_UNREADABLE_ERROR);
  }
  // JPEG has no transparency: without this, the transparent parts of a PNG would turn black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

/** Turns what is drawn on a canvas into a JPEG file in memory. */
function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PhotoError(PHOTO_UNREADABLE_ERROR))),
      PHOTO_TYPE,
      quality,
    );
  });
}

/**
 * Turns the file the user chose into the two versions that are saved: reduced in size, as JPEG
 * and with the photo upright. It needs the browser (it decodes and draws the image), so its
 * rules that do not are in `photo-size.ts`.
 */
@Service()
export class PhotoProcessor {
  /**
   * Gives the thumbnail and the full version of the photo. Throws a `PhotoError`, with a
   * message for the user, when the file is not an image, is too large, or cannot be decoded
   * by this browser (for example a HEIC photo outside Safari).
   */
  async process(file: Blob): Promise<ProcessedPhoto> {
    const problem = photoFileProblem(file);
    if (problem !== null) {
      throw new PhotoError(problem);
    }
    let bitmap: ImageBitmap;
    try {
      // Decodes the image. 'from-image' turns it upright, following the orientation the camera
      // wrote in the file (EXIF).
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new PhotoError(PHOTO_UNREADABLE_ERROR);
    }
    try {
      const full = drawScaled(
        bitmap,
        scaledSize(bitmap.width, bitmap.height, PHOTO_FULL_LONG_SIDE),
      );
      // The thumbnail is drawn from the full version, which is already small: it is faster.
      const thumbnail = drawScaled(
        full,
        scaledSize(full.width, full.height, PHOTO_THUMBNAIL_LONG_SIDE),
      );
      return {
        thumbnail: await toJpeg(thumbnail, PHOTO_THUMBNAIL_QUALITY),
        full: await toJpeg(full, PHOTO_FULL_QUALITY),
      };
    } finally {
      // Frees the memory of the decoded image right away, without waiting for the browser.
      bitmap.close();
    }
  }
}
