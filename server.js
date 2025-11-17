// Contenido para tu archivo server.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// 1. Lee la nueva API Key de Groq desde las variables de entorno
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// 2. Define el modelo de Groq a utilizar (LLaMA 3 es excelente y rápido)
const MODEL_ID = "llama3-8b-8192";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!GROQ_API_KEY) {
        return res.status(500).json({ message: 'La API Key de Groq no está configurada en el servidor.' });
    }

    let systemPrompt = "You are a helpful assistant for a novelist.";
    let userPrompt = '';

    const cleanText = (txt) => txt ? txt.replace(/^"|"$/g, '').trim() : '';

    // 3. Construye los prompts para cada tarea
    switch (task) {
        case 'translate_chapter':
        case 'translate_title':
            const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
            systemPrompt = `You are a professional translator. Translate the user's text to the target language, maintaining the original tone and genre. Only output the translated text.`;
            userPrompt = `Translate the following text to ${payload.targetLanguage}.\nGenre: ${payload.genre}.\nText: "${textToTranslate}"`;
            break;

        case 'generate_anexo':
            systemPrompt = `You are a creative writer. Describe a character or location for a novel based on the user's request. Provide a description for 'appearance' and 'motivation' in a JSON object format like {"appearance": "...", "motivation": "..."}.`;
            userPrompt = `Novel Genre: ${payload.novelGenre}.\nName: "${payload.name}".\nType: ${payload.type}.`;
            break;

        case 'suggest_title':
            systemPrompt = `You are an expert book editor. Suggest one single, creative, and fitting chapter title based on the context provided. Only output the title itself, without any quotation marks or extra text.`;
            userPrompt = `Novel Title: "${payload.novelTitle}".\nNovel Genre: ${payload.novelGenre}.\nPrevious Chapter Content: "${payload.previousChapterContent}"`;
            break;

        default:
            return res.status(400).json({ message: `Tarea desconocida: ${task}` });
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                ...(task === 'generate_anexo' && { response_format: { type: "json_object" } })
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error en la API de Groq: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const generatedText = result.choices[0]?.message?.content || '';

        let formattedResponse = {};

        // 4. Formatea la respuesta para el frontend
        switch (task) {
            case 'translate_chapter':
                formattedResponse = { translatedContent: generatedText.trim() };
                break;
            case 'translate_title':
                formattedResponse = { translatedTitle: cleanText(generatedText) };
                break;
            case 'generate_anexo':
                try {
                    formattedResponse = JSON.parse(generatedText);
                } catch (e) {
                    formattedResponse = { appearance: generatedText, motivation: "No se pudo generar una motivación separada." };
                }
                break;
            case 'suggest_title':
                formattedResponse = { suggestedTitle: cleanText(generatedText) };
                break;
        }

        return res.status(200).json(formattedResponse);

    } catch (error) {
        console.error('Error del Servidor:', error.message);
        return res.status(500).json({ message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Servidor para Groq corriendo en el puerto ${port}`);
});
