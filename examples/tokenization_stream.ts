import {
  type Token,
  TokenCompressorStream,
  TokenizerStream,
  TokenType,
} from "../src/tokenizer.ts";

const chunks = [
  "Hell",
  "o \\{wo",
  "rl",
  "d} How are yo",
  "u, {f",
  "irstN",
  "ame{}",
  "}?",
];

const stream = new TokenizerStream();

const tokenToStdoutPromise = stream.readable
  .pipeThrough(new TokenCompressorStream())
  .pipeThrough(
    new TransformStream<Token, string>({
      transform(token, controller) {
        controller.enqueue(
          `<Token ${TokenType[token.type]} "${token.value}">\n`,
        );
      },
    }),
  )
  .pipeThrough(new TextEncoderStream())
  .pipeTo(Deno.stdout.writable, { preventClose: true });

const writer = stream.writable.getWriter();

for (const chunk of chunks) {
  await writer.write(chunk);
}

await writer.close();

await tokenToStdoutPromise;
