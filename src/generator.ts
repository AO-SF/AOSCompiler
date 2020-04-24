import { AstNode, AstNodeType } from './ast';
import { Parser } from './parser';
import { Scope, ScopeSymbol, ScopeVariable, ScopeFunction } from './scope';
import { Token } from './tokenizer';

export class Generator {
	private globalScope: Scope = new Scope('global', null);
	private currentScope: Scope;
	private globalStackAdjustment:number = 0; // this is required so that we can still determine the address of automatic variables, despite adjusting the stack pointer mid-function

	public constructor() {
	}

	public generate(rootNode: AstNode):null | string {
		// Check we have been given a full AST starting from the root
		if (rootNode.type!=AstNodeType.Root || rootNode.parent!==null)
			return null;

		// Reset state
		this.globalScope=new Scope('global', null);
		this.currentScope=this.globalScope;
		this.globalStackAdjustment=0;

		// Pass to determine scope and variable information
		if (!this.generateNodePassScopes(rootNode))
			return null;

		// Final pass to generate asm code
		return this.generateNodePassCode(rootNode);
	}

	private generateNodePassScopes(node: AstNode):boolean {
		switch(node.type) {
			case AstNodeType.Root: {
				// Pass for children
				for(let i=0; i<node.children.length; ++i) {
					if (!this.generateNodePassScopes(node.children[i]))
						return false;
				}

				return true;
			} break;
			case AstNodeType.Definition:
			break;
			case AstNodeType.Type:
			break;
			case AstNodeType.Name:
			break;
			case AstNodeType.VariableDefinition: {
				let nameNode=node.children[0];
				let name=nameNode.tokens[0].text;

				// See if name already defined (in current scope or any ones above)
				let previouslyDefined=this.currentScope.getSymbolByName(name);
				if (previouslyDefined!==null) {
					this.printError('cannot redefine symbol \''+name+'\' as variable (previously defined at '+previouslyDefined.definitionToken.location.toString()+')', nameNode.tokens[0]);
					return false;
				}

				// Grab type
				let type='';
				for(let i=0; i<node.children[1].tokens.length; ++i)
					type+=node.children[1].tokens[i].text;

				// Determine size of variable in memory based on type
				let varEntrySize=this.typeToSize(type);
				let varEntryCount=1;
				let varTotalSize=varEntrySize*varEntryCount;

				// Define this name by adding it to list of variables in this scope
				this.currentScope.addVariable(name, node.id, type, varTotalSize, nameNode.tokens[0]);

				return true;
			} break;
			case AstNodeType.FunctionDefinition: {
				// TODO: handle FunctionDefinitionArguments

				let nameTypeNode=node.children[0];
				let argumentsNode=(node.children.length==3 ? node.children[1] : null);
				let bodyNode=(argumentsNode!==null ? node.children[2] : node.children[1]);

				// First child is VariableDefinition defining function's name and return type
				let nameNode=nameTypeNode.children[0];
				let name=nameNode.tokens[0].text;
				let typeNode=nameTypeNode.children[1];

				// Check if symbol with same name already defined previously
				let previouslyDefined=this.currentScope.getSymbolByName(name);
				if (previouslyDefined!==null) {
					this.printError('cannot redefine symbol \''+name+'\' as function (previously defined at '+previouslyDefined.definitionToken.location.toString()+')', nameNode.tokens[0]);
					return false;
				}

				// Add function to current scope
				let func=this.currentScope.addfunction(name, node.id, nameNode.tokens[0]);

				// Enter function scope
				this.generateNodePassScopesPushScope(func.getScopeName());

				// Pass for children in body
				if (!this.generateNodePassScopes(bodyNode))
					return false;

				let variableAllocationSize=this.currentScope.getTotalVariableSizeAllocation(); // we have to generate body code before calling this

				// Leave function scope
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.FunctionDefinitionArguments: {
			} break;
			case AstNodeType.Block: {
				// Pass for children
				for(let i=0; i<node.children.length; ++i) {
					if (!this.generateNodePassScopes(node.children[i]))
						return false;
				}
				return true;
			} break;
			case AstNodeType.Statement: {
				// Pass for children
				for(let i=0; i<node.children.length; ++i) {
					if (!this.generateNodePassScopes(node.children[i]))
						return false;
				}
				return true;
			} break;
			case AstNodeType.StatementReturn: {
				// Pass for children
				for(let i=0; i<node.children.length; ++i) {
					if (!this.generateNodePassScopes(node.children[i]))
						return false;
				}
				return true;
			} break;
			case AstNodeType.StatementWhile: {
				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Generate label names to use later
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_loop';
				let startLabel=this.currentScope.name+mangledPrefix+'start';
				let endLabel=this.currentScope.name+mangledPrefix+'end';

				// Body
				this.generateNodePassScopesPushScope(mangledPrefix+'body');
				if (!this.generateNodePassScopes(bodyNode))
					return false;
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.StatementInlineAsm:
			case AstNodeType.Expression:
			case AstNodeType.ExpressionAssignment:
			case AstNodeType.ExpressionInequality:
			case AstNodeType.ExpressionAddition:
			case AstNodeType.ExpressionMultiplication:
			case AstNodeType.ExpressionTerminal:
			case AstNodeType.ExpressionBrackets:
			case AstNodeType.QuotedString:
				return true;
			break;
		}

		this.printError('unexpected/unhandled node of type '+AstNodeType[node.type], null); // TODO: can we find most relevant token to pass?
		return false;
	}

	private generateNodePassCode(node: AstNode):null | string {
		switch(node.type) {
			case AstNodeType.Root: {
				// Require includes
				let outputIncludes='';
				outputIncludes+='; Includes\n';
				outputIncludes+='require lib/sys/syscall.s\n';

				outputIncludes+='\n';

				// Generate code for global variables
				let outputGlobals='';

				for(let i=0; i<this.currentScope.symbols.length; ++i) {
					let variable=this.currentScope.symbols[i];
					if (!(variable instanceof ScopeVariable))
						continue;

					// We use 'allocate byte' pseudo asm instruction for these
					outputGlobals+='ab '+variable.mangledName+' '+variable.totalSize+'\n';
				}

				if (outputGlobals.length>0)
					outputGlobals='; Global variables\n'+outputGlobals+'\n';

				// Initial code to call main function and handle return status
				let outputStart='';
				outputStart+='; Call main and handle exit status once returns\n';
				let mainFunction=this.currentScope.getSymbolByName('main');
				if (mainFunction===null || !(mainFunction instanceof ScopeFunction)) {
					this.printError('missing \'main\' function', null);
					return null;
				}
				outputStart+='call '+mainFunction.mangledName+'\n';
				outputStart+='mov r1 r0\n';
				outputStart+='mov r0 SyscallIdExit\n';
				outputStart+='syscall\n';

				outputStart+='\n';

				// Generate code for children
				let outputCode='';
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNodePassCode(node.children[i]);
					if (childOutput===null)
						return null;
					outputCode+=childOutput;
				}

				// Combine all parts for full output
				let output='';

				output+=outputIncludes;
				output+=outputGlobals;
				output+=outputStart;
				output+=outputCode;

				return output;
			} break;
			case AstNodeType.Definition:
			break;
			case AstNodeType.Type:
			break;
			case AstNodeType.Name:
			break;
			case AstNodeType.VariableDefinition: {
				let nameNode=node.children[0];
				let name=nameNode.tokens[0].text;

				// Lookup symbol in scope
				let symbol=this.currentScope.getSymbolByName(name);
				if (symbol===null  || !(symbol instanceof ScopeVariable)) {
					this.printError('internal error - bad symbol \''+name+'\'', nameNode.tokens[0]);
					return null;
				}

				// Note: neither global nor automatic variables need any actual code generating here
				// (globals are created by Root node code, and automatic variables are created by FunctionDefinition node code)

				return '';
			} break;
			case AstNodeType.FunctionDefinition: {
				// TODO: handle FunctionDefinitionArguments

				let nameTypeNode=node.children[0];
				let argumentsNode=(node.children.length==3 ? node.children[1] : null);
				let bodyNode=(argumentsNode!==null ? node.children[2] : node.children[1]);

				// First child is VariableDefinition defining function's name and return type
				let nameNode=nameTypeNode.children[0];
				let name=nameNode.tokens[0].text;
				let typeNode=nameTypeNode.children[1];

				// Lookup symbol in scope
				let symbol=this.currentScope.getSymbolByName(name);
				if (symbol===null  || !(symbol instanceof ScopeFunction)) {
					this.printError('internal error - bad symbol \''+name+'\'', nameNode.tokens[0]);
					return null;
				}

				let func=symbol as ScopeFunction;

				// Enter function scope
				if (!this.generateNodePassCodeEnterScope(func.getScopeName()))
					return null;

				// Generate code for function body from child Block node
				let outputBody=this.generateNodePassCode(bodyNode);
				if (outputBody===null)
					return null;

				// Generate code for function start
				let variableAllocationSize=this.currentScope.getTotalVariableSizeAllocation();
				let outputStart='';
				outputStart+='; User defined function \''+func.name+'\'\n';
				outputStart+='label '+func.mangledName+'\n';
				if (variableAllocationSize>64) {
					outputStart+='mov r5 '+variableAllocationSize+'\n';
					outputStart+='add r6 r6 r5\n';
				} else if (variableAllocationSize>0)
					outputStart+='inc'+variableAllocationSize+' r6\n';

				// Leave function scope
				if (!this.generateNodePassCodeLeaveScope())
					return null;

				// Add return logic, terminating with 'ret' instruction
				// All 'return' statements within this function will cause flow to jump to this label, with r0 set to return value (if any).
				// This means r0 needs preserving.
				let outputEnd='';
				outputEnd+='label '+func.mangledName+'_end\n';
				if (variableAllocationSize>64) {
					outputEnd+='mov r5 '+variableAllocationSize+'\n';
					outputEnd+='sub r6 r6 r5\n';
				} else if (variableAllocationSize>0)
					outputEnd+='dec'+variableAllocationSize+' r6\n';
				outputEnd+='ret\n';

				// Combine output code produced above (and add empty line after function)
				let output='';

				output+=outputStart;
				output+=outputBody;
				output+=outputEnd;
				output+='\n';

				return output;
			} break;
			case AstNodeType.FunctionDefinitionArguments: {
			} break;
			case AstNodeType.Block: {
				let output='';

				// Generate code for children
				for(let i=0; i<node.children.length; ++i) {
					let childOutput=this.generateNodePassCode(node.children[i]);
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
					let childOutput=this.generateNodePassCode(node.children[i]);
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
					let childOutput=this.generateNodePassCode(node.children[i]);
					if (childOutput===null)
						return null;
					output+=childOutput;
				}

				// Jump to function end label to return
				let funcMangledName=this.currentScope.getFunctionMangledName();
				if (funcMangledName===null) {
					this.printError('\'return\' statement not in function scope', node.tokens[0]);
					return null;
				}
				output+='jmp '+funcMangledName+'_end\n';

				return output;
			} break;
			case AstNodeType.StatementWhile: {
				let output='';

				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Generate label names to use later
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_loop';
				let startLabel=this.currentScope.name+mangledPrefix+'start';
				let endLabel=this.currentScope.name+mangledPrefix+'end';

				// Start label
				output+='label '+startLabel+'\n';

				// Condition checking
				let conditionOutput=this.generateNodePassCode(conditionNode);
				if (conditionOutput===null)
					return null;
				output+=conditionOutput;
				output+='cmp r0 r0 r0\n';
				output+='skipneqz r0\n';
				output+='jmp '+endLabel+'\n';

				// Body
				if (!this.generateNodePassCodeEnterScope(mangledPrefix+'body'))
					return null;

				let bodyOutput=this.generateNodePassCode(bodyNode);
				if (bodyOutput===null)
					return null;
				output+=bodyOutput;

				if (!this.generateNodePassCodeLeaveScope())
					return null;

				// Jump back to start and end label
				output+='jmp '+startLabel+'\n';
				output+='label '+endLabel+'\n';

				return output;
			} break;
			case AstNodeType.StatementInlineAsm: {
				let quotedStringNode=node.children[0];

				return this.parseQuotedString(quotedStringNode.tokens[0].text, quotedStringNode.tokens[0])+'\n';
			} break;
			case AstNodeType.Expression: {
				// Goal of these Expression cases is to return value of (sub) expression in r0 (if any)
				return this.generateNodePassCode(node.children[0]);
			} break;
			case AstNodeType.ExpressionAssignment: {
				let output='';

				let lhsNode=node.children[0];
				let rhsNode=node.children[1];

				// Is the LHS even a registered variable?
				let name=lhsNode.tokens[0].text;
				let lhsSymbol=this.currentScope.getSymbolByName(name);
				if (lhsSymbol===null) {
					this.printError('undefined symbol \''+name+'\' as destination in assignment', lhsNode.tokens[0]);
					return null;
				}

				if (!(lhsSymbol instanceof ScopeVariable)) {
					this.printError('cannot use non-variable symbol \''+name+'\' as destination in assignment', lhsNode.tokens[0]);
					return null;
				}

				let lhsVariable=lhsSymbol as ScopeVariable;

				// Calculate RHS value and leave it in r0
				let rhsOutput=this.generateNodePassCode(rhsNode);
				if (rhsOutput===null)
					return null;
				output+=rhsOutput;

				// Place address of variable into r0 (while moving RHS value into r1)
				output+='push16 r0\n';
				this.globalStackAdjustment+=2;
				output+=this.generateVariableAddress(lhsVariable);
				this.globalStackAdjustment-=2;
				output+='pop16 r1\n';

				// Store logic (address is in r0, RHS value is in r1)
				if (lhsVariable.totalSize==1)
					output+='store8 r0 r1\n';
				else if (lhsVariable.totalSize==2)
					output+='store16 r0 r1\n';
				else {
					// TODO: this
					this.printError('internal error - unimplemented large-variable logic (assignment)', lhsNode.tokens[0]);
					return null;
				}

				return output;
			} break;
			case AstNodeType.ExpressionInequality: {
				let output='';

				// Generate LHS code and save value onto stack
				let lhsOutput=this.generateNodePassCode(node.children[0]);
				if (lhsOutput===null)
					return null;

				output+=lhsOutput;
				output+='push16 r0\n';
				this.globalStackAdjustment+=2;

				// Generate RHS code and save value into r1
				let rhsOutput=this.generateNodePassCode(node.children[1]);
				if (rhsOutput===null)
					return null;

				output+=rhsOutput;
				output+='mov r1 r0\n';

				// Compare code
				this.globalStackAdjustment-=2;
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
				let firstOutput=this.generateNodePassCode(node.children[0]);
				if (firstOutput===null)
					return null;

				output+=firstOutput;
				output+='push16 r0\n';
				this.globalStackAdjustment+=2;

				// Loop over rest of the operands
				for(let i=0; i<node.tokens.length; ++i) {
					// Generate this operands code and place value in r1
					let loopOutput=this.generateNodePassCode(node.children[i+1]);
					if (loopOutput===null)
						return null;

					output+=loopOutput;
					output+='mov r1 r0\n';

					// Execute operation
					this.globalStackAdjustment-=2;
					output+='pop16 r0\n'; // restore previous operand
					if (node.tokens[i].text=='+')
						output+='add r0 r0 r1\n';
					else if (node.tokens[i].text=='-')
						output+='sub r0 r0 r1\n';
					output+='push16 r0\n'; // save result ready to act as next operand
					this.globalStackAdjustment+=2;
				}

				// Pop result off stack
				this.globalStackAdjustment-=2;
				output+='pop16 r0\n';

				return output;
			} break;
			case AstNodeType.ExpressionMultiplication: {
				let output='';

				// Generate first-operand code and save value onto stack
				let firstOutput=this.generateNodePassCode(node.children[0]);
				if (firstOutput===null)
					return null;

				output+=firstOutput;
				output+='push16 r0\n';
				this.globalStackAdjustment+=2;

				// Loop over rest of the operands
				for(let i=0; i<node.tokens.length; ++i) {
					// Generate this operands code and place value in r1
					let loopOutput=this.generateNodePassCode(node.children[i+1]);
					if (loopOutput===null)
						return null;

					output+=loopOutput;
					output+='mov r1 r0\n';

					// Execute operation
					this.globalStackAdjustment-=2;
					output+='pop16 r0\n'; // restore previous operand
					if (node.tokens[i].text=='*')
						output+='mul r0 r0 r1\n';
					else if (node.tokens[i].text=='/')
						output+='div r0 r0 r1\n';
					output+='push16 r0\n'; // save result ready to act as next operand
					this.globalStackAdjustment+=2;
				}

				// Pop result off stack
				this.globalStackAdjustment-=2;
				output+='pop16 r0\n';

				return output;
			} break;
			case AstNodeType.ExpressionTerminal: {
				// No children? Must be literal
				if (node.children.length==0) {
					let terminalStr=node.tokens[0].text;

					// Terminal is literal number?
					if (Parser.strIsNumber(terminalStr))
						return 'mov r0 '+terminalStr+'\n';

					// Terminal is symbol name?
					let terminalSymbol=this.currentScope.getSymbolByName(terminalStr);
					if (terminalSymbol!==null) {
						if (terminalSymbol instanceof ScopeVariable) {
							let terminalVariable=terminalSymbol as ScopeVariable;
							let output='';

							// Place address of variable into r0
							output+=this.generateVariableAddress(terminalVariable);

							// Load logic (address is in r0 from previous step)
							if (terminalVariable.totalSize==1)
								output+='load8 r0 r0\n';
							else if (terminalVariable.totalSize==2)
								output+='load16 r0 r0\n';
							else {
								// TODO: this
								this.printError('internal error - unimplemented large-variable logic (expression terminal)', node.tokens[0]);
								return null;
							}

							return output;
						} else if (terminalSymbol instanceof ScopeFunction) {
							this.printError('cannot use function symbol \''+terminalSymbol.name+'\' as a value', node.tokens[0]);
							return null;
						} else {
							this.printError('internal error - unhandled symbol type for \''+terminalSymbol.name+'\' (expression terminal)', node.tokens[0]);
							return null;
						}
					}

					// Bad terminal
					this.printError('bad literal \''+terminalStr+'\' in expression', node.tokens[0]);
					return null;
				}
			} break;
			case AstNodeType.ExpressionBrackets: {
			} break;
			case AstNodeType.QuotedString: {
			} break;
		}

		this.printError('unexpected/unhandled node of type '+AstNodeType[node.type], null); // TODO: can we find most relevant token to pass?
		return null;
	}

	// This returns a string containing asm code which will move the address of the given variable into r0
	public generateVariableAddress(variable: ScopeVariable):string {
		let output='';

		if (variable.scope.name=='global') {
			// Global variable (easy due to having a fixed address)
			output+='mov r0 '+variable.mangledName+'\n';
		} else {
			// Automatic variable
			let stackAdjustment=this.globalStackAdjustment+variable.getStackAdjustment();
			if (stackAdjustment==0)
				output+='mov r0 r6\n';
			else if (stackAdjustment<=64) {
				output+='mov r0 r6\n';
				output+='dec'+stackAdjustment+' r0\n';
			} else {
				output+='mov r0 '+stackAdjustment+'\n';
				output+='sub r0 r6 r0\n';
			}
		}

		return output;
	}

	public static escapeName(input: string):string {
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

	public printError(message: string, token:null|Token) {
		if (token!==null)
			console.log('Could not generate code ('+token.location.toString()+'): '+message);
		else
			console.log('Could not generate code: '+message);
	}

	private generateNodePassScopesPushScope(name: string) {
		this.currentScope=this.currentScope.push(name);
	}

	private generateNodePassScopesPopScope():boolean {
		if (this.currentScope.parent===null) {
			this.printError('internal error - tried to pop scope but already in global scope', null);
			return false;
		}

		this.currentScope=this.currentScope.parent;
		return true;
	}

	private generateNodePassCodeEnterScope(name: string):boolean {
		for(let i=0; i<this.currentScope.children.length; ++i)
			if (this.currentScope.children[i].name==this.currentScope.name+name) {
				this.currentScope=this.currentScope.children[i];
				return true;
			}

		this.printError('internal error - tried to enter scope \''+this.currentScope.name+name+'\' but no such scope found', null);
		return false;
	}

	private generateNodePassCodeLeaveScope():boolean {
		if (this.currentScope.parent===null) {
			this.printError('internal error - tried to leave scope but already in global scope', null);
			return false;
		}

		this.currentScope=this.currentScope.parent;
		return true;
	}

	private parseQuotedString(input: string, token:null|Token):null|string {
		// Ensure first character is a quote and strip it off.
		if (input.length<1 || input[0]!='"') {
			this.printError('bad quoted string - no open quote', token);
			return null;
		}

		input=input.substring(1);

		// Ensure last character is also a quote and strip it off.
		if (input.length<1 || input[input.length-1]!='"') {
			this.printError('bad quoted string - no close quote', token);
			return null;
		}

		input=input.substring(0,input.length-1);

		// Unescape
		let output='';
		for(let i=0; i<input.length; ++i) {
			if (input[i]!='\\') {
				output+=input[i];
				continue;
			}

			++i;

			if (i>=input.length) {
				this.printError('bad quoted string - trailing escape character', token);
				return null;
			}

			switch(input[i]) {
				case 'n':
					output+='\n';
				break;
				case '"':
					output+='"';
				break;
				case '\\':
					output+='\\';
				break;
				default:
					this.printError('bad quoted string - bad escape sequence \'\\'+input[i]+'\'', token);
					return null;
				break;
			}
		}

		return output;
	}
}
