export class Token {
	public constructor(public text: string, public lineNum: number, public columnNum: number) {
	}
}

export class Tokenizer {
	static operators: string[]=['->','==','!=','<=','>=','<','>','=','+','-','*','/','(',')','{','}','[',']','.',',','&','|','^','!',';'];

	static tokenize(input: string):Token[] {
		let tokens: Token[] = [];
		let lineNum=1;
		let lineStartOffset=0;

		for(let i=0; i<input.length; ++i) {
			let c=input[i];
			let sub=input.substr(i);
			let columnNum=i-lineStartOffset+1;

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
 				tokens.push(new Token(text, lineNum, columnNum));

 				continue;
 			}

 			// Operator?
 			let j;
 			for(j=0; j<this.operators.length; ++j) {
 				if (sub.startsWith(this.operators[j])) {
 					tokens.push(new Token(this.operators[j], lineNum, columnNum));
 					i+=this.operators[j].length-1;
 					break;
 				}
 			}
 			if (j<this.operators.length)
 				continue;

 			// Unexpected character
 			console.log("Could not tokenize: unexpected character '"+c+"' (line "+lineNum+", column "+columnNum+")");
 			return [];
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
