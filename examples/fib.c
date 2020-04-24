
// Print Fibonacci sequence

void put_dec(uint16_t x) {
	// TODO: this (and calls to this)
}

uint16_t main() {
	uint16_t lower;
	uint16_t upper;

	lower=0;
	upper=1;

	// put_dec(lower);
	while(lower<40000) {
		// put_dec(upper);

		uint16_t sum;
		sum=lower+upper;
		lower=upper;
		upper=sum;
	}
	return 0;
}
