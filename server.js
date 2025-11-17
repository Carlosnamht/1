import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

// 1. CAMBIO DE MODELO: Usamos 'gemma-1.1-7b-it' porque Zephyr no está en el router nuevo.
const MODEL_ID = "google/gemma-1.1-7b-it";

// 2. URL DEL ROUTER: Esta es la URL obligatoria ahora.
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) return res.status(500).json({ message: 'Falta API Key.' });

    // 3. PROMPT ADAPTADO: Gemma usa un formato simple
    let prompt = '';
    
    // Función para limpiar comillas extra que a veces genera la IA
    const cleanText = (txt) => txt ? txt.replace(/^"|"$/g, '').trim() : '';

    // Construimos el prompt según la tarea
    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        prompt = `Translate this text to ${payload.targetLanguage}.
Style: ${payload.targetCulture}. Genre: ${payload.genre}.
Original Text: "${textToTranslate}"
Translation:`;
    } else if (task === 'generate_anexo') {
        prompt = `Write a character description for a ${payload.novelGenre} novel.
Name: "${payload.name}". Type: ${payload.type}.
Include physical appearance and motivations.
Description:`;
    } else if (task === 'suggest_title') {
        prompt = `Suggest 1 creative chapter title for a ${payload.novelGenre} novel named "${payload.novelTitle}".
Context: "${payload.previousChapterContent}".
Only output the title.
Title:`;
    } else {
        prompt = JSON.stringify(payload);
    }

    try {
        console.log(`Conectando a: ${HF_INFERENCE_URL}`);

        const response = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500,
                    return_full_text: false, // Para que no repita tu pregunta
                    temperature: 0.7
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error HF (${response.status}):`, errorText);
            
            // Manejo de errores comunes
            if (response.status === 503) {
                return res.status(503).json({ message: 'Modelo cargando (Cold Boot). Intenta en 30 segundos.' });
            }
            if (response.status === 404) {
                return res.status(404).json({ message: `El modelo ${MODEL_ID} no está disponible en el Router actual.` });
            }
            
            throw new Error(`Error Hugging Face: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        // La estructura de respuesta es un array
        const generatedText = (result && result[0]) ? result[0].generated_text : '';
        console.log("Texto generado:", generatedText.substring(0, 50) + "...");

        let formattedResponse = {};

        if (task === 'translate_chapter') {
            formattedResponse = { translatedTitle: `[TRAD] ${payload.title}`, translatedContent: generatedText.trim() };
        } else if (task === 'translate_title') {
             formattedResponse = { translatedTitle: cleanText(generatedText) };
        } else if (task === 'generate_anexo') {
            formattedResponse = { appearance: 'Ver texto', motivation: generatedText.trim() };
        } else if (task === 'suggest_title') {
            formattedResponse = { suggestedTitle: cleanText(generatedText) };
        } else {
             formattedResponse = { result: generatedText };
        }

        res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
