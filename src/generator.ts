import { AstNode, AstNodeType } from './ast';
import { Parser } from './parser';
import { Scope, ScopeVariable, ScopeStack } from './scopeblock';

export class Generator {
	private scopeStack: ScopeStack = new ScopeStack();

	public constructor() {
	}

	public generate(rootNode: AstNode):null | string {
		// Check we have been given a full AST starting from the root
		if (rootNode.type!=AstNodeType.Root || rootNode.parent!==null)
			return null;

		// Reset state
		this.scopeStack=new ScopeStack();

		// Generate from given AST
		return this.generateNode(rootNode);
	}

	private generateNode(node: AstNode):null | string {
		switch(node.type) {
			case AstNodeType.Root: {
				// Create global scope
				this.scopeStack.push(new Scope('global'));

				// Require includes
				let outputIncludes='';
				outputIncludes+='; Includes\n';
				outputIncludes+='require lib/sys/syscall.s\n';

				outputIncludes+='\n';

				// Initial boilerplate to implement main function
				// TODO: prepare argc and argv
				let outputStart='';
				outputStart+='; Call main and handle exit code once returns\n';
				outputStart+='call '+this.mangleNameFunction('main')+'\n';
				outputStart+='mov r1 r0\n';
				outputStart+='mov r0 SyscallIdExit\n';
				outputStart+='syscall\n';

				outputStart+='\n';

				// Generate code for children
				let outputCode='';
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNode(node.children[i]);
					if (childOutput===null)
						return null;
					outputCode+=childOutput;
				}

				// Combine all parts for full output
				let output='';

				output+=outputIncludes;
				output+=outputStart;
				output+=outputCode;

				// Pop scope
				this.scopeStack.pop();

				return output;
			} break;
			case AstNodeType.Definition:
			break;
			case AstNodeType.Type:
			break;
			case AstNodeType.Name:
			break;
			case AstNodeType.VariableDefinition:
			break;
			case AstNodeType.FunctionDefinition: {
				let output='';

				let nameTypeNode=node.children[0];
				let argumentsNode=(node.children.length==3 ? node.children[1] : null);
				let bodyNode=(argumentsNode!==null ? node.children[2] : node.children[1]);

				// First child is VariableDefinition defining function's name and return type
				let nameNode=nameTypeNode.children[0];
				let typeNode=nameTypeNode.children[1];

				output+='; User defined function \''+nameNode.tokens[0].text+'\'\n';
				output+='label '+this.mangleNameFunction(nameNode.tokens[0].text)+'\n';

				// Optional next child is FunctionDefinitionArguments
				// TODO: handle this

				// Final child is Block representing function body
				this.scopeStack.push(new Scope(this.mangleNameFunction(nameNode.tokens[0].text)));
				let blockOutput=this.generateNode(bodyNode);
				if (blockOutput===null)
					return null;
				output+=blockOutput;
				this.scopeStack.pop();

				// Add return statement
				// TODO: don't bother if one already?
				output+='ret\n';

				// Empty line after function
				output+='\n';

				return output;
			} break;
			case AstNodeType.FunctionDefinitionArguments: {
			} break;
			case AstNodeType.Block: {
				let output='';

				// Generate code for children
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNode(node.children[i]);
					if (childOutput===null)
						return null;
					output+=childOutput;
				}

				return output;
			} break;
			case AstNodeType.Statement: {
				let output='';

				// Generate code for children
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNode(node.children[i]);
					if (childOutput===null)
						return null;
					output+=childOutput;
				}

