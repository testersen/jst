import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";

import {
  type AnyMode,
  createState,
  type EscapeMode,
  flushBuffer,
  flushRange,
  flushState,
  type InterpolationMode,
  type LiteralMode,
  Mode,
  processCharacter,
  processEscapeCharacter,
  processInterpolationCharacter,
  processLiteralCharacter,
  type State,
  tokenizeChunk,
  trackCharacter,
  transitionFromEscapeToLiteralMode,
  transitionFromInterpolationToLiteralMode,
  transitionFromLiteralToEscapeMode,
  transitionFromLiteralToInterpolationMode,
} from "./tokenizer.ts";
import {
  LocationSnapshot,
  LocationTracker,
  type RangeWithLocation,
  type Token,
  TokenType,
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

/**
 * A utility function to sanitize a string value for testing.
 *
 * @param value The string to sanitize.
 * @returns The sanitized string.
 */
function sanitize(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

/**
 * {@link ProcessingStep} is an interface that defines a sequence of characters
 * to be processed - and what assertions to make on the resulting state, and
 * produced tokens.
 */
interface ProcessingStep {
  /**
   * The string to be processed.
   */
  value: string;

  expectedBufferAfterProcessing?: string | null;
  expectedRangeAfterProcessing?: ExpectedRange;
  expectedModeAfterProcessing?: Mode;

  /**
   * The expected amount of tokens produced by after the processing step. This
   * does not include the tokens produced by previous steps.
   */
  expectedTokenLength?: number;

  /**
   * The expected
   */
  expectedLastToken?: {
    type?: TokenType;
    value?: string;
  };
}

/**
 * A utility function to process a sequence of characters and assert the
 * resulting state and produced tokens.
 *
 * @param t The test context.
 * @param state The state to be processed.
 * @param steps The steps to be processed.
 */
async function process(
  t: Deno.TestContext,
  state: State,
  steps: ProcessingStep[],
) {
  const allTokens: Token[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    await t.step(`${i + 1} - process ${sanitize(s.value)}`, async (t) => {
      const tokens: Token[] = [];
      for (const char of s.value) {
        processCharacter(state, char, tokens);
      }
      allTokens.push(...tokens);

      if (s.expectedBufferAfterProcessing !== undefined) {
        switch (s.expectedBufferAfterProcessing) {
          case null:
            await t.step("buffer should be undefined", () => {
              assertStrictEquals(
                (state as AnyMode).buffer,
                undefined,
                "Buffer should be undefined",
              );
            });
            break;
          default: {
            const sanitizedExpectedBuffer = sanitize(
              s.expectedBufferAfterProcessing,
            );
            await t.step(
              `buffer should be '${sanitizedExpectedBuffer}'`,
              () =>
                assertStrictEquals(
                  (state as AnyMode).buffer,
                  s.expectedBufferAfterProcessing,
                  `Buffer should be ${sanitizedExpectedBuffer}`,
                ),
            );
            break;
          }
        }
      }

      if (s.expectedModeAfterProcessing !== undefined) {
        const expectedMode = Mode[s.expectedModeAfterProcessing];
        await t.step(`state type should be ${expectedMode}`, () => {
          assertStrictEquals(
            state.type,
            s.expectedModeAfterProcessing,
            `State should be in ${expectedMode} mode, but was ${
              Mode[state.type]
            }`,
          );
        });
      }

      if (s.expectedRangeAfterProcessing !== undefined) {
        await assertRange(
          t,
          "range should match expected range",
          state.locationTracker.complete(state.locationSnapshot),
          s.expectedRangeAfterProcessing,
        );
      }

      if (s.expectedTokenLength !== undefined) {
        await t.step(
          `should have produced ${s.expectedTokenLength} tokens`,
          () =>
            assertStrictEquals(
              tokens.length,
              s.expectedTokenLength,
            ),
        );
      }

      if (
        s.expectedLastToken?.type !== undefined ||
        s.expectedLastToken?.value !== undefined
      ) {
        const lastToken = tokens[tokens.length - 1];

        await t.step("last token should exist", () => {
          assertExists(lastToken, "Last token should exist");
        });

        if (s.expectedLastToken.type !== undefined) {
          const expectedType = s.expectedLastToken.type;
          await t.step(
            `last token type should be ${TokenType[expectedType]}`,
            () =>
              assertStrictEquals(
                lastToken.type,
                expectedType,
                `Last token type should be ${TokenType[expectedType]}`,
              ),
          );
        }

        if (s.expectedLastToken.value !== undefined) {
          const expectedValue = s.expectedLastToken.value;
          const sanitizedExpectedValue = sanitize(expectedValue);
          await t.step(
            `last token value should be '${sanitizedExpectedValue}'`,
            () =>
              assertStrictEquals(
                lastToken.value,
                expectedValue,
                `Last token value should be '${sanitizedExpectedValue}'`,
              ),
          );
        }
      }
    });
  }
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

Deno.test("flushBuffer(state, tokens, type)", async (t) => {
  await t.step("empty buffer does not add tokens", async (t) => {
    const state = createState() as LiteralMode;

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

    const tokens: Token[] = [];

    flushBuffer(state, tokens, TokenType.Literal);

    await t.step(
      "no tokens were added",
      () => assertStrictEquals(tokens.length, 0, "token array should be empty"),
    );

    await assertRange(
      t,
      "state still has default cursor position",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 0,
        length: 0,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );
  });

  await t.step("interpolation token is added from flush buffer", async (t) => {
    const VALUE = "foobar";

    const locationTracker = new LocationTracker();
    const state = {
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      type: Mode.Interpolation,
      buffer: "",
      n: 1,
    } satisfies InterpolationMode;

    state.buffer = VALUE;

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

    const tokens: Token[] = [];

    flushBuffer(state, tokens, TokenType.Interpolation);

    await t.step(
      "tokens array should have 1 token",
      () => assertStrictEquals(tokens.length, 1, "token length should be 1"),
    );

    const token = tokens[0];

    await t.step("token type should be Interpolation", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Interpolation,
        `Expected token type to be Interpolation, but was ${
          TokenType[token.type]
        }`,
      );
    });

    await t.step(`token value should be ${VALUE}`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, VALUE);
    });

    // We haven't moved the cursor using state.locationTracker
    // so we still expect the start and end to be 0
    await assertRange(
      t,
      "state still has default cursor position",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 0,
        length: 0,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );
  });

  await t.step("literal token is added from flush buffer", async (t) => {
    const VALUE = "foobar";

    const state = createState() as LiteralMode;

    state.buffer = VALUE;

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

    const tokens: Token[] = [];

    flushBuffer(state, tokens, TokenType.Literal);

    await t.step(
      "tokens array should have 1 token",
      () => assertStrictEquals(tokens.length, 1, "token length should be 1"),
    );

    const token = tokens[0];

    await t.step("token type should be Literal", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Literal,
        `Expected token type to be Literal, but was ${TokenType[token.type]}`,
      );
    });

    await t.step(`token value should be ${VALUE}`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, VALUE);
    });

    // We haven't moved the cursor using state.locationTracker
    // so we still expect the start and end to be 0
    await assertRange(
      t,
      "state still has default cursor position",
      state.locationTracker.complete(state.locationSnapshot),
      {
        start: 0,
        end: 0,
        length: 0,
        startLocation: { line: 1, column: 0 },
        endLocation: { line: 1, column: 0 },
      },
    );
  });

  await t.step(
    "flushBuffer() attaches correct location range to token",
    async (t) => {
      const FLUSHES: {
        value: string;
        expectedRange: ExpectedRange;
      }[] = [
        {
          value: "foobar",
          expectedRange: {
            start: 0,
            end: 6,
            length: 6,
            startLocation: { line: 1, column: 0 },
            endLocation: { line: 1, column: 6 },
          },
        },
        {
          value: "foo\r\nbar",
          expectedRange: {
            start: 6,
            end: 14,
            length: 8,
            startLocation: { line: 1, column: 6 },
            endLocation: { line: 2, column: 3 },
          },
        },
        {
          value: "\r\r\r\n\r\r\r",
          expectedRange: {
            start: 14,
            end: 21,
            length: 7,
            startLocation: { line: 2, column: 3 },
            endLocation: { line: 3, column: 0 },
          },
        },
        {
          value: "\n\n\n",
          expectedRange: {
            start: 21,
            end: 24,
            length: 3,
            startLocation: { line: 3, column: 0 },
            endLocation: { line: 6, column: 0 },
          },
        },
        {
          value: "\\hello",
          expectedRange: {
            start: 24,
            end: 30,
            length: 6,
            startLocation: { line: 6, column: 0 },
            endLocation: { line: 6, column: 6 },
          },
        },
      ];

      const state = createState() as LiteralMode;
      const tokens: Token[] = [];

      for (let i = 0; i < FLUSHES.length; i++) {
        const { value, expectedRange } = FLUSHES[i];

        state.buffer += value;
        for (const char of value) {
          trackCharacter(state, char);
        }

        flushBuffer(state, tokens, TokenType.Literal);

        await t.step(`flush buffer case ${i}`, async (t) => {
          assertStrictEquals(
            tokens.length,
            i + 1,
            `tokens length should be ${i + 1}`,
          );

          const token = tokens[i];

          await t.step("token type should be Literal", () => {
            assertExists(
              token,
              "Token should have been added by flushBuffer(), but wasn't",
            );

            assertStrictEquals(
              token.type,
              TokenType.Literal,
              `Expected token type to be Literal, but was ${
                TokenType[token.type]
              }`,
            );
          });

          await t.step(
            `token value should be ${
              value.replaceAll("\n", "\\n").replaceAll("\r", "\\r")
            }`,
            () => {
              assertExists(
                token.value,
                "Token should have been added by flushBuffer(), but wasn't",
              );

              assertStrictEquals(token.value, value);
            },
          );

          await assertRange(
            t,
            "token range should match expected range",
            token.range,
            expectedRange,
          );
        });
      }
    },
  );
});

