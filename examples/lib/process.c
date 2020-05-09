#include "string.c"

void exit(uint16_t status) {
	asm "$status\nload16 r1 r0";
	asm "mov r0 SyscallIdExit";
	asm "syscall";
}

uint8_t *getPwd() {
	asm "mov r0 SyscallIdEnvGetPwd";
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
	asm "mov r0 SyscallIdEnvSetPwd";
	asm "syscall";
}

uint8_t fork() {
	asm "mov r0 SyscallIdFork";
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
	asm "mov r0 SyscallIdWaitPid";
	asm "syscall";
}

void exec(uint8_t argc, uint8_t *argv, uint8_t searchFlag) {
	asm "$searchFlag\nload8 r0 r0\npush8 r0";
	asm "$argv\ndec1 r0\nload16 r0 r0\npush16 r0";
	asm "$argc\ndec3 r0\nload8 r1 r0";
	asm "pop16 r2";
	asm "pop8 r3";
	asm "mov r0 SyscallIdExec";
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
