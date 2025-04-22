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

enum Mode {
  Literal,
  Escape,
  Interpolation,
}

interface LiteralMode {
  type: Mode.Literal;

  /**
   * The literal text in the template.
   */
  buffer: string;
}

interface EscapeMode {
  type: Mode.Escape;

  /**
   * The escaped text.
   *
   * This will include the leading backslash.
   */
  buffer: string;
}

interface InterpolationMode {
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