				return output;
			} break;
			case AstNodeType.StatementReturn: {
				let output='';

				// Generate code for children
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNode(node.children[i]);
					if (childOutput===null)
						return null;
					output+=childOutput;
				}

				// Add return instruction
				output+='ret\n';

				return output;
			} break;
			case AstNodeType.StatementWhile: {
				let output='';

				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Generate label names to use later
				let loopName=this.scopeStack.peek()!.genNewSymbolPrefix()+'_loop';
				let startLabel=loopName+'_start';
				let endLabel=loopName+'_end';

				// Start label
				output+='label '+startLabel+'\n';

				// Condition checking
				let conditionOutput=this.generateNode(conditionNode);
				if (conditionOutput===null)
					return null;
				output+=conditionOutput;
				output+='cmp r0 r0 r0\n';
				output+='skipneqz r0\n';
				output+='jmp '+endLabel+'\n';

				// Body
				this.scopeStack.push(new Scope(loopName+'_body'));
				let bodyOutput=this.generateNode(bodyNode);
				if (bodyOutput===null)
					return null;
				output+=bodyOutput;
				this.scopeStack.pop();

				// Jump back to start and end label
				output+='jmp '+startLabel+'\n';
				output+='label '+endLabel+'\n';

				return output;
			} break;
			case AstNodeType.Expression: {
				// Goal of these Expression cases is to return value of (sub) expression in r0 (if any)
				return this.generateNode(node.children[0]);
			} break;
			case AstNodeType.ExpressionAssignment: {
			} break;
			case AstNodeType.ExpressionInequality: {
				let output='';

				// Generate LHS code and save value onto stack
				let lhsOutput=this.generateNode(node.children[0]);
				if (lhsOutput===null)
					return null;

				output+=lhsOutput;
				output+='push16 r0\n';

				// Generate RHS code and save value into r1
				let rhsOutput=this.generateNode(node.children[1]);
				if (rhsOutput===null)
					return null;

				output+=rhsOutput;
				output+='mov r1 r0\n';

				// Compare code
				output+='pop16 r0\n';
				output+='cmp r1 r0 r1\n';
				output+='mov r0 1\n';
				switch(node.tokens[0].text) {
					case '<': output+='skiplt r1\n'; break;
					case '<=': output+='skiple r1\n'; break;
					case '>': output+='skipgt r1\n'; break;
					case '<=': output+='skipge r1\n'; break;
					default: return null; break; // TODO: add error message probably
				}
				output+='mov r0 0\n';

				return output;
			} break;
			case AstNodeType.ExpressionAddition: {
				let output='';

				// Generate first-operand code and save value onto stack
				let firstOutput=this.generateNode(node.children[0]);
				if (firstOutput===null)
					return null;

				output+=firstOutput;
				output+='push16 r0\n';

				// Loop over rest of the operands
				for(let i=0; i<node.tokens.length; ++i) {
					// Generate this operands code and place value in r1
					let loopOutput=this.generateNode(node.children[i+1]);
					if (loopOutput===null)
						return null;

					output+=loopOutput;
					output+='mov r1 r0\n';

					// Execute operation
					output+='pop16 r0\n'; // restore previous operand
					if (node.tokens[i].text=='+')
						output+='add r0 r1\n';
					else if (node.tokens[i].text=='-')
						output+='sub r0 r1\n';
					output+='push16 r0\n'; // save result ready to act as next operand
				}

				// Pop result off stack
				output+='pop16 r0\n';

				return output;
			} break;
			case AstNodeType.ExpressionMultiplication: {
			} break;
			case AstNodeType.ExpressionTerminal: {
				// No children? Must be literal
				if (node.children.length==0) {
					let terminalStr=node.tokens[0].text;

					// Terminal is literal number?
					if (Parser.strIsNumber(terminalStr))
						return 'mov r0 '+terminalStr+'\n';

					// Bad terminal
					console.log('Could not generate code: bad terminal literal \''+terminalStr+'\'');
					return null;
				}
			} break;
			case AstNodeType.ExpressionBrackets: {
			} break;
		}

		console.log('Could not generate code: unexpected/unhandled node of type '+AstNodeType[node.type]); // TODO: improve this
		return null;
	}

	private mangleNameFunction(input: string):string {
		return 'function'+Scope.separator+this.escapeName(input);
	}

	private escapeName(input: string):string {
		return input.replace('_', '_U'); // prevent any double underscores being passed on, as we use these for our own separators
	}

	private typeToSize(type: string):number {
		if (type.length==0)
			return 0;

		if (type[type.length-1]=='*')
			return 2; // pointers are always 16 bit
		else if (type=='uint8_t')
			return 1;
		else if (type=='uint16_t')
			return 2;
		else
			return 0;
	}
}
