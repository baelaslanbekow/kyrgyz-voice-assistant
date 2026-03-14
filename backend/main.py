import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from groq import Groq
from sqlalchemy.orm import Session
import database
import aiofiles
import uuid
import datetime

app = FastAPI()

# CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq Client
client = Groq(api_key=os.environ.get("GROQ_API_KEY", "YOUR_GROQ_API_KEY"))

# Dependency to get DB session
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    # Save temp file
    file_path = f"temp_{uuid.uuid4()}.wav"
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await audio.read()
        await out_file.write(content)
    
    try:
        with open(file_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(file_path, file.read()),
                model="whisper-large-v3",
                language="ky",  # Kyrgyz language code
                response_format="json",
            )
        return {"text": transcription.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

@app.post("/chat")
async def chat(query: str, db: Session = Depends(get_db)):
    # Simple user identification (could be replaced by more robust token)
    user_id = "default_user" 
    
    # Check usage
    usage = db.query(database.UserUsage).filter(database.UserUsage.user_id == user_id).first()
    if not usage:
        usage = database.UserUsage(user_id=user_id, count=0)
        db.add(usage)
        db.commit()
    
    # Reset count if it's a new day
    now = datetime.datetime.utcnow()
    if usage.last_reset.date() < now.date():
        usage.count = 0
        usage.last_reset = now
        db.commit()
        
    if usage.count >= 70:
        raise HTTPException(status_code=403, detail="LIMIT_REACHED")

    try:
        # Increment usage
        usage.count += 1
        db.commit()
        
        # Retrieve last 5 interactions for context
        history = db.query(database.Interaction).order_by(database.Interaction.timestamp.desc()).limit(5).all()
        history.reverse()
        
        messages = [
            {"role": "system", "content": "Сен кыргыз тилдүү акылдуу ассистентсиң. Колдонуучунун аты-жөнүн жана мурунку сүйлөшүүлөрдү эстеп кал. Кыска жана так жооп бер."}
        ]
        
        for interaction in history:
            messages.append({"role": "user", "content": interaction.user_query})
            messages.append({"role": "assistant", "content": interaction.assistant_response})
            
        messages.append({"role": "user", "content": query})

        completion = client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
        )
        response_text = completion.choices[0].message.content
        
        # Save to DB
        new_interaction = database.Interaction(user_query=query, assistant_response=response_text)
        db.add(new_interaction)
        db.commit()
        
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/synthesize")
async def synthesize(text: str):
    # This is a placeholder for Kani TTS. 
    # In a real scenario, we would call the Kani TTS API here.
    # For now, we return a mock success or redirect to a public TTS if possible.
    # Since I don't have a direct SDK for Kani TTS in the env, I'll mock the response.
    return {"audio_url": f"https://api.example.com/tts?text={text}&lang=ky"}

@app.get("/history")
async def get_history(db: Session = Depends(get_db)):
    interactions = db.query(database.Interaction).order_by(database.Interaction.timestamp.desc()).limit(10).all()
    return interactions

@app.post("/clear_history")
async def clear_history(db: Session = Depends(get_db)):
    db.query(database.Interaction).delete()
    db.commit()
    return {"status": "cleared"}

# Serve frontend
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
