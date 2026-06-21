import os
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from groq import Groq
from sqlalchemy.orm import Session
import database
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
DAILY_LIMIT = 70
SYSTEM_PROMPT = (
    "Сен кыргыз тилдүү акылдуу ассистентсиң. "
    "Колдонуучунун аты-жөнүн жана мурунку сүйлөшүүлөрдү эстеп кал. "
    "Кыска жана так жооп бер."
)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
groq = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()
@contextmanager
def temp_file(content: bytes, suffix=".webm"):
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(content)
            path = f.name
        yield path
    finally:
        if path and os.path.exists(path):
            os.unlink(path)
def get_usage(db: Session, user_id: str) -> database.UserUsage:
    usage = db.query(database.UserUsage).filter_by(user_id=user_id).first()
    if not usage:
        usage = database.UserUsage(user_id=user_id)
        db.add(usage)
        db.flush()
        return usage
    now = datetime.now(timezone.utc)
    if usage.last_reset.date() < now.date():
        usage.count = 0
        usage.last_reset = now
    return usage
def recent_history(db: Session, limit: int = 5) -> list[database.Interaction]:
    rows = (
        db.query(database.Interaction)
        .order_by(database.Interaction.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))
def to_messages(history: list[database.Interaction], query: str) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for row in history:
        messages.append({"role": "user", "content": row.user_query})
        messages.append({"role": "assistant", "content": row.assistant_response})
    messages.append({"role": "user", "content": query})
    return messages
@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    content = await audio.read()
    try:
        with temp_file(content) as path:
            result = groq.audio.transcriptions.create(
                file=(path, content),
                model="whisper-large-v3",
                language="ky",
                response_format="json",
            )
        return {"text": result.text}
    except Exception as e:
        raise HTTPException(500, str(e)) from e
@app.post("/chat")
async def chat(query: str, db: Session = Depends(get_db)):
    usage = get_usage(db, "default_user")
    db.commit()
    if usage.count >= DAILY_LIMIT:
        raise HTTPException(403, "LIMIT_REACHED")
    try:
        completion = groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=to_messages(recent_history(db), query),
        )
        text = completion.choices[0].message.content
    except Exception as e:
        raise HTTPException(500, str(e)) from e
    usage.count += 1
    db.add(database.Interaction(user_query=query, assistant_response=text))
    db.commit()
    return {"response": text}
@app.post("/synthesize")
async def synthesize(text: str):
    return {"audio_url": f"https://api.example.com/tts?text={text}&lang=ky"}
@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    return (
        db.query(database.Interaction)
        .order_by(database.Interaction.timestamp.desc())
        .limit(10)
        .all()
    )
@app.post("/clear_history")
async def clear_history(db: Session = Depends(get_db)):
    db.query(database.Interaction).delete()
    db.commit()
    return {"status": "cleared"}
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")