Deno.test("transitionFromLiteralToEscapeMode(state, tokens)", async (t) => {
  await t.step("changes state to escape mode", async (t) => {
    const state = createState() as LiteralMode;

    await t.step("state is in literal mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is empty string before transition", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be empty");
    });

    transitionFromLiteralToEscapeMode(state, []);

    const castedState = state as unknown as EscapeMode;

    await t.step("state is in escape mode", () => {
      assertStrictEquals(
        castedState.type,
        Mode.Escape,
        `State should be in Escape mode, but was ${Mode[castedState.type]}`,
      );
    });

    await t.step("state buffer is undefined after transition", () => {
      assertStrictEquals(state.buffer, undefined, "Buffer should not exist");
    });
  });

  await t.step("does not add tokens if buffer is empty", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    transitionFromLiteralToEscapeMode(state, tokens);

    await t.step(
      "state is in escape mode",
      () => assertStrictEquals(state.type, Mode.Escape),
    );

    await t.step(
      "tokens array should be empty",
      () => assertStrictEquals(tokens.length, 0, "token length should be 0"),
    );

    await t.step(
      "state buffer should be undefined",
      () =>
        assertStrictEquals(
          state.buffer,
          undefined,
          "Buffer should be undefined",
        ),
    );
  });

  await t.step("adds tokens if buffer is not empty", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    state.buffer = "foobar";

    transitionFromLiteralToEscapeMode(state, tokens);

    await t.step(
      "state is in escape mode",
      () => assertStrictEquals(state.type, Mode.Escape),
    );

    await t.step(
      "tokens array should have 1 token",
      () => assertStrictEquals(tokens.length, 1, "token length should be 1"),
    );

    const token = tokens[0];

    await t.step("token type should be Literal", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Literal,
        `Expected token type to be Literal, but was ${TokenType[token.type]}`,
      );
    });

    await t.step(`token value should be foobar`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "foobar");
    });
  });
});

