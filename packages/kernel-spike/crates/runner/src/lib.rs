//! In-process runner for the kernel: the fx TUI, `fx ask`, and in-process
//! libfx cases. It calls `kernel::advance`, runs effects on threads, obeys
//! `cancel` commands, and writes to an optional session store.
//!
//! Crash rule (R2): on load, an effect with an intent and no outcome is run
//! again if it is `safe`, and reported `interrupted { crashed }` if `never`.

use std::collections::BTreeMap;
use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

use kernel::{
    Command, EffectRequest, EffectResult, Event, Input, InterruptReason, Replay, SessionConfig,
    State,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "record", rename_all = "snake_case")]
pub enum Record {
    Input {
        input: Input,
    },
    State {
        state: State,
        open: Vec<EffectRequest>,
    },
    Intent {
        key: String,
    },
    Outcome {
        key: String,
        result: EffectResult,
    },
}

pub trait Store: Send {
    fn load(&mut self) -> io::Result<Vec<Record>>;
    /// `sync` asks for a durability point (fsync).
    fn append(&mut self, record: &Record, sync: bool) -> io::Result<()>;
}

/// `--no-save`: nothing survives the process.
pub struct NoStore;

impl Store for NoStore {
    fn load(&mut self) -> io::Result<Vec<Record>> {
        Ok(Vec::new())
    }
    fn append(&mut self, _: &Record, _: bool) -> io::Result<()> {
        Ok(())
    }
}

#[derive(Default)]
pub struct MemoryStore(pub Vec<Record>);

impl Store for MemoryStore {
    fn load(&mut self) -> io::Result<Vec<Record>> {
        Ok(self.0.clone())
    }
    fn append(&mut self, record: &Record, _: bool) -> io::Result<()> {
        self.0.push(record.clone());
        Ok(())
    }
}

/// The local session log: one JSON record per line. A torn last line is
/// dropped on load; a bad line in the middle is an error.
pub struct JsonlStore {
    path: PathBuf,
    file: Option<File>,
}

impl JsonlStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            file: None,
        }
    }
}

impl Store for JsonlStore {
    fn load(&mut self) -> io::Result<Vec<Record>> {
        let file = match File::open(&self.path) {
            Ok(f) => f,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(e) => return Err(e),
        };
        let lines: Vec<String> = BufReader::new(file).lines().collect::<io::Result<_>>()?;
        let mut records = Vec::with_capacity(lines.len());
        for (i, line) in lines.iter().enumerate() {
            match serde_json::from_str(line) {
                Ok(r) => records.push(r),
                Err(_) if i + 1 == lines.len() => break,
                Err(e) => {
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData,
                        format!("line {}: {e}", i + 1),
                    ))
                }
            }
        }
        Ok(records)
    }

    fn append(&mut self, record: &Record, sync: bool) -> io::Result<()> {
        if self.file.is_none() {
            self.file = Some(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&self.path)?,
            );
        }
        let file = self.file.as_mut().expect("open");
        let mut line = serde_json::to_vec(record)?;
        line.push(b'\n');
        file.write_all(&line)?;
        if sync {
            file.sync_data()?;
        }
        Ok(())
    }
}

pub enum Msg {
    Input(Input),
    Done(String, EffectResult),
}

/// What an effect handler gets besides the request.
pub struct HostCtx {
    pub cancel: Arc<AtomicBool>,
    /// For hosts that inject user input while an effect runs (a TUI).
    pub inputs: Sender<Msg>,
}

impl HostCtx {
    pub fn cancelled(&self) -> bool {
        self.cancel.load(Ordering::SeqCst)
    }
}

pub trait Handlers: Send + Sync + 'static {
    fn run(&self, request: &EffectRequest, ctx: &HostCtx) -> EffectResult;
}

struct OpenEffect {
    request: EffectRequest,
    started: bool,
    cancel: Arc<AtomicBool>,
}

pub struct Runner<S: Store> {
    state: State,
    store: S,
    handlers: Arc<dyn Handlers>,
    open: BTreeMap<String, OpenEffect>,
    tx: Sender<Msg>,
    rx: Receiver<Msg>,
    on_event: Box<dyn FnMut(&Event)>,
    on_command: Box<dyn FnMut(&Command)>,
}

impl<S: Store> Runner<S> {
    /// Opens a session. With saved records, it restores the state and
    /// resolves the effects that were open when the last process stopped.
    pub fn open(
        config: SessionConfig,
        mut store: S,
        handlers: Arc<dyn Handlers>,
    ) -> io::Result<Self> {
        let records = store.load()?;
        let (tx, rx) = channel();
        let mut runner = Self {
            state: kernel::open(config),
            store,
            handlers,
            open: BTreeMap::new(),
            tx,
            rx,
            on_event: Box::new(|_| {}),
            on_command: Box::new(|_| {}),
        };
        runner.restore(records)?;
        Ok(runner)
    }

    pub fn on_event(&mut self, f: impl FnMut(&Event) + 'static) {
        self.on_event = Box::new(f);
    }

    pub fn on_command(&mut self, f: impl FnMut(&Command) + 'static) {
        self.on_command = Box::new(f);
    }

    pub fn sender(&self) -> Sender<Msg> {
        self.tx.clone()
    }

