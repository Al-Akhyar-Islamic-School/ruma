use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct AudioDeviceItem {
    pub name: String,
    pub is_default: bool,
}

enum AudioCommand {
    Start {
        device_name: Option<String>,
        dest_path: PathBuf,
        reply: Sender<Result<String, String>>,
    },
    Stop {
        reply: Sender<Result<PathBuf, String>>,
    },
}

pub struct AudioState {
    cmd_tx: Sender<AudioCommand>,
    pub current_level: Arc<Mutex<f32>>,
    pub is_recording: Arc<AtomicBool>,
}

impl AudioState {
    pub fn new() -> Self {
        let (cmd_tx, cmd_rx) = channel::<AudioCommand>();
        let current_level = Arc::new(Mutex::new(0.0));
        let is_recording = Arc::new(AtomicBool::new(false));

        let level_for_worker = current_level.clone();
        let recording_for_worker = is_recording.clone();

        std::thread::spawn(move || {
            let mut active_stream: Option<Stream> = None;
            let mut wav_writer: Option<hound::WavWriter<BufWriter<File>>> = None;
            let mut active_path: Option<PathBuf> = None;

            while let Ok(cmd) = cmd_rx.recv() {
                match cmd {
                    AudioCommand::Start {
                        device_name,
                        dest_path,
                        reply,
                    } => {
                        let res = (|| -> Result<String, String> {
                            let host = cpal::default_host();
                            let device = find_device_by_name(&host, device_name.as_deref())?;

                            let default_config = device.default_input_config().map_err(|e| {
                                format!("Gagal mengambil konfigurasi mikrofon: {}", e)
                            })?;

                            let sample_format = default_config.sample_format();
                            let config: StreamConfig = default_config.into();

                            let spec = hound::WavSpec {
                                channels: config.channels as u16,
                                sample_rate: config.sample_rate.0,
                                bits_per_sample: 16,
                                sample_format: hound::SampleFormat::Int,
                            };

                            let writer = hound::WavWriter::create(&dest_path, spec).map_err(
                                |e| format!("Gagal membuat berkas WAV di {:?}: {}", dest_path, e),
                            )?;

                            let shared_writer = Arc::new(Mutex::new(Some(writer)));
                            let writer_clone = shared_writer.clone();
                            let lvl_clone = level_for_worker.clone();
                            let rec_clone = recording_for_worker.clone();

                            let err_fn = |err| eprintln!("Galat cpal: {}", err);

                            let stream = match sample_format {
                                SampleFormat::F32 => device.build_input_stream(
                                    &config,
                                    move |data: &[f32], _: &_| {
                                        if !rec_clone.load(Ordering::Relaxed) {
                                            return;
                                        }

                                        let mut sum = 0.0;
                                        for &s in data {
                                            sum += s * s;
                                        }
                                        let rms = (sum / data.len() as f32).sqrt();
                                        if let Ok(mut lvl) = lvl_clone.lock() {
                                            *lvl = (rms * 5.0).min(1.0);
                                        }

                                        if let Ok(mut w_opt) = writer_clone.lock() {
                                            if let Some(w) = w_opt.as_mut() {
                                                for &s in data {
                                                    let c = s.clamp(-1.0, 1.0);
                                                    let sample_i16 = (c * 32767.0) as i16;
                                                    let _ = w.write_sample(sample_i16);
                                                }
                                            }
                                        }
                                    },
                                    err_fn,
                                    None,
                                ),
                                SampleFormat::I16 => device.build_input_stream(
                                    &config,
                                    move |data: &[i16], _: &_| {
                                        if !rec_clone.load(Ordering::Relaxed) {
                                            return;
                                        }

                                        let mut sum = 0.0;
                                        for &s in data {
                                            let n = s as f32 / 32768.0;
                                            sum += n * n;
                                        }
                                        let rms = (sum / data.len() as f32).sqrt();
                                        if let Ok(mut lvl) = lvl_clone.lock() {
                                            *lvl = (rms * 5.0).min(1.0);
                                        }

                                        if let Ok(mut w_opt) = writer_clone.lock() {
                                            if let Some(w) = w_opt.as_mut() {
                                                for &s in data {
                                                    let _ = w.write_sample(s);
                                                }
                                            }
                                        }
                                    },
                                    err_fn,
                                    None,
                                ),
                                _ => return Err("Format sample audio tidak didukung.".to_string()),
                            }
                            .map_err(|e| format!("Gagal membangun stream audio: {}", e))?;

                            stream
                                .play()
                                .map_err(|e| format!("Gagal memulai stream audio: {}", e))?;

                            active_stream = Some(stream);
                            if let Ok(mut w_opt) = shared_writer.lock() {
                                wav_writer = w_opt.take();
                            }
                            active_path = Some(dest_path.clone());
                            recording_for_worker.store(true, Ordering::SeqCst);

                            Ok(dest_path.to_string_lossy().to_string())
                        })();

                        let _ = reply.send(res);
                    }
                    AudioCommand::Stop { reply } => {
                        recording_for_worker.store(false, Ordering::SeqCst);
                        active_stream = None;

                        if let Ok(mut lvl) = level_for_worker.lock() {
                            *lvl = 0.0;
                        }

                        let res = (|| -> Result<PathBuf, String> {
                            if let Some(writer) = wav_writer.take() {
                                writer
                                    .finalize()
                                    .map_err(|e| format!("Gagal memfinalisasi berkas WAV: {}", e))?;
                            }

                            active_path
                                .take()
                                .ok_or_else(|| "Tidak ada rekaman aktif untuk diselesaikan.".to_string())
                        })();

                        let _ = reply.send(res);
                    }
                }
            }
        });

        Self {
            cmd_tx,
            current_level,
            is_recording,
        }
    }

    pub fn start(&self, device_name: Option<String>, dest_path: PathBuf) -> Result<String, String> {
        let (reply_tx, reply_rx) = channel();
        self.cmd_tx
            .send(AudioCommand::Start {
                device_name,
                dest_path,
                reply: reply_tx,
            })
            .map_err(|_| "Audio worker thread tidak merespon.".to_string())?;

        reply_rx
            .recv()
            .map_err(|_| "Audio worker terputus.".to_string())?
    }

    pub fn stop(&self) -> Result<PathBuf, String> {
        let (reply_tx, reply_rx) = channel();
        self.cmd_tx
            .send(AudioCommand::Stop { reply: reply_tx })
            .map_err(|_| "Audio worker thread tidak merespon.".to_string())?;

        reply_rx
            .recv()
            .map_err(|_| "Audio worker terputus.".to_string())?
    }
}

pub fn list_input_devices() -> Result<Vec<AudioDeviceItem>, String> {
    let host = cpal::default_host();
    let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

    let devices = host
        .input_devices()
        .map_err(|e| format!("Gagal memindai perangkat audio: {}", e))?;

    let mut result = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            let is_default = default_device_name.as_deref() == Some(&name);
            result.push(AudioDeviceItem { name, is_default });
        }
    }

    Ok(result)
}

fn find_device_by_name(host: &cpal::Host, name: Option<&str>) -> Result<Device, String> {
    if let Some(target) = name {
        let devices = host
            .input_devices()
            .map_err(|e| format!("Gagal membaca input devices: {}", e))?;
        for d in devices {
            if let Ok(d_name) = d.name() {
                if d_name == target {
                    return Ok(d);
                }
            }
        }
    }

    host.default_input_device()
        .ok_or_else(|| "Tidak ditemukan perangkat mikrofon default di komputer ini.".to_string())
}
