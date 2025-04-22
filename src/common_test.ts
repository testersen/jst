import { assertEquals } from "@std/assert";

import {
  Location,
  LocationSnapshot,
  LocationTracker,
  Range,
  RangeWithLocation,
} from "../src/common.ts";

Deno.test("Range", async (t) => {
  await t.step("getters return the same given values", () => {
    const START = 1;
    const END = 5;

    const range = new Range(START, END);

    assertEquals(range.start, START);
    assertEquals(range.end, END);
  });

  await t.step("length is the difference between start and end", () => {
    const START = 1;
    const END = 5;
    const RESULT = 4;

    const range = new Range(START, END);

    assertEquals(range.length, RESULT);
  });
});

Deno.test("Location", async (t) => {
  await t.step("getters return the same given values", () => {
    const LINE = 1;
    const COLUMN = 5;

    const location = new Location(LINE, COLUMN);

    assertEquals(location.line, LINE);
    assertEquals(location.column, COLUMN);
  });
});

Deno.test("RangeWithLocation", async (t) => {
  await t.step("getters return the same given values", () => {
    const START = 1;
    const END = 5;
    const START_LINE = 1;
    const START_COLUMN = 1;
    const END_LINE = 1;
    const END_COLUMN = 5;

    const rangeWithLocation = new RangeWithLocation(
      START,
      END,
      new Location(START_LINE, START_COLUMN),
      new Location(END_LINE, END_COLUMN),
    );

    assertEquals(rangeWithLocation.start, START);
    assertEquals(rangeWithLocation.end, END);
    assertEquals(rangeWithLocation.startLocation.line, START_LINE);
    assertEquals(rangeWithLocation.startLocation.column, START_COLUMN);
    assertEquals(rangeWithLocation.endLocation.line, END_LINE);
    assertEquals(rangeWithLocation.endLocation.column, END_COLUMN);
  });
});

Deno.test("LocationSnapshot", async (t) => {
  await t.step("complete() returns the correct values", async (t) => {
    const OFFSET_1 = 0;
    const LINE_1 = 1;
    const COLUMN_1 = 1;

    const OFFSET_2 = 5;
    const LINE_2 = 2;
    const COLUMN_2 = 5;

    const LENGTH = 5;

    const locationSnapshot1 = new LocationSnapshot(
      OFFSET_1,
      LINE_1,
      COLUMN_1,
    );

    const locationSnapshot2 = new LocationSnapshot(
      OFFSET_2,
      LINE_2,
      COLUMN_2,
    );

    const rangeWithLocation = locationSnapshot1.complete(locationSnapshot2);

    await t.step(
      `rangeWithLocation.start is ${OFFSET_1}`,
      () => assertEquals(rangeWithLocation.start, OFFSET_1),
    );

    await t.step(
      `rangeWithLocation.end is ${OFFSET_2}`,
      () => assertEquals(rangeWithLocation.end, OFFSET_2),
    );

    await t.step(
      `rangeWithLocation.length is ${LENGTH}`,
      () => assertEquals(rangeWithLocation.length, LENGTH),
    );

    await t.step(
      `rangeWithLocation.startLocation.line is ${LINE_1}`,
      () => assertEquals(rangeWithLocation.startLocation.line, LINE_1),
    );

    await t.step(
      `rangeWithLocation.startLocation.column is ${COLUMN_1}`,
      () => assertEquals(rangeWithLocation.startLocation.column, COLUMN_1),
    );

    await t.step(
      `rangeWithLocation.endLocation.line is ${LINE_2}`,
      () => assertEquals(rangeWithLocation.endLocation.line, LINE_2),
    );

    await t.step(
      `rangeWithLocation.endLocation.column is ${COLUMN_2}`,
      () => assertEquals(rangeWithLocation.endLocation.column, COLUMN_2),
    );
  });
});

Deno.test("LocationTracker", async (t) => {
  await t.step("tracks offsets and locations correctly", async (t) => {
    const RANGE_START = 73;
    const RANGE_END = 207;
    const RANGE_LENGTH = 134;
    const START_LINE = 6;
    const START_COLUMN = 33;
    const END_LINE = 15;
    const END_COLUMN = 5;

    const tracker = new LocationTracker();

    tracker.column(10);
    tracker.line(2);
    tracker.column(5);
    tracker.column(20);
    tracker.line(3);
    tracker.column(31);
    tracker.column(2);

    const snapshot = tracker.snapshot();

    tracker.column(30);
    tracker.line(4);
    tracker.column(40);
    tracker.column(50);
    tracker.line(5);
    tracker.column(2);
    tracker.column(3);

    const range = tracker.complete(snapshot);

    await t.step(
      `range.start is ${RANGE_START}`,
      () => assertEquals(range.start, RANGE_START),
    );

    await t.step(
      `range.end is ${RANGE_END}`,
      () => assertEquals(range.end, RANGE_END),
    );

    await t.step(
      `range.length is ${RANGE_LENGTH}`,
      () => assertEquals(range.length, RANGE_LENGTH),
    );

    await t.step(
      `range.startLocation.line is ${START_LINE}`,
      () => assertEquals(range.startLocation.line, START_LINE),
    );

    await t.step(
      `range.startLocation.column is ${START_COLUMN}`,
      () => assertEquals(range.startLocation.column, START_COLUMN),
    );

    await t.step(
      `range.endLocation.line is ${END_LINE}`,
      () => assertEquals(range.endLocation.line, END_LINE),
    );

    await t.step(
      `range.endLocation.column is ${END_COLUMN}`,
      () => assertEquals(range.endLocation.column, END_COLUMN),
    );
  });
});
