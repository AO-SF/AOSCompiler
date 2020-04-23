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
}

export class Scope {
	public static separator='__';

	private nextSubLabelId=0;

	public symbols: ScopeSymbol[] = [];

	public constructor(public name:string) {
	}

	public genNewSymbolPrefix():string {
		return this.name+Scope.separator+(this.nextSubLabelId++);
	}

	public getSymbolByName(name:string ):null | ScopeSymbol {
		for(let i=0; i<this.symbols.length; ++i)
			if (this.symbols[i].name==name)
				return this.symbols[i];
		return null;
	}

	public addVariable(name:string, type:string, totalSize:number, definitionToken:Token):ScopeSymbol {
		let managedName=this.genNewSymbolPrefix()+'_variable_'+Generator.escapeName(name);
		let variable=new ScopeVariable(this, name, managedName, definitionToken, type, totalSize);
		this.symbols.push(variable);
		return variable;
	}

	public addfunction(name:string, definitionToken:Token):ScopeSymbol {
		let managedName=this.genNewSymbolPrefix()+'_function_'+Generator.escapeName(name);
		let func=new ScopeFunction(this, name, managedName, definitionToken);
		this.symbols.push(func);
		return func;
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
		let scope=new Scope(name);
		this.scopes.push(scope);
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
}
