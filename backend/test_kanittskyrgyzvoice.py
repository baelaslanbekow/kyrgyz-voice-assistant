import os
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
from groq import Groq
import uvicorn
import shutil

# 1. Настройка "мозгового центра"
# Укажите ключ через переменные окружения
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
client = Groq(api_key=GROQ_API_KEY)

app = FastAPI()

# 2. Красивый интерфейс Марлиса (HTML + JS)
HTML_CONTENT = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Marlis AI - Тест Ушей</title>
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5; }
        .marlis-circle { width: 150px; height: 150px; border-radius: 50%; background: #007bff; display: flex; align-items: center; justify-content: center; color: white; font-size: 50px; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,123,255,0.3); }
        .recording { background: #ff4757; transform: scale(1.1); box-shadow: 0 0 30px #ff4757; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        #text-output { margin-top: 20px; font-size: 20px; font-weight: bold; color: #2f3542; text-align: center; max-width: 80%; }
        #status { margin-top: 10px; color: #747d8c; }
    </style>
</head>
<body>
    <div id="marlisBtn" class="marlis-circle">🎤</div>
    <div id="status">Кнопканы басып сүйлөңүз</div>
    <div id="text-output"></div>

    <script>
        let mediaRecorder;
        let audioChunks = [];
        const btn = document.getElementById('marlisBtn');
        const output = document.getElementById('text-output');
        const status = document.getElementById('status');

        btn.onclick = async () => {
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = sendToMarlis;
                
                mediaRecorder.start();
                btn.classList.add('recording');
                status.innerText = "Марлис угуп жатат...";
            } else {
                mediaRecorder.stop();
                btn.classList.remove('recording');
                status.innerText = "Ойлонуп жатат...";
            }
        };

        async function sendToMarlis() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.wav');

            const response = await fetch('/transcribe', { method: 'POST', body: formData });
            const data = await response.json();
            output.innerText = data.text;
            status.innerText = "Даяр!";
        }
    </script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
async def read_root():
    return HTML_CONTENT

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # Сохраняем временный файл
    temp_file = "temp_audio.wav"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Отправляем в Groq Whisper (самый быстрый STT в 2026 году)
        with open(temp_file, "rb") as audio:
            transcription = client.audio.transcriptions.create(
                file=(temp_file, audio.read()),
                model="whisper-large-v3",
                language="ky", # Указываем кыргызский язык
                response_format="text"
            )
        return {"text": transcription}
    except Exception as e:
        return {"text": f"Ката: {str(e)}"}
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

if __name__ == "__main__":
    print("🚀 Сэр, Марлис иштеп жатат! Браузерден ачыңыз: http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)