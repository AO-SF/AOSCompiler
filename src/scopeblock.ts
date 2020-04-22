export class ScopeBlock {
	public static separator='__';

	private nextSubLabelId=0;

	public constructor(public name:string) {
	}

	public genNewSymbolPrefix():string {
		return this.name+ScopeBlock.separator+(this.nextSubLabelId++);
	}
}
