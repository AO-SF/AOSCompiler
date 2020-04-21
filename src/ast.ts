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
}
