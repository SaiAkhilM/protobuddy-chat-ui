import pdfParse from 'pdf-parse';
import axios from 'axios';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ScrapedPDF, ScrapedImage } from '../../types';

export class PDFProcessor {
  private ocrWorker: any = null;

  constructor() {
    this.initializeOCR();
  }

  private async initializeOCR(): Promise<void> {
    try {
      this.ocrWorker = await createWorker(config.ocr.language);
      await this.ocrWorker.setParameters({
        tessedit_pageseg_mode: config.ocr.psm,
      });
      logger.info('OCR worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OCR worker:', error);
    }
  }

  async processPDF(pdfUrl: string): Promise<ScrapedPDF | null> {
    try {
      logger.debug(`Processing PDF: ${pdfUrl}`);

      // Download PDF
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'ProtoBuddy/1.0 (Component Analysis Bot)',
        },
      });

      const buffer = Buffer.from(response.data);

      // Parse PDF
      const data = await pdfParse(buffer, {
        max: 50, // Limit to first 50 pages
        version: 'v2.0.550', // Use specific version for consistency
      });

      // Extract metadata
      const metadata = {
        author: data.info?.Author || undefined,
        subject: data.info?.Subject || undefined,
        creator: data.info?.Creator || undefined,
        producer: data.info?.Producer || undefined,
        creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
      };

      // Extract images from PDF if possible
      const images = await this.extractImagesFromPDF(buffer);

      const scrapedPDF: ScrapedPDF = {
        url: pdfUrl,
        title: this.extractTitleFromPDF(data.text),
        pages: data.numpages,
        text: data.text,
        images,
        metadata,
      };

      logger.debug(`PDF processed successfully: ${pdfUrl}`, {
        pages: data.numpages,
        textLength: data.text.length,
        imageCount: images.length,
      });

      return scrapedPDF;

    } catch (error) {
      logger.error(`Failed to process PDF ${pdfUrl}:`, error);
      return null;
    }
  }

  private async extractImagesFromPDF(buffer: Buffer): Promise<ScrapedImage[]> {
    // Note: This is a simplified implementation
    // In production, you might want to use a more sophisticated PDF image extraction library
    try {
      const images: ScrapedImage[] = [];

      // For now, we'll just return an empty array
      // In a full implementation, you would:
      // 1. Use pdf2pic or similar to convert PDF pages to images
      // 2. Use image analysis to detect diagrams/schematics
      // 3. Perform OCR on detected technical diagrams

      return images;

    } catch (error) {
      logger.warn('Failed to extract images from PDF:', error);
      return [];
    }
  }

  private extractTitleFromPDF(text: string): string {
    // Try to extract title from the first few lines of text
    const lines = text.split('\n').slice(0, 10);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 100) {
        // Likely a title
        return trimmed;
      }
    }

    return 'Untitled Document';
  }

  async extractTechnicalData(pdfText: string): Promise<{
    voltage: string[];
    current: string[];
    dimensions: string[];
    protocols: string[];
    specifications: any;
  }> {
    try {
      const voltage = this.extractPattern(pdfText, /(\d+(?:\.\d+)?)\s*(?:V|volt|volts?)/gi);
      const current = this.extractPattern(pdfText, /(\d+(?:\.\d+)?)\s*(?:mA|ma|A|amp|amps?)/gi);
      const dimensions = this.extractPattern(pdfText, /(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches?)(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|in|inch|inches?))?/gi);
      const protocols = this.extractPattern(pdfText, /(I2C|SPI|UART|PWM|GPIO|ADC|OneWire|CAN|RS232|RS485|Ethernet|WiFi|Bluetooth)/gi);

      // Extract more specific technical specifications
      const specifications = await this.extractSpecifications(pdfText);

      return {
        voltage,
        current,
        dimensions,
        protocols,
        specifications,
      };

    } catch (error) {
      logger.warn('Failed to extract technical data from PDF:', error);
      return {
        voltage: [],
        current: [],
        dimensions: [],
        protocols: [],
        specifications: {},
      };
    }
  }

  private extractPattern(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern);
    return matches ? [...new Set(matches)] : [];
  }

  private async extractSpecifications(text: string): Promise<any> {
    const specs: any = {};

    // Operating temperature range
    const tempMatch = text.match(/(?:operating|ambient)?\s*temperature\s*:?\s*(-?\d+(?:\.\d+)?)\s*°?[CF]?\s*(?:to|~|-)\s*(-?\d+(?:\.\d+)?)\s*°?[CF]/gi);
    if (tempMatch) {
      specs.temperature = tempMatch[0];
    }

    // Supply voltage
    const supplyMatch = text.match(/(?:supply|input|power)\s*voltage\s*:?\s*(\d+(?:\.\d+)?)\s*(?:V|volt)/gi);
    if (supplyMatch) {
      specs.supplyVoltage = supplyMatch[0];
    }

    // Frequency/Clock
    const freqMatch = text.match(/(?:frequency|clock)\s*:?\s*(\d+(?:\.\d+)?)\s*(?:Hz|hz|MHz|mhz|GHz|ghz|kHz|khz)/gi);
    if (freqMatch) {
      specs.frequency = freqMatch[0];
    }

    // Package type
    const packageMatch = text.match(/package\s*:?\s*([A-Z0-9-]+(?:\s+[A-Z0-9-]+)?)/gi);
    if (packageMatch) {
      specs.package = packageMatch[0];
    }

    // Pin count
    const pinMatch = text.match(/(\d+)\s*(?:pin|pins|lead|leads)/gi);
    if (pinMatch) {
      specs.pinCount = pinMatch[0];
    }

    return specs;
  }

  async performOCROnPDFImages(pdfBuffer: Buffer): Promise<string[]> {
    try {
      if (!this.ocrWorker) {
        logger.warn('OCR worker not available, skipping PDF OCR');
        return [];
      }

      // This would convert PDF pages to images and perform OCR
      // For now, returning empty array as this requires additional libraries
      // like pdf2pic or pdf-poppler

      const ocrResults: string[] = [];

      // In a full implementation:
      // 1. Convert PDF pages to images using pdf2pic
      // 2. Filter for pages likely containing diagrams/schematics
      // 3. Perform OCR on those pages
      // 4. Return extracted text

      return ocrResults;

    } catch (error) {
      logger.warn('Failed to perform OCR on PDF images:', error);
      return [];
    }
  }

  async classifyPDFContent(text: string): Promise<{
    type: 'datasheet' | 'manual' | 'tutorial' | 'specification' | 'other';
    confidence: number;
    sections: string[];
  }> {
    const textLower = text.toLowerCase();

    // Datasheet indicators
    const datasheetKeywords = ['datasheet', 'specifications', 'electrical characteristics', 'pin configuration', 'absolute maximum ratings'];
    const datasheetScore = datasheetKeywords.filter(keyword => textLower.includes(keyword)).length;

    // Manual indicators
    const manualKeywords = ['manual', 'user guide', 'installation', 'setup', 'configuration'];
    const manualScore = manualKeywords.filter(keyword => textLower.includes(keyword)).length;

    // Tutorial indicators
    const tutorialKeywords = ['tutorial', 'getting started', 'example', 'project', 'how to'];
    const tutorialScore = tutorialKeywords.filter(keyword => textLower.includes(keyword)).length;

    // Specification indicators
    const specKeywords = ['specification', 'requirements', 'standards', 'compliance'];
    const specScore = specKeywords.filter(keyword => textLower.includes(keyword)).length;

    // Determine type and confidence
    const scores = {
      datasheet: datasheetScore,
      manual: manualScore,
      tutorial: tutorialScore,
      specification: specScore,
    };

    const maxScore = Math.max(...Object.values(scores));
    const type = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore) as any;

    const confidence = maxScore > 0 ? Math.min(maxScore * 0.2, 1.0) : 0.1;

    // Extract sections
    const sections = this.extractSections(text);

    return {
      type: type || 'other',
      confidence,
      sections,
    };
  }

  private extractSections(text: string): string[] {
    const sections: string[] = [];

    // Look for common section headers
    const sectionPatterns = [
      /^\s*(\d+\.?\s+[A-Z][A-Za-z\s]{5,50})\s*$/gm,
      /^\s*([A-Z][A-Z\s]{5,50})\s*$/gm,
    ];

    for (const pattern of sectionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        sections.push(...matches.map(match => match.trim()));
      }
    }

    return [...new Set(sections)].slice(0, 20); // Limit and deduplicate
  }

  async cleanup(): Promise<void> {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
      }
    } catch (error) {
      logger.warn('Error cleaning up PDF processor:', error);
    }
  }
}