#include "string.c"
#include "syscall.c"

#define FdInvalid 0
#define FdStdin 1
#define FdStdout 2

#define FdModeNone 0
#define FdModeRO 1
#define FdModeWO 2
#define FdModeRW 3

#define PathMax 64

uint8_t open(uint8_t *path, uint8_t mode) {
	asm "$path\nload16 r1 r0";
	asm "$mode\nload8 r2 r0";
	asm "$SyscallIdOpen";
	asm "syscall";
}

void close(uint8_t fd) {
	asm "$fd\nload8 r1 r0";
	asm "$SyscallIdClose";
	asm "syscall";
}

void puts(uint8_t *str) {
	fputs(FdStdout, str);
}

void putc(uint8_t c) {
	fputc(FdStdout, c);
}

void putd(uint16_t x, uint16_t padding) {
	fputd(FdStdout, x, padding);
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

	asm "$fd\nload8 r1 r0";
	asm "mov r2 0"; // offset=0
	asm "$str\nload16 r3 r0";
	asm "$len\nload16 r4 r0";
	asm "$SyscallIdWrite";
	asm "syscall";
}

void fputc(uint8_t fd, uint8_t c) {
	asm "$fd\nload8 r1 r0";
	asm "mov r2 0"; // offset=0
	asm "$c\nmov r3 r0"; // &c
	asm "mov r4 1"; // len=1
	asm "$SyscallIdWrite";
	asm "syscall";
}

uint16_t read(uint8_t fd, uint16_t offset, uint8_t *data, uint16_t len) {
	asm "$fd\nload8 r1 r0";
	asm "$offset\nload16 r2 r0";
	asm "$data\nload16 r3 r0";
	asm "$len\nload16 r4 r0";
	asm "$SyscallIdRead";
	asm "syscall";
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
	asm "$SyscallIdIsDir";
	asm "syscall";
}

uint8_t fileExists(uint8_t *path) {
	asm "$path\nload16 r1 r0";
	asm "$SyscallIdFileExists";
	asm "syscall";
}
