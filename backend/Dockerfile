FROM python:3.11-slim

LABEL maintainer="BayMax – Healthcare Buddy"
LABEL description="FastAPI backend with LangChain AI, OCR, and MongoDB"

# ─── System Dependencies (Tesseract OCR + imaging libs) ───────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Python Dependencies ──────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ─── Application Code ─────────────────────────────────────────────────────────
COPY . .

# ─── Expose API Port ──────────────────────────────────────────────────────────
EXPOSE 8000

# ─── Health Check ─────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ─── Start Server ─────────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
