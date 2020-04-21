import { AstNode, AstNodeType } from './ast';

export class Optimizer {
	public constructor() {
	}

	public optimize(node: AstNode) {
		// Optimize children recursively
		for(let i=0; i<node.children.length; ++i)
			this.optimize(node.children[i]);

		// Attempt to simplify this node via its children
		for(let i=0; i<node.children.length; ++i) {
			let child=node.children[i];
			switch(child.type) {
				case AstNodeType.Root:
				case AstNodeType.Definition:
				case AstNodeType.Type:
				case AstNodeType.Name:
				case AstNodeType.VariableDefinition:
				case AstNodeType.FunctionDefinition:
				case AstNodeType.FunctionDefinitionArguments:
				case AstNodeType.Block:
				case AstNodeType.StatementReturn:
				case AstNodeType.StatementWhile:
				case AstNodeType.Expression:
				case AstNodeType.ExpressionTerminal:
				case AstNodeType.ExpressionBrackets:
					// No optimizations available
				break;
				case AstNodeType.Statement:
					// If no children then remove
					if (child.children.length==0) {
						node.children.splice(i, 1);
						--i;
					}
				break;
				case AstNodeType.ExpressionAssignment:
				case AstNodeType.ExpressionInequality:
				case AstNodeType.ExpressionAddition:
				case AstNodeType.ExpressionMultiplication:
					// If no tokens and only one child then remove and replace with said child
					if (child.tokens.length==0 && child.children.length==1) {
						node.children[i]=child.children[0];
						node.children[i].parent=node;
					}
				break;
			}
		}
	}
}