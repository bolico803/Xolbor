import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// State
const state = {
    apiKey: 'AIzaSyDZo901UwJq9Quf5DPvN9jmWewUqdH6q1c',
    stream: null,
    model: null
};

// DOM Elements
const elements = {
    video: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    startCameraBtn: document.getElementById('start-camera'),
    captureBtn: document.getElementById('capture-photo'),
    uploadBtn: document.getElementById('upload-btn'),
    fileInput: document.getElementById('file-upload'),
    heroSection: document.getElementById('scan-section'),
    loadingSection: document.getElementById('loading-section'),
    resultsSection: document.getElementById('results-section'),
    skinScore: document.getElementById('skin-score'),
    issuesList: document.getElementById('skin-issues-list'),
    productsGrid: document.getElementById('products-grid'),
    resetBtn: document.getElementById('reset-btn')
};

// Initialization
function init() {
    initGemini();

    setupEventListeners();
}

function setupEventListeners() {


    elements.startCameraBtn.addEventListener('click', startCamera);

    elements.captureBtn.addEventListener('click', captureAndAnalyze);

    elements.uploadBtn.addEventListener('click', () => elements.fileInput.click());

    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                analyzeImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    elements.resetBtn.addEventListener('click', resetApp);
}

function initGemini() {
    const genAI = new GoogleGenerativeAI(state.apiKey);
    state.model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
}

// Camera Logic
async function startCamera() {
    try {
        state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        elements.video.srcObject = state.stream;
        elements.startCameraBtn.classList.add('hidden');
        elements.captureBtn.classList.remove('hidden');
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Impossible d'accéder à la caméra. Veuillez vérifier vos permissions ou utiliser l'upload.");
    }
}

async function captureAndAnalyze() {
    const context = elements.canvas.getContext('2d');
    elements.canvas.width = elements.video.videoWidth;
    elements.canvas.height = elements.video.videoHeight;
    context.drawImage(elements.video, 0, 0);

    const dataUrl = elements.canvas.toDataURL('image/jpeg');

    // Stop camera
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }

    analyzeImage(dataUrl);
}

// Analysis Logic
async function analyzeImage(base64Image) {
    showLoading();

    try {
        // Convert data URL to base64 string for Gemini
        const base64Data = base64Image.split(',')[1];

        const prompt = `
            Agis en tant qu'expert dermatologue pour L'Oréal. Analyse cette photo de visage.
            Identifie les problèmes de peau visibles (acné, rides, pores, cernes, hydratation, etc.).
            Attribue un score de santé de la peau sur 100.
            Recommande 3 produits L'Oréal Paris spécifiques pour traiter ces problèmes.
            
            Réponds UNIQUEMENT au format JSON strict suivant :
            {
                "score": 85,
                "issues": ["Rides du front", "Pores dilatés", "Cernes marqués"],
                "recommendations": [
                    {
                        "name": "Nom du Produit Exact",
                        "type": "Sérum/Crème/etc",
                        "reason": "Pourquoi ce produit aide (1 phrase courte)"
                    }
                ]
            }
        `;

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
            },
        };

        const result = await state.model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean markdown if present to parse JSON
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonString);

        displayResults(data);

    } catch (error) {
        console.error("Analysis failed:", error);
        alert("Une erreur est survenue lors de l'analyse. Vérifiez votre clé API ou réessayez.");
        resetApp();
    }
}

// UI Updates
function showLoading() {
    elements.heroSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.loadingSection.classList.remove('hidden');

    const messages = ["Analyse de la texture...", "Détection des imperfections...", "Recherche de produits L'Oréal adaptés..."];
    let i = 0;
    const interval = setInterval(() => {
        if (i < messages.length) {
            document.getElementById('loading-text').innerText = messages[i];
            i++;
        } else {
            clearInterval(interval);
        }
    }, 1500);
}

function displayResults(data) {
    elements.loadingSection.classList.add('hidden');
    elements.resultsSection.classList.remove('hidden');

    // Score
    elements.skinScore.innerText = data.score;

    // Issues
    elements.issuesList.innerHTML = '';
    data.issues.forEach(issue => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color: gold; margin-right:8px;"></i> ${issue}`;
        elements.issuesList.appendChild(li);
    });

    // Products
    elements.productsGrid.innerHTML = '';
    data.recommendations.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        // Placeholder image based on product type keyword matching could be added here
        // For now using a generic placeholder or the generated name
        card.innerHTML = `
            <div style="height: 200px; background: #f5f5f5; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; color:#ccc;">
                <i class="fa-solid fa-bottle-droplet fa-3x"></i>
            </div>
            <h4 class="product-name">${product.name}</h4>
            <p style="font-size:0.8rem; text-transform:uppercase; color:#999; margin-bottom:0.5rem;">${product.type}</p>
            <p class="product-reason">${product.reason}</p>
            <button class="btn-primary" style="margin-top:1rem; padding:0.5rem 1rem; font-size:0.8rem;">Découvrir</button>
        `;
        elements.productsGrid.appendChild(card);
    });
}

function resetApp() {
    state.stream = null;
    elements.resultsSection.classList.add('hidden');
    elements.heroSection.classList.remove('hidden');
    elements.startCameraBtn.classList.remove('hidden');
    elements.captureBtn.classList.add('hidden');
    elements.video.srcObject = null;
}

// Start
init();
