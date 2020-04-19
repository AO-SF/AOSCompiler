const nearley = require("nearley");

if (process.argv.length!=4) {
	console.log("bad arguments"); // TODO: improve this
	process.exit(1);
}

const inputPath=process.argv[2];
const outputPath=process.argv[3];

let fs=require('fs');
let path=require('path');
const inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8')

// Create a Parser object from our grammar.
const grammar = require("../src/grammar1.js");
const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

// Parse something!
parser.feed(inputData);

// parser.results is an array of possible parsings.
console.log(parser.results);
