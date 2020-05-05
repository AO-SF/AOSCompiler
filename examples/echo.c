#include "lib/stdio.c"

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
