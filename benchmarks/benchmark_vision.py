import io
import time
import ollama
from transformers import BlipProcessor, BlipForConditionalGeneration
from ultralytics import YOLO
from PIL import Image

image_path = "cartoon_dog.png"

# 1) Salesforce Blip
print("\n--- BLIP OUTPUT (Semantic Text, Low RAM) ---")
processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
raw_image = Image.open(image_path).convert('RGB')
inputs = processor(raw_image, return_tensors="pt")
caption = processor.decode(model.generate(**inputs)[0], skip_special_tokens=True)
print(f"Context Generated: {caption}")

# 2) YOLO
print("\n--- YOLO OUTPUT (Geometric Data, Fast) ---")
yolo_model = YOLO("yolov8n.pt")
results = yolo_model(image_path)
for box in results[0].boxes:
    for box in results[0].boxes:
        print(f"Class: {box.cls.item()}, Coordinates: {box.xyxy.tolist()}")

# 3) LLAVA
print("\n--- LLAVA OUTPUT (Semantic Text, High RAM Bottleneck) ---")
try:
    with Image.open(image_path) as img:
        rgb_img = img.convert("RGB")
        buffer = io.BytesIO()
        rgb_img.save(buffer, format="JPEG")
        image_bytes = buffer.getvalue()

    start_time = time.time()
    response = ollama.chat(
            model="llava:latest",
            messages=[
                {
                    "role": "user",
                    "content": "Describe this image in one short sentence.",
                    "images": [image_bytes],
                }
            ],
    )
    end_time = time.time()

    print(f"Context Generated: {response['message']['content'].strip()}")
    print(f"Inference Latency: {end_time - start_time:.2f} seconds")
except Exception as err:
    print(f"LLaVA Script Error: {err}")