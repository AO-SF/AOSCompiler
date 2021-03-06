import { AstNode, AstNodeType } from './ast';
import { Token, Tokenizer } from './tokenizer';

let fsLib=require('fs');
let pathLib=require('path');

export class Parser {
	private nodeStack: AstNode[];
	private nextNodeId:number;
	private includes = {};

	public constructor() {
	}

	public parse(path:string):null|AstNode {
		this.nextNodeId=0;

		let root = new AstNode(AstNodeType.Root, this.nextNodeId++);

		this.nodeStack = [root];

		if (!this.parseRaw(path))
			return null;

		return root;
	}

	public parseRaw(path:string):boolean {
		path=pathLib.resolve(__dirname, path);

		// Only include any particular file once
		if (this.includes[path])
			return true;

		this.includes[path]=true;

		// Read file
		let pathData;
		try {
			pathData=fsLib.readFileSync(path, 'utf8');
		} catch(e) {
			console.log('Could not parse: could not read file \''+path+'\' ('+e.message+')');
			return false;
		}

		// Tokenize
		let input=Tokenizer.tokenize(pathData, path);
		if (input===null) {
			console.log('Could not parse: could not tokenize file \''+path+'\'\n');
			return false;
		}

		// Parse into abstract syntax tree
		let token;
		while((token=input.shift())!=undefined) {
			let currNode=this.nodeStack[this.nodeStack.length-1];
			switch(currNode.type) {
				case AstNodeType.Root:
					// Type to start a definition (variable or function)?
					if (Parser.strIsBaseType(token.text)) {
						this.nodeStackPush(AstNodeType.Definition);

						input.unshift(token);

						continue;
					}

					// Hash to start preprocessor directive?
					if (token.text=='#') {
						// Peek at next token - must be the 'command' (e.g. 'include', 'define')
						if (input.length==0) {
							console.log('Could not parse: unfinished preprocessor directive - expected command ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
							return false;
						}

						token=input.shift()!;
						switch(token.text) {
							case 'include':
								// Include statement - next token should be quoted string
								if (input.length==0) {
									console.log('Could not parse: unfinished preprocessor include directive - expected path ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}

								token=input.shift()!;

								if (token.text.length<2 || token.text[0]!='"' || token.text[token.text.length-1]!='"') {
									console.log('Could not parse: bad include path - expected quoted string ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}

								// Extract file name (by stripping off quotes)
								token.text.substring()
								let includePath=token.text.substring(1);
								includePath=includePath.substring(0, includePath.length-1);

								includePath=pathLib.resolve(pathLib.dirname(path), includePath);

								// Resurse to parse this file
								if (!this.parseRaw(includePath)) {
									console.log('Could not parse: could not parse included file \''+includePath+'\' ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}

								continue;
							break;
							case 'define': {
								// Define statement - next token should be symbol name
								if (input.length==0) {
									console.log('Could not parse: unfinished preprocessor define directive - expected name ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}
								token=input.shift()!;

								let nameToken=token;
								if (!Parser.strIsSymbol(nameToken.text)) {
									console.log('Could not parse: bad preprocessor define directive - bad name \''+nameToken.text+'\' ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}

								// Next token should be literal integer value
								if (input.length==0) {
									console.log('Could not parse: unfinished preprocessor define directive - expected value ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}
								token=input.shift()!;

								let valueToken=token;
								if (!Parser.strIsNumber(valueToken.text)) {
									console.log('Could not parse: bad preprocessor define directive - bad value \''+valueToken.text+'\' ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
									return false;
								}

								// Create AST node structure
								let defineNode=this.nodeStackPush(AstNodeType.Define);

								let nameNode=this.nodeStackPush(AstNodeType.Name);
								nameNode.tokens.push(nameToken);
								this.nodeStackPop();

								let valueNode=this.nodeStackPush(AstNodeType.ExpressionTerminal);
								valueNode.tokens.push(valueToken);
								this.nodeStackPop();

								this.nodeStackPop();

								continue;
							} break;
						}

						console.log('Could not parse: bad preprocessor directive \''+token.text+'\' ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
						return false;
					}
				break;
				case AstNodeType.Definition:
					// Open parenthesis to indicate this is a function definition?
					if (token.text=='(') {
						currNode.type=AstNodeType.FunctionDefinition;

						// Peek at next token - if closing parenthesis then not actually any arguments
						if (input.length>0 && input[0].text==')') {
							input.shift();

							this.nodeStackPush(AstNodeType.Block);

							continue;
						}

						// Otherwise prepare for list of arguments
						this.nodeStackPush(AstNodeType.FunctionDefinitionArguments);

						continue;
					}

					// Semicolon to end definition?
					if (token.text==';') {
						this.nodeStackPop();

						continue;
					}
				break;
				case AstNodeType.Define:
				break;
				case AstNodeType.Type:
					// Base type?
					if (currNode.tokens.length==0 && Parser.strIsBaseType(token.text)) {
						currNode.tokens.push(token);

						continue;
					}

					// Indirection?
					if (currNode.tokens.length>0 && token.text=='*') {
						currNode.tokens.push(token);

						continue;
					}

					// Symbol to terminate type?
					if (currNode.tokens.length>0 && Parser.strIsSymbol(token.text)) {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.Name:
					// Symbol is all we can accept
					if (Parser.strIsSymbol(token.text)) {
						currNode.tokens.push(token);

						this.nodeStackPop();

						continue;
					}
				break;
				case AstNodeType.VariableDefinition:
					// Open square bracket to indicate array definition?
					if (token.text=='[') {
						// Peek at next token - must be a terminal
						if (input.length>0 && Parser.strIsTerminal(input[0].text)) {
							currNode.tokens.push(input.shift()!);

							// Peek at next token - must be a closing square bracket
							if (input.length>0 && input[0].text==']') {
								input.shift();

								continue;
							}
						}
					}

					// Require a comma, semicolon or open/close parenthesis to terminate
					if (token.text==',' || token.text==';' || token.text=='(' || token.text==')') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.FunctionDefinition:
					// Close curly to end function body (passed up from Block)?
					if (token.text=='}') {
						// Function is fully defined
						this.nodeStackPop();

						continue;
					}
				break;
				case AstNodeType.FunctionDefinitionArguments:
					// Comma to start new argument?
					if (token.text==',') {
						this.nodeStackPush(AstNodeType.VariableDefinition);

						continue;
					}

					// Closing parenthesis to end argument list?
					if (token.text==')') {
						this.nodeStackPop();

						this.nodeStackPush(AstNodeType.Block);

						continue;
					}
				break;
				case AstNodeType.Define:
				break;
				case AstNodeType.Block:
					// Open curly to start block?
					if (currNode.tokens.length==0 && token.text=='{') {
						this.nodeStackPush(AstNodeType.Statement);

						continue;
					}

					// Closing curly to end block?
					if (currNode.tokens.length==0 && token.text=='}') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}

					// Semicolon/colon passed up from statement?
					if (token.text==';' || token.text==':') {
						this.nodeStackPush(AstNodeType.Statement);

						continue;
					}
				break;
				case AstNodeType.Label:
					// First token must be a terminal symbol
					if (Parser.strIsSymbol(token.text)) {
						// Peek at next token checking for colon
						if (input.length>0 && input[0].text==':') {
							currNode.tokens.push(token);
							this.nodeStackPop();

							continue;
						}
					}

				break;
				case AstNodeType.Statement:
					// Type suggesting variable definition?
					if (Parser.strIsBaseType(token.text)) {
						this.nodeStackPush(AstNodeType.VariableDefinition);

						input.unshift(token);

						continue;
					}

					// Terminal symbol followed by colon suggesting label?
					if (Parser.strIsSymbol(token.text)) {
						// Peek at next token checking for colon
						if (input.length>0 && input[0].text==':') {
							this.nodeStackPush(AstNodeType.Label);

							input.unshift(token);

							continue;
						}
					}

					// Terminal literal suggesting part of an expression?
					if (Parser.strIsTerminal(token.text)) {
						this.nodeStackPush(AstNodeType.Expression);

						input.unshift(token);

						continue;
					}

					// Open parenthesis suggesting expression group?
					if (token.text=='(') {
						this.nodeStackPush(AstNodeType.Expression);

						input.unshift(token);

						continue;
					}

					// Closing parenthesis ending group?
					if (token.text==')') {
						this.nodeStackPop();

						continue;
					}

					// Return statement?
					if (token.text=='return') {
						this.nodeStackPush(AstNodeType.StatementReturn);

						input.unshift(token);

						continue;
					}

					// Continue statement?
					if (token.text=='continue') {
						this.nodeStackPush(AstNodeType.StatementContinue);

						input.unshift(token);

						continue;
					}

					// Break statement?
					if (token.text=='break') {
						this.nodeStackPush(AstNodeType.StatementBreak);

						input.unshift(token);

						continue;
					}

					// Goto statement?
					if (token.text=='goto') {
						this.nodeStackPush(AstNodeType.StatementGoto);

						input.unshift(token);

						continue;
					}

					// Inline asm statement?
					if (token.text=='asm') {
						this.nodeStackPush(AstNodeType.StatementInlineAsm);

						input.unshift(token);

						continue;
					}

					// While statement?
					if (token.text=='while') {
						currNode.type=AstNodeType.StatementWhile;
						currNode.tokens.push(token); // add token for better error reporting later

						continue;
					}

					// For statement?
					if (token.text=='for') {
						currNode.type=AstNodeType.StatementFor;
						currNode.tokens.push(token); // add token for better error reporting later

						continue;
					}

					// If statement?
					if (token.text=='if') {
						currNode.type=AstNodeType.StatementIf;
						currNode.tokens.push(token); // add token for better error reporting later

						continue;
					}

					// Semicolon to terminate statement?
					if (token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}

					// Colon to terminate label?
					if (token.text==':') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}

					// Closing curly for parent node?
					if (currNode.tokens.length==0 && token.text=='}') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.StatementReturn:
					// 'return' keyword to start statement?
					if (currNode.tokens.length==0 && token.text=='return') {
						// Add token for better error reporting later
						currNode.tokens.push(token);

						// Peek at next token - if semicolon then void return
						if (input.length>0 && input[0].text==';') {
							this.nodeStackPop();

							continue;
						}

						this.nodeStackPush(AstNodeType.Expression);

						continue;
					}

					// Semicolon to terminate statement?
					if (token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.StatementContinue:
					// 'continue' keyword to start statement?
					if (currNode.tokens.length==0 && token.text=='continue') {
						// Add token for better error reporting later
						currNode.tokens.push(token);

						// Peek at next token - must be semicolon
						if (input.length>0 && input[0].text==';') {
							this.nodeStackPop();

							continue;
						}
					}
				break;
				case AstNodeType.StatementBreak:
					// 'break;' keyword to start statement?
					if (currNode.tokens.length==0 && token.text=='break') {
						// Add token for better error reporting later
						currNode.tokens.push(token);

						// Peek at next token - must be semicolon
						if (input.length>0 && input[0].text==';') {
							this.nodeStackPop();

							continue;
						}
					}
				break;
				case AstNodeType.StatementWhile:
					// Open parenthesis starting condition?
					if (token.text=='(') {
						this.nodeStackPushHelper(currNode, AstNodeType.ExpressionBrackets);

						continue;
					}

					// Closing parenthesis to terminate condition?
					if (token.text==')') {
						this.nodeStackPushHelper(currNode, AstNodeType.Block);

						continue;
					}

					// Closing curly to terminate body?
					if (token.text=='}') {
						this.nodeStackPop();

						this.nodeStackPush(AstNodeType.Statement); // this statement can be empty if another closing curly follows

						continue;
					}
				break;
				case AstNodeType.StatementFor:
					// Open parenthesis starting initialisation statement?
					if (token.text=='(' && currNode.children.length==0) {
						this.nodeStackPushHelper(currNode, AstNodeType.Expression);

						continue;
					}

					// Semicolon ending initialisation or condition statements?
					if (token.text==';' && (currNode.children.length==1 || currNode.children.length==2)) {
						this.nodeStackPushHelper(currNode, AstNodeType.Expression);

						continue;
					}

					// Closing parenthesis ending increment statement?
					if (token.text==')' && currNode.children.length==3) {
						this.nodeStackPushHelper(currNode, AstNodeType.Block);

						continue;
					}

					// Closing curly to terminate body?
					if (token.text=='}') {
						this.nodeStackPop();

						this.nodeStackPush(AstNodeType.Statement); // this statement can be empty if another closing curly follows

						continue;
					}
				break;
				case AstNodeType.StatementIf:
					// Open parenthesis starting condition?
					if (token.text=='(') {
						this.nodeStackPushHelper(currNode, AstNodeType.ExpressionBrackets);

						continue;
					}

					// Closing parenthesis to terminate condition?
					if (token.text==')') {
						this.nodeStackPushHelper(currNode, AstNodeType.Block);

						continue;
					}

					// Closing curly to terminate body?
					if (token.text=='}') {
						this.nodeStackPop();

						this.nodeStackPush(AstNodeType.Statement); // this expression can be empty if another closing curly follows

						continue;
					}
				break;
				case AstNodeType.StatementGoto:
					// 'goto' keyword to start statement?
					if (currNode.tokens.length==0 && token.text=='goto') {
						// Add token for better error reporting later
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.Name);

						continue;
					}

					// Semicolon to terminate statement?
					if (token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.StatementInlineAsm:
					// 'asm' keyword to start statement?
					if (currNode.tokens.length==0 && token.text=='asm') {
						// Add token for better error reporting later
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.QuotedString);

						continue;
					}

					// Semicolon to terminate statement?
					if (token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.Expression:
					// Terminator?
					if (token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionAssignment:
					// Equals sign to indicate another operand?
					if (token.text=='=') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionOr);

						continue;
					}

					// Terminators
					if (token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionOr:
					// OR operator to indicate another operand?
					if (token.text=='||') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionAnd);

						continue;
					}

					// Terminators
					if (token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionAnd:
					// AND operator to indicate another operand?
					if (token.text=='&&') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionEquality);

						continue;
					}

					// Terminators
					if (token.text=='||' || token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionEquality:
					// Equality operator to indicate another operand?
					if (token.text=='==' || token.text=='!=') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionInequality);

						continue;
					}

					// Terminators
					if (token.text=='&&' || token.text=='||' || token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionInequality:
					// Inequality comparison operator to indicate another operand?
					if (token.text=='<' || token.text=='<=' || token.text=='>' || token.text=='>=') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionAddition);

						continue;
					}

					// Terminators
					if (token.text=='&&' || token.text=='||' || token.text=='==' || token.text=='!=' || token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionAddition:
					// Plus or minus sign to indicate another operand?
					if (token.text=='+' || token.text=='-') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionMultiplication);

						continue;
					}

					// Terminators
					if (token.text=='<' || token.text=='<=' || token.text=='>' || token.text=='>=' || token.text=='&&' || token.text=='||' || token.text=='==' || token.text=='!=' || token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionMultiplication:
					// Multiply or divide sign to indicate another operand?
					if (token.text=='*' || token.text=='/') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionTerminal);

						continue;
					}

					// Terminators
					if (token.text=='+' || token.text=='-' || token.text=='<' || token.text=='<=' || token.text=='>' || token.text=='>=' || token.text=='&&' || token.text=='||' || token.text=='==' || token.text=='!=' || token.text=='=' || token.text==']' || token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionTerminal:
					// Symbol followed by open parenthesis to indicate function call?
					if (Parser.strIsSymbol(token.text)) {
						// Peek at next token
						if (input.length>0 && input[0].text=='(') {
							input.shift();

							// Update node
							currNode.type=AstNodeType.ExpressionCall;
							currNode.tokens.push(token);

							continue;
						}
					}

					// Symbol followed by open square bracket to indicate array dereference?
					if (Parser.strIsSymbol(token.text)) {
						// Peek at next token
						if (input.length>0 && input[0].text=='[') {
							input.shift();

							// Update node
							currNode.type=AstNodeType.ExpressionDereference;
							currNode.tokens.push(token);

							continue;
						}
					}

					// Number or symbol?
					if (Parser.strIsTerminal(token.text)) {
						currNode.tokens.push(token);

						this.nodeStackPop();

						continue;
					}

					// Quoted string?
					if (token.text.length>=2 && token.text[0]=='"' && token.text[token.text.length-1]=='"') {
						currNode.type=AstNodeType.QuotedString;
						currNode.tokens.push(token);

						this.nodeStackPop();

						continue;
					}

					// Open parenthesis starting group?
					if (token.text=='(') {
						this.nodeStackPush(AstNodeType.ExpressionBrackets);

						continue;
					}

					// Close parenthesis terminating group?
					if (token.text==')') {
						this.nodeStackPop();

						continue;
					}
				break;
				case AstNodeType.ExpressionBrackets:
					// Close parenthesis terminating a group?
					if (token.text==')') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionCall:
					// Closing parenthesis to indicate end of argument list?
					if (token.text==')') {
						this.nodeStackPop();

						continue;
					}

					// Comma to indicate next argument?
					if (token.text==',') {
						this.nodeStackPush(AstNodeType.Expression);

						continue;
					}

					// Otherwise must be an expression
					input.unshift(token);

					this.nodeStackPush(AstNodeType.Expression);

					continue;
				break;
				case AstNodeType.ExpressionDereference:
					// Closing square bracket to indicate end of dereference?
					if (token.text==']') {
						this.nodeStackPop();

						continue;
					}

					// Otherwise must be an expression
					input.unshift(token);

					this.nodeStackPush(AstNodeType.Expression);

					continue;
				break;
				case AstNodeType.QuotedString:
					if (token.text.length>=2 && token.text.substring(0,1)=='"' && token.text.substring(token.text.length-1)=='"') {
						currNode.tokens.push(token);

						this.nodeStackPop();

						continue;
					}
				break;
			}

			// Bad sequence of tokens
			console.log('Could not parse: unexpected token \''+token.text+'\' ('+token.location.toString()+', state '+this.nodeStackGetHierarchyString()+')');
			return false;
		}

		if (this.nodeStack.length!=1) {
			console.log('Could not parse: unsatisfied nodes '+this.nodeStackGetHierarchyString());
			return false;
		}

		return true;
	}

	private nodeStackGetHierarchyString():string {
		let str='';
		for(let node:null|AstNode=this.nodeStack[this.nodeStack.length-1]; node!==null; node=node.parent) {
			if (str.length>0)
				str='->'+str;
			str=AstNodeType[node.type]+str;
		}
		return str;
	}

	private nodeStackPush(type:AstNodeType):AstNode {
		let parent=this.nodeStack[this.nodeStack.length-1];
		return this.nodeStackPushHelper(parent, type);
	}

	private nodeStackPushHelper(parent:AstNode, type:AstNodeType):AstNode {
		let node=parent.createChild(type, this.nextNodeId++);
		this.nodeStack.push(node);

		switch(type) {
			case AstNodeType.Root:
			break;
			case AstNodeType.Definition:
				this.nodeStackPushHelper(node, AstNodeType.VariableDefinition);
			break;
			case AstNodeType.Type:
			break;
			case AstNodeType.Name:
			break;
			case AstNodeType.VariableDefinition:
				this.nodeStackPushHelper(node, AstNodeType.Name);
				this.nodeStackPushHelper(node, AstNodeType.Type);
			break;
			case AstNodeType.FunctionDefinition:
				// Never created in this way
			break;
			case AstNodeType.FunctionDefinitionArguments:
				this.nodeStackPushHelper(node, AstNodeType.VariableDefinition);
			break;
			case AstNodeType.Define:
			break;
			case AstNodeType.Block:
			break;
			case AstNodeType.Label:
			break;
			case AstNodeType.Statement:
			break;
			case AstNodeType.StatementReturn:
			break;
			case AstNodeType.StatementContinue:
			break;
			case AstNodeType.StatementBreak:
			break;
			case AstNodeType.StatementWhile:
			break;
			case AstNodeType.StatementFor:
			break;
			case AstNodeType.StatementIf:
			break;
			case AstNodeType.StatementGoto:
			break;
			case AstNodeType.StatementInlineAsm:
			break;
			case AstNodeType.Expression:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionAssignment);
			break;
			case AstNodeType.ExpressionAssignment:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionOr);
			break;
			case AstNodeType.ExpressionOr:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionAnd);
			break;
			case AstNodeType.ExpressionAnd:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionEquality);
			break;
			case AstNodeType.ExpressionEquality:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionInequality);
			break;
			case AstNodeType.ExpressionInequality:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionAddition);
			break;
			case AstNodeType.ExpressionAddition:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionMultiplication);
			break;
			case AstNodeType.ExpressionMultiplication:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionTerminal);
			break;
			case AstNodeType.ExpressionTerminal:
			break;
			case AstNodeType.ExpressionBrackets:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionAssignment);
			break;
			case AstNodeType.ExpressionCall:
			break;
			case AstNodeType.ExpressionDereference:
			break;
			case AstNodeType.QuotedString:
			break;
		}

		return node;
	}

