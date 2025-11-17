import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv'; // Asegúrate de tener dotenv si usas variables de entorno locales

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;
const MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.2";

// --- CORRECCIÓN 1: La URL debe apuntar directamente al modelo ---
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) {
        return res.status(500).json({ message: 'API key for Hugging Face is not configured.' });
    }
    if (!task || !payload) {
        return res.status(400).json({ message: 'Request must include a "task" and "payload".' });
    }

    let prompt = '';
    
    // Construcción del prompt (Tu lógica se mantiene igual)
    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        prompt = `[INST] Translate the following text to ${payload.targetLanguage} in a ${payload.targetCulture} style. Keep the original tone and genre (${payload.genre}). Text: "${textToTranslate}" [/INST]`;
    } else if (task === 'generate_anexo') {
        prompt = `[INST] For a ${payload.novelGenre} novel, create a detailed description for a ${payload.type} named "${payload.name}". Describe appearance and motivations. [/INST]`;
    } else if (task === 'suggest_title') {
        prompt = `[INST] Suggest a creative chapter title for a ${payload.novelGenre} novel titled "${payload.novelTitle}". Previous content: "${payload.previousChapterContent}" [/INST]`;
    } else {
        prompt = JSON.stringify(payload);
    }
    
    try {
        console.log("Enviando petición a HF..."); // Log para depurar

        const response = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            // --- CORRECCIÓN 2: No enviamos "model" dentro del body ---
            body: JSON.stringify({ 
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500,
                    return_full_text: false,
                    // temperature: 0.7, // Opcional: ajusta la creatividad
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Hugging Face API Error Response:", errorText);
            
            // Manejo específico para cuando el modelo está cargando (error 503)
            if (response.status === 503) {
                return res.status(503).json({ message: 'El modelo se está cargando en Hugging Face (Cold Boot). Intenta de nuevo en 30 segundos.' });
            }
            
            throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log("Respuesta de HF:", result); // Ver qué devuelve exactamente

        const generatedText = (result && result[0] && result[0].generated_text) ? result[0].generated_text : '';

        let formattedResponse = {};
        // Tu lógica de formateo
        if (task === 'translate_chapter') {
            formattedResponse = { translatedTitle: `[TRAD] ${payload.title}`, translatedContent: generatedText.trim() };
        } else if (task === 'translate_title') {
             formattedResponse = { translatedTitle: generatedText.trim().replace(/"/g, '') };
        } else if (task === 'generate_anexo') {
            formattedResponse = { appearance: 'Ver texto abajo', motivation: generatedText.trim() };
        } else if (task === 'suggest_title') {
            formattedResponse = { suggestedTitle: generatedText.trim().replace(/"/g, '') };
        }

        res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
