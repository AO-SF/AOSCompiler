import { AstNode, AstNodeType } from './ast';
import { Token } from './tokenizer';

export class Parser {
	private nodeStack: AstNode[];
	private nextNodeId:number;

	public constructor() {
	}

	public parse(input: Token[]):null | AstNode {
		this.nextNodeId=0;

		let root = new AstNode(AstNodeType.Root, this.nextNodeId++);

		this.nodeStack = [root];

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

					// Semicolon passed up from statement?
					if (token.text==';') {
						this.nodeStackPush(AstNodeType.Statement);

						continue;
					}
				break;
				case AstNodeType.Statement:
					// Type suggesting variable definition?
					if (Parser.strIsBaseType(token.text)) {
						this.nodeStackPush(AstNodeType.VariableDefinition);

						input.unshift(token);

						continue;
					}

					// Terminal literal suggesting part of an expression?
					if (Parser.strIsTerminal(token.text)) {
						this.nodeStackPush(AstNodeType.Expression);

						input.unshift(token);

						continue;
					}

					// Return statement?
					if (token.text=='return') {
						this.nodeStackPush(AstNodeType.StatementReturn);

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
						currNode=this.nodeStackPush(AstNodeType.StatementWhile);
						currNode.tokens.push(token); // add token for better error reporting later

						continue;
					}

					// If statement?
					if (token.text=='if') {
						currNode=this.nodeStackPush(AstNodeType.StatementIf);
						currNode.tokens.push(token); // add token for better error reporting later

						continue;
					}

					// Semicolon to terminate statement?
					if (token.text==';') {
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
					if (token.text==')' || token.text==',' || token.text==';') {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.ExpressionAssignment:
					// Equals sign to indicate another operand?
					if (token.text=='=') {
						currNode.tokens.push(token);

						this.nodeStackPush(AstNodeType.ExpressionInequality);

						continue;
					}

					// Terminators
					if (token.text==')' || token.text==',' || token.text==';') {
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
					if (token.text=='=' || token.text==')' || token.text==',' || token.text==';') {
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
					if (token.text=='<' || token.text=='<=' || token.text=='>' || token.text=='>=' || token.text=='=' || token.text==')' || token.text==',' || token.text==';') {
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
					if (token.text=='+' || token.text=='-' || token.text=='<' || token.text=='<=' || token.text=='>' || token.text=='>=' || token.text=='=' || token.text==')' || token.text==',' || token.text==';') {
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
			return null;
		}

		if (this.nodeStack.length!=1) {
			console.log('Could not parse: unsatisfied nodes '+this.nodeStackGetHierarchyString());
			return null;
		}

		return root;
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
			case AstNodeType.Block:
			break;
			case AstNodeType.Statement:
			break;
			case AstNodeType.StatementReturn:
			break;
			case AstNodeType.StatementWhile:
			break;
			case AstNodeType.StatementIf:
			break;
			case AstNodeType.StatementInlineAsm:
			break;
			case AstNodeType.Expression:
				this.nodeStackPushHelper(node, AstNodeType.ExpressionAssignment);
			break;
			case AstNodeType.ExpressionAssignment:
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
		if (str=='return' || str=='asm' || str=='while' || str=='if')
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
