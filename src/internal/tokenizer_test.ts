import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";

import { createState, type LiteralMode, Mode } from "./tokenizer.ts";
import { LocationSnapshot, LocationTracker } from "./common.ts";

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
