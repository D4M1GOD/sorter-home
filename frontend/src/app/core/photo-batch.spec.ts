import {
  BATCH_ITEM_ERROR,
  batchFailureText,
  batchProgressText,
  batchSummary,
  limitBatchFiles,
  PHOTO_BATCH_MAX,
} from './photo-batch';

describe('photo batch', () => {
  /** A list of `count` file names, "photo-1.jpg", "photo-2.jpg"... */
  const names = (count: number) => Array.from({ length: count }, (_, i) => `photo-${i + 1}.jpg`);

  it('has a maximum of 20 photos', () => {
    expect(PHOTO_BATCH_MAX).toBe(20);
  });

  describe('limitBatchFiles', () => {
    it('uses all the files when there are 20 or fewer', () => {
      for (const count of [0, 1, 19, 20]) {
        const { used, ignored } = limitBatchFiles(names(count));
        expect(used).toEqual(names(count));
        expect(ignored).toBe(0);
      }
    });

    it('uses the first 20, in order, and counts the rest, when there are more', () => {
      expect(limitBatchFiles(names(21))).toEqual({ used: names(20), ignored: 1 });
      expect(limitBatchFiles(names(27))).toEqual({ used: names(20), ignored: 7 });
    });

    it('does not change the list it receives', () => {
      const files = names(25);
      limitBatchFiles(files);
      expect(files).toEqual(names(25));
    });
  });

  describe('batchProgressText', () => {
    it('says which photo is being prepared', () => {
      expect(batchProgressText(3, 9)).toBe('Preparing photo 3 of 9…');
      expect(batchProgressText(1, 1)).toBe('Preparing photo 1 of 1…');
      expect(batchProgressText(20, 20)).toBe('Preparing photo 20 of 20…');
    });
  });

  describe('batchSummary', () => {
    const failure = (fileName: string) => ({ fileName, reason: 'This file is not an image.' });

    it('says how many photos were added when all went well', () => {
      expect(batchSummary({ added: 9, chosen: 9, ignored: 0, failures: [] })).toBe('Added 9 photos.');
    });

    it('uses the singular for one photo', () => {
      expect(batchSummary({ added: 1, chosen: 1, ignored: 0, failures: [] })).toBe('Added 1 photo.');
    });

    it('says how many of the photos were added and how many failed', () => {
      expect(
        batchSummary({ added: 7, chosen: 9, ignored: 0, failures: [failure('a.pdf'), failure('b.txt')] }),
      ).toBe('Added 7 of 9 photos. 2 failed.');
    });

    it('says it when all failed, and uses the singular for one photo', () => {
      expect(
        batchSummary({ added: 0, chosen: 3, ignored: 0, failures: [failure('a'), failure('b'), failure('c')] }),
      ).toBe('Added 0 of 3 photos. 3 failed.');
      expect(batchSummary({ added: 0, chosen: 1, ignored: 0, failures: [failure('a')] })).toBe(
        'Added 0 of 1 photo. 1 failed.',
      );
    });

    it('says that the photos over the maximum were not added', () => {
      expect(batchSummary({ added: 20, chosen: 20, ignored: 7, failures: [] })).toBe(
        'Added 20 photos. The other 7 were not added: the maximum is 20 photos at a time.',
      );
      expect(batchSummary({ added: 20, chosen: 20, ignored: 1, failures: [] })).toBe(
        'Added 20 photos. The other photo was not added: the maximum is 20 photos at a time.',
      );
    });

    it('says both when some failed and some were over the maximum', () => {
      expect(
        batchSummary({ added: 19, chosen: 20, ignored: 3, failures: [failure('a.pdf')] }),
      ).toBe(
        'Added 19 of 20 photos. 1 failed. The other 3 were not added: the maximum is 20 photos at a time.',
      );
    });
  });

  describe('batchFailureText', () => {
    it('gives the name of the file and why it failed', () => {
      expect(batchFailureText({ fileName: 'IMG_0123.jpg', reason: 'This file is not an image.' })).toBe(
        'IMG_0123.jpg: This file is not an image.',
      );
    });
  });

  it('has the text for an item that the store does not accept', () => {
    expect(BATCH_ITEM_ERROR).toBe("Couldn't add the item.");
  });
});
