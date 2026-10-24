/**
 * The order of the files to merge. Dragging a file and pressing its "Move up"
 * or "Move down" button end in the same place: a new list, with the input
 * left as it was so React sees the change.
 */

/** Moves the item at `from` to `to`. Out-of-range positions change nothing. */
export function moveItem(list, from, to) {
  const inRange = (index) => Number.isInteger(index) && index >= 0 && index < list.length;
  if (!inRange(from) || !inRange(to) || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function moveUp(list, index) {
  return moveItem(list, index, index - 1);
}

export function moveDown(list, index) {
  return moveItem(list, index, index + 1);
}
