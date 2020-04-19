var parser = require('../src/arithmeticgrammar.js');
if (process.argv.length != 4) {
    console.log("bad arguments"); // TODO: improve this
    process.exit(1);
}
var inputPath = process.argv[2];
var outputPath = process.argv[3];
var fs = require('fs');
var path = require('path');
var inputData = fs.readFileSync(path.resolve(__dirname, inputPath), 'utf8');
var result = parser.parse(inputData);
console.log(result); // .....
//# sourceMappingURL=main.js.map