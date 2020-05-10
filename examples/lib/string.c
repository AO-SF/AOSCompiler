uint8_t *strchr(uint8_t *str, uint8_t c) {
	asm "$c\nload8 r0 r0\npush8 r0";
	asm "$str\ndec r0\nload16 r1 r0";
	asm "pop8 r2";
	asm "mov r0 SyscallIdStrChr";
	asm "syscall";

	uint8_t *ret;
	asm "push16 r0";
	asm "$ret\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return ret;
}

uint8_t *strchrnul(uint8_t *str, uint8_t c) {
	asm "$c\nload8 r0 r0\npush8 r0";
	asm "$str\ndec r0\nload16 r1 r0";
	asm "pop8 r2";
	asm "mov r0 SyscallIdStrChrNul";
	asm "syscall";

	uint8_t *ret;
	asm "push16 r0";
	asm "$ret\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return ret;
}

uint8_t strcmp(uint8_t *a, uint8_t *b) {
	asm "$b\nload16 r0 r0\npush16 r0";
	asm "$a\ndec2 r0\nload16 r1 r0";
	asm "pop16 r2";

	asm "mov r0 SyscallIdStrCmp";
	asm "syscall";

	uint8_t ret;
	asm "push8 r0";
	asm "$ret\ndec r0";
	asm "pop8 r1";
	asm "store8 r0 r1";

	return ret;
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
	asm "$n\nload16 r0 r0\npush16 r0";
	asm "$src\ndec2 r0\nload16 r0 r0\npush16 r0";
	asm "$dest\ndec4 r0\nload16 r1 r0";
	asm "pop16 r2";
	asm "pop16 r3";

	asm "mov r0 SyscallIdMemMove";
	asm "syscall";
}
