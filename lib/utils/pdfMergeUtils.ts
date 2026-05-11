// utils/pdfMergeUtils.ts - Optimized non-blocking version
import { PDFDocument } from 'pdf-lib';

/**
 * Process image file: Resize → Convert to JPEG (non-blocking)
 * Uses createImageBitmap for better performance
 */
async function processImageToJpeg(file: File): Promise<{ jpegBlob: Blob; width: number; height: number }> {
  // Use createImageBitmap for faster, non-blocking image decode
  const imageBitmap = await createImageBitmap(file);
  
  // Calculate dimensions (max 2000x2000, maintain aspect ratio)
  let { width, height } = imageBitmap;
  const maxDim = 2000;
  
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  // Use OffscreenCanvas if available (better performance)
  const canvas = typeof OffscreenCanvas !== 'undefined' 
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  
  if (canvas instanceof HTMLCanvasElement) {
    canvas.width = width;
    canvas.height = height;
  }
  
  const ctx = canvas.getContext('2d', { 
    alpha: false, // Faster for JPEGs
    desynchronized: true // Non-blocking rendering
  })!;
  

// Ensure we actually have a 2D canvas context
if (!(ctx instanceof OffscreenCanvasRenderingContext2D)) {
    throw new Error("2D rendering context not supported");
  }
  
  // Now TS knows the type is 2D-only
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // High quality drawing
  //ctx.imageSmoothingEnabled = true;
  //ctx.imageSmoothingQuality = 'high';
  //ctx.drawImage(imageBitmap, 0, 0, width, height);
  
  // Clean up bitmap
  imageBitmap.close();
  
  // Convert to JPEG blob
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    return { jpegBlob: blob, width, height };
  } else {
    return new Promise((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => {
          if (blob) {
            resolve({ jpegBlob: blob, width, height });
          } else {
            reject(new Error('Failed to convert image to JPEG'));
          }
        },
        'image/jpeg',
        0.9
      );
    });
  }
}

/**
 * Convert JPEG blob to PDF page
 */
async function jpegToPdf(jpegBlob: Blob, width: number, height: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const jpegBuffer = await jpegBlob.arrayBuffer();
  const jpegImage = await pdfDoc.embedJpg(jpegBuffer);
  const page = pdfDoc.addPage([width, height]);
  
  page.drawImage(jpegImage, {
    x: 0,
    y: 0,
    width: width,
    height: height,
  });
  
  return await pdfDoc.save();
}

/**
 * Read PDF file bytes
 */
async function readPdfBytes(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Merge multiple PDFs into one
 */
async function mergePdfs(pdfBytesArray: Uint8Array[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdfBytes of pdfBytesArray) {
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
}

/**
 * Process single file (with progress callback)
 */
async function processSingleFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<Uint8Array> {
  if (file.type === 'application/pdf') {
    onProgress?.(`Reading ${file.name}...`);
    return await readPdfBytes(file);
  } else {
    onProgress?.(`Processing ${file.name}...`);
    const { jpegBlob, width, height } = await processImageToJpeg(file);
    onProgress?.(`Converting ${file.name} to PDF...`);
    return await jpegToPdf(jpegBlob, width, height);
  }
}

/**
 * Main function: Process files per section with parallel processing and progress
 */
export async function processFilesToPdf(
  files: File[], 
  stage: string, 
  onProgress?: (current: number, total: number, status: string) => void
): Promise<{ 
  pdfBytes: Uint8Array; 
  filename: string;
}> {
  if (files.length === 0) {
    throw new Error('No files provided');
  }
  
  onProgress?.(0, files.length, 'Starting processing...');
  
  // Process all files in parallel for better performance
  const processPromises = files.map((file, index) => 
    processSingleFile(file, (status) => {
      onProgress?.(index + 1, files.length, status);
    })
  );
  
  // Wait for all files to be processed
  const pdfBytesArray = await Promise.all(processPromises);
  
  onProgress?.(files.length, files.length, 'Merging PDFs...');
  
  // Merge all PDFs
  const mergedPdfBytes = await mergePdfs(pdfBytesArray);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${stage}_${timestamp}.pdf`;
  
  onProgress?.(files.length, files.length, 'Complete!');
  
  return {
    pdfBytes: mergedPdfBytes,
    filename,
  };
}

/**
 * Optimized batch processing for multiple sections
 * Processes sections sequentially but files within each section in parallel
 */
export async function processSectionsBatch(
  sections: Array<{ stage:string; files: File[] }>,
  onSectionProgress?: (
    stage: string,
    current: number,
    total: number,
    status: string
  ) => void
): Promise<Array<{ stage: string; pdfBytes: Uint8Array; filename: string }>> {
  const results = [];
  
  for (const section of sections) {
    if (section.files.length > 0) {
      const result = await processFilesToPdf(
        section.files,
        section.stage,
        (current, total, status) => {
          onSectionProgress?.(section.stage, current, total, status);
        }
      );
      results.push({ stage: section.stage, ...result });
    }
  }
  
  return results;
}

/**
 * Convert PDF bytes to File object

export function pdfBytesToFile(pdfBytes: Uint8Array, filename: string): File {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
} */
/**
 * Convert raw PDF bytes to upload-ready structure
 * required by API: { filename, mimeType, fileBase64 }
 */
export async function pdfBytesToFile(
  pdfBytes: Uint8Array,
  filename: string
): Promise<{ filename: string; mimeType: string; fileBase64: string }> {

  // Create Blob
  // 💡 ROBUST SOLUTION: Use 'as any' to completely bypass the SharedArrayBuffer conflict.
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });

  // Convert Blob → Base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // remove "data:application/pdf;base64,"
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Return in correct API format
  return {
    filename,
    mimeType: "application/pdf",
    fileBase64: base64
  };
}
/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Utility to yield control back to browser (prevents UI freezing)
 */
export function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

export const convertFileToBase64Format = (file: File): Promise<{
  filename: string;
  mimeType: string;
  fileBase64: string;
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Strip "data:audio/webm;base64," prefix
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        filename: file.name,
        mimeType: file.type,
        fileBase64: base64String
      });
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
};