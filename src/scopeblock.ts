export class ScopeVariable {
	public constructor(public scope: Scope, public name:string, public type:string, public totalSize:number) {
	}
}

export class Scope {
	public static separator='__';

	private nextSubLabelId=0;

	public variables: ScopeVariable[] = [];

	public constructor(public name:string) {
	}

	public genNewSymbolPrefix():string {
		return this.name+Scope.separator+(this.nextSubLabelId++);
	}

	public getVariableByName(name:string ):null | ScopeVariable {
		for(let i=0; i<this.variables.length; ++i)
			if (this.variables[i].name==name)
				return this.variables[i];
		return null;
	}

	public addVariable(name:string, type:string, totalSize:number):ScopeVariable {
		let variable=new ScopeVariable(this, name, type, totalSize);
		this.variables.push(variable);
		return variable;
	}
}

export class ScopeStack {
	private scopes: Scope[] = [];

	public constructor() {
	}

	public peek():null | Scope {
		return (this.scopes.length>0 ? this.scopes[this.scopes.length-1] : null);
	}

	public push(scope: Scope) {
		this.scopes.push(scope);
	}

	public pop() {
		this.scopes.pop();
	}

	public getVariableByName(name: string):null | ScopeVariable {
		for(let i=0; i<this.scopes.length; ++i) {
			let variable=this.scopes[i].getVariableByName(name);
			if (variable!==null)
				return variable;
		}
		return null;
	}
}
