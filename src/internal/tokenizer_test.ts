import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertNotStrictEquals,
} from "@std/assert";

import {
  createState,
  flushRange,
  type LiteralMode,
  Mode,
  trackCharacter,
} from "./tokenizer.ts";
import {
  LocationSnapshot,
  LocationTracker,
  type RangeWithLocation,
} from "./common.ts";

/**
 * The {@link ExpectedRange} interface lets the caller define the expected
 * properties of a {@link RangeWithLocation} object.
 */
interface ExpectedRange {
    start?: number;
    end?: number;
    length?: number;
    startLocation?: { line?: number; column?: number };
    endLocation?: { line?: number; column?: number };
}

/**
 * A utility function to assert that a range has expected values.
 *
 * @param t The test context.
 * @param title The title of the test.
 * @param actual The actual range to assert.
 * @param expected The expected values for the range.
 */
async function assertRange(
  t: Deno.TestContext,
  title: string,
  actual: RangeWithLocation,
  expected: ExpectedRange,
) {
  await t.step(title, async (t) => {
    const {
      start,
      end,
      length,
      startLocation: { line: startLine, column: startColumn },
      endLocation: { line: endLine, column: endColumn },
    } = actual;

    const {
      start: START,
      end: END,
      length: LENGTH,
      startLocation,
      endLocation,
    } = expected;

    const { line: START_LINE, column: START_COLUMN } = startLocation || {};
    const { line: END_LINE, column: END_COLUMN } = endLocation || {};

    if (START !== undefined) {
      await t.step(
        `start offset should be ${START}`,
        () => assertEquals(start, START, `Start offset should be ${START}`),
      );
    }

    if (END !== undefined) {
      await t.step(
        `end offset should be ${END}`,
        () => assertEquals(end, END, `End offset should be ${END}`),
      );
    }

    if (LENGTH !== undefined) {
      await t.step(
        `length should be ${LENGTH}`,
        () => assertEquals(length, LENGTH, `Length should be ${LENGTH}`),
      );
    }

    if (START_LINE !== undefined) {
      await t.step(
        `start line should be ${START_LINE}`,
        () =>
          assertEquals(
            startLine,
            START_LINE,
            `Start line should be ${START_LINE}`,
          ),
      );
    }

    if (START_COLUMN !== undefined) {
      await t.step(
        `start column should be ${START_COLUMN}`,
        () =>
          assertEquals(
            startColumn,
            START_COLUMN,
            `Start column should be ${START_COLUMN}`,
          ),
      );
    }

    if (END_LINE !== undefined) {
      await t.step(
        `end line should be ${END_LINE}`,
        () => assertEquals(endLine, END_LINE, `End line should be ${END_LINE}`),
      );
    }

    if (END_COLUMN !== undefined) {
      await t.step(
        `end column should be ${END_COLUMN}`,
        () =>
          assertEquals(
            endColumn,
            END_COLUMN,
            `End column should be ${END_COLUMN}`,
          ),
      );
    }
  });
}

Deno.test("createState()", async (t) => {
  await t.step("created state is in literal mode", () => {
    const state = createState();

    assertEquals(state.type, Mode.Literal);
  });

  await t.step("created state has empty buffer", () => {
    const state = createState();

    assertEquals((state as LiteralMode).buffer, "");
  });

  await t.step("created state has location tracker", () => {
    const state = createState();

    assertExists(state.locationTracker, "Location tracker should exist");
    assertInstanceOf(
      state.locationTracker,
      LocationTracker,
      "Location tracker should be an instance of LocationTracker",
    );
  });

  await t.step("created state has location snapshot", () => {
    const state = createState();

    assertExists(state.locationSnapshot, "Location snapshot should exist");
    assertInstanceOf(
      state.locationSnapshot,
      LocationSnapshot,
      "Location snapshot should be an instance of LocationSnapshot",
    );
  });

  await t.step(
    "created state's location snapshot has offset 0, line 1, column 0",
    () => {
      const state = createState();

      const { start, startLocation: { column, line } } = state.locationTracker
        .complete(state.locationSnapshot);

      assertEquals(start, 0, "Start offset should be 0");
      assertEquals(line, 1, "Start line should be 1");
      assertEquals(column, 0, "Start column should be 0");
    },
  );
});

