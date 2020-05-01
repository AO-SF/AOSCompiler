uint16_t main(uint8_t argc, uint8_t **argv) {
	// Run any scripts pass as arguments
	uint8_t i;
	for(i=1; i<argc; i=i+1) {
		uint8_t fd;

		// Open file in read-only mode
		fd=openPath(argv[i], 1);
		if (fd==0) {
			continue; // try next argument
		}

		// Execute file
		if (runFd(fd, 0)==0) {
			return 0;
		}

		// Close file
		close(fd);
	}

	// Run commands from stdin
	runFd(1, 1); // stdin fd = 1, interactive mode = true

	return 0;
}

// Reads and executes commands from given fd. Returns 1 unless exit was called in which case 0 is returned.
uint8_t runFd(uint8_t fd, uint8_t interactiveMode) {
	// Input loop
	uint16_t readOffset;
	readOffset=0;
	while(1) {
		// If in interactive mode then print a prompt consisting of pwd and dollar character
		if (interactiveMode) {
			puts(getPwd());
			puts("$ ");
		}

		// TODO: rest of this
	}

	// Return 1 to indicate we should move onto the next input file/stdin
	return 1;
}

////////////////////////////////////////////////////////////////////////////////
// Library functions
////////////////////////////////////////////////////////////////////////////////

void puts(uint8_t *str) {
	// Use puts0 library function
	asm "requireend lib/std/io/fput.s";
	asm "$str\nload16 r0 r0\ncall puts0";
}

uint8_t openPath(uint8_t *path, uint8_t mode) {
	// Use openpath library function
	asm "requireend lib/std/proc/openpath.s";

	// Setup arguments
	asm "$path\nload16 r0 r0\npush16 r0";
	asm "$mode\ndec2 r0\nload8 r1 r0\npop16 r0"; // dec2 is because we adjusted stack in previous asm code

	// Call function
	asm "call openpath";

	// Grab returned fd
	uint8_t fd;
	asm "push8 r0";
	asm "$fd\ndec r0"; // dec is because we adjusted stack in previous asm code
	asm "pop8 r1";
	asm "store8 r0 r1";

	return fd;
}

void close(uint8_t fd) {
	asm "$fd\nload8 r1 r0";
	asm "mov r0 SyscallIdClose";
	asm "syscall";
}

uint8_t *getPwd() {
	asm "mov r0 SyscallIdEnvGetPwd";
	asm "syscall";

	uint8_t *pwd;
	asm "push16 r0";
	asm "$pwd\ndec2 r0"; // dec2 is because we adjusted stack in previous asm code
	asm "pop16 r1";
	asm "store16 r0 r1";

	return pwd;
}
