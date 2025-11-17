import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
// Render proporciona la variable de entorno PORT.
const port = process.env.PORT || 10000;

// Middleware
app.use(cors()); // Permite peticiones desde tu app frontend
app.use(express.json());

// Tu clave de API de Hugging Face (la leeremos de las variables de entorno de Render)
const HF_API_KEY = process.env.HF_API_KEY;

// --- CAMBIOS AQUÍ ---
// 1. La URL de la API de Hugging Face ha sido actualizada según el mensaje de error.
const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference";
// 2. Ahora pasamos el nombre del modelo como parte de la petición.
const MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.2";
// --- FIN DE LOS CAMBIOS ---


// Ruta principal de la API que tu frontend llamará
app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) {
        return res.status(500).json({ message: 'API key for Hugging Face is not configured on the server.' });
    }
    if (!task || !payload) {
        return res.status(400).json({ message: 'Request must include a "task" and "payload".' });
    }

    let prompt = '';
    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        prompt = `Translate the following text to ${payload.targetLanguage} in a ${payload.targetCulture} style. Keep the original tone and genre (${payload.genre}). Text to translate: "${textToTranslate}"`;
    } else if (task === 'generate_anexo') {
        prompt = `For a ${payload.novelGenre} novel, create a detailed description for a ${payload.type} named "${payload.name}". Describe their physical appearance and their motivations within the story.`;
    } else if (task === 'suggest_title') {
        prompt = `Suggest a creative and fitting chapter title for a ${payload.novelGenre} novel titled "${payload.novelTitle}". The previous chapter ended with this content: "${payload.previousChapterContent}"`;
    } else {
        prompt = JSON.stringify(payload);
    }
    
    try {
        // --- CAMBIOS AQUÍ ---
        // 3. La llamada ahora va a la nueva URL y el modelo se especifica en el "body".
        const response = await fetch(HF_INFERENCE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                model: MODEL_ID, // El modelo ahora se pasa aquí
                inputs: prompt,
                parameters: {
                    max_new_tokens: 500,
                    return_full_text: false,
                }
            }),
        });
        // --- FIN DE LOS CAMBIOS ---

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const generatedText = result[0]?.generated_text || '';

        let formattedResponse = {};
        if (task === 'translate_chapter') {
            // El título también necesita ser traducido. Hacemos una suposición simple por ahora.
            formattedResponse = { translatedTitle: `[TRAD] ${payload.title}`, translatedContent: generatedText.trim() };
        } else if (task === 'translate_title') {
             formattedResponse = { translatedTitle: generatedText.trim().replace(/"/g, '') };
        } else if (task === 'generate_anexo') {
            formattedResponse = { appearance: 'Apariencia generada por IA...', motivation: generatedText.trim() };
        } else if (task === 'suggest_title') {
            formattedResponse = { suggestedTitle: generatedText.trim().replace(/"/g, '') };
        }

        res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Server Error:', error.message);
        res.status(500).json({ message: 'An error occurred on the server.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
