export class TokenLocation {
	public constructor(public file: string, public lineNum: number, public columnNum: number) {
	}

	public toString():string {
		return 'file \''+this.file+'\', line '+this.lineNum+', column '+this.columnNum;
	}
}

export class Token {
	public constructor(public text: string, public location:TokenLocation) {
	}
}

export class Tokenizer {
	static operators: string[]=['->','==','!=','<=','>=','<','>','=','+','-','*','/','(',')','{','}','[',']','.',',','&','|','^','!',';'];

	static tokenize(input: string, file: string):null | Token[] {
		let tokens: Token[] = [];
		let lineNum=1;
		let lineStartOffset=0;

		for(let i=0; i<input.length; ++i) {
			let c=input[i];
			let sub=input.substr(i);
			let columnNum=i-lineStartOffset+1;

			// Start of quoted string?
			if (sub.startsWith('"')) {
				// Consume entire string up to end quote or end of file
				let stringStartLineNum=lineNum;
				let stringStartColumnNum=columnNum;
				let text=c;
				while(i+1<input.length) {
					let c2=input[i+1];
					text+=c2;
					++i;
					if (c2=='\n') {
						++lineNum;
						lineStartOffset=i+1;
					} else if (c2=='\\') {
						++i;
						if (i>=input.length) {
							console.log("Could not tokenize: unterminated string (file '"+file+"', line "+stringStartLineNum+", column "+stringStartColumnNum+")");
							return null;
						}
						text+=input[i];
					} else if (c2=='"')
						break;
				}

				if (text.length<2 || text[0]!='"' || text[text.length-1]!='"') {
					console.log("Could not tokenize: unterminated string (file '"+file+"', line "+stringStartLineNum+", column "+stringStartColumnNum+")");
					return null;
				}

				tokens.push(new Token(text, new TokenLocation(file, lineNum, columnNum)));

				continue;
			}

			// Start of multi-line comment?
			if (sub.startsWith('/*')) {
				// Consume entire comment up to closing marker or end of file
				while(i+1<input.length) {
					let sub2=input.substr(i+1);
					if (sub2.startsWith('\n')) {
						++lineNum;
						lineStartOffset=i+1;
					} else if (sub2.startsWith('*/')) {
						i+=2;
						break;
					}
					++i;
				}
				continue;
			}

			// Single line comment?
			if (sub.startsWith('//')) {
				// Consume entire comment up to newline or end of file
				while(i+1<input.length) {
					let c2=input[i+1];
					if (c2=='\n')
						break;
					++i;
				}
				continue;
			}

			// Whitespace?
			if (this.charIsWhitespace(c)) {
				// If newline then increment line count and reset column
				if (c=='\n') {
					++lineNum;
					lineStartOffset=i+1;
				}
				continue;
			}

			// Literal?
			if (this.charIsLiteral(c)) {
				// Consume as many characters as possible
				let text=c;
				while(i+1<input.length) {
					let c2=input[i+1];
					if (!this.charIsLiteral(c2))
						break;
					text+=c2;
					++i;
				}
				tokens.push(new Token(text, new TokenLocation(file, lineNum, columnNum)));

				continue;
			}

			// Operator?
			let j;
			for(j=0; j<this.operators.length; ++j) {
				if (sub.startsWith(this.operators[j])) {
					tokens.push(new Token(this.operators[j], new TokenLocation(file, lineNum, columnNum)));
					i+=this.operators[j].length-1;
					break;
				}
			}
			if (j<this.operators.length)
				continue;

			// Unexpected character
			console.log("Could not tokenize: unexpected character '"+c+"' (file '"+file+"', line "+lineNum+", column "+columnNum+")");
			return null;
		}

		return tokens;
	}

	static charIsLiteral(char: string):boolean {
		if (char.charCodeAt(0)>='0'.charCodeAt(0) && char.charCodeAt(0)<='9'.charCodeAt(0))
			return true;
		if (char.charCodeAt(0)>='a'.charCodeAt(0) && char.charCodeAt(0)<='z'.charCodeAt(0))
			return true;
		if (char.charCodeAt(0)>='A'.charCodeAt(0) && char.charCodeAt(0)<='Z'.charCodeAt(0))
			return true;
		if (char=='_')
			return true;
		return false;
	}

	static charIsWhitespace(char: string):boolean {
		if (char==' ' || char=='\t' || char=='\r' || char=='\n')
			return true;
		return false;
	}
}
