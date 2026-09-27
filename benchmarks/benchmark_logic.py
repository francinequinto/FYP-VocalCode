import requests
# from openai import OpenAI
import time

prompt = """
You are an AI game logic engine.
Current State: [{"id": "knight", "x": 100, "y": 200}]
Command: "Move the knight 50 pixels right."
Output ONLY valid Python code inside ```python ``` tags. Do not say 'Here is the code'.
"""

def test_local_llm(model_name):
    print(f"\n--- {model_name.upper()} OUTPUT ---")
    start_time = time.time()
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": model_name,
            "prompt": prompt,
            "temperature": 0,
            "stream": False
        })
        res_json = response.json()
        end_time = time.time()

        if 'response' in res_json:
            print(res_json['response'])
            print(f"Inference Latency: {end_time - start_time:.2f} seconds")
        else:
            print(f"API Error Payload: {res_json}")
    except Exception as e:
        print(f"Network/Script Error: {e}")

# 1 & 2. LLAMA 3 vs MISTRAL
test_local_llm("llama3")
test_local_llm("mistral")

# # 3. GPT-4
# print("\n--- GPT-4 OUTPUT (Cloud Network Latency) ---")
# try:
#     client = OpenAI(api_key="api_key")
#     start_time = time.time()
#     response = client.chat.completions.create(
#         model="gpt-4",
#         messages=[
#             {"role": "system", "content": "You are an AI game logic engine."},
#             {"role": "user", "content": prompt}
#         ],
#         temperature=0
#     )
#     end_time = time.time()
#     print(response.choices[0].message.content)
#     print(f"Network Latency: {end_time - start_time:.2f} seconds")
# except Exception as e:
#     print(f"GPT-4 Error (Expected if no API key): {e}")