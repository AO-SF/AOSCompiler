import { AstNode, AstNodeType } from './ast';
import { Token } from './tokenizer';

export class Parser {
	private nodeStack: AstNode[];

	public constructor() {
	}

	public parse(input: Token[]):null | AstNode {
		let root = new AstNode(AstNodeType.Root);

		this.nodeStack = [root];

		let token;
		while((token=input.shift())!=undefined) {
			let currNode=this.nodeStack[this.nodeStack.length-1];
			switch(currNode.type) {
				case AstNodeType.Root:
					// Type to start a definition (variable or function)?
					if (this.strIsBaseType(token.text)) {
						this.nodeStackPush(AstNodeType.Definition);

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.Definition:
					// Open parenthesis to indicate this is a function definition?
					if (token.text=='(') {
						currNode.type=AstNodeType.FunctionDefinition;

						this.nodeStackPush(AstNodeType.FunctionDefinitionArguments);

						continue;
					}
				break;
				case AstNodeType.Type:
					// Base type?
					if (currNode.tokens.length==0 && this.strIsBaseType(token.text)) {
						currNode.tokens.push(token);

						continue;
					}

					// Indirection?
					if (currNode.tokens.length>0 && token.text=='*') {
						currNode.tokens.push(token);

						continue;
					}

					// Symbol to terminate type?
					if (currNode.tokens.length>0 && this.strIsSymbol(token.text)) {
						this.nodeStackPop();

						input.unshift(token);

						continue;
					}
				break;
				case AstNodeType.Name:
					// Symbol is all we can accept
					if (this.strIsSymbol(token.text)) {
						currNode.tokens.push(token);

						this.nodeStackPop();

						continue;
					}
				break;
				case AstNodeType.VariableDefinition:
					this.nodeStackPop();

					input.unshift(token);

					continue;
				break;
				case AstNodeType.FunctionDefinition:
					// Open curly to start function body?
					if (token.text=='{') {
						// TODO: this

						continue;
					}

					// Close curly to end function body?
					if (token.text=='}') {
						// Function is fulled defined
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

						continue;
					}
				break;
			}

			// Bad sequence of tokens
			console.log("Could not parse: unexpected token '"+token.text+"' (file '"+token.file+"', line "+token.lineNum+", column "+token.columnNum+", state "+this.nodeStackGetHierarchyString()+")");
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
		for(let i=0; i<this.nodeStack.length; ++i) {
			if (i>0)
				str+='->';
			str+=AstNodeType[this.nodeStack[i].type];
		}
		return str;
	}

	private nodeStackPush(type:AstNodeType) {
		let parent=this.nodeStack[this.nodeStack.length-1];
		this.nodeStackPushHelper(parent, type);
	}

	private nodeStackPushHelper(parent:AstNode, type:AstNodeType) {
		let node=parent.createChild(type);
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
		}
	}

	private nodeStackPop() {
		this.nodeStack.pop();
	}

	private strIsBaseType(str: string):boolean {
		if (str=='uint8_t' || str=='uint16_t')
			return true;
		return false;
	}

	private strIsKeyword(str: string):boolean {
		if (str=='return' || str=='if' || str=='while')
			return true;
		return false;
	}

	private strIsSymbol(str: string):boolean {
		if (str.length==0)
			return false;
		if (this.strIsKeyword(str))
			return false;
		if (this.strIsBaseType(str))
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
}
