import { Token } from './tokenizer';

export enum AstNodeType {
	Root,
	Definition, // either variable or function definition
	Type,
	Name,
	VariableDefinition,
	FunctionDefinition,
	FunctionDefinitionArguments,
	Block,
	Statement,
	StatementReturn,
	StatementContinue,
	StatementBreak,
	StatementWhile,
	StatementFor,
	StatementIf,
	StatementInlineAsm,
	Expression,
	ExpressionAssignment,
	ExpressionEquality,
	ExpressionInequality,
	ExpressionAddition,
	ExpressionMultiplication,
	ExpressionTerminal,
	ExpressionBrackets,
	ExpressionCall,
	ExpressionDereference,
	QuotedString,
};

export class AstNode {
	public parent: AstNode | null = null;
	public children: AstNode[] = [];

	public tokens: Token[] = [];

	public constructor(public type: AstNodeType, public id:number) {
	}

	public createChild(type: AstNodeType, id:number): AstNode {
		// Create and add child
		let child=new AstNode(type, id);
		child.parent=this;
		this.children.push(child);

		return child;
	}

	public debug() {
		this.debugHelper(0);
	}

	public debugHelper(depth: number) {
		// Initialise string with identation
		let str=' '.repeat(depth*2);

		// Add type to string
		str+=this.id+' '+AstNodeType[this.type];

		// All text of all tokens (if any)
		str+=':';
		for(let i=0; i<this.tokens.length; ++i)
			str+=' '+this.tokens[i].text;

		// Add location information (if any)
		if (this.tokens.length>0) {
			let x=80;
			if (str.length<x)
				str+=' '.repeat(x-str.length);
			str+=' ('+this.tokens[0].location.toString()+')';
		}

		// Write out string
		console.log(str);

		// Call recursively on children with depth increased
		for(let i=0; i<this.children.length; ++i)
			this.children[i].debugHelper(depth+1);
	}
}
