import { Generator } from './generator';
import { Token } from './tokenizer';

export class ScopeSymbol {
	public constructor(public scope: Scope, public name:string, public mangledName:string, public definitionToken: Token) {
	}

	public getFunctionScope():null|Scope {
		return this.scope.getFunctionScope();
	}
}

export class ScopeVariable extends ScopeSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token, public type:string, public totalSize:number) {
		super(scope, name, mangledName, definitionToken);
	}

	// For global variables, returns 0.
	// For automatic variables, returns how far into the relevant function's stack storage this variable is.
	// For example the very first automatic variable defined at the start of a function will return 0,
	// the next one after it at 2 (assuming first variable is 16 bit).
	public getStackOffset():number {
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
}

export class Scope {
	public static separator='__';

	private nextSubLabelId=0;

	public symbols: ScopeSymbol[] = [];
	public children: Scope[] = [];

	public constructor(public name:string, public parent:null|Scope) {
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

	public genNewSymbolMangledName():string {
		return this.name+this.genNewSymbolMangledPrefix();
	}

	public genNewSymbolMangledPrefix():string {
		return Scope.separator+(this.nextSubLabelId++);
	}

	public getSymbolByName(name:string ):null | ScopeSymbol {
		for(let i=0; i<this.symbols.length; ++i)
			if (this.symbols[i].name==name)
				return this.symbols[i];
		return null;
	}

	public addVariable(name:string, type:string, totalSize:number, definitionToken:Token):ScopeVariable {
		let mangledName=this.genNewSymbolMangledName()+'_variable_'+Generator.escapeName(name);
		let variable=new ScopeVariable(this, name, mangledName, definitionToken, type, totalSize);
		this.symbols.push(variable);
		return variable;
	}

	public addfunction(name:string, definitionToken:Token):ScopeFunction {
		let mangledName=this.genNewSymbolMangledName()+'_function_'+Generator.escapeName(name);
		let func=new ScopeFunction(this, name, mangledName, definitionToken);
		this.symbols.push(func);
		return func;
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

export class ScopeStack {
	private scopes: Scope[] = [];

	public constructor() {
	}

	public peek():null | Scope {
		return (this.scopes.length>0 ? this.scopes[this.scopes.length-1] : null);
	}

	public push(name: string):Scope {
		let parentScope=this.peek();
		if (parentScope!==null)
				name=parentScope.name+name;
		let scope=new Scope(name, parentScope);
		this.scopes.push(scope);
		if (parentScope!==null)
			parentScope.children.push(scope);
		return scope;
	}

	public pop() {
		this.scopes.pop();
	}

	public getSymbolByName(name: string):null | ScopeSymbol {
		for(let i=0; i<this.scopes.length; ++i) {
			let symbol=this.scopes[i].getSymbolByName(name);
			if (symbol!==null)
				return symbol;
		}
		return null;
	}

	// If scopes is empty or contains only the global scope, this returns null.
	// Otherwise this returns the mangled name for whichever function this scope either is or is descendant from.
	public getFunctionMangledName():null | string {
		// HACK: this assumes the 2nd scope in the list is always a function, may not always be true in the future

		if (this.scopes.length<2)
			return null;

		return this.scopes[1].name;
	}

	public debug() {
		console.log('Scope Stack:');
		if (this.scopes.length>0)
			this.scopes[0].debug(2);
	}
}
