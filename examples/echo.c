void puts(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint16_t main(uint8_t argc, uint8_t **argv) {
	// Loop over arguments (excluding the first)
	uint8_t i;
	for(i=1; i<argc; i=i+1) {
		// If there has been an argument printed before this then add a space before we print the next one.
		if (i>1) {
			puts(" ");
		}

		// Print current argument
		puts(argv[i]);
	}

	// Add newline to terminate output
	puts("\n");

	return 0;
}
