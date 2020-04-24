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
	StatementWhile,
	StatementInlineAsm,
	Expression,
	ExpressionAssignment,
	ExpressionInequality,
	ExpressionAddition,
	ExpressionMultiplication,
	ExpressionTerminal,
	ExpressionBrackets,
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

		// Write out string
		console.log(str);

		// Call recursively on children with depth increased
		for(let i=0; i<this.children.length; ++i)
			this.children[i].debugHelper(depth+1);
	}
}
