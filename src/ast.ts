import { Token } from './tokenizer';

export enum AstNodeType {
	Root,
	Definition, // either variable or function definition
	Type,
	Name,
	VariableDefinition,
	FunctionDefinition,
	FunctionDefinitionArguments,
	Define,
	Block,
	Label,
	Statement,
	StatementReturn,
	StatementContinue,
	StatementBreak,
	StatementWhile,
	StatementFor,
	StatementIf,
	StatementGoto,
	StatementInlineAsm,
	Expression,
	ExpressionAssignment,
	ExpressionOr,
	ExpressionAnd,
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

	public remove():boolean {
		if (this.parent===null)
			return true;

		for(let i=0; i<this.parent.children.length; ++i)
			if (this.parent.children[i]==this) {
				this.parent.children.splice(i,1);
				this.parent=null;
				return true;
			}

		return false;
	}

	// This should be called only on root node instance
	public getFunctionDefinitionNode(name:string):null|AstNode {
		// Not root node?
		if (this.parent!==null)
			return null;

		// Look through children for matching function definition
		for(let i=0; i<this.children.length; ++i) {
			let funcDefNode=this.children[i];
			if (funcDefNode.type==AstNodeType.FunctionDefinition && funcDefNode.children.length>0) {
				let varDefNode=funcDefNode.children[0];
				if (varDefNode.type==AstNodeType.VariableDefinition && varDefNode.children.length>0) {
					let nameNode=varDefNode.children[0];
					if (nameNode.type==AstNodeType.Name && nameNode.tokens.length>0 && nameNode.tokens[0].text==name)
						return funcDefNode;
				}
			}
		}

		return null;
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
