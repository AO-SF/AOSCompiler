# Overview
A compiler written in typescript for a basic C-like language, compiling down to assembly.

Example programs can be found in the `examples` directory.

Part of the [ArduinoOS](https://github.com/AO-SF/ArduinoOS) project.

# Usage
```sh
npm run build ../examples/fib.c ../examples/fib.s
aosf-asm -ILIBPATH ./examples/fib.s ./examples/fib.o
aosf-emu ./examples/fib.o
```

Where `LIBPATH` points to directory *containing* the `lib` directory found in ``src/userspace/bin`` in the [ArduinoOS](https://github.com/AO-SF/ArduinoOS) repo. For example, this is a possible value for `LIBPATH`: `../ArduinoOS/src/userspace/bin`.

# Limitations
* cannot define and initialise variables at the same time
* if/while statements always require braces
* incomplete error checking allowing many invalid programs to parse and sometimes even fully compile
* ...
