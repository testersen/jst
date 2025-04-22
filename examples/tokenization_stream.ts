import { TokenType } from "../src/common.ts";
import { TokenizerStream } from "../src/tokenizer.ts";

const chunks = [
  "Hell",
  "o \\{wo",
  "rl",
  "d} How are yo",
  "u, {f",
  "irstN",
  "ame{}",
  "}",
];

const stream = new TokenizerStream();

const writer = stream.writable.getWriter();

for (const chunk of chunks) {
  await writer.write(chunk);
}

await writer.close();

for await (const token of stream.readable) {
  console.log(
    `<Token ${TokenType[token.type]} "${token.value}">`,
  );
}
