export class Scope {
	public static separator='__';

	private nextSubLabelId=0;

	public constructor(public name:string) {
	}

	public genNewSymbolPrefix():string {
		return this.name+Scope.separator+(this.nextSubLabelId++);
	}

	public getVariableByName(name:string ):null | ScopeVariable {
		return null;
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
}
