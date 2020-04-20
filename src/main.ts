import { Parser } from './parser'
import { Tokenizer } from './tokenizer'

// Process arguments
if (process.argv.length!=4) {
	console.log("bad arguments"); // TODO: improve this
	process.exit(1);
}

const inputPath=process.argv[2];
const outputPath=process.argv[3];

// Load input file data
let fs=require('fs');
let path=require('path');
const inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8')

// Tokenize
let tokens=Tokenizer.tokenize(inputData, inputPath);
if (tokens===null) {
	console.log("Error: could not tokenize\n");
	process.exit(0);
}

// Parse
let ast=Parser.parse(tokens);
if (ast===null) {
	console.log("Error: could not parse\n");
	process.exit(0);
}

// Temp debugging
console.log(tokens);
console.log(ast);