	private nodeStackPop() {
		this.nodeStack.pop();
	}

	public static strIsBaseType(str: string):boolean {
		if (str=='uint8_t' || str=='uint16_t' || str=='void')
			return true;
		return false;
	}

	public static strIsKeyword(str: string):boolean {
		if (str=='return' || str=='asm' || str=='while' || str=='for' || str=='if' || str=='continue' || str=='break' || str=='goto')
			return true;
		return false;
	}

	public static strIsSymbol(str: string):boolean {
		if (str.length==0)
			return false;
		if (Parser.strIsKeyword(str))
			return false;
		if (Parser.strIsBaseType(str))
			return false;
		for(let i=0; i<str.length; ++i) {
			let c=str[i];
			if (c.charCodeAt(0)>='0'.charCodeAt(0) && c.charCodeAt(0)<='9'.charCodeAt(0) && i!=0)
				continue;
			if (c.charCodeAt(0)>='a'.charCodeAt(0) && c.charCodeAt(0)<='z'.charCodeAt(0))
				continue;
			if (c.charCodeAt(0)>='A'.charCodeAt(0) && c.charCodeAt(0)<='Z'.charCodeAt(0))
				continue;
			if (c=='_')
				continue;
			return false;
		}
		return true;
	}

	public static strIsTerminal(str: string) {
		if (Parser.strIsNumber(str))
			return true;

		if (Parser.strIsSymbol(str))
			return true;

		return false;
	}

	public static strIsNumber(str: string) {
		if (str.length==0)
			return false;

		let i;
		for(let i=0; i<str.length; ++i) {
			let c=str[i];
			if (c.charCodeAt(0)<'0'.charCodeAt(0) || c.charCodeAt(0)>'9'.charCodeAt(0))
				return false;
		}

		return true;
	}
}
