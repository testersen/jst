import { assertEquals, assertStrictEquals, assertThrows } from "@std/assert";

import {
  Location,
  LocationSnapshot,
  LocationTracker,
  Range,
  RangeWithLocation,
  Token,
  TokenType,
} from "./common.ts";

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

  await t.step("handles zero-length ranges correctly", () => {
    const START = 5;
    const END = 5;
    const RESULT = 0;

    const range = new Range(START, END);

    assertEquals(range.length, RESULT);
  });

  await t.step("throws for negative start", () => {
    const START = -1;
    const END = 5;

    assertThrows(
      () => new Range(START, END),
      Error,
      "Start offset must be greater than or equal to 0",
    );
  });

  await t.step("throws for end < start", () => {
    const START = 5;
    const END = 1;

    assertThrows(
      () => new Range(START, END),
      Error,
      "End offset must be greater than or equal to start",
    );
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

  await t.step("throws for line < 1", () => {
    const LINE = 0;
    const COLUMN = 1;

    assertThrows(
      () => new Location(LINE, COLUMN),
      Error,
      "Line number must be greater than or equal to 1",
    );
  });

  await t.step("throws for negative column", () => {
    const LINE = 1;
    const COLUMN = -1;

    assertThrows(
      () => new Location(LINE, COLUMN),
      Error,
      "Column number must be greater than or equal to 0",
    );
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
    const RANGE_START = 76;
    const RANGE_END = 211;
    const RANGE_LENGTH = 135;
    const START_LINE = 6;
    const START_COLUMN = 33;
    const END_LINE = 15;
    const END_COLUMN = 5;

    const tracker = new LocationTracker();

    tracker.column(10);
    tracker.line(2);
    tracker.column(5);
    tracker.offset(3);
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
    tracker.offset(1);
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

  await t.step("throws for negative column increments", () => {
    const tracker = new LocationTracker();

    assertThrows(
      () => tracker.column(-1),
      Error,
      "Column increment must be non-negative",
    );
  });

  await t.step("throws for negative line increments", () => {
    const tracker = new LocationTracker();

    assertThrows(
      () => tracker.line(-1),
      Error,
      "Line increment must be non-negative",
    );
  });

  await t.step("throws for negative offset increments", () => {
    const tracker = new LocationTracker();

    assertThrows(
      () => tracker.offset(-1),
      Error,
      "Offset increment must be non-negative",
    );
  });
});

Deno.test("Token", async (t) => {
  await t.step("getters return the same given values", async (t) => {
    const TYPE = TokenType.Literal;
    const VALUE = "value";
    const START = 0;
    const END = 5;
    const LENGTH = 5;
    const START_LINE = 1;
    const START_COLUMN = 0;
    const END_LINE = 1;
    const END_COLUMN = 5;
    const RANGE = new RangeWithLocation(
      START,
      END,
      new Location(START_LINE, START_COLUMN),
      new Location(END_LINE, END_COLUMN),
    );

    const token = new Token(TYPE, VALUE, RANGE);

    await t.step(
      `token.type is ${TYPE}`,
      () => assertEquals(token.type, TYPE),
    );

    await t.step(
      `token.value is ${VALUE}`,
      () => assertEquals(token.value, VALUE),
    );

    await t.step(
      `token.range.start is ${START}`,
      () => assertEquals(token.range.start, START),
    );

    await t.step(
      `token.range.end is ${END}`,
      () => assertEquals(token.range.end, END),
    );

    await t.step(
      `token.range.length is ${LENGTH}`,
      () => assertEquals(token.range.length, LENGTH),
    );

    await t.step(
      `token.range.startLocation.line is ${START_LINE}`,
      () => assertEquals(token.range.startLocation.line, START_LINE),
    );

    await t.step(
      `token.range.startLocation.column is ${START_COLUMN}`,
      () => assertEquals(token.range.startLocation.column, START_COLUMN),
    );

    await t.step(
      `token.range.endLocation.line is ${END_LINE}`,
      () => assertEquals(token.range.endLocation.line, END_LINE),
    );

    await t.step(
      `token.range.endLocation.column is ${END_COLUMN}`,
      () => assertEquals(token.range.endLocation.column, END_COLUMN),
    );
  });

  await t.step("concat(other)", async (t) => {
    await t.step("throws for different types", () => {
      // the offsets and locations doesn't really matter for this test.
      const token1 = new Token(
        TokenType.Literal,
        "foo",
        new RangeWithLocation(0, 0, new Location(1, 0), new Location(1, 0)),
      );
      const token2 = new Token(
        TokenType.Interpolation,
        "bar",
        new RangeWithLocation(0, 0, new Location(1, 0), new Location(1, 0)),
      );

      assertThrows(
        () => token1.concat(token2),
        Error,
        "Cannot concatenate tokens of different types",
      );
    });
  });

  await t.step("throws for non-adjacent tokens", () => {
    // the offsets and locations doesn't really matter for this test.
    const token1 = new Token(
      TokenType.Literal,
      "foo",
      new RangeWithLocation(0, 0, new Location(1, 0), new Location(1, 0)),
    );
    const token2 = new Token(
      TokenType.Literal,
      "bar",
      new RangeWithLocation(1, 1, new Location(1, 0), new Location(1, 0)),
    );

    assertThrows(
      () => token1.concat(token2),
      Error,
      "Cannot concatenate tokens that are not adjacent",
    );
  });

  await t.step("concatenates adjacent tokens", () => {
    const token1 = new Token(
      TokenType.Literal,
      "foo",
      new RangeWithLocation(0, 3, new Location(1, 0), new Location(1, 3)),
    );
    const token2 = new Token(
      TokenType.Literal,
      "bar",
      new RangeWithLocation(3, 6, new Location(1, 3), new Location(1, 6)),
    );

    const result = token1.concat(token2);

    assertEquals(result.type, TokenType.Literal);
    assertEquals(result.value, "foobar");
    assertEquals(result.range.start, 0);
    assertEquals(result.range.end, 6);
    assertEquals(result.range.startLocation.line, 1);
    assertEquals(result.range.startLocation.column, 0);
    assertEquals(result.range.endLocation.line, 1);
    assertEquals(result.range.endLocation.column, 6);
  });

  await t.step("toString() returns a debug friendly representation", () => {
    // the offsets and locations doesn't really matter for this test.
    const token1 = new Token(
      TokenType.Literal,
      "foo",
      new RangeWithLocation(0, 0, new Location(1, 0), new Location(1, 0)),
    );

    assertStrictEquals(
      token1.toString(),
      `Token(type=Literal, value="foo")`,
    );
  });
});
