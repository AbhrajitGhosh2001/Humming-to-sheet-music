const VF = Vex.Flow;

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const clefSelect = document.getElementById("clef");
const sheetMusicDiv = document.getElementById("sheet-music");

let audioContext;
let analyser;
let source;
let notesArray = [];

function startAudioProcessing() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      setInterval(detectPitch, 100);
    })
    .catch((error) => console.error("Error:", error));
}

function stopAudioProcessing() {
  if (source) {
    source.mediaStream.getTracks().forEach((track) => track.stop());
  }
}

function detectPitch() {
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  const autoCorrelationBuffer = autoCorrelate(dataArray, audioContext.sampleRate);

  const frequency = findFrequency(autoCorrelationBuffer);

  if (frequency) {
    const note = teoria.note.fromFrequency(frequency).toString(true);
    notesArray.push(note);
  }
}

function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  const MIN_SAMPLES = 0;

  let best_offset = -1;
  let best_correlation = 0;
  let rms = 0;
  let foundGoodCorrelation = false;
  for (let i = 0; i < SIZE; i++) {
    const val = buf[i] / 255 - 0.5;
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;

    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs((buf[i] / 255 - 0.5) - (buf[i + offset] / 255 - 0.5));
    }

    correlation = 1 - correlation / MAX_SAMPLES;
    if (correlation > 0.9 && correlation > best_correlation) {
      best_correlation = correlation;
      best_offset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation && correlation < 0.9) {
      break;
    }
  }

  return foundGoodCorrelation ? sampleRate / best_offset : -1;
}

function findFrequency(buf) {
  const n = 1024;
  const im = new Array(n).fill(0);
  const re = new Array(n).fill(0);
  let max_magnitude = -Infinity;
  let max_index = -1;

  for (let i = 0; i < n; i++) {
    re[i] = buf[i] ? buf[i] / 255 : 0;
  }

  fft(re, im);

  for (let i = 0; i < n / 2; i++) {
    const magnitude = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
    if (magnitude > max_magnitude) {
      max_magnitude = magnitude;
      max_index = i;
    }
  }

  return max_index * audioContext.sampleRate / (2 * n);
}

function renderSheetMusic() {
  sheetMusicDiv.innerHTML = "";
  const renderer = new VF.Renderer(sheetMusicDiv, VF.Renderer.Backends.SVG);
  renderer.resize(800, 200);
  const context = renderer.getContext();
  const stave = new VF.Stave(10, 40, 780);

  stave.addClef(clefSelect.value);
  stave.setContext(context).draw();

  const notes = notesArray.map((note) => new VF.StaveNote({
    clef: clefSelect.value,
    keys: [note],
    duration: "q"
  }));

  const voice = new VF.Voice({ num_beats: notes.length, beat_value: 4 });
  voice.addTickables(notes);

  const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 760);

  voice.draw(context, stave);
}

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  startAudioProcessing();
});

stopBtn.addEventListener("click", () => {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  stopAudioProcessing();
  renderSheetMusic();
});
