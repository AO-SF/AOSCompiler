#include "lib/process.c"
#include "lib/stdbool.c"
#include "lib/stdio.c"
#include "lib/string.c"
#include "lib/syscall.c"

#define readBufferSize 256
uint8_t readBuffer[256]; // this is global as otherwise makes stack calculations more difficult/slower in runFd

uint8_t pwdBuffer[64]; // used to hold pwd so we can update it in the case of a 'cd' command

uint16_t main(uint8_t argc, uint8_t **argv) {
	// Copy current pwd into our own buffer,
	// then update our env vars to point at this buffer
	strcpy(pwdBuffer, getPwd());
	setPwd(pwdBuffer);

	// Run any scripts pass as arguments
	uint8_t i;
	for(i=1; i<argc; i=i+1) {
		uint8_t fd;

		// Open file in read-only mode
		fd=shellOpen(argv[i], FdModeRO);
		if (fd==FdInvalid) {
			continue; // try next argument
		}

		// Execute file
		if (runFd(fd, false)==false) {
			return 0;
		}

		// Close file
		close(fd);
	}

	// Run commands from stdin
	runFd(FdStdin, true);

	return 0;
}

// Reads and executes commands from given fd. Returns true unless exit was called in which case false is returned.
uint8_t runFd(uint8_t fd, uint8_t interactiveMode) {
	// Input loop
	uint16_t readOffset;
	readOffset=0;
	while(true) {
		uint8_t *ptr;

		// If in interactive mode then print a prompt consisting of pwd and dollar character
		if (interactiveMode) {
			puts(getPwd());
			puts("$ ");
		}

		// Read line from fd
		// TODO: use 32 bit version of fgets to handle large files
		uint16_t readCount;
		readCount=fgets(fd, readOffset, readBuffer, readBufferSize);
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
			return false;
		}
		if (strcmp(readBuffer, "cd")==0) {
			// If no arguments then assume home directory
			if (argc<2) {
				ptr="/home";
			}

			// Otherwise use first argument as path
			if (argc>=2) {
				// Grab first argument after 'cd' command and make sure it is absolute
				ptr=readBuffer+strlen(readBuffer)+1; // get addr of 1st argument
				ptr=ptr+strlen(ptr)+1; // get addr of 2nd argument (use this as scratch space)
				getAbsPath(ptr, readBuffer+strlen(readBuffer)+1);
			}

			// Check directory exists
			if (isDir(ptr)==false) {
				puts("no such directory: ");
				puts(ptr);
				puts("\n");
				continue;
			}

			// Update pwf
			strcpy(pwdBuffer, ptr);

			continue;
		}

		// Fork
		uint8_t forkRet;
		forkRet=fork();

		if (forkRet==PidMax) {
			puts("could not fork\n");

			// in interactiveMode let user try again, but if part of a file we cannot continue as this command may be critical
			if (interactiveMode) {
				continue;
			}
			return true;
		}

		if (forkRet>0) {
			// parent - forkRet is equal to child's PID

			// wait for child to terminate
			waitpid(forkRet, 0); // timeout=0 for infinite wait
		}

		if (forkRet==0) {
			// child

			// use exec syscall to replace process
			exec(argc, readBuffer, SyscallExecPathFlagSearch);

			// exec only returns on error
			puts("could not exec\n");
			exit(1);
		}
	}

	// Return true to indicate we should move onto the next input file/stdin
	return true;
}
