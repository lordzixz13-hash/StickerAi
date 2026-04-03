import { useState, useRef, useCallback } from "react";

const STYLES = [
  { id: "cartoon", label: "Cartoon", emoji: "🎨", prompt: "cartoon style, vibrant colors, thick outlines, playful illustration" },
  { id: "anime", label: "Anime", emoji: "⚔️", prompt: "anime style, manga illustration, Japanese animation, detailed linework" },
  { id: "meme", label: "Meme", emoji: "😂", prompt: "meme style, funny internet meme, bold expression, humorous illustration" },
  { id: "chibi", label: "Chibi", emoji: "🌸", prompt: "chibi style, cute kawaii, big head small body, adorable Japanese art style" },
  { id: "pixel", label: "Pixel Art", emoji: "👾", prompt: "pixel art style, 8-bit retro game art, pixelated, classic video game aesthetic" },
  { id: "3d", label: "3D Realista", emoji: "💎", prompt: "3D realistic render, CGI, photorealistic, detailed 3D modeling, studio lighting" },
];

const EXAMPLES = [
  "Cachorro pilotando foguete 🚀",
  "Pizza brava com raiva 🍕",
  "Gato astronauta 🌙",
  "Sapo tocando guitarra 🎸",
  "Dinossauro comendo sorvete 🍦",
];

