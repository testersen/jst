export {
  Location,
  Range,
  RangeWithLocation,
  Token,
  TokenType,
} from "./internal/common.ts";

export { tokenize, TokenizerStream } from "./internal/tokenizer.ts";
export {
  compressTokens,
  TokenCompressorStream,
} from "./internal/token_compressor.ts";
