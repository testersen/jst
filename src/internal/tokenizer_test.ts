import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";

import {
  createState,
  type LiteralMode,
  Mode,
  trackCharacter,
} from "./tokenizer.ts";
import {
  LocationSnapshot,
  LocationTracker,
  type RangeWithLocation,
} from "./common.ts";

async function assertRange(
  t: Deno.TestContext,
  title: string,
  actual: RangeWithLocation,
  expected: {
    start?: number;
    end?: number;
    length?: number;
    startLocation?: { line?: number; column?: number };
    endLocation?: { line?: number; column?: number };
  },
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
