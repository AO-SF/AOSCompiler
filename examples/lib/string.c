#include "syscall.c"

uint8_t *strchr(uint8_t *str, uint8_t c) {
	asm "$c\nload8 r1 r0";
	asm "$str\nload16 r2 r0";
	asm "$SyscallIdStrChr";
	asm "syscall";
}

uint8_t *strchrnul(uint8_t *str, uint8_t c) {
	asm "$str\nload16 r1 r0";
	asm "$c\nload8 r2 r0";
	asm "$SyscallIdStrChrNul";
	asm "syscall";
}

uint8_t strcmp(uint8_t *a, uint8_t *b) {
	asm "$a\nload16 r1 r0";
	asm "$b\nload16 r2 r0";
	asm "$SyscallIdStrCmp";
	asm "syscall";
}

void strcat(uint8_t *dest, uint8_t *src) {
	strcpy(dest+strlen(dest), src);
}

void strcpy(uint8_t *dest, uint8_t *src) {
	memmove(dest, src, strlen(src)+1);
}

uint16_t strlen(uint8_t *str) {
	// Find null terminator pointer then subtract base pointer to find length
	return strchrnul(str, 0)-str;
}

void memmove(void *dest, void *src, uint16_t n) {
	asm "$dest\nload16 r1 r0";
	asm "$src\nload16 r2 r0";
	asm "$n\nload16 r3 r0";
	asm "$SyscallIdMemMove";
	asm "syscall";
}
