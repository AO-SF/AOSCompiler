let parser = require('../src/arithmeticgrammar.js');

if (process.argv.length!=4) {
	console.log("bad arguments"); // TODO: improve this
	process.exit(1);
}

const inputPath=process.argv[2];
const outputPath=process.argv[3];

let fs=require('fs');
let path=require('path');
const inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8')

const result=parser.parse(inputData);

console.log(result); // ..... TEMP