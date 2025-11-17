import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;

// 1. URL DEL MODELO NLLB
const MODEL_ID = "facebook/nllb-200-distilled-600M";
const HF_INFERENCE_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

// 2. MAPA DE IDIOMAS (NLLB usa códigos FLORES-200)
// Puedes añadir más aquí: https://github.com/facebookresearch/flores/blob/main/flores200/README.md
const LANGUAGE_MAP = {
    'Spanish': 'spa_Latn',
    'English': 'eng_Latn',
    'French': 'fra_Latn',
    'German': 'deu_Latn',
    'Italian': 'ita_Latn',
    'Portuguese': 'por_Latn',
    'Japanese': 'jpn_Jpan',
    'Chinese': 'zho_Hans',
    // Valor por defecto si no encuentra el idioma
    'default': 'eng_Latn' 
};

const getFloresCode = (langName) => {
    // Intenta buscar exacto, o busca si el string incluye el nombre (ej: "Spanish (Spain)")
    const key = Object.keys(LANGUAGE_MAP).find(k => langName && langName.includes(k));
    return LANGUAGE_MAP[key] || LANGUAGE_MAP['default'];
};

app.post('/api/generate', async (req, res) => {
    const { task, payload } = req.body;

    if (!HF_API_KEY) return res.status(500).json({ message: 'Falta API Key.' });

    // --- LÓGICA ESPECÍFICA PARA NLLB ---
    
    if (task === 'translate_chapter' || task === 'translate_title') {
        const textToTranslate = task === 'translate_title' ? payload.title : payload.content;
        
        // Detectamos idioma origen (asumimos inglés si no viene definido, o puedes pasarlo en el payload)
        // Si tu app no envía sourceLanguage, NLLB intentará adivinarlo, pero es mejor especificarlo.
        const srcLang = payload.sourceLanguage ? getFloresCode(payload.sourceLanguage) : 'eng_Latn'; 
        const tgtLang = getFloresCode(payload.targetLanguage);

        try {
            console.log(`Traduciendo de ${srcLang} a ${tgtLang} usando NLLB...`);

            const response = await fetch(HF_INFERENCE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HF_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: textToTranslate,
                    parameters: {
                        // Estos parámetros son OBLIGATORIOS para NLLB
                        src_lang: srcLang,
                        tgt_lang: tgtLang
                    }
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 503) return res.status(503).json({ message: 'Modelo cargando (Cold Boot). Reintenta en 20s.' });
                throw new Error(`HF Error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            // NOTA: NLLB devuelve un formato diferente a Mistral/Gemma
            // Suele ser: [{ translation_text: "..." }]
            const translatedText = (result && result[0]) ? 
                                   (result[0].translation_text || result[0].generated_text) : '';

            const formattedResponse = { 
                translatedTitle: task === 'translate_title' ? translatedText : `[TRAD] ${payload.title}`, 
                translatedContent: translatedText 
            };

            return res.status(200).json(formattedResponse);

        } catch (error) {
            console.error('Translation Error:', error);
            return res.status(500).json({ message: error.message });
        }
    } 
    
    // --- AQUÍ MANTENEMOS LA LÓGICA PARA LAS OTRAS TAREAS QUE NO SON TRADUCCIÓN ---
    // (Para generar anexos o títulos, NLLB NO sirve, necesitas un LLM como Gemma o Zephyr)
    else {
        return res.status(400).json({ 
            message: 'Este endpoint ahora está configurado solo para traducción con NLLB. Para generación de texto usa otro modelo.' 
        });
        
        /* SI QUIERES MANTENER TODO EN UN SOLO ARCHIVO:
           Tendrías que hacer un "if" arriba del todo:
           if (task.includes('translate')) -> USAR URL DE NLLB
           else -> USAR URL DE GEMMA/MISTRAL
        */
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
