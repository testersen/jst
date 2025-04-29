import { assertStrictEquals } from "@std/assert";
import { compressTokens, TokenCompressorStream } from "./token_compressor.ts";
import { tokenize } from "./tokenizer.ts";
import { type Token, TokenType } from "./common.ts";

type ExpectedToken = {
  type?: TokenType;
  value?: string;
  start?: number;
  end?: number;
};

async function assertToken(
  t: Deno.TestContext,
  actual: Token,
  expected: ExpectedToken,
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
  const tokens = compressTokens(
    tokenize("foo\\bar\\baz{}\\{monday{tuesday}}{foo}{bar}"),
  );

  await t.step("tokens array should have 6 tokens", () => {
    assertStrictEquals(tokens.length, 6);
  });

  const results: ExpectedToken[] = [
    {
      type: TokenType.Literal,
      value: "foo\\bar\\baz",
      start: 0,
      end: 11,
    },
    {
      type: TokenType.Literal,
      value: "{monday",
      start: 14,
      end: 21,
    },
    {
      type: TokenType.Interpolation,
      value: "tuesday",
      start: 22,
      end: 29,
    },
    {
      type: TokenType.Literal,
      value: "}",
      start: 30,
      end: 31,
    },
    {
      type: TokenType.Interpolation,
      value: "foo",
      start: 32,
      end: 35,
    },
    {
      type: TokenType.Interpolation,
      value: "bar",
      start: 37,
      end: 40,
    },
  ];

  for (let i = 0; i < results.length; i++) {
    await t.step(`token ${i}`, async () => {
      await assertToken(t, tokens[i], results[i]);
    });
  }
});
