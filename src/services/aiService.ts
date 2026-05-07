import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function parseVoiceCommand(command: string, language: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Parse the following voice command for a ledger app (SmartKhata). 
    Context: Shopkeeper voice commands in Pakistan.
    Languages Supported: English, Urdu, Roman Urdu, Sindhi.
    
    Command: "${command}"
    Language: ${language}
    
    Return a JSON object with:
    1. type: 'CREDIT' (Shopkeeper gave/Udhaar), 'DEBIT' (Shopkeeper got/Jama), 'ADD_CUSTOMER', 'VIEW_BALANCE', 'SEARCH', 'REPORT', 'UNKNOWN'
    2. amount: number (if found)
    3. customerName: string (if found)
    4. description: string (if found)
    5. confirmation: A natural response string in the detected language to speak back to the user.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          customerName: { type: Type.STRING },
          description: { type: Type.STRING },
          confirmation: { type: Type.STRING },
        },
        required: ["type", "confirmation"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function getRiskInsights(customer: any, transactions: any[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this customer's behavior for a shopkeeper in Pakistan.
    Customer: ${JSON.stringify(customer)}
    Transactions: ${JSON.stringify(transactions)}
    
    Return a JSON object with:
    1. score: 0-100
    2. riskLevel: 'low', 'medium', 'high'
    3. likelyToPay: probability 0-1
    4. insights: A brief summary in ${customer.language || 'English'}
    5. suggestedLimit: a PKR amount
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          riskLevel: { type: Type.STRING },
          likelyToPay: { type: Type.NUMBER },
          insights: { type: Type.STRING },
          suggestedLimit: { type: Type.NUMBER },
        },
        required: ["score", "riskLevel", "insights", "suggestedLimit"]
      }
    }
  });

  return JSON.parse(response.text);
}