Deno.test("transitionFromLiteralToInterpolationMode(state, tokens)", async (t) => {
  await t.step("changes state to interpolation mode", async (t) => {
    const state = createState() as LiteralMode;

    await t.step("state is in literal mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is empty string before transition", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be empty");
    });

    transitionFromLiteralToInterpolationMode(state, []);

    const castedState = state as unknown as InterpolationMode;

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        castedState.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${
          Mode[castedState.type]
        }`,
      );
    });

    await t.step("state buffer is an empty string after transition", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be an empty string");
    });
  });

  await t.step("does not add tokens if buffer is empty", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    transitionFromLiteralToInterpolationMode(state, tokens);

    await t.step(
      "state is in interpolation mode",
      () => assertStrictEquals(state.type, Mode.Interpolation),
    );

    await t.step(
      "tokens array should be empty",
      () => assertStrictEquals(tokens.length, 0, "token length should be 0"),
    );

    await t.step(
      "state buffer should be an empty string",
      () =>
        assertStrictEquals(
          state.buffer,
          "",
          "Buffer should be an empty string",
        ),
    );
  });

  await t.step("adds tokens if buffer is not empty", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    state.buffer = "foobar";

    transitionFromLiteralToInterpolationMode(state, tokens);

    await t.step(
      "state is in interpolation mode",
      () => assertStrictEquals(state.type, Mode.Interpolation),
    );

    await t.step(
      "tokens array should have 1 token",
      () => assertStrictEquals(tokens.length, 1, "token length should be 1"),
    );

    const token = tokens[0];

    await t.step("token type should be Literal", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Literal,
        `Expected token type to be Literal, but was ${TokenType[token.type]}`,
      );
    });

    await t.step(`token value should be foobar`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "foobar");
    });
  });
});

Deno.test("processLiteralCharacter(state, character, tokens)", async (t) => {
  await t.step("mutates buffer when not LF or {", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    await t.step("state buffer is empty string before transition", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be empty");
    });

    processLiteralCharacter(state, "a", tokens);

    await t.step("state buffer is a after transition", () => {
      assertStrictEquals(state.buffer, "a", "Buffer should be a");
    });

    processLiteralCharacter(state, "b", tokens);

    await t.step("state buffer is ab after transition", () => {
      assertStrictEquals(state.buffer, "ab", "Buffer should be ab");
    });

    processLiteralCharacter(state, "c", tokens);

    await t.step("state buffer is abc after transition", () => {
      assertStrictEquals(state.buffer, "abc", "Buffer should be abc");
    });
  });

  await t.step("switches to escape mode on \\", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    await t.step("mode is literal", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    // We have already tested the behavior of
    // `transitionFromLiteralToEscapeMode` which is called during the processing
    // of the escape character, so we won't test it here again.
    processLiteralCharacter(state, "\\", tokens);

    await t.step("state type is escape after transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Escape,
        `State should be in Escape mode, but was ${Mode[state.type]}`,
      );
    });
  });

  await t.step("switches to interpolation mode on {", async (t) => {
    const state = createState() as LiteralMode;
    const tokens: Token[] = [];

    await t.step("mode is literal", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    // We have already tested the behavior of
    // `transitionFromLiteralToInterpolationMode` which is called during the
    // processing of the escape character, so we won't test it here again.
    processLiteralCharacter(state, "{", tokens);

    await t.step("state type is interpolation after transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });
  });
});

Deno.test("transitionFromEscapeToLiteralMode(state)", async (t) => {
  await t.step("changes state to literal mode", async (t) => {
    const locationTracker = new LocationTracker();
    const state: EscapeMode = {
      type: Mode.Escape,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
    };

    await t.step("state is in escape mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Escape,
        `State should be in Escape mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is undefined before transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        undefined,
        "Buffer should not exist",
      );
    });

    transitionFromEscapeToLiteralMode(state);

    await t.step("state is in literal mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is empty string after transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        "",
        "Buffer should be an empty string",
      );
    });
  });
});

