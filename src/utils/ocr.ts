import { createWorker, type Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng')
  }
  return workerPromise
}

export async function extractTextFromImage(file: File): Promise<string> {
  const worker = await getWorker()
  const { data } = await worker.recognize(file)
  const text = data.text.trim()
  if (!text) {
    throw new Error('No text detected in image')
  }
  return text
}

/** Terminates the shared Tesseract worker and frees its memory. */
export async function terminateOcrWorker(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}

// Automatically clean up the worker when the page is closed
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    terminateOcrWorker()
  })
}