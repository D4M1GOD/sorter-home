/**
 * The rules of adding several photos at once (one item per photo) that do not need the browser:
 * the limit of photos, and the texts of the progress and of the summary.
 */

/** The most photos one batch creates. If more are chosen, the first ones are used. */
export const PHOTO_BATCH_MAX = 20;

/** The reason shown when the store does not accept an item whose photo was already saved. */
export const BATCH_ITEM_ERROR = "Couldn't add the item.";

/** A file of the batch that did not become an item, and why (a text written for the user). */
export interface BatchFailure {
  fileName: string;
  reason: string;
}

/** What a batch did. `chosen` is the number of files it tried (never more than the maximum). */
export interface BatchOutcome {
  added: number;
  chosen: number;
  /** How many of the files the user picked were left out for being over the maximum. */
  ignored: number;
  failures: readonly BatchFailure[];
}

/** The files of the batch and how many were left out. The first files are the ones used. */
export function limitBatchFiles<T>(files: readonly T[]): { used: T[]; ignored: number } {
  return {
    used: files.slice(0, PHOTO_BATCH_MAX),
    ignored: Math.max(0, files.length - PHOTO_BATCH_MAX),
  };
}

/** "1 photo", "9 photos": the number with the singular or the plural word. */
function photos(count: number): string {
  return `${count} photo${count === 1 ? '' : 's'}`;
}

/** The text shown while the photos are prepared, for example "Preparing photo 3 of 9…". */
export function batchProgressText(current: number, total: number): string {
  return `Preparing photo ${current} of ${total}…`;
}

/**
 * The message shown when the batch ends:
 * - all went well: "Added 9 photos.";
 * - some failed: "Added 7 of 9 photos. 2 failed." (the files are listed apart, see `BatchFailure`);
 * - some were over the maximum: "The other 7 were not added: the maximum is 20 photos at a time."
 */
export function batchSummary(outcome: BatchOutcome): string {
  const parts: string[] = [];
  if (outcome.failures.length === 0) {
    parts.push(`Added ${photos(outcome.added)}.`);
  } else {
    parts.push(
      `Added ${outcome.added} of ${photos(outcome.chosen)}. ${outcome.failures.length} failed.`,
    );
  }
  if (outcome.ignored > 0) {
    const others = outcome.ignored === 1 ? 'The other photo was' : `The other ${outcome.ignored} were`;
    parts.push(`${others} not added: the maximum is ${photos(PHOTO_BATCH_MAX)} at a time.`);
  }
  return parts.join(' ');
}

/** One line of the list of failed files: "IMG_0123.jpg: This file is not an image." */
export function batchFailureText(failure: BatchFailure): string {
  return `${failure.fileName}: ${failure.reason}`;
}
