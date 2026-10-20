//! Node-API binding. Two shapes, to measure the boundary:
//! - `open` / `advance`: the state crosses as JSON on every call.
//! - `Kernel`: the state stays in Rust; `snapshot()` serializes it on demand.

use napi::{Error, Result};
use napi_derive::napi;

fn err(e: impl std::fmt::Display) -> Error {
    Error::from_reason(e.to_string())
}

#[napi]
pub fn open(config: String) -> Result<String> {
    kernel::json::open(&config).map_err(err)
}

/// Returns `{ state, effects, commands, events }` as JSON.
#[napi]
pub fn advance(state: String, inputs: String) -> Result<String> {
    kernel::json::advance(&state, &inputs).map_err(err)
}

#[napi]
pub struct Kernel {
    state: kernel::State,
}

#[napi]
impl Kernel {
    #[napi(constructor)]
    pub fn new(config: String) -> Result<Self> {
        let config: kernel::SessionConfig = serde_json::from_str(&config).map_err(err)?;
        Ok(Self {
            state: kernel::open(config),
        })
    }

    #[napi(factory)]
    pub fn from_state(state: String) -> Result<Self> {
        let value: serde_json::Value = serde_json::from_str(&state).map_err(err)?;
        Ok(Self {
            state: kernel::migrate(value).map_err(err)?,
        })
    }

    /// Returns `{ effects, commands, events }` as JSON. The state stays here.
    #[napi]
    pub fn advance(&mut self, inputs: String) -> Result<String> {
        let inputs: Vec<kernel::Input> = serde_json::from_str(&inputs).map_err(err)?;
        let out = kernel::advance(&mut self.state, inputs);
        serde_json::to_string(&out).map_err(err)
    }

    #[napi]
    pub fn snapshot(&self) -> Result<String> {
        serde_json::to_string(&self.state).map_err(err)
    }

    #[napi]
    pub fn is_idle(&self) -> bool {
        self.state.is_idle()
    }
}
