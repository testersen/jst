import { TokenType } from "../src/internal/common.ts";
import { tokenize } from "../src/internal/tokenizer.ts";

console.log(
  tokenize("Hello \\{world} How are you, {firstName{}}?").map((token) =>
    `<Token ${TokenType[token.type]} "${token.value}">`
  ),
);
