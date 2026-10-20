// EXPERIMENTAL (kernel-spike): the kernel's WebAssembly build, loaded
// synchronously with no host globals, so workflow code can call it.

import type { KernelBinding } from "#harness/kernel/contract.js";
import { KERNEL_WASM_BASE64 } from "#harness/kernel/wasm-bytes.js";

interface Exports {
  memory: { buffer: ArrayBuffer };
  alloc(len: number): number;
  dealloc(ptr: number, len: number): void;
  kernel_open(ptr: number, len: number): bigint;
  kernel_advance(sptr: number, slen: number, iptr: number, ilen: number): bigint;
}

/** The synchronous WebAssembly API. eve's TypeScript lib has no DOM types. */
interface WasmApi {
  Module: new (bytes: Uint8Array<ArrayBuffer>) => object;
  Instance: new (module: object, imports: object) => { exports: Record<string, unknown> };
}

let cached: KernelBinding | undefined;

export function wasmKernel(): KernelBinding {
  if (cached !== undefined) return cached;
  if (KERNEL_WASM_BASE64 === "") {
    throw new Error("eve.kernelMode is wasm, but the kernel WASM bytes were not generated.");
  }
  const wasm = Reflect.get(globalThis, "WebAssembly") as WasmApi;
  const ex = new wasm.Instance(new wasm.Module(base64Decode(KERNEL_WASM_BASE64)), {}).exports;
  const x: Exports = {
    memory: ex.memory as Exports["memory"],
    alloc: ex.alloc as Exports["alloc"],
    dealloc: ex.dealloc as Exports["dealloc"],
    kernel_open: ex.kernel_open as Exports["kernel_open"],
    kernel_advance: ex.kernel_advance as Exports["kernel_advance"],
  };
  const put = (s: string): [number, number] => {
    const data = utf8Encode(s);
    const ptr = x.alloc(data.length);
    new Uint8Array(x.memory.buffer, ptr, data.length).set(data);
    return [ptr, data.length];
  };
  const take = (packed: bigint): string => {
    const ptr = Number(packed >> 32n);
    const len = Number(packed & 0xffffffffn);
    const s = utf8Decode(new Uint8Array(x.memory.buffer, ptr, len));
    x.dealloc(ptr, len);
    if (s.startsWith("!")) throw new Error(s.slice(1));
    return s;
  };
  cached = {
    open(config) {
      const [p, l] = put(JSON.stringify(config));
      const out = take(x.kernel_open(p, l));
      x.dealloc(p, l);
      return JSON.parse(out);
    },
    advance(state, inputs) {
      const [sp, sl] = put(JSON.stringify(state));
      const [ip, il] = put(JSON.stringify(inputs));
      const out = take(x.kernel_advance(sp, sl, ip, il));
      x.dealloc(sp, sl);
      x.dealloc(ip, il);
      return JSON.parse(out);
    },
  };
  return cached;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64Decode(s: string): Uint8Array<ArrayBuffer> {
  const clean = s.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    value = (value << 6) | B64.indexOf(clean[i]!);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (value >> bits) & 0xff;
    }
  }
  return out;
}

function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++]!;
    let c: number;
    if (b < 0x80) c = b;
    else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++]! & 63);
    else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++]! & 63) << 6) | (bytes[i++]! & 63);
    else {
      c =
        ((b & 7) << 18) |
        ((bytes[i++]! & 63) << 12) |
        ((bytes[i++]! & 63) << 6) |
        (bytes[i++]! & 63);
    }
    s += String.fromCodePoint(c);
  }
  return s;
}
