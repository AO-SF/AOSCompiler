#include "stdio.c"
#include "string.c"
#include "syscall.c"

#define PidMax 16
#define ArgLenMax 64
#define EnvVarPathMax 128
#define MaxFds 9 // maximum amount of open files a single process can have (although local fd=0 is used for invalid so there are really only 8 available)
#define ArgMax 255

void exit(uint16_t status) {
	asm "$status\nload16 r1 r0";
	asm "$SyscallIdExit";
	asm "syscall";
}

uint8_t *getPwd() {
	asm "$SyscallIdEnvGetPwd";
	asm "syscall";

	uint8_t *pwd;
	asm "push16 r0";
	asm "$pwd\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return pwd;
}

void setPwd(uint8_t *pwd) {
	asm "$pwd\nload16 r1 r0";
	asm "$SyscallIdEnvSetPwd";
	asm "syscall";
}

uint8_t *getPath() {
	asm "$SyscallIdEnvGetPath";
	asm "syscall";

	uint8_t *path;
	asm "push16 r0";
	asm "$path\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return path;
}

void setPath(uint8_t *path) {
	asm "$path\nload16 r1 r0";
	asm "$SyscallIdEnvSetPath";
	asm "syscall";
}

uint8_t fork() {
	asm "$SyscallIdFork";
	asm "syscall";

	uint8_t ret;
	asm "push8 r0";
	asm "$ret\ndec r0";
	asm "pop8 r1";
	asm "store8 r0 r1";

	return ret;
}

void waitpid(uint8_t pid, uint16_t timeoutSeconds) {
	asm "$timeoutSeconds\nload16 r0 r0\npush16 r0";
	asm "$pid\ndec2 r0\nload8 r1 r0";
	asm "pop16 r2";
	asm "$SyscallIdWaitPid";
	asm "syscall";
}

void exec(uint8_t argc, uint8_t *argv, uint8_t searchFlag) {
	asm "$searchFlag\nload8 r0 r0\npush8 r0";
	asm "$argv\ndec1 r0\nload16 r0 r0\npush16 r0";
	asm "$argc\ndec3 r0\nload8 r1 r0";
	asm "pop16 r2";
	asm "pop8 r3";
	asm "$SyscallIdExec";
	asm "syscall";
}

void getAbsPath(uint8_t *dest, uint8_t *src) {
	// Already absolute?
	if (src[0]==47) { // '/'
		strcpy(dest, src);
		return;
	}

	// Otherwise prepend src with pwd
	strcpy(dest, getPwd());
	strcat(dest, "/");
	strcat(dest, src);
}

// see shellPath for more info
uint8_t shellOpen(uint8_t *path, uint8_t mode) {
	uint8_t newPath[64]; // PathMax=64
	shellPath(newPath, path);
	return open(newPath, mode);
}

// Intereprets a path as the shell would.
// If absolute, then copies as-is.
// Otherwise assumes relative to a directory in PATH or to the PWD
// dest should have enough space for at least PathMax bytes
void shellPath(uint8_t *dest, uint8_t *src) {
	// Already absolute?
	if (src[0]==47) { // '/'=47
		strcpy(dest, src);
		return;
	}

	// Check if relative to one of PATH directories
	uint8_t *path;
	path=getPath();

	uint8_t *colonPtr;
	while((colonPtr=strchr(path, 58))!=0) { // ':'=58
		// Create test path in dest string
		memmove(dest, path, colonPtr-path);
		dest[colonPtr-path]=0;
		strcat(dest, "/");
		strcat(dest, src);

		// Check if file exists
		if (fileExists(dest)) {
			return;
		}

		// Update path pointer for next iteration
		path=colonPtr+1;
	}

	// Finally assume relative to working directory
	getAbsPath(dest, src);
}
