# Overview
A compiler written in typescript for a basic C-like language, compiling down to assembly.

Example programs can be found in the `examples` directory.

Part of the [ArduinoOS](https://github.com/AO-SF/ArduinoOS) project.

# Usage
```sh
npm run build ../examples/fib.c ../examples/fib.s
aosf-asm ./examples/fib.s ./examples/fib.o
aosf-emu ./examples/fib.o
```

# Limitations
* cannot define and initialise variables at the same time
* if/while statements always require braces
* incomplete error checking allowing many invalid programs to parse and sometimes even fully compile
* ...
