void puts(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

void putc(uint8_t c) {
	// Use putc0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$c\nload8 r0 r0\ncall putc0";
}

void putd(uint16_t x) {
	// Print x using putdec library function
	asm "requireend lib/std/io/fputdec.s";
	asm "$x\nload16 r0 r0\ncall putdec";
}

// reads up to and including first newline, always null-terminates buf (potentially to be 0 length if could not read)
// returns number of bytes read
uint16_t fgets(uint8_t fd, uint16_t offset, uint8_t *buf, uint16_t len) {
	asm "requireend lib/std/io/fget.s";

	asm "$fd\nload8 r0 r0\npush8 r0";
	asm "$offset\ndec r0\nload16 r0 r0\npush16 r0";
	asm "$buf\ndec3 r0\nload16 r0 r0\npush16 r0";
	asm "$len\ndec5 r0\nload16 r3 r0";
	asm "pop16 r2\npop16 r1\npop8 r0";
	asm "call fgets";

	uint16_t readCount;
	asm "push16 r0";
	asm "$readCount\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return readCount;
}
