/** Upload rules the page applies before anything is sent. */
export const MAX_FILES_CLIENT = 3;

export function fileMessage(reason, copy) {
  return (
    {
      heic: copy.heic,
      type: copy.badType,
      tooBig: copy.tooBig,
      unopenable: copy.unopenable,
    }[reason] ?? copy.unopenable
  );
}

/**
 * Each file's photo number, or null for a file that can't be sent. Only the
 * files that will be sent are counted, in order, so the number a file shows
 * in the list is the number the server's answer gives its photo (`image`).
 * A file still getting ready counts: the read waits for it.
 */
export function photoNumbers(files) {
  let n = 0;
  return files.map((file) => (file.status === "error" ? null : (n += 1)));
}
