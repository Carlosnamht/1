import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
// import dotenv from 'dotenv'; dotenv.config(); // Descomenta si usas local

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

// USAMOS ZEPHYR (Es más estable para la API gratuita que Mistral original)
const MODEL_ID = "HuggingFaceH4/zephyr-7b-beta";
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) return res.status(500).json({ message: 'Falta la API KEY.' });

    // Construcción del prompt (Adaptado para Zephyr/Mistral)
    // Zephyr usa el formato: <|system|>...</s><|user|>...</s><|assistant|>
    // Pero el formato simple de [INST] funciona bien por compatibilidad.
    let prompt = '';
    
    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        prompt = `<|system|>You are a professional translator.</s><|user|>Translate to ${payload.targetLanguage} (Style: ${payload.targetCulture}, Genre: ${payload.genre}). Text: "${textToTranslate}"</s><|assistant|>`;
    } else if (task === 'generate_anexo') {
        prompt = `<|system|>You are a creative writer.</s><|user|>Create a character description for a ${payload.novelGenre} novel. Type: ${payload.type}, Name: "${payload.name}". Include appearance and motivations.</s><|assistant|>`;
    } else if (task === 'suggest_title') {
        prompt = `<|system|>You are an editor.</s><|user|>Suggest a chapter title for a ${payload.novelGenre} novel ("${payload.novelTitle}"). Context: "${payload.previousChapterContent}"</s><|assistant|>`;
    } else {
        prompt = JSON.stringify(payload);
    }

    try {
        console.log(`Consultando modelo: ${MODEL_ID}`);
        
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
                    return_full_text: false,
                    temperature: 0.7
                }
            }),
        });

        // Manejo de errores detallado
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error HF (${response.status}):`, errorText);
            
            if (response.status === 404) {
                throw new Error(`Error 404: El modelo ${MODEL_ID} no existe o tu token no tiene acceso a él.`);
            }
            if (response.status === 503) {
                return res.status(503).json({ message: 'El modelo se está cargando (Cold Boot). Intenta en 20 segundos.' });
            }
            throw new Error(`Error de API: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const generatedText = (result && result[0]) ? result[0].generated_text : '';

        // Formateo simple
        let formattedResponse = { 
            result: generatedText.trim(),
            // Aquí mantienes tu lógica original de mapeo según "task"
            translatedTitle: generatedText.trim(), // Ejemplo genérico
            translatedContent: generatedText.trim() 
        };

        res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
