// Print 'Hello world!\n'

void puts(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint16_t main(uint8_t argc, uint8_t **argv) {
	puts("Hello world!\n");
	return 0;
}
