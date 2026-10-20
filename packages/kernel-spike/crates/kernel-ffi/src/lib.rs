//! C ABI for the kernel. The state stays in Rust behind a handle; each call
//! crosses only the new inputs and the output.

use std::ffi::c_char;

pub struct Kernel(kernel::State);

unsafe fn bytes<'a>(ptr: *const c_char, len: usize) -> &'a [u8] {
    std::slice::from_raw_parts(ptr.cast::<u8>(), len)
}

fn give(s: String, out_len: *mut usize) -> *mut c_char {
    let mut b = s.into_bytes().into_boxed_slice();
    unsafe { *out_len = b.len() };
    let p = b.as_mut_ptr().cast::<c_char>();
    std::mem::forget(b);
    p
}

/// # Safety
/// `config` must point to `len` bytes of UTF-8 JSON.
#[no_mangle]
pub unsafe extern "C" fn fxk_new(config: *const c_char, len: usize) -> *mut Kernel {
    match serde_json::from_slice::<kernel::SessionConfig>(bytes(config, len)) {
        Ok(c) => Box::into_raw(Box::new(Kernel(kernel::open(c)))),
        Err(_) => std::ptr::null_mut(),
    }
}

/// # Safety
/// `k` must come from `fxk_new`; `inputs` must point to `len` bytes.
#[no_mangle]
pub unsafe extern "C" fn fxk_advance(k: *mut Kernel, inputs: *const c_char, len: usize, out_len: *mut usize) -> *mut c_char {
    let k = &mut *k;
    let out = match serde_json::from_slice::<Vec<kernel::Input>>(bytes(inputs, len)) {
        Ok(inputs) => {
            let o = kernel::advance(&mut k.0, inputs);
            let mut v = serde_json::to_value(&o).unwrap_or_default();
            v["idle"] = serde_json::Value::Bool(k.0.is_idle());
            v.to_string()
        }
        Err(e) => format!("!{e}"),
    };
    give(out, out_len)
}

/// # Safety
/// `buf` and `len` must come from `fxk_advance`.
#[no_mangle]
pub unsafe extern "C" fn fxk_free(buf: *mut c_char, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(buf.cast::<u8>(), len)));
}

/// # Safety
/// `k` must come from `fxk_new` and not be used again.
#[no_mangle]
pub unsafe extern "C" fn fxk_drop(k: *mut Kernel) {
    drop(Box::from_raw(k));
}