Deno.test("processEscapeCharacter(state, character, tokens)", async (t) => {
  await t.step("escapes \\", async (t) => {
    const locationTracker = new LocationTracker();
    const state: EscapeMode = {
      type: Mode.Escape,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
    };
    const tokens: Token[] = [];

    await t.step("state is in escape mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Escape,
        `State should be in Escape mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is undefined before transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        undefined,
        "Buffer should not exist",
      );
    });

    processEscapeCharacter(state, "\\", tokens);

    await t.step("state is in literal mode after transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is an empty string after transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        "",
        "Buffer should be an empty string",
      );
    });

    await t.step("tokens array should have 1 token", () => {
      assertStrictEquals(tokens.length, 1, "token length should be 1");
    });

    const token = tokens[0];

    await t.step("token type should be Literal", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Literal,
        `Expected token type to be Literal, but was ${TokenType[token.type]}`,
      );
    });

    await t.step("token value should be \\", () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "\\");
    });
  });

  await t.step("escapes {", async (t) => {
    const locationTracker = new LocationTracker();
    const state: EscapeMode = {
      type: Mode.Escape,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
    };
    const tokens: Token[] = [];

    await t.step("state is in escape mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Escape,
        `State should be in Escape mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is undefined before transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        undefined,
        "Buffer should not exist",
      );
    });

    processEscapeCharacter(state, "{", tokens);

    await t.step("state is in literal mode after transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is an empty string after transition", () => {
      assertStrictEquals(
        (state as AnyMode).buffer,
        "",
        "Buffer should be an empty string",
      );
    });

    await t.step("tokens array should have 1 token", () => {
      assertStrictEquals(tokens.length, 1, "token length should be 1");
    });

    const token = tokens[0];

    await t.step("token type should be Literal", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Literal,
        `Expected token type to be Literal, but was ${TokenType[token.type]}`,
      );
    });

    await t.step("token value should be {", () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "{");
    });
  });

  for (const char of "abc123&%#\n\r") {
    const representation = char
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r");

    await t.step(`does not escape ${representation}`, async (t) => {
      const locationTracker = new LocationTracker();
      const state: EscapeMode = {
        type: Mode.Escape,
        locationTracker,
        locationSnapshot: locationTracker.snapshot(),
      };
      const tokens: Token[] = [];

      await t.step("state is in escape mode", () => {
        assertStrictEquals(
          state.type,
          Mode.Escape,
          `State should be in Escape mode, but was ${Mode[state.type]}`,
        );
      });

      await t.step("state buffer is undefined before transition", () => {
        assertStrictEquals(
          (state as AnyMode).buffer,
          undefined,
          "Buffer should not exist",
        );
      });

      processEscapeCharacter(state, char, tokens);

      await t.step("state is in literal mode after transition", () => {
        assertStrictEquals(
          state.type,
          Mode.Literal,
          `State should be in Literal mode, but was ${Mode[state.type]}`,
        );
      });

      await t.step("state buffer is an empty string after transition", () => {
        assertStrictEquals(
          (state as AnyMode).buffer,
          "",
          "Buffer should be an empty string",
        );
      });

      await t.step("tokens array should have 1 token", () => {
        assertStrictEquals(tokens.length, 1, "token length should be 1");
      });

      const token = tokens[0];

      await t.step("token type should be Literal", () => {
        assertExists(
          token,
          "Token should have been added by flushBuffer(), but wasn't",
        );

        assertStrictEquals(
          token.type,
          TokenType.Literal,
          `Expected token type to be Literal, but was ${TokenType[token.type]}`,
        );
      });

      await t.step(`token value should be \\${char}`, () => {
        assertExists(
          token.value,
          "Token should have been added by flushBuffer(), but wasn't",
        );

        assertStrictEquals(token.value, `\\${char}`);
      });
    });
  }
});

