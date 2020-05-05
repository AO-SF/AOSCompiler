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

void strcpy(uint8_t *dest, uint8_t *src) {
	asm "requireend lib/std/str/strcpy.s";
	asm "$src\nload16 r0 r0\npush16 r0";
	asm "$dest\ndec2 r0\nload16 r0 r0\npop16 r1";
	asm "call strcpy";
}

uint16_t strlen(uint8_t *str) {
	asm "requireend lib/std/str/strlen.s";
	asm "$str\nload16 r0 r0";
	asm "call strlen";

	uint16_t ret;
	asm "push16 r0";
	asm "$ret\ndec2 r0";
	asm "pop16 r1";
	asm "store16 r0 r1";

	return ret;
}
