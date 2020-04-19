"use strict";
exports.__esModule = true;
console.log("test");
/*

.....

import {
    devConsoleExecute,
    devConsoleMapEditScrollEvent,
    devConsoleMapEditClickEvent,
    devConsoleMapEditMoveEvent,
    devConsoleMapEditTileToolbarEntryClick,
    devConsoleMapEditTileToolbarEntrySelect,
} from './devconsole';
import { Engine, EngineState } from './arithmeticgrammar.js';


*/
var arithmeticgrammar_1 = require("./arithmeticgrammar");
arithmeticgrammar_1.parser.parse("abba"); // returns ["a", "b", "b", "a"]
arithmeticgrammar_1.parser.parse("abcd"); // throws an exception
//# sourceMappingURL=main.js.map