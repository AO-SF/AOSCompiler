// Print Fibonacci sequence

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

uint16_t main(uint8_t argc, uint8_t **argv) {
	// Initialise and print first value
	uint16_t lower;
	uint16_t upper;

	lower=0;
	upper=1;

	putd(lower);

	// Loop to print subsequent values
	while(lower<40000) {
		// Print separator followed by value
		putc(44); // ','
		putc(32); // ' '
		putd(upper);

		// Execute single Fibonacci step
		uint16_t sum;
		sum=lower+upper;
		lower=upper;
		upper=sum;
	}

	// Print newline
	putc(10);

	return 0;
}
