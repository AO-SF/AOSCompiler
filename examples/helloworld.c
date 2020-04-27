// Print 'Hello world!\n'

void put_str(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint16_t main(uint8_t argc) {
	put_str("Hello world!\n");
	return 0;
}
