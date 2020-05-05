import { Generator } from './generator'
import { Optimizer } from './optimizer'
import { Parser } from './parser'

let fs=require('fs');
let path=require('path');

// Process arguments
if (process.argv.length!=4 && process.argv.length!=5) {
	console.log('Usage: '+process.argv[0]+' '+process.argv[1]+' [--ast] inputfile outputfile');
	process.exit(1);
}

let showAst=false;
for(let i=2; i<process.argv.length-2; ++i) {
	if (process.argv[i]=='--ast')
		showAst=true;
	else
		console.log('Warning: unknown option \''+process.argv[i]+'\'');
}
const inputPath=process.argv[process.argv.length-2];
const outputPath=process.argv[process.argv.length-1];

// Parse input file (and any others included by it)
let parser=new Parser();
let ast=parser.parse(inputPath);
if (ast===null) {
	console.log('Error: could not parse\n');
	process.exit(0);
}

// Optimize
let optimizer=new Optimizer();
optimizer.optimize(ast);

// Output AST if needed
if (showAst) {
	console.log("Abstract syntax tree:");
	ast.debug();
	console.log('');
}

// Generate code
let generator=new Generator();
let outputData=generator.generate(ast);
if (outputData===null) {
	console.log('Error: could not generate code\n');
	process.exit(0);
}

// Write code to output file
fs.writeFileSync(path.resolve(__dirname, outputPath), outputData);
