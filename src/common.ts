/**
 * Defines a range.
 *
 * A range is used to represent the start and end offsets of some entity.
 */
export class Range {
  #start: number;
  #end: number;

  constructor(start: number, end: number) {
    if (start < 0) {
      throw new Error("Start offset must be greater than or equal to 0");
    }

    if (end < start) {
      throw new Error("End offset must be greater than or equal to start");
    }

    this.#start = start;
    this.#end = end;
  }

  get start(): number {
    return this.#start;
  }

  get end(): number {
    return this.#end;
  }

  get length(): number {
    return this.#end - this.#start;
  }
}

/**
 * Defines a location.
 *
 * A location, similar to {@link Range}, is used to represent the offset of some
 * entity, but in line and column format, instead of start and end offsets.
 */
export class Location {
  #line: number;
  #column: number;

  /**
   * Create a new location.
   *
   * @param line The line number of the location.
   * @param column The column number of the location.
   */
  constructor(line: number, column: number) {
    if (line < 1) {
      throw new Error("Line number must be greater than or equal to 1");
    }

    if (column < 0) {
      throw new Error("Column number must be greater than or equal to 0");
    }

    this.#line = line;
    this.#column = column;
  }

  /**
   * The line number of the location.
   */
  get line(): number {
    return this.#line;
  }

  /**
   * The column number of the location.
   */
  get column(): number {
    return this.#column;
  }
}

/**
 * Defines a range with a location.
 *
 * A range with a location is used to represent the start and end offsets of
 * some entity, as well as the line and column numbers of the start and end
 * offsets.
 */
export class RangeWithLocation extends Range {
  #startLocation: Location;
  #endLocation: Location;

  /**
   * Create a new range with a location.
   *
   * @param start The start offset of the range.
   * @param end The end offset of the range.
   * @param startLocation The start location of the range.
   * @param endLocation The end location of the range.
   */
  constructor(
    start: number,
    end: number,
    startLocation: Location,
    endLocation: Location,
  ) {
    super(start, end);
    this.#startLocation = startLocation;
    this.#endLocation = endLocation;
  }

  /**
   * The start location of the range.
   */
  get startLocation(): Location {
    return this.#startLocation;
  }

  /**
   * The end location of the range.
   */
  get endLocation(): Location {
    return this.#endLocation;
  }
}

/**
 * Defines a location snapshot.
 *
 * A location snapshot is used to represent the offset and line and column
 * numbers of some position in a sequence.
 */
export class LocationSnapshot {
  #offset: number;
  #line: number;
  #column: number;

  /**
   * Create a new location snapshot.
   *
   * @param offset The offset of the location.
   * @param line The line number of the location.
   * @param column The column number of the location.
   */
  constructor(offset: number, line: number, column: number) {
    this.#offset = offset;
    this.#line = line;
    this.#column = column;
  }

  /**
   * Complete the location snapshot with another location snapshot.
   *
   * This will create a new {@link RangeWithLocation} object with the start and
   * end offsets of the two location snapshots, as well as the start and end
   * locations of the two location snapshots.
   *
   * @param other The other location snapshot to complete with.
   *
   * @returns A new {@link RangeWithLocation} object with the start and end
   *          offsets of the two location snapshots, as well as the start and
   *          end locations of the two location snapshots.
   */
  public complete(other: LocationSnapshot): RangeWithLocation {
    return new RangeWithLocation(
      this.#offset,
      other.#offset,
      new Location(this.#line, this.#column),
      new Location(other.#line, other.#column),
    );
  }
}

/**
 * Used to track offsets and locations.
 */
export class LocationTracker {
  #offset: number = 0;
  #line: number = 1;
  #column: number = 0;

  /**
   * Move the offset and the column number forward {@link n} times.
   * @param n The number of times to move the offset and column number forward.
   * @returns The new offset.
   * @throws Error if {@link n} is less than `0`.
   */
  public column(n: number = 1): number {
    if (n < 0) {
      throw new Error("Column increment must be non-negative");
    }
    this.#column += n;
    return this.#offset += n;
  }

  /**
   * Move the offset and the line number down {@link n} times.
   *
   * This will also reset the column number to `0`.
   *
   * @param n The number of times to move the offset and line number forward.
   * @returns The new offset.
   * @throws Error if {@link n} is less than `0`.
   */
  public line(n: number = 1): number {
    if (n < 0) {
      throw new Error("Line increment must be non-negative");
    }
    this.#line += n;
    this.#column = 0;
    return this.#offset += n;
  }

  /**
   * Creates a new {@link LocationSnapshot} object with the current offset, line
   * number, and column number. This can later be used to create a new
   * {@link RangeWithLocation} object.
   *
   * @returns A new {@link LocationSnapshot} object with the current offset,
   *          line number, and column number.
   */
  public snapshot(): LocationSnapshot {
    return new LocationSnapshot(this.#offset, this.#line, this.#column);
  }

  /**
   * Complete a {@link LocationSnapshot} object with the current offset, line
   * number, and column number.
   *
   * This is an alias for {@link snapshot} and
   * {@link LocationSnapshot.complete}.
   *
   * @param snapshot The location snapshot to complete with.
   *
   * @returns A new {@link RangeWithLocation} object with the start and end
   *          offsets of the two location snapshots, as well as the start and
   *          end locations of the two location snapshots.
   */
  public complete(snapshot: LocationSnapshot): RangeWithLocation {
    return snapshot.complete(this.snapshot());
  }
}

/**
 * The {@link TokenType} describes how a sequence of characters should be
 * interpreted.
 */
export enum TokenType {
  /**
   * A literal token is a sequence of characters that should be treated as a
   * string literal.
   */
  Literal,

  /**
   * An interpolation token is a sequence of characters that should be treated
   * as code that will be executed at runtime to produce a, preferably, literal
   * value.
   */
  Interpolation,
}

/**
 * The {@link Token} class is used to represent a sequence of characters, where
 * the sequence of characters are located in a specific range of a source, and
 * the sequence of characters should be interpreted as a specific type.
 */
export class Token {
  #type: TokenType;
  #value: string;
  #range: RangeWithLocation;

  /**
   * Create a new token.
   *
   * @param type The type of the token.
   * @param value The value of the token.
   * @param range The range of the token.
   */
  constructor(
    type: TokenType,
    value: string,
    range: RangeWithLocation,
  ) {
    this.#type = type;
    this.#value = value;
    this.#range = range;
  }

  /**
   * The type of the token.
   */
  get type(): TokenType {
    return this.#type;
  }

  /**
   * The value of the token.
   */
  get value(): string {
    return this.#value;
  }

  /**
   * The range and location of where the token is located in the source.
   */
  get range(): RangeWithLocation {
    return this.#range;
  }
}
