from flask import Flask, render_template, request, jsonify
from google import genai
import os

app = Flask(__name__)

# --- CONFIGURATION ---
# Try to get key from environment, otherwise use the key provided by user in previous attempts.
# WARNING: It is best practice to use environment variables for keys.
API_KEY = os.environ.get("GOOGLE_API_KEY") or "AIzaSyDZo901UwJq9Quf5DPvN9jmWewUqdH6q1c"

client = None
if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"Error initializing client: {e}")

# System instructions
SYSTEM_INSTRUCTION = (
    "You are ParleGPT, an AI assistant created by Imrane Bouadass. "
    "You have a special connection with Google services. "
    "Always identify yourself as ParleGPT created by Imrane Bouadass. "
    "Speak French by default unless asked otherwise."
)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    if not client:
        return jsonify({"error": "API Key invalid or missing. Please check app.py or your environment variables."}), 500

    user_message = request.json.get('message')
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        # Using the model as requested/available
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            config={
                'system_instruction': SYSTEM_INSTRUCTION,
            },
            contents=user_message,
        )
        return jsonify({"response": response.text})
    except Exception as e:
        print(f"Generation error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting ParleGPT Web Server...")
    print("Go to http://127.0.0.1:5000 in your browser to chat!")
    app.run(debug=True, host='0.0.0.0', port=5000)
