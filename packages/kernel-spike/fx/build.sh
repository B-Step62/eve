#!/bin/sh
# Builds baseline fx and fx with the kernel linked, from an fx checkout.
#
#   fx/build.sh <fx checkout> <out dir>
#
# Needs Zig 0.17.0 on PATH. Both builds use ReleaseSafe, as fx's releases do.
set -eu
fx="$1"
out="$2"
here="$(cd "$(dirname "$0")/.." && pwd)"
cargo build --manifest-path "$here/Cargo.toml" --release -p kernel-ffi --target aarch64-apple-darwin
lib="$here/target/aarch64-apple-darwin/release/libkernel_ffi.a"
mkdir -p "$out"
if [ -n "$(cd "$fx" && git status --porcelain)" ]; then echo "fx checkout must be clean" >&2; exit 1; fi
(cd "$fx" && zig build -Doptimize=ReleaseSafe && cp zig-out/bin/fx "$out/fx-baseline")
(cd "$fx" && git apply "$here/fx/fx-kernel.patch" && zig build -Doptimize=ReleaseSafe -Dkernel-lib="$lib" && cp zig-out/bin/fx "$out/fx-kernel" && git apply -R "$here/fx/fx-kernel.patch")
ls -l "$out"
