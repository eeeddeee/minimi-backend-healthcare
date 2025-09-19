import axios from 'axios';
import mongoose from "mongoose";

// Cache translations
const translationCacheSchema = new mongoose.Schema({
  text: String,
  sourceLang: String,
  targetLang: String,
  translatedText: String,
  createdAt: { type: Date, default: Date.now }
});
translationCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30-day TTL
const TranslationCache = mongoose.model('TranslationCache', translationCacheSchema);

const LIBRETRANSLATE_URL = 'http://localhost:5000/translate'; // Self-hosted instance

export async function translateText(text, targetLanguage) {
  if (!text || targetLanguage === 'en') return text;

  const cached = await TranslationCache.findOne({ text, targetLang: targetLanguage });
  if (cached) return cached.translatedText;

  try {
    let translatedText;
    if (['bn', 'ta'].includes(targetLanguage)) {
      // Fallback to MyMemory for bn/ta
      const response = await axios.get('http://api.mymemory.translated.net/get', {
        params: { q: text, langpair: `en|${targetLanguage}` }
      });
      translatedText = response.data.responseData.translatedText;
    } else {
      const response = await axios.post(LIBRETRANSLATE_URL, {
        q: text,
        source: 'en',
        target: targetLanguage,
        format: 'text'
      });
      translatedText = response.data.translatedText;
    }

    await TranslationCache.create({ text, sourceLang: 'en', targetLang: targetLanguage, translatedText });
    return translatedText;
  } catch (error) {
    console.error('Translation error:', error.message);
    return text; // Fallback to original
  }
}
