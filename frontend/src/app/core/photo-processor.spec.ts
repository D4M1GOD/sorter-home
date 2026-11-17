import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PhotoError, PhotoProcessor } from './photo-processor';
import {
  PHOTO_MAX_FILE_BYTES,
  PHOTO_NOT_IMAGE_ERROR,
  PHOTO_TOO_LARGE_ERROR,
  PHOTO_UNREADABLE_ERROR,
} from './photo-size';

/**
 * jsdom cannot decode or draw images, so these tests replace the browser parts (the decoder and
 * the canvas) with fakes that record what they were asked to do. They check the steps and the
 * sizes, not the pixels: the real result is checked by hand.
 */
describe('PhotoProcessor', () => {
  /** One fake canvas: what was drawn on it and what it was exported as. */
  interface Drawn {
    width: number;
    height: number;
    filled: { style: unknown; rect: number[] } | null;
    source: unknown;
    drawSize: number[];
    exported: { type?: string; quality?: unknown } | null;
  }

  let canvases: Drawn[];
  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
  let decode: ReturnType<typeof vi.fn>;
  /** When true, the canvas gives no file when it is exported. */
  let exportFails: boolean;

  function file(type = 'image/jpeg', size = 1000): Blob {
    return { type, size } as Blob;
  }

  beforeEach(() => {
    canvases = [];
    exportFails = false;
    bitmap = { width: 4000, height: 3000, close: vi.fn() };
    decode = vi.fn(async () => bitmap);
    vi.stubGlobal('createImageBitmap', decode);

    const realCreate = document.createElement.bind(document);
    const fakeCreate = (tag: string): HTMLElement => {
      if (tag !== 'canvas') {
        return realCreate(tag);
      }
      const drawn: Drawn = {
        width: 0,
        height: 0,
        filled: null,
        source: null,
        drawSize: [],
        exported: null,
      };
      canvases.push(drawn);
      const context = {
        fillStyle: '',
        fillRect(...rect: number[]) {
          drawn.filled = { style: context.fillStyle, rect };
        },
        drawImage(source: unknown, ...size: number[]) {
          // The fill must come first, or it would cover the photo.
          expect(drawn.filled).not.toBeNull();
          drawn.source = source;
          drawn.drawSize = size;
        },
      };
      const canvas = {
        get width() {
          return drawn.width;
        },
        set width(value: number) {
          drawn.width = value;
        },
        get height() {
          return drawn.height;
        },
        set height(value: number) {
          drawn.height = value;
        },
        getContext: () => context,
        toBlob(done: (blob: Blob | null) => void, type?: string, quality?: unknown) {
          drawn.exported = { type, quality };
          done(exportFails ? null : new Blob([`${drawn.width}x${drawn.height}`], { type }));
        },
      };
      return canvas as unknown as HTMLElement;
    };
    vi.spyOn(document, 'createElement').mockImplementation(
      fakeCreate as typeof document.createElement,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function processor(): PhotoProcessor {
    return TestBed.inject(PhotoProcessor);
  }

  async function errorOf(attempt: Promise<unknown>): Promise<unknown> {
    try {
      await attempt;
    } catch (error) {
      return error;
    }
    throw new Error('It did not fail');
  }

  describe('a photo that can be read', () => {
    it('decodes the file turned upright, following its EXIF orientation', async () => {
      const chosen = file();
      await processor().process(chosen);
      expect(decode).toHaveBeenCalledTimes(1);
      expect(decode).toHaveBeenCalledWith(chosen, { imageOrientation: 'from-image' });
    });

    it('draws the full version with a long side of 1280 px', async () => {
      await processor().process(file());
      const [full] = canvases;
      expect([full.width, full.height]).toEqual([1280, 960]);
      expect(full.source).toBe(bitmap);
      expect(full.drawSize).toEqual([0, 0, 1280, 960]);
    });

    it('draws the thumbnail with a long side of 320 px, from the full version', async () => {
      await processor().process(file());
      expect(canvases.length).toBe(2);
      const thumbnail = canvases[1];
      expect([thumbnail.width, thumbnail.height]).toEqual([320, 240]);
      expect(thumbnail.drawSize).toEqual([0, 0, 320, 240]);
      // Its source is the canvas of the full version, not the decoded photo.
      expect(thumbnail.source).not.toBe(bitmap);
    });

    it('keeps the proportions of a portrait photo', async () => {
      bitmap.width = 3000;
      bitmap.height = 4000;
      await processor().process(file());
      expect([canvases[0].width, canvases[0].height]).toEqual([960, 1280]);
      expect([canvases[1].width, canvases[1].height]).toEqual([240, 320]);
    });

    it('never enlarges a small photo', async () => {
      bitmap.width = 200;
      bitmap.height = 100;
      await processor().process(file());
      expect([canvases[0].width, canvases[0].height]).toEqual([200, 100]);
      expect([canvases[1].width, canvases[1].height]).toEqual([200, 100]);
    });

    it('paints a white background first, for images with transparent parts', async () => {
      await processor().process(file('image/png'));
      for (const canvas of canvases) {
        expect(canvas.filled).toEqual({ style: '#fff', rect: [0, 0, canvas.width, canvas.height] });
      }
    });

    it('exports both versions as JPEG: the full one at quality 0.8, the thumbnail at 0.7', async () => {
      const photo = await processor().process(file('image/png'));
      expect(canvases[0].exported).toEqual({ type: 'image/jpeg', quality: 0.8 });
      expect(canvases[1].exported).toEqual({ type: 'image/jpeg', quality: 0.7 });
      expect(photo.full.type).toBe('image/jpeg');
      expect(photo.thumbnail.type).toBe('image/jpeg');
      expect(await photo.full.text()).toBe('1280x960');
      expect(await photo.thumbnail.text()).toBe('320x240');
    });

    it('frees the decoded photo when it is done', async () => {
      await processor().process(file());
      expect(bitmap.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('a file with a problem', () => {
    it('rejects a file that is not an image, without decoding it', async () => {
      const error = await errorOf(processor().process(file('application/pdf')));
      expect(error).toBeInstanceOf(PhotoError);
      expect((error as PhotoError).message).toBe(PHOTO_NOT_IMAGE_ERROR);
      expect(decode).not.toHaveBeenCalled();
    });

    it('rejects a file above 30 MB, without decoding it', async () => {
      const error = await errorOf(
        processor().process(file('image/jpeg', PHOTO_MAX_FILE_BYTES + 1)),
      );
      expect(error).toBeInstanceOf(PhotoError);
      expect((error as PhotoError).message).toBe(PHOTO_TOO_LARGE_ERROR);
      expect(decode).not.toHaveBeenCalled();
    });

    it('says the image could not be read when the browser cannot decode it (HEIC, damaged file)', async () => {
      decode.mockRejectedValue(new DOMException('The source image could not be decoded.'));
      const error = await errorOf(processor().process(file('image/heic')));
      expect(error).toBeInstanceOf(PhotoError);
      expect((error as PhotoError).message).toBe(PHOTO_UNREADABLE_ERROR);
      expect(canvases).toEqual([]);
    });

    it('says the image could not be read when the browser has no decoder', async () => {
      vi.stubGlobal('createImageBitmap', undefined);
      const error = await errorOf(processor().process(file()));
      expect((error as PhotoError).message).toBe(PHOTO_UNREADABLE_ERROR);
    });

    it('says the image could not be read when it cannot be exported, and still frees the photo', async () => {
      exportFails = true;
      const error = await errorOf(processor().process(file()));
      expect(error).toBeInstanceOf(PhotoError);
      expect((error as PhotoError).message).toBe(PHOTO_UNREADABLE_ERROR);
      expect(bitmap.close).toHaveBeenCalledTimes(1);
    });
  });
});
