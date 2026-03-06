import time
from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

import os

# Upload file
script_dir = os.path.dirname(os.path.abspath(__file__))
video_path = os.path.join(script_dir, "videoplayback.mp4")
myfile = client.files.upload(file=video_path)

# Wait until the file is ACTIVE
while True:
    file_state = client.files.get(name=myfile.name)
    if file_state.state == "ACTIVE":
        break
    elif file_state.state == "FAILED":
        raise RuntimeError("File processing failed.")
    time.sleep(2)

# Now it is safe to use/Users/gobus/Desktop/main/DAC/videoplayback.mp4
response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        myfile,
        "Summarize this video. Then create a quiz with an answer key based on the information in this video."
    ]
)

print(response.text)