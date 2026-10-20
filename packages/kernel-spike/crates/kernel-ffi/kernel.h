// C ABI for the kernel prototype (packages/kernel-spike/crates/kernel-ffi).
// Strings are UTF-8 JSON with an explicit length. Every returned buffer is
// freed with fxk_free. A returned buffer that starts with '!' is an error.
#include <stddef.h>

typedef struct fxk_kernel fxk_kernel;

fxk_kernel *fxk_new(const char *config, size_t len);
// Returns {effects, commands, events, idle} as JSON.
char *fxk_advance(fxk_kernel *k, const char *inputs, size_t len, size_t *out_len);
void fxk_free(char *buf, size_t len);
void fxk_drop(fxk_kernel *k);
