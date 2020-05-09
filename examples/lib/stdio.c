#include "string.c"

void puts(uint8_t *str) {
	fputs(2, str); // FdStdout=2
}

void putc(uint8_t c) {
	fputc(2, c); // FdStdout=2
}

void putd(uint16_t x) {
	// Print x using putdec library function
	asm "requireend lib/std/io/fputdec.s";
	asm "$x\nload16 r0 r0\ncall putdec";
}

void fputs(uint8_t fd, uint8_t *str) {
	uint16_t len;
	len=strlen(str);

	asm "$fd\nload8 r0 r0\npush8 r0";
	asm "$str\ndec r0\nload16 r0 r0\npush16 r0";
	asm "$len\ndec3 r0\nload16 r4 r0"; // len
	asm "pop16 r3"; // str
	asm "pop8 r1"; // fd
	asm "mov r2 0"; // offset=0
	asm "mov r0 SyscallIdWrite";
	asm "syscall";
}

void fputc(uint8_t fd, uint8_t c) {
	asm "$fd\nload8 r0 r0\npush8 r0";
	asm "$c\ndec r0\nmov r3 r0"; // &c
	asm "pop8 r1"; // fd
	asm "mov r4 1"; // len=1
	asm "mov r2 0"; // offset=0
	asm "mov r0 SyscallIdWrite";
	asm "syscall";
}

// reads up to and including first newline, always null-terminates buf (potentially to be 0 length if could not read)
// returns number of bytes read
uint16_t fgets(uint8_t fd, uint16_t offset, uint8_t *buf, uint16_t len) {
	asm "requireend lib/std/io/fget.s";

	asm "$fd\nload8 r0 r0\npush8 r0";
	asm "$offset\ndec r0\nload16 r0 r0\npush16 r0";
	asm "$buf\ndec3 r0\nload16 r0 r0\npush16 r0";
	asm "$len\ndec5 r0\nload16 r3 r0";
	asm "pop16 r2\npop16 r1\npop8 r0";
	asm "call fgets";

	uint16_t readCount;
	asm "push16 r0";
	asm "$readCount\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return readCount;
}
