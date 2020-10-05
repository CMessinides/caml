export interface SourceLocation {
	offset: number;
	line: number;
	col: number;
}

const NEWLINE = "\n".charCodeAt(0);
const TAB = "\t".charCodeAt(0);
const TAB_WIDTH = 2;

export class Source {
	protected readonly data: string;
	protected offset = 0;
	protected line = 1;
	protected col = 1;

	static from(data: string | Buffer) {
		return new Source(typeof data === "string" ? data : data.toString("utf-8"));
	}

	constructor(data: string) {
		this.data = data;
	}

	loc(): SourceLocation {
		return {
			offset: this.offset,
			line: this.line,
			col: this.col,
		};
	}

	advance(): number {
		let charCode = this.data.charCodeAt(this.offset++);

		if (charCode === NEWLINE) {
			this.line++;
			this.col = 1;
		} else if (charCode === TAB) {
			this.col += TAB_WIDTH;
		} else {
			this.col += 1;
		}

		return charCode;
	}

	advanceChars(n: number): number[] {
		let charCodes = [];

		while (!this.isAtEnd() && charCodes.length < n) {
			charCodes.push(this.advance());
		}

		return charCodes;
	}

	peek(): number {
		if (this.isAtEnd()) return 0;

		return this.data.charCodeAt(this.offset);
	}

	isAtEnd(): boolean {
		return this.offset >= this.data.length;
	}

	reset() {
		this.offset = 0;
		this.line = 1;
		this.col = 1;
	}
}
