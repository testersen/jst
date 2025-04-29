/**
 * The token compressor is responsible for combining multiple consecutive tokens
 * into a single token if the token type supports it.
 *
 * @packageDocumentation
 */

import { type Token, TokenType } from "./common.ts";

/**
 * The state of the token compressor.
 *
 * @internal
 */
export interface State {
  /**
   * The last token that was handed to the compressor.
   */
  lastToken?: Token;
}

/**
 * Flush the state of the compressor.
 * @param state The state of the compressor.
 * @returns An array of flushed tokens.
 *
 * @internal
 */
export function flushState(state: State): Token[] {
  if (state.lastToken) {
    const lastToken = state.lastToken;
    state.lastToken = undefined;
    return [lastToken];
  } else {
    return [];
  }
}

/**
 * Process a single token.
 * @param state The state of the compressor.
 * @param nextToken The next token to process.
 * @returns An array of produced tokens.
 *
 * @internal
 */
export function processToken(state: State, nextToken: Token): Token[] {
  const producedTokens: Token[] = [];

  if (
    state.lastToken && (state.lastToken.type !== nextToken.type ||
      state.lastToken.range.end !== nextToken.range.start)
  ) {
    // The two tokens are different types, so we need to flush the state.
    // We don't want to return, because there is a chance that the next token is
    // eligible for compression.
    producedTokens.push(...flushState(state));
  }

  // Between the previous check and the next check, the state.lastToken could
  // have been set to undefined.

  if (
    state.lastToken && state.lastToken.type === nextToken.type &&
    state.lastToken.range.end === nextToken.range.start
  ) {
    // If the last token and the next token are of the same type, we can assume
    // that they are eligible for compression, because lastToken will never be
    // assigned for a token that is not eligible for compression.
    state.lastToken = state.lastToken.concat(nextToken);
    // Now we want to return the produced tokens, because we have consumed the
    // next token.
    return producedTokens;
  }

  // Now we can assume that state.lastToken is undefined, because we have either
  // flushed it, or returned early because we could compress the next token.

  switch (nextToken.type) {
    // The list of token types that are eligible for compression.
    case TokenType.Literal:
      // Because the token is eligible for compression, we will set the
      // state.lastToken to the next token without adding it to the produced
      // tokens.
      state.lastToken = nextToken;
      break;
    default:
      // We can't compress the nextToken, so we will just return it.
      producedTokens.push(nextToken);
      break;
  }

  return producedTokens;
}

/**
 * Compress a list of tokens.
 * @param tokens The tokens to compress.
 * @returns The compressed tokens.
 */
export function compressTokens(tokens: Token[]): Token[] {
  const state: State = {};
  const output: Token[] = [];

  for (const token of tokens) {
    output.push(...processToken(state, token));
  }

  output.push(...flushState(state));

  return output;
}

/** */
export class TokenCompressorStreamTransformer
  implements Transformer<Token, Token> {
  /**
   * The state of the compressor.
   */
  #state: State = {};

  /**
   * Potentially turns multiple consecutive tokens into a single token.
   * @param chunk The chunk to process.
   * @param controller The controller to use to enqueue the processed tokens.
   */
  transform(
    chunk: Token,
    controller: TransformStreamDefaultController<Token>,
  ) {
    for (const token of processToken(this.#state, chunk)) {
      controller.enqueue(token);
    }
  }

  /**
   * Flushes the state of the compressor.
   * @param controller The controller to use to enqueue the processed tokens.
   */
  flush(controller: TransformStreamDefaultController<Token>) {
    for (const token of flushState(this.#state)) {
      controller.enqueue(token);
    }
  }
}

/**
 * The {@link TokenCompressorStream} class is used to turn multiple consecutive
 * tokens into a single token if the token type supports it.
 */
export class TokenCompressorStream extends TransformStream<Token, Token> {
  constructor() {
    super(new TokenCompressorStreamTransformer());
  }
}
