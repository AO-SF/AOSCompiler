void put_str(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint16_t main(uint8_t argc, uint8_t **argv) {
	// Loop over arguments (excluding the first)
	uint8_t i;
	i=1;
	while(i<argc) {
		// If there has been an argument printed before this then add a space before we print the next one.
		if (i>1) {
			put_str(" ");
		}

		// Print current argument and increment i to handle next instruction
		put_str(argv[i]);
		i=i+1;
	}

	// Add newline to terminate output
	put_str("\n");

	return 0;
}
