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

// La URL de la API de Inferencia de Hugging Face
// Usaremos un modelo de lenguaje versátil. Puedes cambiarlo si lo necesitas.
const MODEL_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";

// Ruta principal de la API que tu frontend llamará
app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) {
        return res.status(500).json({ message: 'API key for Hugging Face is not configured on the server.' });
    }
    if (!task || !payload) {
        return res.status(400).json({ message: 'Request must include a "task" and "payload".' });
    }

    // Aquí construyes el prompt para la IA basado en la tarea que pide el frontend.
    // Esto es muy importante y necesitarás ajustarlo para obtener los mejores resultados.
    let prompt = '';
    if (task === 'translate_chapter') {
        prompt = `Translate the following text to ${payload.targetLanguage} in a ${payload.targetCulture} style. Keep the original tone and genre (${payload.genre}). Text to translate: "${payload.content}"`;
    } else if (task === 'generate_anexo') {
        prompt = `For a ${payload.novelGenre} novel, create a detailed description for a ${payload.type} named "${payload.name}". Describe their physical appearance and their motivations within the story.`;
    } else if (task === 'suggest_title') {
        prompt = `Suggest a creative and fitting chapter title for a ${payload.novelGenre} novel titled "${payload.novelTitle}". The previous chapter ended with this content: "${payload.previousChapterContent}"`;
    } else {
        // Un caso genérico si se añade una nueva tarea
        prompt = JSON.stringify(payload);
    }
    
    try {
        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                inputs: prompt,
                // Parámetros para controlar la respuesta de la IA
                parameters: {
                    max_new_tokens: 500,
                    return_full_text: false,
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const generatedText = result[0]?.generated_text || '';

        // Ahora, formatea la respuesta para que coincida con lo que el frontend espera.
        let formattedResponse = {};
        if (task === 'translate_chapter') {
            formattedResponse = { translatedTitle: `[TRAD] ${payload.title}`, translatedContent: generatedText };
        } else if (task === 'generate_anexo') {
            // Esto es una simplificación. Podrías pedir a la IA que formatee la salida como JSON.
            formattedResponse = { appearance: 'Apariencia generada por IA...', motivation: generatedText };
        } else if (task === 'suggest_title') {
            formattedResponse = { suggestedTitle: generatedText.replace(/"/g, '') };
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
