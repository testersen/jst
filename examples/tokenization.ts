import { compressTokens, tokenize, TokenType } from "../src/tokenizer.ts";

console.log(
  compressTokens(tokenize("Hello \\{world} How are you, {firstName{}}?"))
    .map((token) => `<Token ${TokenType[token.type]} "${token.value}">`)
    .join("\n"),
);
