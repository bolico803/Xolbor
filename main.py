from google import genai
import os

# Function to run the AI
def run_parlegpt():
    # Check for API key
    if not os.environ.get("AIzaSyDZo901UwJq9Quf5DPvN9jmWewUqdH6q1c"):
        print("Note: Make sure to set the GOOGLE_API_KEY environment variable.")
        # Optional: You can hardcode it here for testing if the user provides it, 
        # but for security, env var is better.
    
    try:
        client = genai.Client()
        
        # Identity and System Instructions
        system_instruction = (
            "You are ParleGPT, an AI assistant created by Imrane Bouadass. "
            "You have a special connection with Google services. "
            "Always identify yourself as ParleGPT created by Imrane Bouadass."
        )

        # The user requested 'gemini-3-flash-preview'. 
        # Using the requested model.
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            config={
                'system_instruction': system_instruction,
            },
            contents="Bonjour, qui es-tu et qui t'a créé ?",
        )
        
        print("--- Réponse de ParleGPT ---")
        print(response.text)
        print("---------------------------")

        # Interactive loop
        print("\n(You can type 'exit' to quit)")
        while True:
            user_input = input("\nYou: ")
            if user_input.lower() in ["exit", "quit"]:
                break
                
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                config={
                    'system_instruction': system_instruction,
                },
                contents=user_input,
            )
            print(f"ParleGPT: {response.text}")

    except Exception as e:
        print(f"An error occurred: {e}")
        print("\nPossible fix: Check your API Key or Model Name.")

if __name__ == "__main__":
    run_parlegpt()
