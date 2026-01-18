const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const { search } = require('duck-duck-scrape');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('templates'));

// Configuration
const SYSTEM_INSTRUCTION =
    "Tu es ParleGPT, une IA créée par Imrane Bouadass. " +
    "Tu es cool, détendu, et tu aimes utiliser des emojis. " +
    "Ton style d'écriture est moderne et agréable. " +
    "Tu as accès à internet via des recherches. " +
    "Si l'utilisateur pose une question d'actualité ou de faits, utilise le contexte fourni. " +
    "Ne mentionne pas que tu es un modèle 'OpenAI' ou autre, tu es ParleGPT. " +
    "Parle toujours en Français par défaut.";

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Helper: Determine if search is likely needed
function needsSearch(query) {
    const triggers = ['qui', 'quoi', 'ou', 'comment', 'pourquoi', 'quand', 'météo', 'heure', 'actu', 'news', 'dernier', 'cherche', 'trouve', 'donne moi'];
    const lower = query.toLowerCase();
    return triggers.some(t => lower.includes(t)) || query.endsWith('?');
}

app.post('/chat', async (req, res) => {
    try {
        const { message, useSearch } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message requis' });
        }

        let context = "";

        // 1. Web Search Step
        // Perform search if manual toggle is ON OR if specific keywords/question detected
        if (useSearch || needsSearch(message)) {
            console.log(`Searching for: ${message} (Manual: ${useSearch})`);
            try {
                const searchResults = await search(message, { safeSearch: 0 }); // safeSearch: 0 (Strict), 1 (Moderate), 2 (Off) - let's use Moderate (1) usually, but library might use different mapping. strict=0, moderate=-1, off=-2 in some libs. duck-duck-scrape uses: safe: 1 (moderate).

                if (searchResults && searchResults.results && searchResults.results.length > 0) {
                    const topResults = searchResults.results.slice(0, 3).map(r =>
                        `- [${r.title}](${r.url}): ${r.description}`
                    ).join('\n');

                    context = `\n\n[CONTEXTE WEB RECENT pour aider à répondre]:\n${topResults}\n`;
                }
            } catch (searchErr) {
                console.error("Search failed:", searchErr.message);
                // Continue without search context
            }
        }

        // 2. AI Generation Step (Pollinations.ai)
        // We use their POST endpoint for chat
        const messages = [
            { role: 'system', content: SYSTEM_INSTRUCTION + context },
            { role: 'user', content: message }
        ];

        console.log("Sending to AI...");
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: messages,
            model: 'openai', // Maps to GPT-4o-mini usually, very good and free
            jsonMode: false
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        // The response from pollinations might be raw text or specific format depending on endpoint
        // text.pollinations.ai usually returns raw text string if we just enable it?
        // Let's check typical usage. POST returns the text content directly usually.
        // Wait, Pollinations.ai docs say:
        // POST / with body { messages, model } -> returns the assistant response text.

        let aiText = "";
        if (typeof response.data === 'string') {
            aiText = response.data;
        } else if (response.data && response.data.choices) {
            // Sometimes it mimics OpenAI format
            aiText = response.data.choices[0].message.content;
        } else {
            // Fallback
            aiText = JSON.stringify(response.data);
        }

        res.json({ response: aiText });

    } catch (error) {
        console.error("Server Error:", error.message);
        res.status(500).json({ error: "Oups, mon cerveau a buggé... " + error.message });
    }
});

app.listen(port, () => {
    console.log(`ParleGPT server running at http://localhost:${port}`);
});
