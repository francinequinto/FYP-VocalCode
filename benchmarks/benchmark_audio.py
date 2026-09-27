import json
import numpy as np
import soundfile as sf
from vosk import Model, KaldiRecognizer
import whisper
# from google.cloud import speech

audio_file = "benchmark_audio.m4a"

# 1) OpenAI Whisper
print("\n--- WHISPER OUTPUT (Local, High Accuracy) ---")
whisper_model = whisper.load_model("base")
whisper_result = whisper_model.transcribe(audio_file)
print(f"Transcript: {whisper_result['text']}")

# 2) Vosk
print("\n--- VOSK OUTPUT (Local, Fast, Lower Accuracy) ---")
vosk_model = Model(lang="en-us")

# whisper.load_audio uses ffmpeg to output a 16kHz mono float32 numpy array
audio_waveform = whisper.load_audio(audio_file)

# convert float32 in [-1.0, 1.0] to standard 16-bit signed PCM integers
pcm16_waveform = (audio_waveform *  32767).astype(np.int16)
raw_bytes = pcm16_waveform.tobytes()

rec = KaldiRecognizer(vosk_model, 16000.0)

chunk_size = 4000
for i in range(0, len(raw_bytes), chunk_size):
    rec.AcceptWaveform(raw_bytes[i : i + chunk_size])

final_res = json.loads(rec.FinalResult())
print(f"Transcript: {final_res.get('text', '')}")

# 3) Google Cloud Speech
# will only run with a valid service account JSON key
# print("\n--- GOOGLE CLOUD SPEECH OUTPUT (Cloud, Privacy Risk) ---")
# try:
#     client = speech.SpeechClient.from_service_account_json('google_cloud_key.json')
#     with io.open(audio_file, "rb") as f:
#         content = f.read()
#     audio = speech.RecognitionAudio(content=content)
#     config = speech.RecognitionConfig(language_code="en-US")

#     response = client.recognize(config=config, audio=audio)
#     for result in response.results:
#         print(f"Transcript: {result.alternatives[0].transcript}")
# except Exception as e:
#     print(f"Google Cloud Error (Expected if no API key): {e}")