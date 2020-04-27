import { Generator } from './generator';
import { Token } from './tokenizer';

export class ScopeSymbol {
	public constructor(public scope: Scope, public name:string, public mangledName:string, public definitionToken: Token) {
	}

	public getFunctionScope():null|Scope {
		return this.scope.getFunctionScope();
	}
}

export class ScopeStorageSymbol extends ScopeSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token, public type:string, public totalSize:number) {
		super(scope, name, mangledName, definitionToken);
	}

	// For global variables returns 0.
	// Otherwise returns how far into the relevant function's stack storage this variable is.
	// Classes which implement this interface should redefine this as required.
	public getStackAdjustment():number {
		return 0;
	}
}

export class ScopeVariable extends ScopeStorageSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token, type:string, totalSize:number) {
		super(scope, name, mangledName, definitionToken, type, totalSize);
	}

	// For global variables, returns 0.
	// For automatic variables, returns how far into the relevant function's stack storage this variable is.
	// For example the very first automatic variable defined at the start of a function will return 0,
	// the next one after it at 2 (assuming first variable is 16 bit).
	private getStackOffset():number {
		// Global variable?
		// (shouldn't really be used in this way anyway)
		if (this.scope.name=='global')
			return 0;

		// Find our local offset within our scope.
		let localOffset=0;
		for (let i=0; i<this.scope.symbols.length; ++i) {
			if (!(this.scope.symbols[i] instanceof ScopeVariable))
				continue;
			let loopVariable=this.scope.symbols[i] as ScopeVariable;
			if (loopVariable.name==this.name)
				break;
			localOffset+=loopVariable.totalSize;
		}

		// Find our scope's offset
		let scopeOffset=this.scope.getStackOffset();

		return scopeOffset+localOffset;
	}

	// For global variables, returns 0.
	// For automatic variables, returns how much the stack pointer should be decreased by to find the storage for this variable.
	// Assumes the stack is as it was after starting the function (so already incremented by total stack allocation for the function, but no more).
	public getStackAdjustment():number {
		// Grab relevant function scope (or return if global)
		let functionScope=this.getFunctionScope();
		if (functionScope===null)
			return 0;

		// Take total stack allocation and subtract offset of this variable.
		let stackAllocation=functionScope.getTotalVariableSizeAllocation();
		let stackOffset=this.getStackOffset();
		return stackAllocation-stackOffset;
	}
}

export class ScopeFunction extends ScopeSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token) {
		super(scope, name, mangledName, definitionToken);
	}

	public getScopeName():string {
		return this.mangledName.substr(this.scope.name.length);
	}

	// this.scope is the scope containing this functions definition,
	// but this function returns the scope representing the body of the function
	public getBodyScope():null|Scope {
		for(let i=0; i<this.scope.children.length; ++i) {
			if (this.scope.children[i].name==this.mangledName)
				return this.scope.children[i];
		}
		return null;
	}

	// See Scope.getArgumentN for more info
	public getArgumentN(n:number):null|ScopeArgument {
		let bodyScope=this.getBodyScope();
		if (bodyScope===null)
			return null;
		return bodyScope.getArgumentN(n);
	}
}

export class ScopeArgument extends ScopeStorageSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token, type:string, totalSize:number) {
		super(scope, name, mangledName, definitionToken, type, totalSize);
	}

	// Returns offset of this argument in the stack space allocated to arguments
	private getStackOffset():number {
		let offset=0;
		for(let i=0; i<this.scope.symbols.length; ++i) {
			if (!(this.scope.symbols[i] instanceof ScopeArgument))
				continue;
			let argument=this.scope.symbols[i] as ScopeArgument;

			if (argument.name==this.name)
				break;

			offset+=argument.totalSize;
		}
		return offset;
	}

	// Returns how much the stack pointer should be decreased by to find the storage for this argument.
	// Assumes the stack is as it was after starting the function (so already incremented by total stack allocation for the function, but no more).
	public getStackAdjustment():number {
		let stackAdjustment=0;

		// Start by adjusting for variables defined within function body
		stackAdjustment+=this.scope.getTotalVariableSizeAllocation();

		// Adjust by 2 more bytes to skip over return address (added to stack during asm call instruction).
		stackAdjustment+=2;

		// Adjust by total of argument sizes and then back up based on offset of this particular argument.
		stackAdjustment+=this.scope.getTotalArgumentSizeAllocation();
		stackAdjustment-=this.getStackOffset();

		return stackAdjustment;
	}

}

export class Scope {
	public static separator='__';

	public symbols: ScopeSymbol[] = [];
	public children: Scope[] = [];

	public constructor(public name:string, public parent:null|Scope) {
	}

	public push(name: string):Scope {
		name=this.name+name;
		let scope=new Scope(name, this);
		this.children.push(scope);
		return scope;
	}

	public getFunctionScope():null|Scope {
		// Global scope has no function
		if (this.parent===null)
			return null;

		// Is this a function scope directly?
		if (this.parent.parent===null)
			return this;

		// Walk up tree until find function ancestor
		return this.parent.getFunctionScope();
	}

