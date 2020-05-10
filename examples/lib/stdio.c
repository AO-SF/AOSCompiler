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

uint16_t read(uint8_t fd, uint16_t offset, uint8_t *data, uint16_t len) {
	asm "$fd\nload8 r0 r0\npush8 r0";
	asm "$offset\ndec r0\nload16 r0 r0\npush16 r0";
	asm "$data\ndec3 r0\nload16 r0 r0\npush16 r0";
	asm "$len\ndec5 r0\nload16 r4 r0"; // len
	asm "pop16 r3"; // data
	asm "pop16 r2"; // offset
	asm "pop8 r1"; // fd
	asm "mov r0 SyscallIdRead";
	asm "syscall";

	uint16_t count;
	asm "push16 r0";
	asm "$count\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return count;
}

// reads up to and including first newline, always null-terminates buf (potentially to be 0 length if could not read)
// returns number of bytes read
uint16_t fgets(uint8_t fd, uint16_t offset, uint8_t *buf, uint16_t len) {
	// Loop reading a character each iteration
	uint16_t readCount;
	for(readCount=0; readCount<len; readCount=readCount+1) {
		// Read character into provided buffer
		if (read(fd, offset+readCount, buf+readCount, 1)==0) {
			break;// EOF
		}

		// Newline?
		if (buf[readCount]==10) { // '\n'=10
			readCount=readCount+1;
			break;
		}
	}

	// Add null terminator
	buf[readCount]=0;

	return readCount;
}
