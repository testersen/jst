import { TokenType } from "../src/common.ts";
import { tokenize } from "../src/tokenizer.ts";

console.log(
  tokenize("Hello \\{world} How are you, {firstName{}}?").map((token) =>
    `<Token ${TokenType[token.type]} "${token.value}">`
  ),
);
