
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

import { parser } from './arithmeticgrammar'

parser.parse("abba"); // returns ["a", "b", "b", "a"]

parser.parse("abcd"); // throws an exception
