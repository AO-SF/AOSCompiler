void put_str(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint16_t main(uint8_t argc, uint8_t **argv) {
	uint8_t i;
	i=0;
	while(i<argc) {
		if (i>0) {
			put_str(" ");
		}
		put_str(argv[i]);
		i=i+1;
	}
	return 0;
}
