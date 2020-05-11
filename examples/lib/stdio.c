#include "string.c"

uint8_t open(uint8_t *path, uint8_t mode) {
	asm "$path\nload16 r0 r0\npush16 r0";
	asm "$mode\ndec2 r0\nload8 r2 r0";
	asm "pop16 r1";
	asm "mov r0 SyscallIdOpen";
	asm "syscall";

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

void puts(uint8_t *str) {
	fputs(2, str); // FdStdout=2
}

void putc(uint8_t c) {
	fputc(2, c); // FdStdout=2
}

void putd(uint16_t x, uint16_t padding) {
	fputd(2, x, padding);
}

// padding treated same as for inttostr
void fputd(uint8_t fd, uint16_t x, uint16_t padding) {
	// TODO: improve this using alloca to create local array (or skip string stuff and do differently)

	// Convert number to string then write to file
	uint8_t str[6];
	inttostr(str, x, padding);
	fputs(fd, str);
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

// padding capped at 5 maximum
void inttostr(uint8_t *str, uint16_t x, uint16_t padding) {
	// Skip leading zeros
	if (x<10 && padding<2) {
		goto print1;
	}
	if (x<100 && padding<3) {
		goto print10;
	}
	if (x<1000 && padding<4) {
		goto print100;
	}
	if (x<10000 && padding<5) {
		goto print1000;
	}

	// Print digits (unrolled loop)
	uint8_t digit;

	digit=x/10000;
	x=x-digit*10000;
	str[0]=digit+48;
	str=str+1;

	print1000:
	digit=x/1000;
	x=x-digit*1000;
	str[0]=digit+48;
	str=str+1;

	print100:
	digit=x/100;
	x=x-digit*100;
	str[0]=digit+48;
	str=str+1;

	print10:
	digit=x/10;
	x=x-digit*10;
	str[0]=digit+48;
	str=str+1;

	print1:
	str[0]=x+48;

	// Add null terminator
	str[1]=0;
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