Deno.test("transitionFromInterpolationToLiteralMode(state, token)", async (t) => {
  await t.step("changes state to literal mode", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "",
    };

    await t.step("state is in interpolation mode before transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state n should be a number before transition", () => {
      assertStrictEquals(typeof state.n, "number", "n should be a number");
    });

    const tokens: Token[] = [];

    transitionFromInterpolationToLiteralMode(state, tokens);

    await t.step("state is in literal mode after transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is an empty string after transition", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be an empty string");
    });

    await t.step("state n should be undefined after transition", () => {
      assertStrictEquals(state.n, undefined, "n should be undefined");
    });
  });

  await t.step("empty buffer does not add token", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "",
    };

    await t.step("state is in interpolation mode before transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    const tokens: Token[] = [];

    transitionFromInterpolationToLiteralMode(state, tokens);

    await t.step(
      "tokens array should be empty",
      () => assertStrictEquals(tokens.length, 0, "token length should be 0"),
    );
  });

  await t.step("adds token if buffer is not empty", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "foobar",
    };

    await t.step("state is in interpolation mode before transition", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    const tokens: Token[] = [];

    transitionFromInterpolationToLiteralMode(state, tokens);

    await t.step("tokens array should have 1 token", () => {
      assertStrictEquals(tokens.length, 1, "token length should be 1");
    });

    const token = tokens[0];

    await t.step("token type should be Interpolation", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Interpolation,
        `Expected token type to be Interpolation, but was ${
          TokenType[token.type]
        }`,
      );
    });

    await t.step(`token value should be foobar`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "foobar");
    });
  });
});

