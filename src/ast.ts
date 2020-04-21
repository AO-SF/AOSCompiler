import { Token } from './tokenizer';

export enum AstNodeType {
	Root,
	Definition, // either variable or function definition
	Type,
	Name,
	VariableDefinition,
	FunctionDefinition,
	FunctionDefinitionArguments,
};

export class AstNode {
	public parent: AstNode | null = null;
	public children: AstNode[] = [];

	public tokens: Token[] = [];

	public constructor(public type: AstNodeType) {
	}

	public createChild(type: AstNodeType): AstNode {
		let child=new AstNode(type);
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
		str+=AstNodeType[this.type];

		// Type-specific info
		switch(this.type) {
			case AstNodeType.Root:
			case AstNodeType.Definition:
			case AstNodeType.VariableDefinition:
			case AstNodeType.FunctionDefinition:
			case AstNodeType.FunctionDefinitionArguments:
				// Nothing extra to add
			break;
			case AstNodeType.Type:
			case AstNodeType.Name:
				// Simply list all token texts
				str+=':';
				for(let i=0; i<this.tokens.length; ++i)
					str+=' '+this.tokens[i].text;
			break;
		}

		// Write out string
		console.log(str);

		// Call recursively on children with depth increased
		for(let i=0; i<this.children.length; ++i)
			this.children[i].debugHelper(depth+1);
	}
}
