import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting server initialization...");
  const app = express();
  const PORT = 3000;

  try {
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---
  
  // Biometric Prediction (Backend Processing)
  app.post("/api/biometric/predict", async (req, res) => {
    try {
      const { capturedDataUrl, gallery } = req.body;
      
      const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API__KEY;
      if (!key) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const genAI = new (GoogleGenAI as any)({ apiKey: key });
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash", 
        generationConfig: { responseMimeType: "application/json" }
      });

      const parts: any[] = [
        { text: `SYSTEM PROTOCOL: Biometric Identity Verification.
          
  CRITICAL TASK: Analyze the 'CAPTURED_SCAN' and find the closest matching face from the 'ENROLLED_GALLERY'.
  
  Facial Landmark Analysis:
  1. Examine ocular distance and orbital socket depth.
  2. Compare the nasal bridge structure and base width.
  3. Verify the mandibular line and labial alignment.
  4. Account for minor variations in lighting, pose, or expression.
  
  CONFIDENCE CALCULATION:
  - Match: Confidence 0.70 to 1.00 (Success)
  - Ambiguous: Confidence 0.50 to 0.69 (Return 'low_confidence')
  - No Match: Confidence < 0.50 (Return 'none')
  
  You MUST return ONLY a JSON object:
  {"id": "matched_user_id_or_none", "confidence": 0.95, "reason": "Consistent bone structure"}` }
      ];

      // Add captured image
      const capturedBase64 = capturedDataUrl.split(',')[1];
      parts.push({ 
        inlineData: { data: capturedBase64, mimeType: "image/jpeg" }
      });
      parts.push({ text: "SOURCE: CAPTURED_SCAN" });

      // Add gallery
      gallery.forEach((emp: any) => {
        if (emp.faceData && emp.faceData.startsWith('data:image')) {
          const base64 = emp.faceData.split(',')[1];
          parts.push({ 
            inlineData: { data: base64, mimeType: "image/jpeg" } 
          });
          parts.push({ text: `REFERENCE: USER_ID_${emp.id}` });
        }
      });

      const result = await model.generateContent({ contents: [{ role: "user", parts }] });
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Invalid AI response format: ${text}`);
      }

      const match = JSON.parse(jsonMatch[0]);
      res.json(match);
    } catch (error: any) {
      console.error("Backend Biometric Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock ID/Password Login
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    
    // In a real app, you'd check a DB. For this kiosk, we'll allow standard admin/manager credentials
    if (username === "admin" && password === "admin123") {
        return res.json({ 
            success: true, 
            user: { id: 'adm_1', name: 'Robin Bosky', role: 'ADMIN', position: 'Factory Owner' } 
        });
    }
    
    if (username === "manager" && password === "manager123") {
        return res.json({ 
            success: true, 
            user: { id: 'mgr_1', name: 'Sarah Connor', role: 'MANAGER', position: 'Site Manager' } 
        });
    }

    if (username === "staff" && password === "staff123") {
        return res.json({ 
            success: true, 
            user: { id: 'SHARED_STAFF', name: 'Workforce Hub', role: 'EMPLOYEE', position: 'Kiosk Terminal' } 
        });
    }

    res.status(401).json({ success: false, message: "Invalid workforce credentials" });
  });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`WORKFORCE KIOSK Server running on http://localhost:${PORT}`);
    });
  } catch (globalErr) {
    console.error("FATAL: Server failed to start:", globalErr);
    process.exit(1);
  }
}

startServer();