Deno.test("processInterpolationCharacter(state, character, tokens)", async (t) => {
  await t.step("increments n when {", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state n is 1 before processing", () => {
      assertStrictEquals(state.n, 1, "n should be 1");
    });

    await t.step("state buffer is empty string before processing", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be empty");
    });

    processInterpolationCharacter(state, "{", tokens);

    await t.step("state n is 2 after processing", () => {
      assertStrictEquals(state.n, 2, "n should be 2");
    });

    await t.step("buffer is { after processing", () => {
      assertStrictEquals(state.buffer, "{", "Buffer should be {");
    });

    processInterpolationCharacter(state, "{", tokens);

    await t.step("state n is 3 after processing another {", () => {
      assertStrictEquals(state.n, 3, "n should be 3");
    });

    await t.step("buffer is {{ after processing another {", () => {
      assertStrictEquals(state.buffer, "{{", "Buffer should be {{");
    });
  });

  await t.step("decrements n when }", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 5,
      buffer: "{{{{",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state n is 5 before processing", () => {
      assertStrictEquals(state.n, 5, "n should be 5");
    });

    await t.step("state buffer is {{{{ before processing", () => {
      assertStrictEquals(state.buffer, "{{{{", "Buffer should be {{{{");
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("state n is 4 after processing", () => {
      assertStrictEquals(state.n, 4, "n should be 4");
    });

    await t.step("buffer is {{{{} after processing", () => {
      assertStrictEquals(state.buffer, "{{{{}", "Buffer should be {{{{}");
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("state n is 3 after processing another }", () => {
      assertStrictEquals(state.n, 3, "n should be 3");
    });

    await t.step("buffer is {{{{}} after processing", () => {
      assertStrictEquals(state.buffer, "{{{{}}", "Buffer should be {{{{}}");
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("state n is 2 after processing another }", () => {
      assertStrictEquals(state.n, 2, "n should be 2");
    });

    await t.step("buffer is {{{{}}} after processing", () => {
      assertStrictEquals(state.buffer, "{{{{}}}", "Buffer should be {{{{}}}");
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("state n is 1 after processing another }", () => {
      assertStrictEquals(state.n, 1, "n should be 1");
    });

    await t.step("buffer is {{{{}}}} after processing", () => {
      assertStrictEquals(state.buffer, "{{{{}}}}", "Buffer should be {{{{}}}}");
    });
  });

  await t.step("switches to literal mode on } when n = 1", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "{{{{}}}}",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state n is 1 before processing", () => {
      assertStrictEquals(state.n, 1, "n should be 1");
    });

    await t.step("state buffer is {{{{}}}} before processing", () => {
      assertStrictEquals(
        state.buffer,
        "{{{{}}}}",
        "Buffer should be {{{{}}}}",
      );
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("state is in literal mode after processing", () => {
      assertStrictEquals(
        state.type,
        Mode.Literal,
        `State should be in Literal mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is an empty string after processing", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be an empty string");
    });
  });

  await t.step("empty interpolation buffer does not add tokens", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is empty string before processing", () => {
      assertStrictEquals(state.buffer, "", "Buffer should be empty");
    });

    // We have already tested the behavior where n = 1 and
    // mode is switched to literal mode, so we will not add
    // further assertions for that here.
    processInterpolationCharacter(state, "}", tokens);

    await t.step(
      "tokens array should be empty",
      () => assertStrictEquals(tokens.length, 0, "token length should be 0"),
    );
  });

  await t.step("adds token if buffer is not empty", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "foobar",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state buffer is foobar before processing", () => {
      assertStrictEquals(state.buffer, "foobar", "Buffer should be foobar");
    });

    processInterpolationCharacter(state, "}", tokens);

    await t.step("tokens array should have 1 token", () => {
      assertStrictEquals(tokens.length, 1, "token length should be 1");
    });

    const token = tokens[0];

    await t.step("token type should be Interpolation", () => {
      assertExists(
        token,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(
        token.type,
        TokenType.Interpolation,
        `Expected token type to be Interpolation, but was ${
          TokenType[token.type]
        }`,
      );
    });

    await t.step(`token value should be foobar`, () => {
      assertExists(
        token.value,
        "Token should have been added by flushBuffer(), but wasn't",
      );

      assertStrictEquals(token.value, "foobar");
    });
  });

  await t.step(
    // See note in processInterpolationCharacter about }
    "interpolation decrements n when }, even in valid scenarios",
    async (t) => {
      const locationTracker = new LocationTracker();
      const state: InterpolationMode = {
        type: Mode.Interpolation,
        locationTracker,
        locationSnapshot: locationTracker.snapshot(),
        n: 1,
        buffer: "'",
      };
      const tokens: Token[] = [];

      await t.step("state is in interpolation mode", () => {
        assertStrictEquals(
          state.type,
          Mode.Interpolation,
          `State should be in Interpolation mode, but was ${Mode[state.type]}`,
        );
      });

      await t.step("state n is 1 before processing", () => {
        assertStrictEquals(state.n, 1, "n should be 1");
      });

      await t.step('state buffer is "\'" before processing', () => {
        assertStrictEquals(
          state.buffer,
          "'",
          'Buffer should be "\'"',
        );
      });

      processInterpolationCharacter(state, "}", tokens);

      await t.step("state is in literal mode after processing", () => {
        assertStrictEquals(
          state.type,
          Mode.Literal,
          `State should be in Literal mode, but was ${Mode[state.type]}`,
        );
      });

      await t.step("state buffer is an empty string after processing", () => {
        assertStrictEquals(
          state.buffer,
          "",
          "Buffer should be an empty string",
        );
      });

      await t.step("state n should be undefined after processing", () => {
        assertStrictEquals(state.n, undefined, "n should be undefined");
      });

      await t.step("tokens array should have 1 token", () => {
        assertStrictEquals(tokens.length, 1, "token length should be 1");
      });

      const token = tokens[0];

      await t.step("token type should be Interpolation", () => {
        assertExists(
          token,
          "Token should have been added by flushBuffer(), but wasn't",
        );

        assertStrictEquals(
          token.type,
          TokenType.Interpolation,
          `Expected token type to be Interpolation, but was ${
            TokenType[token.type]
          }`,
        );
      });

      await t.step(`token value should be '`, () => {
        assertExists(
          token.value,
          "Token should have been added by flushBuffer(), but wasn't",
        );

        assertStrictEquals(token.value, "'");
      });
    },
  );

  await t.step("only adds to buffer when not {}", async (t) => {
    const locationTracker = new LocationTracker();
    const state: InterpolationMode = {
      type: Mode.Interpolation,
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      n: 1,
      buffer: "",
    };
    const tokens: Token[] = [];

    await t.step("state is in interpolation mode", () => {
      assertStrictEquals(
        state.type,
        Mode.Interpolation,
        `State should be in Interpolation mode, but was ${Mode[state.type]}`,
      );
    });

    await t.step("state n is 1 before processing", () => {
      assertStrictEquals(state.n, 1, "n should be 1");
    });

    processInterpolationCharacter(state, "h", tokens);

    await t.step("tokens is empty", () => {
      assertStrictEquals(tokens.length, 0);
    });

    await t.step("buffer is h", () => {
      assertStrictEquals(state.buffer, "h");
    });
  });
});

Deno.test("processCharacter(state, character, tokens)", async (t) => {
  await t.step("tracks characters", async (t) => {
    await process(t, createState(), [
      {
        value: "Hello world",
        expectedBufferAfterProcessing: "Hello world",
        expectedRangeAfterProcessing: {
          start: 0,
          end: 11,
          length: 11,
          endLocation: {
            line: 1,
            column: 11,
          },
        },
      },
      {
        value: "\n",
        expectedBufferAfterProcessing: "Hello world\n",
        expectedRangeAfterProcessing: {
          start: 0,
          end: 12,
          length: 12,
          endLocation: {
            line: 2,
            column: 0,
          },
        },
      },
      {
        value: "\r",
        expectedBufferAfterProcessing: "Hello world\n\r",
        expectedRangeAfterProcessing: {
          start: 0,
          end: 13,
          length: 13,
          endLocation: {
            line: 2,
            column: 0,
          },
        },
      },
      {
        value: "foo",
        expectedBufferAfterProcessing: "Hello world\n\rfoo",
        expectedRangeAfterProcessing: {
          start: 0,
          end: 16,
          length: 16,
          endLocation: {
            line: 2,
            column: 3,
          },
        },
      },
    ]);
  });

  await t.step("changes to escape mode on \\", async (t) => {
    await t.step("prepends \\ when not {", async (t) => {
      await process(t, createState(), [
        {
          value: "\\",
          expectedBufferAfterProcessing: null,
          expectedTokenLength: 0,
          expectedModeAfterProcessing: Mode.Escape,
          expectedRangeAfterProcessing: {
            start: 0,
            end: 1,
            length: 1,
            endLocation: {
              line: 1,
              column: 1,
            },
          },
        },
        {
          value: " ",
          expectedBufferAfterProcessing: "",
          expectedTokenLength: 1,
          expectedModeAfterProcessing: Mode.Literal,
          expectedLastToken: {
            type: TokenType.Literal,
            value: "\\ ",
          },
        },
      ]);
    });

    await t.step("does not prepend \\ when {", async (t) => {
      await process(t, createState(), [
        {
          value: "\\",
          expectedBufferAfterProcessing: null,
          expectedTokenLength: 0,
          expectedModeAfterProcessing: Mode.Escape,
          expectedRangeAfterProcessing: {
            start: 0,
            end: 1,
            length: 1,
            endLocation: {
              line: 1,
              column: 1,
            },
          },
        },
        {
          value: "{",
          expectedBufferAfterProcessing: "",
          expectedTokenLength: 1,
          expectedModeAfterProcessing: Mode.Literal,
          expectedLastToken: {
            type: TokenType.Literal,
            value: "{",
          },
        },
      ]);
    });

    await t.step("flushes previous buffers if any", async (t) => {
      await process(t, createState(), [
        {
          value: "Hello, World!",
          expectedBufferAfterProcessing: "Hello, World!",
          expectedTokenLength: 0,
          expectedRangeAfterProcessing: {
            start: 0,
            end: 13,
            length: 13,
            startLocation: {
              line: 1,
              column: 0,
            },
            endLocation: {
              line: 1,
              column: 13,
            },
          },
        },
        {
          value: "\\",
          expectedBufferAfterProcessing: null,
          expectedTokenLength: 1,
          expectedModeAfterProcessing: Mode.Escape,
          expectedRangeAfterProcessing: {
            start: 13,
            end: 14,
            length: 1,
            endLocation: {
              line: 1,
              column: 14,
            },
          },
          expectedLastToken: {
            type: TokenType.Literal,
            value: "Hello, World!",
          },
        },
      ]);
    });
  });

  await t.step("changes to interpolation mode on {", async (t) => {
    await t.step("with no tokens when empty literal buffer", async (t) => {
      await process(t, createState(), [
        {
          value: "{",
          expectedBufferAfterProcessing: "",
          expectedTokenLength: 0,
          expectedModeAfterProcessing: Mode.Interpolation,
          expectedRangeAfterProcessing: {
            start: 0,
            end: 1,
            length: 1,
            startLocation: {
              line: 1,
              column: 0,
            },
            endLocation: {
              line: 1,
              column: 1,
            },
          },
        },
      ]);
    });

    await t.step("flushes buffer if any", async (t) => {
      await process(t, createState(), [
        {
          value: "Hello, World!",
          expectedBufferAfterProcessing: "Hello, World!",
          expectedTokenLength: 0,
          expectedModeAfterProcessing: Mode.Literal,
          expectedRangeAfterProcessing: {
            start: 0,
            end: 13,
            length: 13,
            startLocation: {
              line: 1,
              column: 0,
            },
            endLocation: {
              line: 1,
              column: 13,
            },
          },
        },
        {
          value: "{",
          expectedBufferAfterProcessing: "",
          expectedTokenLength: 1,
          expectedModeAfterProcessing: Mode.Interpolation,
          expectedRangeAfterProcessing: {
            start: 13,
            end: 14,
            length: 1,
            startLocation: {
              line: 1,
              column: 13,
            },
            endLocation: {
              line: 1,
              column: 14,
            },
          },
        },
      ]);
    });

    await t.step("changes back to literal mode on }", async (t) => {
      await t.step("ignores empty interpolation buffers", async (t) => {
        const locationTracker = new LocationTracker();
        const state: InterpolationMode = {
          type: Mode.Interpolation,
          locationTracker,
          locationSnapshot: locationTracker.snapshot(),
          n: 1,
          buffer: "",
        };
        await process(t, state, [
          {
            value: "}",
            expectedBufferAfterProcessing: "",
            expectedTokenLength: 0,
            expectedModeAfterProcessing: Mode.Literal,
            expectedRangeAfterProcessing: {
              start: 0,
              end: 1,
              length: 1,
              startLocation: {
                line: 1,
                column: 0,
              },
              endLocation: {
                line: 1,
                column: 1,
              },
            },
          },
        ]);
      });

      await t.step("adds interpolation token", async (t) => {
        const locationTracker = new LocationTracker();
        locationTracker.column(3);
        const state: InterpolationMode = {
          type: Mode.Interpolation,
          locationTracker,
          locationSnapshot: locationTracker.snapshot(),
          n: 1,
          buffer: "foo",
        };
        await process(t, state, [
          {
            value: "}",
            expectedBufferAfterProcessing: "",
            expectedTokenLength: 1,
            expectedModeAfterProcessing: Mode.Literal,
            expectedLastToken: {
              type: TokenType.Interpolation,
              value: "foo",
            },
            expectedRangeAfterProcessing: {
              start: 3,
              end: 4,
              length: 1,
              startLocation: {
                line: 1,
                column: 3,
              },
              endLocation: {
                line: 1,
                column: 4,
              },
            },
          },
        ]);
      });
    });
  });
});

Deno.test("flushState(state, tokens)", async (t) => {
  await t.step("throws on escape mode", () => {
    const locationTracker = new LocationTracker();
    const state = {
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      type: Mode.Escape,
    } as EscapeMode;

    assertThrows(
      () => flushState(state, []),
      Error,
      "Unexpected end of input in escape mode. Did you forget to escape a character?",
    );
  });

  await t.step("throws on interpolation mode", () => {
    const locationTracker = new LocationTracker();
    const state = {
      locationTracker,
      locationSnapshot: locationTracker.snapshot(),
      type: Mode.Interpolation,
      n: 1,
      buffer: "",
    } as InterpolationMode;

    assertThrows(
      () => flushState(state, []),
      Error,
      "Unexpected end of input in interpolation mode. Did you forget to close a brace?",
    );
  });

  await t.step("handles literal mode", async (t) => {
    await t.step("does not produce token on empty buffer", async (t) => {
      const locationTracker = new LocationTracker();
      const state = {
        locationTracker,
        locationSnapshot: locationTracker.snapshot(),
        type: Mode.Literal,
        buffer: "",
      } as LiteralMode;
      const tokens: Token[] = [];

      await t.step("flushState should return undefined", () => {
        assertStrictEquals(flushState(state, tokens), undefined);
      });

      await t.step("tokens array should be empty", () => {
        assertStrictEquals(tokens.length, 0);
      });
    });

    await t.step("produces token on non-empty buffer", async (t) => {
      const locationTracker = new LocationTracker();
      const state = {
        locationTracker,
        locationSnapshot: locationTracker.snapshot(),
        type: Mode.Literal,
        buffer: "foobar",
      } as LiteralMode;
      const tokens: Token[] = [];
      let token!: Token;

      await t.step("flushState should return a token", () => {
        assertExists(token = flushState(state, tokens)!);
      });

      await t.step("tokens array should not be empty", () => {
        assertStrictEquals(tokens.length, 1);
      });

      await t.step(
        "returned token and first token in array should be the same",
        () => assertStrictEquals(token, tokens[0]),
      );

      await t.step("token type is literal", () => {
        assertStrictEquals(
          token.type,
          TokenType.Literal,
          `expected Literal, but received ${TokenType[token.type]}`,
        );
      });

      await t.step("token value is foobar", () => {
        assertStrictEquals(token.value, "foobar");
      });
    });
  });
});

Deno.test("tokenizeChunk(state, chunk)", async (t) => {
  const state = createState();

  const tokens = tokenizeChunk(state, "Hello\\{{world}\\foobar");

  await t.step("tokens array length should be 4", () => {
    assertStrictEquals(tokens.length, 4);
  });

  await t.step("token 1/4 should be Literal with text Hello", () => {
    assertStrictEquals(
      tokens[0].type,
      TokenType.Literal,
      `expected Literal, received ${TokenType[tokens[0].type]}`,
    );
    assertStrictEquals(tokens[0].value, "Hello");
  });

  await t.step("token 2/4 should be Literal with text {", () => {
    assertStrictEquals(
      tokens[1].type,
      TokenType.Literal,
      `expected Literal, received ${TokenType[tokens[0].type]}`,
    );
    assertStrictEquals(tokens[1].value, "{");
  });

  await t.step("token 3/4 should be Interpolation with text world", () => {
    assertStrictEquals(
      tokens[2].type,
      TokenType.Interpolation,
      `expected Interpolation, received ${TokenType[tokens[2].type]}`,
    );
    assertStrictEquals(tokens[2].value, "world");
  });

  await t.step("token 4/4 should be Literal with text \\f", () => {
    assertStrictEquals(
      tokens[3].type,
      TokenType.Literal,
      `expected Literal, received ${TokenType[tokens[3].type]}`,
    );
    assertStrictEquals(tokens[3].value, "\\f");
  });

  await t.step("state should be in literal mode", () => {
    assertStrictEquals(
      state.type,
      Mode.Literal,
      `expected Literal, received ${Mode[state.type]}`,
    );
  });

  await t.step("state buffer should be oobar", () => {
    assertStrictEquals(
      (state as AnyMode).buffer,
      "oobar",
    );
  });
});
