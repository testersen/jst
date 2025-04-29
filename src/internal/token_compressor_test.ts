import { assertStrictEquals } from "@std/assert";
import { compressTokens, TokenCompressorStream } from "./token_compressor.ts";
import { tokenize } from "./tokenizer.ts";
import { type Token, TokenType } from "./common.ts";

async function assertToken(
  t: Deno.TestContext,
  actual: Token,
  expected: {
    type?: TokenType;
    value?: string;
    start?: number;
    end?: number;
  },
) {
  if (expected.type !== undefined) {
    await t.step(`should have type ${TokenType[expected.type]}`, () => {
      assertStrictEquals(
        actual.type,
        expected.type,
        `expected ${TokenType[expected.type!]}, got ${TokenType[actual.type]}`,
      );
    });
  }

  if (expected.value !== undefined) {
    await t.step(`should have value ${expected.value}`, () => {
      assertStrictEquals(actual.value, expected.value);
    });
  }

  if (expected.start !== undefined) {
    await t.step(`should have start offset ${expected.start}`, () => {
      assertStrictEquals(actual.range.start, expected.start);
    });
  }

  if (expected.end !== undefined) {
    await t.step(`should have end offset ${expected.end}`, () => {
      assertStrictEquals(actual.range.end, expected.end);
    });
  }
}

Deno.test("compressTokens(tokens)", async (t) => {
  const result = compressTokens(
    tokenize("foo\\bar\\baz{}\\{monday{tuesday}}{foo}{bar}"),
  );

  await t.step("result should have 6 tokens", () => {
    assertStrictEquals(result.length, 6);
  });

  await t.step("token 0", async (t) => {
    await assertToken(t, result[0], {
      type: TokenType.Literal,
      value: "foo\\bar\\baz",
      start: 0,
      end: 11,
    });
  });

  await t.step("token 1", async (t) => {
    await assertToken(t, result[1], {
      type: TokenType.Literal,
      value: "{monday",
      start: 14,
      end: 21,
    });
  });

  await t.step("token 2", async (t) => {
    await assertToken(t, result[2], {
      type: TokenType.Interpolation,
      value: "tuesday",
      start: 22,
      end: 29,
    });
  });

  await t.step("token 3", async (t) => {
    await assertToken(t, result[3], {
      type: TokenType.Literal,
      value: "}",
      start: 30,
      end: 31,
    });
  });

  await t.step("token 4", async (t) => {
    await assertToken(t, result[4], {
      type: TokenType.Interpolation,
      value: "foo",
      start: 32,
      end: 35,
    });
  });

  await t.step("token 5", async (t) => {
    await assertToken(t, result[5], {
      type: TokenType.Interpolation,
      value: "bar",
      start: 37,
      end: 40,
    });
  });
});
