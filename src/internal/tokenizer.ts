/**
 * The tokenizer is responsible for splitting the template into
 * different modes.
 *
 * The modes are:
 * - Literal: A string that is not escaped or interpolated.
 * - Escape: A string that is escaped with a backslash.
 * - Interpolation: A string that is interpolated with braces.
 *
 * @packageDocumentation
 */

import {
  type LocationSnapshot,
  LocationTracker,
  type RangeWithLocation,
  Token,
  TokenType,
} from "./common.ts";

/**
 * The {@link Mode} enum is used to identify the current mode that the tokenizer
 * is in.
 *
 * @internal
 */
export enum Mode {
  /**
   * The literal mode is the default mode. It is used to identify a string that
   * is not escaped or interpolated.
   *
   * This mode can break out of its context if it encounters a backslash (`\`)
   * or an interpolation (`{` and `}`).
   */
  Literal,

  /**
   * The escape mode is used to identify a string that is escaped with a
   * backslash (`\`).
   *
   * This mode is only used to prevent opening curly brackets (`{`) from being
   * interpreted as interpolation.
   *
   * If the escape mode encounters an opening curly bracket (`{`), it will
   * push the opening curly bracket into the previous literal mode (if any) and
   * return to the previous state.
   *
   * If the escape mode encounters any other character, it will push both the
   * backslash (`\`) and the character into the previous literal mode (if any)
   * and return to the previous state.
   */
  Escape,

  /**
   * The interpolation mode is used to identify a string that is interpolated
   * with braces (`{` and `}`).
   *
   * This mode will count the number of opening and closing curly brackets (`{`
   * and `}`) to determine the amount of braces needed to close the
   * interpolation. Once the interpolation is closed, it will push an
   * interpolation token (without the curly brackets). Then, return to a new
   * literal state.
   *
   * If the interpolation is unable to be close, it will error.
   */
  Interpolation,
}

/**
 * The {@link BaseMode} interface is used to type the state of the tokenizer
 * when it is in the base mode.
 *
 * @internal
 */
export interface BaseMode {
  /**
   * The current tokenization mode.
   */
  type: Mode;

  /**
   * The location tracker is used to track the location of the cursor during
   * tokenization.
   */
  locationTracker: LocationTracker;

  /**
   * The location snapshot is used to store the location of the cursor during
   * tokenization.
   */
  locationSnapshot: LocationSnapshot;
}

/**
 * The {@link LiteralMode} interface is used to type the state of the tokenizer
 * when it is in the literal mode.
 *
 * @internal
 */
interface LiteralMode extends BaseMode {
  /**
   * The literal type constant.
   */
  type: Mode.Literal;

  /**
   * The literal text in the template.
   */
  buffer: string;
}

/**
 * The {@link EscapeMode} interface is used to type the state of the tokenizer
 * when it is in the escape mode.
 *
 * @internal
 */
interface EscapeMode extends BaseMode {
  /**
   * The escape type constant.
   */
  type: Mode.Escape;
}

/**
 * The {@link InterpolationMode} interface is used to type the state of the
 * tokenizer when it is in the interpolation mode.
 *
 * @internal
 */
interface InterpolationMode extends BaseMode {
  /**
   * The interpolation type constant.
   */
  type: Mode.Interpolation;

  /**
   * The code in the interpolation.
   *
   * This code might be executed in a given context, so it
   * should be sanitized.
   */
  buffer: string;

  /**
   * The amount of braces needed to close the interpolation.
   */
  n: number;
}

/**
 * The {@link State} type is used to type the state of the tokenizer.
 *
 * @internal
 */
export type State = LiteralMode | EscapeMode | InterpolationMode;

/**
 * The {@link AnyMode} type is used to provide optional typing for the state of
 * the tokenizer during transitions of tokenizer modes.
 *
 * @internal
 */
export type AnyMode =
  & Partial<LiteralMode>
  & Partial<EscapeMode>
  & Partial<InterpolationMode>;

/**
 * The {@link createState} function is used to create a new state for the
 * tokenizer.
 *
 * @returns The initial state of the tokenizer.
 *
 * @internal
 */
export function createState(): State {
  const locationTracker = new LocationTracker();
  return {
    locationTracker,
    locationSnapshot: locationTracker.snapshot(),
    type: Mode.Literal,
    buffer: "",
  };
}

/**
 * The {@link trackCharacter} function is used track movements of the cursor
 * based on the character passed to it.
 *
 * @param state The current state of the tokenizer.
 * @param character The character to track.
 *
 * @internal
 */
export function trackCharacter(state: State, character: string): void {
  switch (character) {
    case "\n":
      state.locationTracker.line();
      break;
    case "\r":
      // \r is a carriage return, so we don't want to increment the column
      state.locationTracker.offset();
      break;
    default:
      state.locationTracker.column();
      break;
  }
}

