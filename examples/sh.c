#include "lib/stdio.c"
#include "lib/string.c"
#include "lib/process.c"

uint8_t readBuffer[256]; // this is global as otherwise makes stack calculations more difficult/slower in runFd

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
		uint8_t *ptr;

		// If in interactive mode then print a prompt consisting of pwd and dollar character
		if (interactiveMode) {
			puts(getPwd());
			puts("$ ");
		}

		// Read line from fd
		// TODO: use 32 bit version of fgets to handle large files
		uint16_t readCount;
		readCount=fgets(fd, readOffset, readBuffer, 256);
		if (readCount==0) {
			break; // end of file
		}

		readOffset=readOffset+readCount;

		// Remove trailing newline (if any)
		if (readBuffer[readCount-1]==10) {
			readBuffer[readCount-1]=0;
			readCount=readCount-1;
		}

		// Remove trailing comment (if any)
		ptr=strchr(readBuffer, 35); // '#'
		if (ptr!=0) {
			ptr[0] = 0;
		}

		// Compute argc by looping over input looking for spaces as separators
		// Genereate argv string by replacing the spaces with null terminators
		uint8_t argc;
		argc=1;
		for(ptr=readBuffer; ptr[0]!=0; ptr=ptr+1) {
			if (ptr[0]==32) { // space
				ptr[0]=0;
				argc=argc+1;
			}
		}

		// Check for builtin command
		if (strcmp(readBuffer, "exit")==0) {
			return 0;
		}

		// Fork
		uint8_t forkRet;
		forkRet=fork();

		if (forkRet==16) { // PidMax=16
			puts("could not fork\n");

			// in interactiveMode let user try again, but if part of a file we cannot continue as this command may be critical
			if (interactiveMode) {
				continue;
			}
			return 1;
		}

		if (forkRet>0) {
			// parent - forkRet is equal to child's PID

			// wait for child to terminate
			waitpid(forkRet, 0); // timeout=0 for infinite wait
		}

		if (forkRet==0) {
			// child

			// use exec syscall to replace process
			exec(argc, readBuffer, 1);

			// exec only returns on error
			puts("could not exec\n");
			exit(1);
		}
	}

	// Return 1 to indicate we should move onto the next input file/stdin
	return 1;
}

////////////////////////////////////////////////////////////////////////////////
// Library functions
////////////////////////////////////////////////////////////////////////////////

uint8_t openPath(uint8_t *path, uint8_t mode) {
	asm "requireend lib/std/proc/openpath.s";

	asm "$path\nload16 r0 r0\npush16 r0";
	asm "$mode\ndec2 r0\nload8 r1 r0\npop16 r0";

	asm "call openpath";

	uint8_t fd;
	asm "push8 r0";
	asm "$fd\ndec r0";
	asm "pop8 r1";
	asm "store8 r0 r1";

	return fd;
}

void close(uint8_t fd) {
	asm "$fd\nload8 r1 r0";
	asm "mov r0 SyscallIdClose";
	asm "syscall";
}

uint8_t isDir(uint8_t *path) {
	asm "$path\nload16 r1 r0";
	asm "mov r0 SyscallIdIsDir";
	asm "syscall";

	uint8_t ret;
	asm "push8 r0";
	asm "$ret\ndec r0";
	asm "pop8 r1";
	asm "store8 r0 r1";

	return ret;
}
