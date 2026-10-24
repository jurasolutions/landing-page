import { describe, expect, it } from "vitest";
import { moveDown, moveItem, moveUp } from "./order.js";

const files = ["a", "b", "c", "d"];

describe("Move up and Move down", () => {
  it("swap a file with its neighbour", () => {
    expect(moveUp(files, 2)).toEqual(["a", "c", "b", "d"]);
    expect(moveDown(files, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("leave the order alone at the top and bottom of the list", () => {
    expect(moveUp(files, 0)).toEqual(files);
    expect(moveDown(files, 3)).toEqual(files);
  });

  it("never change the list they were given", () => {
    const before = [...files];
    moveUp(files, 3);
    moveDown(files, 0);
    moveItem(files, 0, 3);
    expect(files).toEqual(before);
  });
});

describe("dragging a file to a new place", () => {
  it("puts the dragged file where it was dropped, down or up the list", () => {
    expect(moveItem(files, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(files, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(files, 1, 3)).toEqual(["a", "c", "d", "b"]);
  });

  it("does nothing when dropped where it started or outside the list", () => {
    expect(moveItem(files, 1, 1)).toEqual(files);
    expect(moveItem(files, 1, 9)).toEqual(files);
    expect(moveItem(files, -1, 2)).toEqual(files);
  });
});