/**
 * The {@link processCharacter} function is used to process a character in the
 * current state of the tokenizer. If any tokens are generated, they will be
 * pushed to the provided tokens array.
 *
 * @param state The current state of the tokenizer.
 * @param character The character to process.
 * @param tokens The tokens generated from the chunk.
 *
 * @internal
 */
export function processCharacter(
  state: State,
  character: string,
  tokens: Token[],
): void {
  trackCharacter(state, character);

  switch (state.type) {
    case Mode.Literal:
      processLiteralCharacter(state, character, tokens);
      break;
    case Mode.Escape:
      processEscapeCharacter(state, character, tokens);
      break;
    case Mode.Interpolation:
      processInterpolationCharacter(state, character, tokens);
      break;
  }
}

/**
 * The {@link flushRange} function is used to get a range from the last location
 * snapshot of the tokenizer, until the current location in the tracker. This
 * also resets the location snapshot to the current location.
 *
 * @param state The current state of the tokenizer.
 * @returns The range of the last location snapshot.
 */
export function flushRange(state: State): RangeWithLocation {
  const snapshot = state.locationTracker.snapshot();
  const range = state.locationSnapshot.complete(snapshot);
  state.locationSnapshot = snapshot;
  return range;
}

/**
 * The {@link flushBuffer} function is used to flush the current literal mode
 * of the tokenizer. This is used to generate any remaining tokens in the
 * literal mode.
 *
 * @param state The current state of the tokenizer.
 *
 * @internal
 */
export function flushBuffer(
  state: LiteralMode | InterpolationMode,
  tokens: Token[],
  type: TokenType,
): void {
  if (state.buffer.length > 0) {
    tokens.push(new Token(type, state.buffer, flushRange(state)));
    state.buffer = "";
  }
}

/**
 * The {@link transitionFromLiteralToEscapeMode} function is used to transition
 * from the literal mode to the escape mode.
 *
 * @param state The current state of the tokenizer.
 * @param tokens The tokens generated from the chunk.
 */
export function transitionFromLiteralToEscapeMode(
  state: LiteralMode,
  tokens: Token[],
) {
  flushBuffer(state, tokens, TokenType.Literal);

  const castedState = state as unknown as EscapeMode;
  castedState.type = Mode.Escape;

  (state as AnyMode).buffer = undefined;
}

/**
 * The {@link transitionFromLiteralToInterpolationMode} function is used to
 * transition from the literal mode to the interpolation mode.
 *
 * @param state The current state of the tokenizer.
 * @param tokens The tokens generated from the chunk.
 */
export function transitionFromLiteralToInterpolationMode(
  state: LiteralMode,
  tokens: Token[],
) {
  flushBuffer(state, tokens, TokenType.Literal);

  const castedState = state as unknown as InterpolationMode;
  castedState.type = Mode.Interpolation;
  castedState.n = 1;
  castedState.buffer = "";
}

/**
 * The {@link processLiteralCharacter} function is used to process a character
 * in the literal mode of the tokenizer. If any tokens are generated, they will
 * be pushed to the provided tokens array.
 *
 * @param state The current state of the tokenizer.
 * @param character The character to process.
 * @param tokens The tokens generated from the chunk.
 *
 * @internal
 */
export function processLiteralCharacter(
  state: LiteralMode,
  character: string,
  tokens: Token[],
): void {
  switch (character) {
    case "\\":
      transitionFromLiteralToEscapeMode(state, tokens);
      break;
    case "{":
      transitionFromLiteralToInterpolationMode(state, tokens);
      break;
    default:
      state.buffer += character;
      break;
  }
}

export function transitionFromEscapeToLiteralMode(
  state: EscapeMode,
): void {
  const castedState = state as unknown as LiteralMode;
  castedState.type = Mode.Literal;
  castedState.buffer = "";
}

/**
 * The {@link processEscapeCharacter} function is used to process a character
 * in the escape mode of the tokenizer. If any tokens are generated, they will
 * be pushed to the provided tokens array.
 *
 * @param state The current state of the tokenizer.
 * @param character The character to process.
 * @param tokens The tokens generated from the chunk.
 *
 * @internal
 */
export function processEscapeCharacter(
  state: EscapeMode,
  character: string,
  tokens: Token[],
): void {
  switch (character) {
    case "{":
    case "\\":
      tokens.push(new Token(TokenType.Literal, character, flushRange(state)));
      break;
    default:
      tokens.push(
        new Token(TokenType.Literal, `\\${character}`, flushRange(state)),
      );
      break;
  }
  transitionFromEscapeToLiteralMode(state);
}

/**
 * The {@link transitionFromInterpolationToLiteralMode} function is used to
 * transition from the interpolation mode to the literal mode.
 *
 * @param state The current state of the tokenizer.
 * @param tokens The tokens generated from the chunk.
 */
