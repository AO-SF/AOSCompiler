import { AstNode, AstNodeType } from './ast';
import { Parser } from './parser';
import { Scope, ScopeSymbol, ScopeVariable, ScopeFunction, ScopeArgument, ScopeStorageSymbol } from './scope';
import { Token } from './tokenizer';

export class Generator {
	private globalScope: Scope = new Scope('global', null, false);
	private currentScope: Scope;
	private globalStackAdjustment:number = 0; // this is required so that we can still determine the address of automatic variables, despite adjusting the stack pointer mid-function

	public constructor() {
	}

	public generate(rootNode: AstNode):null | string {
		// Check we have been given a full AST starting from the root
		if (rootNode.type!=AstNodeType.Root || rootNode.parent!==null)
			return null;

		// Reset state
		this.globalScope=new Scope('global', null, false);
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

				// Grab type and compute size (do this before we adjust type for array)
				let type='';
				for(let i=0; i<node.children[1].tokens.length; ++i)
					type+=node.children[1].tokens[i].text;

				let typeSize=this.typeToSize(type);

				// Array? Grab entryCount and update type
				let entryCount=1;
				if (node.tokens.length==1) {
					entryCount=parseInt(node.tokens[0].text);
					type+='[]';
				}

				// Define this name by adding it to list of variables in this scope
				let totalSize=entryCount*typeSize;
				this.currentScope.addVariable(name, node.id, nameNode.tokens[0], type, typeSize, totalSize);

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
				let func=this.currentScope.addFunction(name, node.id, nameNode.tokens[0]);

				// Enter function scope
				this.generateNodePassScopesPushScope(func.getScopeName(), false);

				// Pass to register any arguments
				if (argumentsNode!==null && !this.generateNodePassScopes(argumentsNode))
					return false;

				// Pass for children in body
				if (!this.generateNodePassScopes(bodyNode))
					return false;

				// Leave function scope
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.FunctionDefinitionArguments: {
				for(let i=0; i<node.children.length; ++i) {
					let variableDefinitionNode=node.children[i];
					let argumentNameNode=variableDefinitionNode.children[0];
					let argumentTypeNode=variableDefinitionNode.children[1];

					// Grab argument's name and type
					let argumentName=argumentNameNode.tokens[0].text;
					let argumentType='';
					for(let i=0; i<argumentTypeNode.tokens.length; ++i)
						argumentType+=argumentTypeNode.tokens[i].text;

					// Check for array definition (not allowed in function arguments as would reduce to a pointer anyway)
					// TODO: this

					// Determine size of variable in memory based on type
					let argumentTypeSize=this.typeToSize(argumentType);
					let argumentEntryCount=1;
					let argumentTotalSize=argumentTypeSize*argumentEntryCount;

					// Add argument to current (function) scope
					this.currentScope.addArgument(argumentName, variableDefinitionNode.id, argumentNameNode.tokens[0], argumentType, argumentTypeSize, argumentTotalSize);
				}

				return true;
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
			case AstNodeType.StatementContinue:
				return true;
			break;
			case AstNodeType.StatementBreak:
				return true;
			break;
			case AstNodeType.StatementWhile: {
				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Body
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_while';
				this.generateNodePassScopesPushScope(mangledPrefix+'body', true);
				if (!this.generateNodePassScopes(bodyNode))
					return false;
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.StatementFor: {
				let initNode=node.children[0];
				let conditionNode=node.children[1];
				let incrementNode=node.children[2];
				let bodyNode=node.children[3];

				// Body
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_for';
				this.generateNodePassScopesPushScope(mangledPrefix+'body', true);
				if (!this.generateNodePassScopes(bodyNode))
					return false;
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.StatementIf: {
				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Body
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_if';
				this.generateNodePassScopesPushScope(mangledPrefix+'body', false);
				if (!this.generateNodePassScopes(bodyNode))
					return false;
				if (!this.generateNodePassScopesPopScope())
					return false;

				return true;
			} break;
			case AstNodeType.StatementInlineAsm:
			case AstNodeType.Expression:
			case AstNodeType.ExpressionAssignment:
			case AstNodeType.ExpressionEquality:
			case AstNodeType.ExpressionInequality:
			case AstNodeType.ExpressionAddition:
			case AstNodeType.ExpressionMultiplication:
			case AstNodeType.ExpressionTerminal:
			case AstNodeType.ExpressionBrackets:
			case AstNodeType.ExpressionCall:
			case AstNodeType.ExpressionDereference:
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
				outputStart+='; Setup argc and argv then call main and handle exit status once returns\n';

				outputStart+='mov r3 r6 ; save start of stack-based array to use as argv argument\n';
				outputStart+='mov r1 0 ; argv loop index\n';
				outputStart+='label argvLoopStart\n';

				outputStart+='mov r0 SyscallIdArgvN\n';
				outputStart+='syscall\n';
				outputStart+='cmp r2 r0 r0\n';
				outputStart+='skipneqz r2\n';
				outputStart+='jmp argvLoopEnd\n';

				outputStart+='push16 r0 ; add to stack-based argv array\n';
				outputStart+='inc r1\n';
				outputStart+='jmp argvLoopStart\n';
				outputStart+='label argvLoopEnd\n';

				outputStart+='mov r0 SyscallIdArgc ; grab argc\n';
				outputStart+='syscall\n';
				outputStart+='push8 r0 ; push argc\n';
				outputStart+='push16 r3 ; push argv\n';

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
			case AstNodeType.StatementContinue: {
				let output='';

				// Find relevant loop and continue label
				let continueLabel=this.currentScope.getLoopContinueLabel();
				if (continueLabel===null) {
					this.printError('\'continue\' statement not in loop scope', node.tokens[0]);
					return null;
				}

				// Generate code to jump to continue label
				output+='jmp '+continueLabel+'\n';

				return output;
			} break;
			case AstNodeType.StatementBreak: {
				let output='';

				// Find relevant loop and break label
				let breakLabel=this.currentScope.getLoopBreakLabel();
				if (breakLabel===null) {
					this.printError('\'break\' statement not in loop scope', node.tokens[0]);
					return null;
				}

				// Generate code to jump to break label
				output+='jmp '+breakLabel+'\n';

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
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_while';
				let startLabel=this.currentScope.name+mangledPrefix+'start';
				let continueLabel=this.currentScope.name+mangledPrefix+'continue';
				let breakLabel=this.currentScope.name+mangledPrefix+'break';

				// Start and continue labels
				output+='label '+startLabel+'\n';
				output+='label '+continueLabel+'\n';

				// Condition checking
				let conditionOutput=this.generateNodePassCode(conditionNode);
				if (conditionOutput===null)
					return null;
				output+=conditionOutput;
				output+='cmp r0 r0 r0\n';
				output+='skipneqz r0\n';
				output+='jmp '+breakLabel+'\n';

				// Body
				if (!this.generateNodePassCodeEnterScope(mangledPrefix+'body'))
					return null;

				let bodyOutput=this.generateNodePassCode(bodyNode);
				if (bodyOutput===null)
					return null;
				output+=bodyOutput;

				if (!this.generateNodePassCodeLeaveScope())
					return null;

				// Jump back to start and add break label
				output+='jmp '+startLabel+'\n';
				output+='label '+breakLabel+'\n';

				return output;
			} break;
			case AstNodeType.StatementFor: {
				let output='';

				let initNode=node.children[0];
				let conditionNode=node.children[1];
				let incrementNode=node.children[2];
				let bodyNode=node.children[3];

				// Generate label names to use later
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_for';
				let startLabel=this.currentScope.name+mangledPrefix+'start';
				let continueLabel=this.currentScope.name+mangledPrefix+'continue';
				let breakLabel=this.currentScope.name+mangledPrefix+'break';

				// Generate initialisation code
				let initOutput=this.generateNodePassCode(initNode);
				if (initOutput===null)
					return null;
				output+=initOutput;

				// Start label
				output+='label '+startLabel+'\n';

				// Condition checking
				let conditionOutput=this.generateNodePassCode(conditionNode);
				if (conditionOutput===null)
					return null;
				output+=conditionOutput;
				output+='cmp r0 r0 r0\n';
				output+='skipneqz r0\n';
				output+='jmp '+breakLabel+'\n';

				// Generate body code
				if (!this.generateNodePassCodeEnterScope(mangledPrefix+'body'))
					return null;

				let bodyOutput=this.generateNodePassCode(bodyNode);
				if (bodyOutput===null)
					return null;
				output+=bodyOutput;

				if (!this.generateNodePassCodeLeaveScope())
					return null;

				// Generate 'increment' code
				output+='label '+continueLabel+'\n';

				let incrementOutput=this.generateNodePassCode(incrementNode);
				if (incrementOutput===null)
					return null;
				output+=incrementOutput;

				// Jump back to start and add break label
				output+='jmp '+startLabel+'\n';
				output+='label '+breakLabel+'\n';

				return output;
			} break;
			case AstNodeType.StatementIf: {
				let output='';

				let conditionNode=node.children[0];
				let bodyNode=node.children[1];

				// Generate label names to use later
				let mangledPrefix=this.currentScope.genNewSymbolMangledPrefix(node.id)+'_if';
				let endLabel=this.currentScope.name+mangledPrefix+'end';

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

				// End/false label
				output+='label '+endLabel+'\n';

				return output;
			} break;
			case AstNodeType.StatementInlineAsm: {
				let quotedStringNode=node.children[0];

				// Unescape string (replace e.g. '\' followed by 'n' with single genuine newline)
				let input=this.parseQuotedString(quotedStringNode.tokens[0].text, quotedStringNode.tokens[0])+'\n';

				// If any variables should be substituted in.
				let output='';
				for(let i=0; i<input.length; ++i) {
					// Check for '$' indicating start of variable which should be substituted
					if (input[i]!='$') {
						output+=input[i];
						continue;
					}

					// Find the full extent of the symbol
					let name='';
					for(++i; i<input.length; ++i) {
						if (!Parser.strIsSymbol(name+input[i]))
							break;
						name+=input[i];
					}

					// Generate code to move this symbol's address into r0, and add it to the inline asm
					let symbolOutput=this.generateSymbolAddressByName(name);
					if (symbolOutput===null) {
						this.printError('internal error - unhandled symbol type for \''+name+'\' (inline asm variable substitution)', quotedStringNode.tokens[0]);
						return null;
					}

					output+=symbolOutput;
				}

				return output;
			} break;
			case AstNodeType.Expression: {
				// Goal of these Expression cases is to return value of (sub) expression in r0 (if any)
				// Although this particular node type is never actually produced by the parser and so we do not need to handle it.
			} break;
			case AstNodeType.ExpressionAssignment: {
				// TODO: handle ExpressionDereference as lhsNode for e.g. buf[x]=y

				let output='';

				let lhsNode=node.children[0];
				let rhsNode=node.children[1];

				// Check lhsNode is one of expected types.
				if (lhsNode.type!=AstNodeType.ExpressionTerminal) {
					this.printError('bad destination in assignment - expected literal', lhsNode.tokens[0]);
					return null;
				}

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

				// Ensure LHS is not an array
				if (this.typeIsArray(lhsVariable.type)) {
					this.printError('cannot use array symbol \''+name+'\' as destination in assignment', lhsNode.tokens[0]);
					return null;
				}

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
				switch(lhsVariable.typeSize) {
					case 1: output+='store8 r0 r1\n'; break;
					case 2: output+='store16 r0 r1\n'; break;
					default:
						// TODO: this
						this.printError('internal error - unimplemented large-variable logic (assignment)', lhsNode.tokens[0]);
						return null;
					break;
				}

				return output;
			} break;
			case AstNodeType.ExpressionEquality:
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
					case '==': output+='skipeq r1\n'; break;
					case '!=': output+='skipneq r1\n'; break;
					default: return null; break; // TODO: add error message probably
				}
				output+='mov r0 0\n';

				return output;
			break;
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
					let outputSymbolValue=this.generateSymbolValueByName(terminalStr);
					if (outputSymbolValue!==null)
						return outputSymbolValue;

					// Bad terminal
					this.printError('bad literal \''+terminalStr+'\' in expression', node.tokens[0]);
					return null;
				}
			} break;
			case AstNodeType.ExpressionBrackets: {
			} break;
			case AstNodeType.ExpressionCall: {
				let output = '';

				let funcName=node.tokens[0].text;

				// Lookup symbol in scope
				let symbol=this.currentScope.getSymbolByName(funcName);
				if (symbol===null) {
					this.printError('bad function call - no such symbol \''+funcName+'\'', node.tokens[0]);
					return null;
				}

				if (!(symbol instanceof ScopeFunction)) {
					this.printError('bad function call - symbol \''+funcName+'\' is not a function', node.tokens[0]);
					return null;
				}

				let func=symbol as ScopeFunction;

				// Handle arguments
				let asmArgumentStackAdjustment=0;
				for(let i=0; i<node.children.length; ++i) {
					let expressionCode=this.generateNodePassCode(node.children[i]);
					if (expressionCode===null)
						return null;
					output+=expressionCode;

					let expectedArgument=func.getArgumentN(i)
					if (expectedArgument===null) {
						this.printError('bad call to function \''+func.name+'\' - too many arguments', node.children[i].tokens[0]);
						return null;
					}

					switch(expectedArgument.typeSize) {
						case 1: output+='push8 r0\n'; break;
						case 2: output+='push16 r0\n'; break;
						default:
							// TODO: this
							this.printError('internal error - unimplemented large-variable logic (calling function \''+func.name+'\')', node.children[i].tokens[0]);
							return null;
						break;
					}

					this.globalStackAdjustment+=expectedArgument.typeSize;
					asmArgumentStackAdjustment+=expectedArgument.typeSize;
				}

				this.globalStackAdjustment-=asmArgumentStackAdjustment;

				// Add call instruction
				output+='call '+func.mangledName+'\n';

				// Add instruction to restore stack after pushing arguments (if any)
				if (asmArgumentStackAdjustment>64) {
					output+='mov r1 '+asmArgumentStackAdjustment+'\n';
					output+='sub r6 r6 r1\n';
				} else if (asmArgumentStackAdjustment>0) {
					output+='dec'+asmArgumentStackAdjustment+' r6\n';
				}

				return output;
			} break;
			case AstNodeType.ExpressionDereference: {
				let output = '';

				let ptrName=node.tokens[0].text;

				// Lookup symbol in scope
				let symbol=this.currentScope.getSymbolByName(ptrName);
				if (symbol===null) {
					this.printError('bad dereference - no such symbol \''+ptrName+'\'', node.tokens[0]);
					return null;
				}

				if (!(symbol instanceof ScopeStorageSymbol)) {
					this.printError('bad dereference - symbol \''+ptrName+'\' is not a variable', node.tokens[0]);
					return null;
				}

				let storageSymbol=symbol as ScopeStorageSymbol;

				let dereferencedType=this.typeDereference(storageSymbol.type);
				if (dereferencedType===null) {
					this.printError('bad dereference - symbol \''+ptrName+'\' is not a pointer or an array', node.tokens[0]);
					return null;
				}

				// Generate code for expression within square brackets, and protect it by placing onto the stack
				let expressionCode=this.generateNodePassCode(node.children[0]);
				if (expressionCode===null)
					return null;
				output+=expressionCode;

				output+='push16 r0\n';
				this.globalStackAdjustment+=2;

				// Generate code to load pointer base address into r0
				let baseAddressCode=this.generateSymbolValue(storageSymbol);
				if (baseAddressCode===null) {
					// TODO: if we make versions of functions like generateSymbolValue which accept ScopeStorageSymbol instead then won't have to worry about null
					this.printError('bad dereference - internal error', node.tokens[0]);
					return null;
				}
				output+=baseAddressCode;

				// Compute true address by taking the base address and adding the offset (suitably multiplied), and store into r0
				output+='pop16 r1\n'; // restore expression value
				this.globalStackAdjustment-=2;

				switch(this.typeToSize(dereferencedType)) {
					case 1:
						output+='add r0 r0 r1\n';
					break;
					case 2:
						// easier to add twice rather than try to multiply then add
						output+='add r0 r0 r1\n';
						output+='add r0 r0 r1\n';
					break;
					default:
						// TODO: this
						this.printError('internal error - unimplemented large-variable logic (dereference)', node.tokens[0]);
						return null;
					break;
				}

				// Generate code to actually do the dereferencing by doing a load operation
				switch(this.typeToSize(dereferencedType)) {
					case 1:
						output+='load8 r0 r0\n';
					break;
					case 2:
						output+='load16 r0 r0\n';
					break;
					default:
						// TODO: this
						this.printError('internal error - unimplemented large-variable logic (dereference)', node.tokens[0]);
						return null;
					break;
				}

				return output;
			} break;
			case AstNodeType.QuotedString: {
				// Parse quoted string from input token
				let text=this.parseQuotedString(node.tokens[0].text, node.tokens[0]);
				if (text===null)
					return null;

				// Escape the text (note that this is a slightly different format to the escaping we removed from the input token)
				let escapedText=text;
				escapedText=escapedText.replace('\n', '\\n');
				escapedText=escapedText.replace('\'', '\\\'');

				// Choose unique global name for this constant
				let globalName=this.globalScope.genNewSymbolMangledName(node.id)+'_constant';

				// Generate code (simply store string in global variable and place pointer to it in r0)
				let output='';
				output+='db '+globalName+' \''+escapedText+'\',0\n';
				output+='mov r0 '+globalName+'\n';

				return output;
			} break;
		}

