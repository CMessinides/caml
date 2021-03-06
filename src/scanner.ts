import { Token, TokenLocation, TokenType } from "./tokens";

type CharCode = number;

const COLON = 0x3a;
const EQUALS = 0x3d;
const QUESTION = 0x3f;
const SLASH = 0x2f;
const HASH = 0x23;
const NEWLINE = 0x0a;

class Scanner {
	readonly source: string;
	readonly tokens: Token[] = [];
	/** The start of the current token */
	protected offset = 0;
	/** The end of the current token (non-inclusive) */
	protected cursor = 0;
	/** The line number of the current token */
	protected line = 1;
	/** The column number of the current token */
	protected col = 1;

	constructor(source: string) {
		this.source = source;
	}

	/**
	 * Add another character to the current token and return its char code. If there are no
	 * more characters to consume, returns NaN.
	 */
	advance(): CharCode {
		if (this.isAtEnd()) return NaN;

		return this.source.charCodeAt(this.cursor++);
	}

	/**
	 * Remove the last character of the current token and reset the scanner to the position
	 * just before it. Note that this will have no effect if the current token is empty.
	 */
	backup(): void {
		if (this.cursor > this.offset) {
			this.cursor--;
		}
	}

	/**
	 * Preview the char code of the next character without consuming it. If there are no
	 * more characters to consume, returns NaN.
	 */
	peek(): CharCode {
		let charCode = this.advance();
		this.backup();
		return charCode;
	}

	/**
	 * Ignore all characters in the current token.
	 */
	ignore(): void {
		let substr = this.source.slice(this.offset, this.cursor);
		for (let i = 0; i < substr.length; i++) {
			let char = substr.charCodeAt(i);

			if (char === NEWLINE) {
				this.line++;
				this.col = 1;
			} else {
				this.col++;
			}
		}

		this.offset = this.cursor;
	}

	/**
	 * Add the next character to the current token if it is found in the given string of
	 * acceptable characters. Returns true if a character was consumed, false otherwise.
	 */
	match(chars: string): boolean {
		let next = this.advance();

		for (const char of chars) {
			if (char.charCodeAt(0) === next) {
				return true;
			}
		}

		this.backup();
		return false;
	}

	/**
	 * Add characters to the current token so long as they are found in the given string of
	 * acceptable characters. Returns true if any characters were consumed, false otherwise.
	 */
	matchRun(chars: string): boolean {
		let matched = 0;

		while (this.match(chars)) {
			matched++;
		}

		return matched > 0;
	}

	/**
	 * Ignore any spaces or tabs.
	 */
	skipWhitespace(): void {
		let matched = this.matchRun(" \t");
		if (matched) this.ignore();
	}

	/**
	 * Emit the current token with the given type.
	 */
	emit(type: TokenType): Token {
		let token: Token = {
			type,
			value: this.source.slice(this.offset, this.cursor),
			loc: this.loc(),
		};

		// Setup state for the next token
		this.ignore();

		this.tokens.push(token);
		return token;
	}

	/**
	 * Emit an error token with the given message and, optionally, a given location. If no
	 * location is provided, the location of the current token is used.
	 */
	error(message: string, loc: TokenLocation = this.loc()): null {
		this.tokens.push({
			type: TokenType.ERROR,
			value: message,
			loc,
		});

		return null;
	}

	/**
	 * Returns true if there are no more characters to consume, otherwise returns false.
	 */
	isAtEnd(): boolean {
		return this.cursor >= this.source.length;
	}

	/**
	 * Returns true if the current token has characters, otherwise returns false.
	 */
	hasAdvanced(): boolean {
		return this.cursor > this.offset;
	}

	/**
	 * Get the location of the current token.
	 */
	loc(): TokenLocation {
		return {
			offset: this.offset,
			line: this.line,
			col: this.col,
		};
	}
}

export function scan(source: string): Token[] {
	let scanner = new Scanner(source);

	let state: ScanState | null = scanIndent;
	while (state !== null) {
		state = state(scanner);
	}

	scanner.emit(TokenType.EOF);

	return scanner.tokens;
}

const scanIndent: ScanState = (scanner) => {
	if (scanner.isAtEnd()) return null;

	scanner.matchRun("\t");
	scanner.emit(TokenType.INDENT);

	if (scanner.peek() === HASH) {
		return scanComment;
	}

	return scanKeyText;
};

const scanComment: ScanState = (scanner) => {
	do {
		scanner.advance();
	} while (!scanner.isAtEnd() && scanner.peek() !== NEWLINE);

	scanner.emit(TokenType.COMMENT);

	if (scanner.isAtEnd()) return null;

	return scanNewline;
};

const scanNewline: ScanState = (scanner) => {
	scanner.advance();
	scanner.emit(TokenType.NEWLINE);
	return scanIndent;
};

const scanValueText: ScanState = (scanner) => {
	let next: ScanState | null = null;

	while (!scanner.isAtEnd()) {
		let c = scanner.peek();

		if (c === NEWLINE) {
			next = scanNewline;
			break;
		}

		scanner.advance();
	}

	if (scanner.hasAdvanced()) {
		scanner.emit(TokenType.TEXT);
	}

	return next;
};

const DELIMITER_TABLE = new Map([
	[COLON, scanDelimiter(TokenType.COLON)],
	[EQUALS, scanDelimiter(TokenType.EQUALS)],
	[QUESTION, scanDelimiter(TokenType.QUESTION)],
	[SLASH, scanDelimiter(TokenType.SLASH)],
]);

function scanDelimiter(type: TokenType): ScanState {
	return (scanner) => {
		scanner.advance(); // Consume the delimiter
		scanner.emit(type);
		scanner.skipWhitespace();

		return scanValueText;
	};
}

const scanKeyText: ScanState = (scanner) => {
	let next: ScanState | null = null;

	while (!scanner.isAtEnd()) {
		let c = scanner.peek();

		if (c === NEWLINE) {
			next = scanNewline;
			break;
		}

		if (DELIMITER_TABLE.has(c)) {
			next = DELIMITER_TABLE.get(c)!;
			break;
		}

		scanner.advance();
	}

	if (scanner.hasAdvanced()) {
		scanner.emit(TokenType.TEXT);
	}

	return next;
};

type ScanState = (scanner: Scanner) => ScanState | null;