export function transitionFromInterpolationToLiteralMode(
  state: InterpolationMode,
  tokens: Token[],
): void {
  flushBuffer(state, tokens, TokenType.Interpolation);

  const castedState = state as unknown as LiteralMode;
  castedState.type = Mode.Literal;
  castedState.buffer = "";

  (state as AnyMode).n = undefined;
}

/**
 * The {@link processInterpolationCharacter} function is used to process a
 * character in the interpolation mode of the tokenizer. If any tokens are
 * generated, they will be pushed to the provided tokens array.
 *
 * @param state The current state of the tokenizer.
 * @param character The character to process.
 * @param tokens The tokens generated from the chunk.
 *
 * @internal
 */
export function processInterpolationCharacter(
  state: InterpolationMode,
  character: string,
  tokens: Token[],
): void {
  switch (character) {
    case "{":
      state.n++;
      state.buffer += character;
      break;
    case "}":
      state.n--;
      if (state.n === 0) {
        transitionFromInterpolationToLiteralMode(state, tokens);
      } else {
        state.buffer += character;
      }
      break;
    default:
      state.buffer += character;
      break;
  }
}

/**
 * The {@link tokenizeChunk} function is used to tokenize a chunk of template
 * strings into tokens.
 *
 * @param state The current state of the tokenizer.
 * @param chunk The chunk of template strings to tokenize.
 * @returns The tokens generated from the chunk.
 *
 * @internal
 */
export function tokenizeChunk(state: State, chunk: string): Token[] {
  const tokens: Token[] = [];

  for (const char of chunk) {
    processCharacter(state, char, tokens);
  }

  return tokens;
}

/**
 * The {@link flushState} function is used to flush the current state of the
 * tokenizer. This is used to generate any remaining tokens in the state.
 *
 * @param state The current state of the tokenizer.
 * @returns The token generated from the state, if any.
 * @throws {Error} If the state is in escape or interpolation mode.
 *
 * @internal
 */
export function flushState(
  state: State,
  tokens: Token[] = [],
): Token | undefined {
  switch (state.type) {
    case Mode.Literal: {
      flushBuffer(state, tokens, TokenType.Literal);
      return tokens[0];
    }
    case Mode.Escape:
      throw new Error(
        "Unexpected end of input in escape mode. Did you forget to escape a character?",
      );
    case Mode.Interpolation:
      throw new Error(
        "Unexpected end of input in interpolation mode. Did you forget to close a brace?",
      );
  }
}

/**
 * The {@link TokenizerStreamTransformer} class is used to transform a stream
 * of template strings into tokens.
 *
 * @internal
 */
export class TokenizerStreamTransformer implements Transformer<string, Token> {
  /**
   * The state of the tokenizer.
   */
  #state!: State;

  /**
   * The start method is used to start the tokenizer. This is used to create a
   * new state for the tokenizer.
   */
  start() {
    if (this.#state !== undefined) {
      throw new Error("TokenizerStreamTransformer has already been started");
    }

    this.#state = createState();
  }

  /**
   * The transform method is used to transform a chunk of template strings into
   * tokens. This is used to process the chunk and generate tokens.
   *
   * @param chunk The chunk of template strings to tokenize.
   * @param controller The controller used to enqueue tokens.
   * @throws {Error} If the transformer has not been started.
   */
  transform(
    chunk: string,
    controller: TransformStreamDefaultController<Token>,
  ) {
    if ((this.#state as unknown) === undefined) {
      throw new Error("TokenizerStreamTransformer has not been started");
    }

    try {
      for (const token of tokenizeChunk(this.#state, chunk)) {
        controller.enqueue(token);
      }
    } catch (error) {
      controller.error(error);
    }
  }

  /**
   * The flush method is used to flush the current state of the tokenizer. This
   * is used to generate any remaining tokens in the state.
   *
   * @param controller The controller used to enqueue tokens.
   * @throws {Error} If the transformer has not been started.
   */
  flush(controller: TransformStreamDefaultController<Token>) {
    if ((this.#state as unknown) === undefined) {
      throw new Error("TokenizerStreamTransformer has not been started");
    }

    try {
      const token = flushState(this.#state);

      if (token) {
        controller.enqueue(token);
      }
    } catch (error) {
      controller.error(error);
    }
  }
}

/**
 * The {@link TokenizerStream} class is used to tokenize a stream of template
 * strings into tokens.
 */
export class TokenizerStream extends TransformStream<string, Token> {
  constructor() {
    super(new TokenizerStreamTransformer());
  }
}

/**
 * The {@link tokenize} function is used to tokenize a template string into
 * tokens.
 *
 * @param value The template string to tokenize.
 * @returns The tokens generated from the template string.
 * @throws {Error} If the template string is invalid.
 */
export function tokenize(value: string): Token[] {
  const tokens: Token[] = [];
  const state = createState();

  for (const char of value) {
    processCharacter(state, char, tokens);
  }

  flushState(state, tokens);

  return tokens;
}