export default function StickerAI() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("cartoon");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("idle"); // idle | generating | removing_bg | done
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [savedStickers, setSavedStickers] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const canvasRef = useRef(null);

  const getStyleConfig = () => STYLES.find(s => s.id === selectedStyle);

  const buildPrompt = () => {
    const style = getStyleConfig();
    return `${prompt}, ${style.prompt}, sticker design, white background, centered composition, high quality, clean edges, no text`;
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Digite uma descrição para sua figurinha!");
      return;
    }
    const key = apiKey || localStorage.getItem("hf_api_key");
    if (!key) {
      setShowApiKeyInput(true);
      setError("Insira sua chave da API Hugging Face para gerar figurinhas.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setProcessedImage(null);
    setStep("generating");

    try {
      const fullPrompt = buildPrompt();
      const response = await fetch(
        "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: fullPrompt,
            parameters: {
              num_inference_steps: 30,
              guidance_scale: 7.5,
              width: 512,
              height: 512,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          throw new Error("Modelo carregando... Tente novamente em 20 segundos!");
        } else if (response.status === 401) {
          throw new Error("Chave API inválida. Verifique sua chave do Hugging Face.");
        } else {
          throw new Error(errorData.error || `Erro na API: ${response.status}`);
        }
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setGeneratedImage(imageUrl);
      setStep("removing_bg");

      // Process with canvas: add white border sticker effect
      await processImageAsSticker(imageUrl);
      setStep("done");
      if (apiKey) localStorage.setItem("hf_api_key", apiKey);
    } catch (err) {
      setError(
        err.message.includes("fetch")
          ? "Sem conexão com a internet. Verifique sua rede."
          : err.message
      );
      setStep("idle");
    } finally {
      setIsGenerating(false);
    }
  };

  const processImageAsSticker = async (imageUrl) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = 512;
        canvas.width = size;
        canvas.height = size;

        // Draw white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);

        // Draw thick white stroke border (sticker effect)
        ctx.save();
        const padding = 16;
        const innerSize = size - padding * 2;

        // White outline (sticker border)
        ctx.shadowColor = "white";
        ctx.shadowBlur = 20;
        ctx.drawImage(img, padding, padding, innerSize, innerSize);
        ctx.restore();

        // Draw image clean
        ctx.drawImage(img, padding, padding, innerSize, innerSize);

        // Remove white background using pixel manipulation
        const imageData = ctx.getImageData(0, 0, size, size);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // Make near-white pixels transparent
          if (r > 230 && g > 230 && b > 230) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);

        // Re-draw with white border outline
        const borderCanvas = document.createElement("canvas");
        borderCanvas.width = size;
        borderCanvas.height = size;
        const borderCtx = borderCanvas.getContext("2d");

        // White sticker border
        const offsets = [];
        for (let angle = 0; angle < 360; angle += 15) {
          const rad = (angle * Math.PI) / 180;
          offsets.push([Math.cos(rad) * 8, Math.sin(rad) * 8]);
        }

        offsets.forEach(([ox, oy]) => {
          borderCtx.drawImage(canvas, ox, oy);
        });

        // White fill for border
        const borderData = borderCtx.getImageData(0, 0, size, size);
        const bd = borderData.data;
        for (let i = 0; i < bd.length; i += 4) {
          if (bd[i + 3] > 0) {
            bd[i] = 255;
            bd[i + 1] = 255;
            bd[i + 2] = 255;
            bd[i + 3] = 255;
          }
        }
        borderCtx.putImageData(borderData, 0, 0);
        borderCtx.drawImage(canvas, 0, 0);

        const finalUrl = borderCanvas.toDataURL("image/png");
        setProcessedImage(finalUrl);
        resolve(finalUrl);
      };
      img.src = imageUrl;
    });
  };

  const saveSticker = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.download = `sticker_${Date.now()}.png`;
    link.href = processedImage;
    link.click();

    // Save to gallery
    const newSticker = {
      id: Date.now(),
      image: processedImage,
      prompt: prompt,
      style: selectedStyle,
      date: new Date().toLocaleDateString("pt-BR"),
    };
    setSavedStickers(prev => [newSticker, ...prev].slice(0, 20));
  };

  const shareSticker = async (platform) => {
    if (!processedImage) return;
    if (navigator.share) {
      try {
        const blob = await (await fetch(processedImage)).blob();
        const file = new File([blob], "sticker.png", { type: "image/png" });
        await navigator.share({ files: [file], title: "Minha Figurinha AI ✨" });
      } catch {}
    } else {
      await navigator.clipboard.writeText("Figurinha gerada com Sticker AI! 🎨");
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const loadExample = (example) => {
    setPrompt(example.replace(/[^\w\s]/gi, '').trim());
  };

  const stepMessages = {
    generating: ["✨ IA gerando sua figurinha...", "🎨 Pintando os detalhes...", "🚀 Quase pronto..."],
    removing_bg: ["🔧 Processando figurinha...", "✂️ Adicionando borda branca..."],
    done: ["✅ Figurinha pronta!"],
  };

  const [loadingMsgIdx] = useState(0);
  const currentMsg = step !== "idle" && step !== "done"
    ? stepMessages[step]?.[loadingMsgIdx % (stepMessages[step]?.length || 1)]
    : "";

  return (
    <div style={{
      fontFamily: "'Nunito', 'Segoe UI', sans-serif",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      padding: "0",
      color: "white",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .sticker-app { max-width: 480px; margin: 0 auto; padding: 16px; }
        .header { text-align: center; padding: 24px 0 16px; }
        .logo { font-family: 'Fredoka One', cursive; font-size: 36px; background: linear-gradient(90deg, #ff6b9d, #c44dff, #4d79ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .subtitle { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 4px; }
        .card { background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; margin-bottom: 16px; }
        .input-area { width: 100%; background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2); border-radius: 14px; padding: 14px 16px; font-size: 15px; font-family: 'Nunito', sans-serif; color: white; resize: none; outline: none; transition: border-color 0.2s; }
        .input-area::placeholder { color: rgba(255,255,255,0.4); }
        .input-area:focus { border-color: #c44dff; }
        .section-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
        .style-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .style-btn { background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 8px; text-align: center; cursor: pointer; transition: all 0.2s; }
        .style-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(196,77,255,0.5); }
        .style-btn.active { background: rgba(196,77,255,0.2); border-color: #c44dff; }
        .style-emoji { font-size: 22px; display: block; }
        .style-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.8); margin-top: 4px; }
        .generate-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #c44dff, #4d79ff); border: none; border-radius: 16px; font-family: 'Fredoka One', cursive; font-size: 20px; color: white; cursor: pointer; transition: all 0.2s; letter-spacing: 0.5px; }
        .generate-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(196,77,255,0.4); }
        .generate-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .examples { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .example-pill { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 5px 12px; font-size: 12px; cursor: pointer; color: rgba(255,255,255,0.7); transition: all 0.15s; white-space: nowrap; }
        .example-pill:hover { background: rgba(196,77,255,0.15); border-color: #c44dff; color: white; }
        .result-area { text-align: center; }
        .sticker-frame { width: 200px; height: 200px; margin: 0 auto 20px; border-radius: 20px; overflow: hidden; background: repeating-conic-gradient(#444 0% 25%, #333 0% 50%) 0 0 / 20px 20px; position: relative; display: flex; align-items: center; justify-content: center; }
        .sticker-img { width: 100%; height: 100%; object-fit: contain; }
        .loading-ring { width: 60px; height: 60px; border: 4px solid rgba(196,77,255,0.2); border-top: 4px solid #c44dff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-msg { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 12px; animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
        .action-btn { padding: 12px; border-radius: 12px; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .save-btn { background: linear-gradient(135deg, #11998e, #38ef7d); color: #0a3d2e; }
        .share-btn { background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2); color: white; }
        .save-btn:hover { transform: scale(1.02); }
        .share-btn:hover { background: rgba(255,255,255,0.18); }
        .error-box { background: rgba(255,80,80,0.15); border: 1px solid rgba(255,80,80,0.4); border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #ff9999; margin-bottom: 16px; }
        .api-key-area { display: flex; flex-direction: column; gap: 8px; }
        .api-input { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: white; font-family: 'Nunito', sans-serif; outline: none; }
        .api-input::placeholder { color: rgba(255,255,255,0.35); }
        .api-link { font-size: 11px; color: #c44dff; text-decoration: none; }
        .gallery-toggle { text-align: center; margin-top: 8px; }
        .gallery-btn { background: none; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); font-family: 'Nunito', sans-serif; font-size: 12px; padding: 6px 16px; border-radius: 20px; cursor: pointer; }
        .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
        .gallery-item { aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: repeating-conic-gradient(#444 0% 25%, #333 0% 50%) 0 0 / 12px 12px; cursor: pointer; transition: transform 0.15s; }
        .gallery-item:hover { transform: scale(1.05); }
        .gallery-item img { width: 100%; height: 100%; object-fit: contain; }
        .new-btn { width: 100%; padding: 12px; background: rgba(255,255,255,0.06); border: 1.5px dashed rgba(255,255,255,0.2); border-radius: 14px; font-family: 'Nunito', sans-serif; font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.6); cursor: pointer; margin-top: 12px; transition: all 0.2s; }
        .new-btn:hover { background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.4); }
        .badge { display: inline-block; background: linear-gradient(90deg, #ff6b9d, #c44dff); padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-left: 8px; vertical-align: middle; }
      `}</style>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="sticker-app">
        {/* Header */}
        <div className="header">
          <div className="logo">🎭 Sticker AI</div>
          <div className="subtitle">Gerador de figurinhas com Inteligência Artificial</div>
        </div>

        {/* API Key Section */}
        <div className="card">
          <div className="section-label">🔑 API Hugging Face {apiKey && <span style={{ color: "#38ef7d", fontSize: 11 }}>✓ Configurada</span>}</div>
          {showApiKeyInput || !localStorage.getItem("hf_api_key") ? (
            <div className="api-key-area">
              <input
                className="api-input"
                type="password"
                placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Gratuito em{" "}
                  <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="api-link">
                    huggingface.co
                  </a>
                </span>
                {apiKey && (
                  <button onClick={() => { localStorage.setItem("hf_api_key", apiKey); setShowApiKeyInput(false); setError(null); }}
                    style={{ background: "rgba(196,77,255,0.2)", border: "1px solid #c44dff", color: "white", borderRadius: 8, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>
                    Salvar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>API key salva e pronta ✨</span>
              <button onClick={() => setShowApiKeyInput(true)} style={{ background: "none", border: "none", color: "#c44dff", fontSize: 12, cursor: "pointer" }}>Alterar</button>
            </div>
          )}
        </div>

        {/* Main Generation */}
        {step !== "done" && (
          <>
            <div className="card">
              <div className="section-label">📝 Descreva sua figurinha</div>
              <textarea
                className="input-area"
                rows={3}
                placeholder="Ex: Cachorro pilotando foguete com óculos de sol..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && e.ctrlKey && generateImage()}
              />
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Ideias rápidas:</div>
                <div className="examples">
                  {EXAMPLES.map(ex => (
                    <div key={ex} className="example-pill" onClick={() => loadExample(ex)}>{ex}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-label">🎨 Estilo</div>
              <div className="style-grid">
                {STYLES.map(style => (
                  <div
                    key={style.id}
                    className={`style-btn ${selectedStyle === style.id ? "active" : ""}`}
                    onClick={() => setSelectedStyle(style.id)}
                  >
                    <span className="style-emoji">{style.emoji}</span>
                    <div className="style-label">{style.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="error-box">⚠️ {error}</div>}

            <button className="generate-btn" onClick={generateImage} disabled={isGenerating}>
              {isGenerating ? "⏳ Gerando..." : "✨ Gerar Figurinha"}
            </button>
          </>
        )}

        {/* Loading */}
        {isGenerating && (
          <div className="card" style={{ marginTop: 16, textAlign: "center", padding: "32px 20px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="loading-ring" />
            </div>
            <div className="loading-msg">{currentMsg || "Processando..."}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
              Stable Diffusion 2 · Hugging Face API
            </div>
          </div>
        )}

        {/* Result */}
        {step === "done" && processedImage && (
          <div className="card result-area">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "rgba(255,255,255,0.8)" }}>
              🎉 Sua figurinha está pronta!
            </div>
            <div className="sticker-frame">
              <img src={processedImage} className="sticker-img" alt="Figurinha gerada" />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
              "{prompt}" · {STYLES.find(s => s.id === selectedStyle)?.label}
            </div>

            <div className="action-row">
              <button className="action-btn save-btn" onClick={saveSticker}>
                💾 Salvar PNG
              </button>
              <button className="action-btn share-btn" onClick={() => shareSticker("whatsapp")}>
                {copiedShare ? "✅ Copiado!" : "📤 Compartilhar"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
              <a
                href={`https://wa.me/?text=Criei%20essa%20figurinha%20com%20IA!%20%F0%9F%8E%A8`}
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <button className="action-btn share-btn" style={{ width: "100%", background: "rgba(37,211,102,0.15)", borderColor: "rgba(37,211,102,0.4)", fontSize: 12 }}>
                  💬 WhatsApp
                </button>
              </a>
              <a
                href="https://t.me/share/url?url=.&text=Figurinha+gerada+com+Sticker+AI!"
                target="_blank" rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <button className="action-btn share-btn" style={{ width: "100%", background: "rgba(41,182,246,0.15)", borderColor: "rgba(41,182,246,0.4)", fontSize: 12 }}>
                  ✈️ Telegram
                </button>
              </a>
              <button className="action-btn share-btn" style={{ fontSize: 12, background: "rgba(255,107,157,0.15)", borderColor: "rgba(255,107,157,0.4)" }}
                onClick={() => shareSticker("instagram")}>
                📸 Instagram
              </button>
            </div>

            <button className="new-btn" onClick={() => { setStep("idle"); setProcessedImage(null); setGeneratedImage(null); setPrompt(""); }}>
              ➕ Criar Nova Figurinha
            </button>
          </div>
        )}

        {/* Gallery */}
        {savedStickers.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-label" style={{ margin: 0 }}>
                🗂️ Galeria
                <span className="badge">{savedStickers.length}</span>
              </div>
              <button className="gallery-btn" onClick={() => setShowGallery(!showGallery)}>
                {showGallery ? "Ocultar" : "Ver todas"}
              </button>
            </div>
            {showGallery && (
              <div className="gallery-grid">
                {savedStickers.map(s => (
                  <div key={s.id} className="gallery-item" title={s.prompt}>
                    <img src={s.image} alt={s.prompt} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "20px 0 8px", fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          Sticker AI · Powered by Stable Diffusion 2 + Hugging Face
        </div>
      </div>
    </div>
  );
}
