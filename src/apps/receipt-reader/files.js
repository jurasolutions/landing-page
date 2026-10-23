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
