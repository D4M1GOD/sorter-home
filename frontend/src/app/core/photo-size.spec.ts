import {
  PHOTO_FULL_LONG_SIDE,
  PHOTO_MAX_FILE_BYTES,
  PHOTO_NOT_IMAGE_ERROR,
  PHOTO_SAVE_ERROR,
  PHOTO_THUMBNAIL_LONG_SIDE,
  PHOTO_TOO_LARGE_ERROR,
  PHOTO_UNREADABLE_ERROR,
  photoFileProblem,
  scaledSize,
  usedPhotoIds,
} from './photo-size';

describe('photo sizes', () => {
  it('uses 320 px for the thumbnail and 1280 px for the full version', () => {
    expect(PHOTO_THUMBNAIL_LONG_SIDE).toBe(320);
    expect(PHOTO_FULL_LONG_SIDE).toBe(1280);
  });

  describe('scaledSize', () => {
    it('scales a landscape image so its width is the long side', () => {
      expect(scaledSize(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
      expect(scaledSize(4000, 3000, 320)).toEqual({ width: 320, height: 240 });
    });

    it('scales a portrait image so its height is the long side', () => {
      expect(scaledSize(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
    });

    it('scales a square image', () => {
      expect(scaledSize(2000, 2000, 320)).toEqual({ width: 320, height: 320 });
    });

    it('never enlarges a small image', () => {
      expect(scaledSize(200, 100, 320)).toEqual({ width: 200, height: 100 });
      expect(scaledSize(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
      expect(scaledSize(320, 320, 320)).toEqual({ width: 320, height: 320 });
    });

    it('gives whole numbers, rounded', () => {
      // 4032 x 3024 (a common phone photo) to 1280: 3024 * 1280 / 4032 = 960.
      expect(scaledSize(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
      // 1000 x 333 to 320: 333 * 0.32 = 106.56.
      expect(scaledSize(1000, 333, 320)).toEqual({ width: 320, height: 107 });
    });

    it('keeps at least 1 pixel on the short side of a very thin image', () => {
      expect(scaledSize(10000, 5, 320)).toEqual({ width: 320, height: 1 });
      expect(scaledSize(5, 10000, 320)).toEqual({ width: 1, height: 320 });
    });
  });

  describe('photoFileProblem', () => {
    it('accepts a file that says it is an image and is not too large', () => {
      expect(photoFileProblem({ type: 'image/jpeg', size: 3_000_000 })).toBeNull();
      expect(photoFileProblem({ type: 'image/png', size: 1 })).toBeNull();
      expect(photoFileProblem({ type: 'image/heic', size: 2_000_000 })).toBeNull();
      expect(photoFileProblem({ type: 'image/jpeg', size: PHOTO_MAX_FILE_BYTES })).toBeNull();
    });

    it('rejects a file that is not an image', () => {
      for (const type of ['application/pdf', 'text/plain', 'video/mp4', '']) {
        expect(photoFileProblem({ type, size: 1000 })).toBe(PHOTO_NOT_IMAGE_ERROR);
      }
    });

    it('rejects an image above 30 MB', () => {
      expect(PHOTO_MAX_FILE_BYTES).toBe(30 * 1024 * 1024);
      expect(photoFileProblem({ type: 'image/jpeg', size: PHOTO_MAX_FILE_BYTES + 1 })).toBe(
        PHOTO_TOO_LARGE_ERROR,
      );
    });

    it('says first that the file is not an image, when it is also too large', () => {
      expect(photoFileProblem({ type: 'video/mp4', size: PHOTO_MAX_FILE_BYTES * 2 })).toBe(
        PHOTO_NOT_IMAGE_ERROR,
      );
    });
  });

  it('has the texts of the errors', () => {
    expect(PHOTO_NOT_IMAGE_ERROR).toBe('This file is not an image.');
    expect(PHOTO_TOO_LARGE_ERROR).toBe('This photo is too large. The maximum is 30 MB.');
    expect(PHOTO_UNREADABLE_ERROR).toBe("Couldn't read this image. Try a JPEG or PNG photo.");
    expect(PHOTO_SAVE_ERROR).toBe("Couldn't save the photo.");
  });

  describe('usedPhotoIds', () => {
    const rooms = [
      {
        containers: [
          { items: [{ photoId: 'a' }, { photoId: null }] },
          { items: [{ photoId: 'b' }] },
        ],
      },
      { containers: [{ items: [{ photoId: 'c' }, { photoId: 'a' }] }, { items: [] }] },
    ];

    it('gives the photo ids of the items of all the rooms, without the items without photo', () => {
      expect([...usedPhotoIds(rooms)].sort()).toEqual(['a', 'b', 'c']);
    });

    it('is empty when there are no rooms or no item has a photo', () => {
      expect(usedPhotoIds([]).size).toBe(0);
      expect(usedPhotoIds([{ containers: [{ items: [{ photoId: null }] }] }]).size).toBe(0);
    });
  });
});
