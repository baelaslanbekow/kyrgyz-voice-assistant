import os
import shutil

import uvicorn
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=GROQ_API_KEY)
app = FastAPI()

HTML = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Marlis — тест транскрипции</title>
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5; }
        .btn { width: 150px; height: 150px; border-radius: 50%; background: #007bff; display: flex; align-items: center; justify-content: center; color: white; font-size: 50px; cursor: pointer; border: none; }
        .btn.recording { background: #ff4757; transform: scale(1.1); }
        #output { margin-top: 20px; font-size: 20px; max-width: 80%; text-align: center; }
        #status { margin-top: 10px; color: #747d8c; }
    </style>
</head>
<body>
    <button id="btn" class="btn">🎤</button>
    <div id="status">Кнопканы басып сүйлөңүз</div>
    <div id="output"></div>
    <script>
        let recorder, chunks = [];
        const btn = document.getElementById('btn');
        const output = document.getElementById('output');
        const status = document.getElementById('status');

        btn.onclick = async () => {
            if (!recorder || recorder.state === 'inactive') {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                recorder = new MediaRecorder(stream);
                chunks = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = send;
                recorder.start();
                btn.classList.add('recording');
                status.textContent = 'Угуп жатам...';
            } else {
                recorder.stop();
                btn.classList.remove('recording');
                status.textContent = 'Иштетилүүдө...';
            }
        };

        async function send() {
            const form = new FormData();
            form.append('file', new Blob(chunks, { type: 'audio/wav' }), 'audio.wav');
            const res = await fetch('/transcribe', { method: 'POST', body: form });
            const data = await res.json();
            output.textContent = data.text;
            status.textContent = 'Даяр';
        }
    </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index():
    return HTML


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    path = "temp_audio.wav"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        with open(path, "rb") as audio:
            text = client.audio.transcriptions.create(
                file=(path, audio.read()),
                model="whisper-large-v3",
                language="ky",
                response_format="text",
            )
        return {"text": text}
    except Exception as e:
        return {"text": f"Ката: {e}"}
    finally:
        if os.path.exists(path):
            os.remove(path)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)