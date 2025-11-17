import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
// import dotenv from 'dotenv'; dotenv.config(); 

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

// 1. SELECCIONAMOS EL MODELO (Zephyr es excelente y gratuito)
const MODEL_ID = "HuggingFaceH4/zephyr-7b-beta";

// 2. USAMOS LA NUEVA URL "ROUTER"
// La estructura correcta es: https://router.huggingface.co/hf-inference/models/{MODEL_ID}
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) return res.status(500).json({ message: 'Falta API Key.' });

    // 3. FORMATEO DEL PROMPT (Estilo Chat para Zephyr/Mistral)
    let prompt = '';
    
    // Función auxiliar para limpiar strings
    const cleanText = (txt) => txt ? txt.replace(/"/g, '').trim() : '';

    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        prompt = `<|system|>
You are a professional translator specialized in literary translation.
</s>
<|user|>
Translate the following text to ${payload.targetLanguage}.
Style: ${payload.targetCulture}.
Genre: ${payload.genre}.
Tone: Maintain original tone.

Text to translate:
"${textToTranslate}"
</s>
<|assistant|>`;
    } else if (task === 'generate_anexo') {
        prompt = `<|system|>You are a creative novelist.</s><|user|>Create a character description for a ${payload.novelGenre} novel. Type: ${payload.type}, Name: "${payload.name}". Include physical appearance and motivations.</s><|assistant|>`;
    } else if (task === 'suggest_title') {
        prompt = `<|system|>You are an editor.</s><|user|>Suggest 1 short, creative chapter title for a ${payload.novelGenre} novel titled "${payload.novelTitle}". Context: "${payload.previousChapterContent}". Output ONLY the title.</s><|assistant|>`;
    } else {
        prompt = JSON.stringify(payload);
    }

    try {
        console.log("Enviando petición a:", HF_INFERENCE_URL);

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
                    return_full_text: false, // Importante: para no repetir el prompt
                    temperature: 0.7,
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error HF (${response.status}):`, errorText);
            
            if (response.status === 503) {
                return res.status(503).json({ message: 'El modelo se está iniciando (Cold Boot). Espera 20 segundos e intenta de nuevo.' });
            }
            throw new Error(`Error de Hugging Face: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log("Respuesta bruta:", JSON.stringify(result).substring(0, 200) + "...");

        // La respuesta suele ser un array [{ generated_text: "..." }]
        const generatedText = (result && result[0]) ? result[0].generated_text : '';

        let formattedResponse = {};

        if (task === 'translate_chapter') {
            formattedResponse = { translatedTitle: `[TRAD] ${payload.title}`, translatedContent: generatedText.trim() };
        } else if (task === 'translate_title') {
             formattedResponse = { translatedTitle: cleanText(generatedText) };
        } else if (task === 'generate_anexo') {
            formattedResponse = { appearance: 'Ver descripción abajo', motivation: generatedText.trim() };
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
