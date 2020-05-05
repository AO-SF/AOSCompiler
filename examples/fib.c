// Print Fibonacci sequence (0, 1, 1, 2, 3, 5, ...)

#include "lib/stdio.c"

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
		puts(", ");
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