	// If we are the global scope, returns null.
	// Otherwise this returns the mangled name for whichever function this scope either is or is descendant from.
	public getFunctionMangledName():null | string {
		// HACK: this assumes the 2nd scope in the tree is always a function, may not always be true in the future

		// Global scope?
		if (this.parent===null)
			return null;

		// Fnuction scope itself?
		if (this.parent.parent===null)
			return this.name;

		// Otherwise recursively try parent to see if it is the function scope
		return this.parent.getFunctionMangledName();
	}

	public genNewSymbolMangledName(id:number):string {
		return this.name+this.genNewSymbolMangledPrefix(id);
	}

	public genNewSymbolMangledPrefix(id:number):string {
		return Scope.separator+id;
	}

	public getSymbolByName(name:string ):null | ScopeSymbol {
		// Check within this scope
		for(let i=0; i<this.symbols.length; ++i)
			if (this.symbols[i].name==name)
				return this.symbols[i];

		// Check within parent scope recursively (if any parent)
		if (this.parent!==null)
			return this.parent.getSymbolByName(name);

		return null;
	}

	public addVariable(name:string, id:number, definitionToken:Token, type:string, totalSize:number):ScopeVariable {
		let mangledName=this.genNewSymbolMangledName(id)+'_variable_'+Generator.escapeName(name);
		let variable=new ScopeVariable(this, name, mangledName, definitionToken, type, totalSize);
		this.symbols.push(variable);
		return variable;
	}

	public addFunction(name:string, id:number, definitionToken:Token):ScopeFunction {
		let mangledName=this.genNewSymbolMangledName(id)+'_function_'+Generator.escapeName(name);
		let func=new ScopeFunction(this, name, mangledName, definitionToken);
		this.symbols.push(func);
		return func;
	}

	public addArgument(name:string, id:number, definitionToken:Token, type:string, totalSize:number):ScopeArgument {
		let mangledName=this.genNewSymbolMangledName(id)+'_argument_'+Generator.escapeName(name);
		let arg=new ScopeArgument(this, name, mangledName, definitionToken, type, totalSize);
		this.symbols.push(arg);
		return arg;
	}

	// This function returns total number of bytes required to store all local variables in this scope but NOT any from descendant scopes
	public getLocalVariableSizeAllocation():number {
		let total=0;

		// Sum size of all variables allocated directly within this scope (not within children)
		for(let i=0; i<this.symbols.length; ++i) {
			if (this.symbols[i] instanceof ScopeVariable)
				total+=(this.symbols[i] as ScopeVariable).totalSize;
		}

		return total;
	}

	// This function returns total number of bytes required to store all local variables in this scope and all descendant scopes
	public getTotalVariableSizeAllocation():number {
		let total=0;

		// First sum size of all variables allocated directly within this scope (not within children)
		total+=this.getLocalVariableSizeAllocation();

		// Next find largest child scope and add this to existing total.
		let largestChildAllocation=0;
		for (let i=0; i<this.children.length; ++i) {
			let childAllocation=this.children[i].getTotalVariableSizeAllocation();
			if (childAllocation>largestChildAllocation)
				largestChildAllocation=childAllocation;
		}
		total+=largestChildAllocation;

		return total;
	}

	// For function scopes (directly), returns total number of bytes required to store all arguments for the function.
	// Otherwise returns 0.
	public getTotalArgumentSizeAllocation():number {
		let total=0;

		for(let i=0; i<this.symbols.length; ++i) {
			if (this.symbols[i] instanceof ScopeArgument)
				total+=(this.symbols[i] as ScopeArgument).totalSize;
		}

		return total;
	}

	// For root scope and immediate descendants (i.e. functions), returns 0.
	// For all other scopes, returns how far into the relevant function's stack storage the variables in this scope start.
	// See ScopeVariable.getStackOffset for more information.
	public getStackOffset():number {
		// Global variable?
		// (shouldn't really be used in this way anyway)
		if (this.name=='global' || this.parent===null)
			return 0;

		// Handle function scopes
		if (this.parent.name=='global' || this.parent.parent===null)
			return 0;

		// This scope must be a sub-scope, and so its variables will be placed after all variables in the parent scope.
		return this.parent.getStackOffset()+this.parent.getLocalVariableSizeAllocation();
	}

	// For root scope returns null.
	// For other scopes (functions and their descendants) returns nth argument of the function this scope belongs to (or null if n too large)
	public getArgumentN(n:number):null|ScopeArgument {
		// Global scope?
		if (this.parent===null)
			return null;

		// Not a function scope?
		if (this.parent.parent!==null)
			return this.parent.getArgumentN(n);

		// Look through symbols for nth argument
		for(let i=0; i<this.symbols.length; ++i) {
			if (!(this.symbols[i] instanceof ScopeArgument))
				continue;

			if (n==0)
				return (this.symbols[i] as ScopeArgument);

			--n;
		}

		return null;
	}

	public debug(indentation:number=0) {
		// Print string for this scope
		let str=' '.repeat(indentation)+this.name;

		if (this.parent!==null) {
			// Non-global scopes
			str+=' (';
			if (this.parent.parent!=null)
				// Non-function scopes
				str+='stackOffset='+this.getStackOffset()+', ';
			str+='stackAllocation='+this.getTotalVariableSizeAllocation();
			str+=')';
		}

		console.log(str);

		// Recurse to debug child scopes
		for(let i=0; i<this.children.length; ++i)
			this.children[i].debug(indentation+2);
	}
}
