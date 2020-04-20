import { Tokenizer } from './tokenizer'

if (process.argv.length!=4) {
	console.log("bad arguments"); // TODO: improve this
	process.exit(1);
}

const inputPath=process.argv[2];
const outputPath=process.argv[3];

let fs=require('fs');
let path=require('path');
const inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8')

let tokens=Tokenizer.tokenize(inputData);
if (tokens.length==0) {
	console.log("Error: could not tokenize\n");
	process.exit(0);
}

console.log(tokens);