		this.printError('unexpected/unhandled node of type '+AstNodeType[node.type], null); // TODO: can we find most relevant token to pass?
		return null;
	}

	// Thin wrapper around generateSymbolAddress
	public generateSymbolAddressByName(name: string):null|string {
		let symbol=this.currentScope.getSymbolByName(name);
		if (symbol===null)
			return null;

		return this.generateSymbolAddress(symbol);
	}

	// This returns a string containing asm code which will move the address of the given symbol into r0.
	// If the symbol is not a variable or an argument then returns null.
	public generateSymbolAddress(symbol: ScopeSymbol):null|string {
		// Variable?
		if (symbol instanceof ScopeVariable)
			return this.generateVariableAddress(symbol as ScopeVariable);

		// Argument?
		if (symbol instanceof ScopeArgument)
			return this.generateArgumentAddress(symbol as ScopeArgument);

		// Otherwise error
		return null;
	}

	// Thin wrapper around generateSymbolValue
	public generateSymbolValueByName(name: string):null|string {
		let symbol=this.currentScope.getSymbolByName(name);
		if (symbol===null)
			return null;

		return this.generateSymbolValue(symbol);
	}

	// This returns a string containing asm code which will move the value of the given symbol into r0.
	// If the symbol is not a variable or an argument then returns null.
	public generateSymbolValue(symbol: ScopeSymbol):null|string {
		let output='';

		// Not even the right kind of symbol?
		if (!(symbol instanceof ScopeStorageSymbol))
			return null;
		let storageSymbol=symbol as ScopeStorageSymbol;

		// Generate code to move address into r0
		let outputAddress=this.generateSymbolAddress(symbol);
		if (outputAddress===null)
			return null;
		output+=outputAddress;

		// Generate loading code (address is in r0 from previous step)
		// Note: we skip this for arrays as their base address is their value when used in an expression
		if (!this.typeIsArray(storageSymbol.type)) {
			switch(storageSymbol.typeSize) {
				case 1: output+='load8 r0 r0\n'; break;
				case 2: output+='load16 r0 r0\n'; break;
				default:
					return null;
				break;
			}
		}

		return output;
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

	// This returns a string containing asm code which will move the address of the given argument into r0
	public generateArgumentAddress(argument: ScopeArgument):string {
		let output='';

		let stackAdjustment=this.globalStackAdjustment+argument.getStackAdjustment();
		if (stackAdjustment==0)
			output+='mov r0 r6\n';
		else if (stackAdjustment<=64) {
			output+='mov r0 r6\n';
			output+='dec'+stackAdjustment+' r0\n';
		} else {
			output+='mov r0 '+stackAdjustment+'\n';
			output+='sub r0 r6 r0\n';
		}

		return output;
	}

	public static escapeName(input: string):string {
		return input.replace('_', '_U'); // prevent any double underscores being passed on, as we use these for our own separators
	}

	private typeToSize(type: string):number {
		if (type.length==0)
			return 0;

		if (this.typeIsPointer(type) || this.typeIsArray(type))
			return 2;

		if (type=='uint8_t')
			return 1;
		else if (type=='uint16_t')
			return 2;

		return 0;
	}

	private typeDereference(type: string):null|string {
		// Pointer type?
		if (this.typeIsPointer(type)) {
			// Strip final '*' off to reduce indirection by one level
			return type.substring(0, type.length-1);
		}

		// Array type?
		if (this.typeIsArray(type)) {
			// Strip final '[]' off to reduce indirection by one level
			return type.substring(0, type.length-2);
		}

		// Otherwise cannot dereference
		return null;
	}

	private typeIsPointer(type: string):boolean {
		if (type.length==0)
			return false;

		return (type[type.length-1]=='*');
	}

	private typeIsArray(type: string):boolean {
		if (type.length<2)
			return false;

		return (type.substring(type.length-2)=='[]');
	}

	public printError(message: string, token:null|Token) {
		if (token!==null)
			console.log('Could not generate code ('+token.location.toString()+'): '+message);
		else
			console.log('Could not generate code: '+message);
	}

	private generateNodePassScopesPushScope(name: string, isLoop:boolean) {
		this.currentScope=this.currentScope.push(name, isLoop);
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
