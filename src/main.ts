import { Generator } from './generator'
import { Optimizer } from './optimizer'
import { Parser } from './parser'
import { Tokenizer } from './tokenizer'

let fs=require('fs');
let path=require('path');

// Process arguments
if (process.argv.length!=4) {
	console.log("bad arguments"); // TODO: improve this
	process.exit(1);
}

const inputPath=process.argv[2];
const outputPath=process.argv[3];

// Load input file data
const inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8')

// Tokenize
let tokens=Tokenizer.tokenize(inputData, inputPath);
if (tokens===null) {
	console.log("Error: could not tokenize\n");
	process.exit(0);
}

// Temp debugging
console.log(tokens);

// Parse
let parser=new Parser();
let ast=parser.parse(tokens);
if (ast===null) {
	console.log("Error: could not parse\n");
	process.exit(0);
}

// Temp debugging
ast.debug();

// Optimize
let optimizer=new Optimizer();
optimizer.optimize(ast);

// Temp debugging
ast.debug();

// Generate code
let generator=new Generator();
let outputData=generator.generate(ast);
if (outputData===null) {
	console.log("Error: could not generate code\n");
	process.exit(0);
}

// Write code to output file
fs.writeFileSync(path.resolve(__dirname, outputPath), outputData);