    pub fn state(&self) -> &State {
        &self.state
    }

    fn restore(&mut self, records: Vec<Record>) -> io::Result<()> {
        let last_state = records
            .iter()
            .rposition(|r| matches!(r, Record::State { .. }));
        let mut pending_inputs = Vec::new();
        let mut intents = Vec::new();
        let mut outcomes = BTreeMap::new();
        let tail = match last_state {
            Some(i) => {
                let Record::State { state, open } = &records[i] else {
                    unreachable!()
                };
                self.state =
                    kernel::migrate(serde_json::to_value(state)?).map_err(io::Error::other)?;
                for request in open {
                    self.open.insert(
                        request.key.clone(),
                        OpenEffect {
                            request: request.clone(),
                            started: false,
                            cancel: Arc::default(),
                        },
                    );
                }
                &records[i + 1..]
            }
            None => &records[..],
        };
        for r in tail {
            match r {
                Record::Input { input } => pending_inputs.push(input.clone()),
                Record::Intent { key } => intents.push(key.clone()),
                Record::Outcome { key, result } => {
                    outcomes.insert(key.clone(), result.clone());
                }
                Record::State { .. } => unreachable!(),
            }
        }
        // Results that landed after the last state, then inputs that were never applied.
        let mut inputs = Vec::new();
        for (key, result) in outcomes {
            if self.open.remove(&key).is_some() {
                inputs.push(Input::EffectResult { key, result });
            }
        }
        inputs.extend(pending_inputs);
        if !inputs.is_empty() {
            self.advance(inputs, false)?;
        }
        for key in intents {
            let Some(effect) = self.open.get(&key) else {
                continue;
            };
            if effect.request.replay == Replay::Never {
                let result = EffectResult::Interrupted {
                    reason: InterruptReason::Crashed,
                    partial: Value::Null,
                };
                self.open.remove(&key);
                self.store.append(
                    &Record::Outcome {
                        key: key.clone(),
                        result: result.clone(),
                    },
                    true,
                )?;
                self.advance(vec![Input::EffectResult { key, result }], false)?;
            }
        }
        Ok(())
    }

    fn advance(&mut self, inputs: Vec<Input>, record_inputs: bool) -> io::Result<()> {
        if record_inputs {
            for input in &inputs {
                if !matches!(input, Input::EffectResult { .. }) {
                    self.store.append(
                        &Record::Input {
                            input: input.clone(),
                        },
                        false,
                    )?;
                }
            }
        }
        let out = kernel::advance(&mut self.state, inputs);
        for request in out.effects {
            self.open.insert(
                request.key.clone(),
                OpenEffect {
                    request,
                    started: false,
                    cancel: Arc::default(),
                },
            );
        }
        let open: Vec<EffectRequest> = self.open.values().map(|e| e.request.clone()).collect();
        self.store.append(
            &Record::State {
                state: self.state.clone(),
                open,
            },
            false,
        )?;
        for command in &out.commands {
            (self.on_command)(command);
            let Command::Cancel { key } = command;
            if let Some(effect) = self.open.get(key) {
                if effect.started {
                    effect.cancel.store(true, Ordering::SeqCst);
                } else {
                    let result = EffectResult::Interrupted {
                        reason: InterruptReason::Cancelled,
                        partial: Value::Null,
                    };
                    let _ = self.tx.send(Msg::Done(key.clone(), result));
                }
            }
        }
        for event in &out.events {
            (self.on_event)(event);
        }
        Ok(())
    }

    fn start_ready(&mut self) -> io::Result<()> {
        let ready: Vec<String> = self
            .open
            .iter()
            .filter(|(_, e)| {
                !e.started && e.request.after.iter().all(|k| !self.open.contains_key(k))
            })
            .map(|(k, _)| k.clone())
            .collect();
        for key in ready {
            let effect = self.open.get_mut(&key).expect("open");
            effect.started = true;
            let sync = effect.request.replay == Replay::Never;
            self.store
                .append(&Record::Intent { key: key.clone() }, sync)?;
            let request = effect.request.clone();
            let ctx = HostCtx {
                cancel: effect.cancel.clone(),
                inputs: self.tx.clone(),
            };
            let handlers = self.handlers.clone();
            let tx = self.tx.clone();
            std::thread::spawn(move || {
                let result = handlers.run(&request, &ctx);
                let _ = tx.send(Msg::Done(request.key.clone(), result));
            });
        }
        Ok(())
    }

    /// Applies `inputs` and runs until the session is idle.
    pub fn run(&mut self, inputs: Vec<Input>) -> io::Result<()> {
        if !inputs.is_empty() {
            self.advance(inputs, true)?;
        }
        loop {
            self.start_ready()?;
            if self.open.is_empty() && self.state.is_idle() {
                return Ok(());
            }
            match self.rx.recv().expect("the runner holds a sender") {
                Msg::Input(input) => self.advance(vec![input], true)?,
                Msg::Done(key, result) => {
                    if self.open.remove(&key).is_none() {
                        continue;
                    }
                    self.store.append(
                        &Record::Outcome {
                            key: key.clone(),
                            result: result.clone(),
                        },
                        false,
                    )?;
                    self.advance(vec![Input::EffectResult { key, result }], false)?;
                }
            }
        }
    }
}
