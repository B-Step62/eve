//! WebAssembly build with a pointer/length ABI and no imports, so it can be
//! instantiated synchronously inside a Workflow VM.
//!
//! Results are `(ptr << 32) | len` of a UTF-8 JSON buffer the caller frees.
//! A string starting with `!` is an error message.

use std::alloc::{alloc as raw_alloc, dealloc as raw_dealloc, Layout};

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    unsafe { raw_alloc(Layout::from_size_align(len.max(1), 1).unwrap()) }
}

/// # Safety
/// `ptr` and `len` must come from `alloc` or a returned result.
#[no_mangle]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    raw_dealloc(ptr, Layout::from_size_align(len.max(1), 1).unwrap());
}

unsafe fn read(ptr: *const u8, len: usize) -> &'static str {
    std::str::from_utf8_unchecked(std::slice::from_raw_parts(ptr, len))
}

fn give(result: Result<String, String>) -> u64 {
    let s = match result {
        Ok(s) => s,
        Err(e) => format!("!{e}"),
    };
    let mut bytes = s.into_bytes().into_boxed_slice();
    let (ptr, len) = (bytes.as_mut_ptr(), bytes.len());
    std::mem::forget(bytes);
    ((ptr as u64) << 32) | len as u64
}

/// # Safety
/// The arguments must describe a buffer written by the caller.
#[no_mangle]
pub unsafe extern "C" fn kernel_open(ptr: *const u8, len: usize) -> u64 {
    give(kernel::json::open(read(ptr, len)))
}

/// # Safety
/// The arguments must describe buffers written by the caller.
#[no_mangle]
pub unsafe extern "C" fn kernel_advance(
    sptr: *const u8,
    slen: usize,
    iptr: *const u8,
    ilen: usize,
) -> u64 {
    give(kernel::json::advance(read(sptr, slen), read(iptr, ilen)))
}

/// # Safety
/// The arguments must describe a buffer written by the caller.
#[no_mangle]
pub unsafe extern "C" fn kernel_resume(ptr: *const u8, len: usize) -> u64 {
    give(kernel::json::resume(read(ptr, len)))
}