Deno.test("trackCharacter(state, character)", async (t) => {
  await t.step("updates location tracker by 1 line on LF", async (t) => {
    const state = createState();

    await assertRange(
      t,
      "tracker has offset 0, line 1, column 0",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 0,
        length: 0,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );

    trackCharacter(state, "\n");

    await assertRange(
      t,
      "tracker has end offset 1, line 2, column 0",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 1,
        length: 1,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 2, column: 0 },
      },
    );
  });

  await t.step("updates location tracker offset by 1 on CR", async (t) => {
    const state = createState();

    await assertRange(
      t,
      "tracker has offset 0, line 1, column 0",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 0,
        length: 0,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );

    trackCharacter(state, "\r");

    await assertRange(
      t,
      "tracker has end offset 1, line 1, column 0",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 1,
        length: 1,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );
  });

  await t.step(
    "updates location tracker by 1 column on other chars",
    async (t) => {
      const state = createState();

      await assertRange(
        t,
        "tracker has offset 0, line 1, column 0",
        state.locationTracker.complete(state.locationSnapshot),
        {
          start: 0,
          end: 0,
          length: 0,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 1, column: 0 },
        },
      );

      trackCharacter(state, "a");

      await assertRange(
        t,
        "tracker has end offset 1, line 1, column 1",
        state.locationTracker.complete(state.locationSnapshot),
        {
          start: 0,
          end: 1,
          length: 1,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 1, column: 1 },
        },
      );
    },
  );

  await t.step(
    "updates location tracker by big string",
    async (t) => {
      const state = createState();

      await assertRange(
        t,
        "tracker has offset 0, line 1, column 0",
        state.locationTracker.complete(state.locationSnapshot),
        {
          start: 0,
          end: 0,
          length: 0,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 1, column: 0 },
        },
      );

      for (const char of "Hello\r\nWorld How \nAre yo\nu?") {
        trackCharacter(state, char);
      }

      await assertRange(
        t,
        "tracker has end offset 27, line 4, column 2",
        state.locationTracker.complete(state.locationSnapshot),
        {
          start: 0,
          end: 27,
          length: 27,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 4, column: 2 },
        },
      );
    },
  );
});

Deno.test("flushRange(state)", async (t) => {
  await t.step(
    "returns range with location and replaces previous snapshot",
    async (t) => {
      const state = createState();

      await assertRange(
        t,
        "state has default cursor position",
        state.locationTracker.complete(state.locationSnapshot),
        {
          start: 0,
          end: 0,
          length: 0,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 1, column: 0 },
        },
      );

      for (const char of "hello world") {
        trackCharacter(state, char);
      }

      const snapshot1 = state.locationSnapshot;
      const range1 = flushRange(state);
      const snapshot2 = state.locationSnapshot;

      assertNotStrictEquals(
        snapshot1,
        snapshot2,
        "Snapshots should be different",
      );

      await assertRange(
        t,
        "Range1 has end offset 11, line 1, column 11",
        range1,
        {
          start: 0,
          end: 11,
          length: 11,
          startLocation: { line: 1, column: 0 },
          endLocation: { line: 1, column: 11 },
        },
      );

      for (const char of "foo\r\nbar") {
        trackCharacter(state, char);
      }

      const range2 = flushRange(state);
      const snapshot3 = state.locationSnapshot;

      assertNotStrictEquals(
        snapshot2,
        snapshot3,
        "Snapshots should be different",
      );
      assertNotStrictEquals(
        snapshot1,
        snapshot3,
        "Snapshots should be different",
      );

      await assertRange(
        t,
        "Range2 has end offset 19, line 2, column 3",
        range2,
        {
          start: 11,
          end: 19,
          length: 8,
          startLocation: { line: 1, column: 11 },
          endLocation: { line: 2, column: 3 },
        },
      );
    },
  );
});
