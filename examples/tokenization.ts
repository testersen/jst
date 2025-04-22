import { tokenize, TokenType } from "../src/tokenizer.ts";

console.log(
  tokenize("Hello \\{world} How are you, {firstName{}}?").map((token) =>
    `<Token ${TokenType[token.type]} "${token.value}">`
  ),
);
