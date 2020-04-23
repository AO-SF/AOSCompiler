import { Generator } from './generator';
import { Token } from './tokenizer';

export class ScopeSymbol {
	public constructor(public scope: Scope, public name:string, public mangledName:string, public definitionToken: Token) {
	}
}

export class ScopeVariable extends ScopeSymbol {
	public constructor(scope: Scope, name:string, mangledName:string, definitionToken: Token, public type:string, public totalSize:number) {
		super(scope, name, mangledName, definitionToken);
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

	// This function returns total number of bytes required to store all local variables in this scope and all descendant scopes
	public getTotalVariableSizeAllocation():number {
		let total=0;

		// First sum size of all variables allocated directly within this scope (not within children)
		for(let i=0; i<this.symbols.length; ++i) {
			if (this.symbols[i] instanceof ScopeVariable)
				total+=(this.symbols[i] as ScopeVariable).totalSize;
		}

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

	public debug(identation:number=0) {
		console.log(' '.repeat(identation)+this.name);
		for(let i=0; i<this.children.length; ++i)
			this.children[i].debug(identation+2);
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
