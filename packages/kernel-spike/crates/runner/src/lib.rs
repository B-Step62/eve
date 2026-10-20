//! In-process runner for the kernel: the fx TUI, `fx ask`, and in-process
//! libfx cases. It calls `kernel::advance`, runs effects on threads, obeys
//! `cancel` commands, and writes to an optional session store.
//!
//! The store holds only the kernel's log entries and snapshots. On load the
//! runner folds the entries after the last snapshot and asks the kernel which
//! effects are open (`kernel::resume`). An open `replay: safe` effect runs
//! again. An open `replay: never` effect with a recorded intent may have run,
//! so it is not run again: the kernel gets `interrupted { crashed }` (R2).

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::Arc;

use kernel::{
    Command, EffectRequest, EffectResult, Entry, Event, Input, InterruptReason, Output, Replay,
    SessionConfig, State,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A line of the local session log: the kernel's entries, and now and then a
/// snapshot so loading does not fold the whole log.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "record", rename_all = "snake_case")]
#[allow(clippy::large_enum_variant)]
pub enum Record {
    Entry {
        entry: Entry,
    },
    Snapshot {
        state: State,
    },
    /// Written, with fsync, before a `replay: never` effect starts.
    Intent {
        key: String,
    },
}

/// A snapshot after this many entries, and at the end of every turn.
pub const SNAPSHOT_EVERY: u64 = 32;

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
        let last = records
            .iter()
            .rposition(|r| matches!(r, Record::Snapshot { .. }));
        let tail = match last {
            Some(i) => {
                let Record::Snapshot { state } = &records[i] else {
                    unreachable!()
                };
                self.state =
                    kernel::migrate(serde_json::to_value(state)?).map_err(io::Error::other)?;
                &records[i + 1..]
            }
            None => &records[..],
        };
        let entries: Vec<Entry> = tail
            .iter()
            .filter_map(|r| match r {
                Record::Entry { entry } => Some(entry.clone()),
                _ => None,
            })
            .collect();
        let intents: BTreeSet<&str> = records
            .iter()
            .filter_map(|r| match r {
                Record::Intent { key } => Some(key.as_str()),
                _ => None,
            })
            .collect();
        kernel::replay(&mut self.state, entries).map_err(io::Error::other)?;
        let mut resumed = kernel::resume(&self.state);
        let (crashed, open): (Vec<_>, Vec<_>) = resumed
            .effects
            .into_iter()
            .partition(|e| e.replay == Replay::Never && intents.contains(e.key.as_str()));
        resumed.effects = open;
        self.handle(resumed)?;
        if crashed.is_empty() {
            return Ok(());
        }
        let results = crashed
            .into_iter()
            .map(|e| Input::EffectResult {
                key: e.key,
                result: EffectResult::Interrupted {
                    reason: InterruptReason::Crashed,
                    partial: Value::Null,
                },
            })
            .collect();
        self.advance(results)
    }

    fn advance(&mut self, inputs: Vec<Input>) -> io::Result<()> {
        let out = kernel::advance(&mut self.state, inputs);
        for entry in &out.entries {
            self.store.append(
                &Record::Entry {
                    entry: entry.clone(),
                },
                false,
            )?;
        }
        if self.state.is_idle() || self.state.seq % SNAPSHOT_EVERY == 0 {
            self.store.append(
                &Record::Snapshot {
                    state: self.state.clone(),
                },
                false,
            )?;
        }
        self.handle(out)
    }

    fn handle(&mut self, out: Output) -> io::Result<()> {
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
            if effect.request.replay == Replay::Never {
                self.store
                    .append(&Record::Intent { key: key.clone() }, true)?;
            }
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
            self.advance(inputs)?;
        }
        loop {
            self.start_ready()?;
            if self.open.is_empty() && self.state.is_idle() {
                return Ok(());
            }
            match self.rx.recv().expect("the runner holds a sender") {
                Msg::Input(input) => self.advance(vec![input])?,
                Msg::Done(key, result) => {
                    if self.open.remove(&key).is_none() {
                        continue;
                    }
                    self.advance(vec![Input::EffectResult { key, result }])?;
                }
            }
        }
    }
}
