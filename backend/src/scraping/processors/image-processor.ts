import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ScrapedImage } from '../../types';

export class ImageProcessor {
  private ocrWorker: any = null;

  constructor() {
    this.initializeOCR();
  }

  private async initializeOCR(): Promise<void> {
    try {
      this.ocrWorker = await createWorker(config.ocr.language);
      await this.ocrWorker.setParameters({
        tessedit_pageseg_mode: config.ocr.psm,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-+()[]{}:;/\\|=<>?@#$%^&*_~`',
      });
      logger.info('Image OCR worker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize image OCR worker:', error);
    }
  }

  async performOCR(imageUrl: string): Promise<string> {
    try {
      if (!this.ocrWorker) {
        logger.warn('OCR worker not available, skipping OCR');
        return '';
      }

      // Download and preprocess image
      const processedBuffer = await this.preprocessImage(imageUrl);

      // Perform OCR
      const { data: { text } } = await this.ocrWorker.recognize(processedBuffer);

      logger.debug(`OCR completed for ${imageUrl}`, {
        textLength: text.length,
        preview: text.substring(0, 100)
      });

      return text.trim();

    } catch (error) {
      logger.warn(`OCR failed for ${imageUrl}:`, error);
      return '';
    }
  }

  async preprocessImage(imageUrl: string): Promise<Buffer> {
    try {
      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'ProtoBuddy/1.0 (Component Analysis Bot)',
        },
      });

      const inputBuffer = Buffer.from(response.data);

      // Preprocess image for better OCR
      const processedBuffer = await sharp(inputBuffer)
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1, flat: 1, jagged: 2 })
        .threshold(128)
        .png()
        .toBuffer();

      return processedBuffer;

    } catch (error) {
      logger.warn(`Image preprocessing failed for ${imageUrl}:`, error);
      throw error;
    }
  }

  async analyzeSchematic(imageUrl: string): Promise<{
    components: string[];
    connections: string[];
    labels: string[];
    ocrText: string;
  }> {
    try {
      const ocrText = await this.performOCR(imageUrl);

      // Extract component information from OCR text
      const components = this.extractComponents(ocrText);
      const connections = this.extractConnections(ocrText);
      const labels = this.extractLabels(ocrText);

      logger.debug(`Schematic analysis completed for ${imageUrl}`, {
        componentsFound: components.length,
        connectionsFound: connections.length,
        labelsFound: labels.length,
      });

      return {
        components,
        connections,
        labels,
        ocrText,
      };

    } catch (error) {
      logger.warn(`Schematic analysis failed for ${imageUrl}:`, error);
      return {
        components: [],
        connections: [],
        labels: [],
        ocrText: '',
      };
    }
  }

  async analyzePinout(imageUrl: string): Promise<{
    pins: Array<{ number: number; name: string; function: string; }>;
    package: string;
    ocrText: string;
  }> {
    try {
      const ocrText = await this.performOCR(imageUrl);

      // Extract pin information
      const pins = this.extractPinInformation(ocrText);
      const packageType = this.extractPackageType(ocrText);

      logger.debug(`Pinout analysis completed for ${imageUrl}`, {
        pinsFound: pins.length,
        package: packageType,
      });

      return {
        pins,
        package: packageType,
        ocrText,
      };

    } catch (error) {
      logger.warn(`Pinout analysis failed for ${imageUrl}:`, error);
      return {
        pins: [],
        package: 'unknown',
        ocrText: '',
      };
    }
  }

  async classifyImage(imageUrl: string): Promise<{
    type: 'schematic' | 'pinout' | 'photo' | 'diagram' | 'chart' | 'wiring';
    confidence: number;
    features: string[];
  }> {
    try {
      // First, try to classify based on URL/filename
      const urlClassification = this.classifyByUrl(imageUrl);
      if (urlClassification.confidence > 0.8) {
        return urlClassification;
      }

      // Perform OCR and analyze content
      const ocrText = await this.performOCR(imageUrl);
      const contentClassification = this.classifyByContent(ocrText);

      // Combine URL and content classification
      const combinedType = contentClassification.confidence > urlClassification.confidence
        ? contentClassification.type
        : urlClassification.type;

      const combinedConfidence = Math.max(urlClassification.confidence, contentClassification.confidence);

      return {
        type: combinedType,
        confidence: combinedConfidence,
        features: [
          ...urlClassification.features,
          ...contentClassification.features,
        ],
      };

    } catch (error) {
      logger.warn(`Image classification failed for ${imageUrl}:`, error);
      return {
        type: 'photo',
        confidence: 0.1,
        features: [],
      };
    }
  }

  private classifyByUrl(url: string): {
    type: 'schematic' | 'pinout' | 'photo' | 'diagram' | 'chart' | 'wiring';
    confidence: number;
    features: string[];
  } {
    const urlLower = url.toLowerCase();
    const features: string[] = [];

    if (urlLower.includes('schematic') || urlLower.includes('circuit')) {
      features.push('url-schematic');
      return { type: 'schematic', confidence: 0.9, features };
    }

    if (urlLower.includes('pinout') || urlLower.includes('pin-out') || urlLower.includes('pins')) {
      features.push('url-pinout');
      return { type: 'pinout', confidence: 0.9, features };
    }

    if (urlLower.includes('wiring') || urlLower.includes('connection')) {
      features.push('url-wiring');
      return { type: 'wiring', confidence: 0.8, features };
    }

    if (urlLower.includes('diagram') || urlLower.includes('block')) {
      features.push('url-diagram');
      return { type: 'diagram', confidence: 0.7, features };
    }

    if (urlLower.includes('chart') || urlLower.includes('graph')) {
      features.push('url-chart');
      return { type: 'chart', confidence: 0.7, features };
    }

    return { type: 'photo', confidence: 0.2, features };
  }

  private classifyByContent(text: string): {
    type: 'schematic' | 'pinout' | 'photo' | 'diagram' | 'chart' | 'wiring';
    confidence: number;
    features: string[];
  } {
    const textLower = text.toLowerCase();
    const features: string[] = [];
    let score = { schematic: 0, pinout: 0, photo: 0, diagram: 0, chart: 0, wiring: 0 };

    // Schematic indicators
    if (textLower.includes('vcc') || textLower.includes('gnd') || textLower.includes('ground')) {
      score.schematic += 2;
      features.push('power-labels');
    }
    if (textLower.includes('resistor') || textLower.includes('capacitor') || textLower.includes('led')) {
      score.schematic += 2;
      features.push('component-names');
    }
    if (/r\d+|c\d+|u\d+|q\d+/i.test(text)) {
      score.schematic += 2;
      features.push('component-references');
    }

    // Pinout indicators
    if (/pin\s*\d+/i.test(text) || /p\d+/i.test(text)) {
      score.pinout += 2;
      features.push('pin-numbers');
    }
    if (textLower.includes('dip') || textLower.includes('qfp') || textLower.includes('bga')) {
      score.pinout += 2;
      features.push('package-type');
    }
    if (textLower.includes('sda') || textLower.includes('scl') || textLower.includes('rx') || textLower.includes('tx')) {
      score.pinout += 1;
      features.push('signal-names');
    }

    // Wiring indicators
    if (textLower.includes('wire') || textLower.includes('connect') || textLower.includes('jumper')) {
      score.wiring += 1;
      features.push('connection-terms');
    }

    // Diagram indicators
    if (textLower.includes('block') || textLower.includes('flow')) {
      score.diagram += 1;
      features.push('block-diagram');
    }

    // Chart indicators
    if (textLower.includes('frequency') || textLower.includes('response') || textLower.includes('characteristic')) {
      score.chart += 1;
      features.push('chart-terms');
    }

    // Find highest score
    const maxScore = Math.max(...Object.values(score));
    const type = Object.keys(score).find(key => score[key as keyof typeof score] === maxScore) as any;

    const confidence = maxScore > 0 ? Math.min(maxScore * 0.3, 1.0) : 0.1;

    return {
      type: type || 'photo',
      confidence,
      features,
    };
  }

  private extractComponents(text: string): string[] {
    const components: string[] = [];

    // Component reference patterns
    const refPatterns = [
      /[RCL]\d+/gi, // R1, C2, L3
      /U\d+/gi, // U1, U2
      /Q\d+/gi, // Q1, Q2
      /D\d+/gi, // D1, D2
      /IC\d+/gi, // IC1, IC2
    ];

    for (const pattern of refPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        components.push(...matches);
      }
    }

    // Component names
    const componentNames = [
      'arduino', 'raspberry pi', 'esp32', 'esp8266',
      'resistor', 'capacitor', 'inductor', 'led', 'diode',
      'transistor', 'sensor', 'motor', 'servo', 'relay',
    ];

    for (const name of componentNames) {
      if (text.toLowerCase().includes(name)) {
        components.push(name);
      }
    }

    return [...new Set(components)];
  }

  private extractConnections(text: string): string[] {
    const connections: string[] = [];

    // Connection patterns
    const connectionPatterns = [
      /\w+\s*-\s*\w+/gi, // PIN1 - PIN2
      /\w+\s*to\s*\w+/gi, // VCC to PIN1
      /connect\s*\w+\s*to\s*\w+/gi, // connect VCC to PIN1
    ];

    for (const pattern of connectionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        connections.push(...matches);
      }
    }

    return [...new Set(connections)];
  }

  private extractLabels(text: string): string[] {
    const labels: string[] = [];

    // Common labels
    const labelPatterns = [
      /VCC|VDD|3V3|5V|12V/gi,
      /GND|GROUND/gi,
      /SDA|SCL|MOSI|MISO|SCK|CS/gi,
      /RX|TX|UART|I2C|SPI/gi,
      /ADC|PWM|GPIO|DIGITAL|ANALOG/gi,
    ];

    for (const pattern of labelPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        labels.push(...matches);
      }
    }

    return [...new Set(labels)];
  }

  private extractPinInformation(text: string): Array<{ number: number; name: string; function: string; }> {
    const pins: Array<{ number: number; name: string; function: string; }> = [];

    // Pin patterns
    const pinPatterns = [
      /pin\s*(\d+)[:\s]*([A-Z0-9_/]+)?\s*([A-Za-z0-9\s,/()]+)?/gi,
      /(\d+)\s*[:\-]\s*([A-Z0-9_/]+)\s*[:\-]?\s*([A-Za-z0-9\s,/()]+)?/gi,
    ];

    for (const pattern of pinPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const pinNumber = parseInt(match[1], 10);
        const pinName = match[2] || `PIN${pinNumber}`;
        const pinFunction = match[3] || 'Unknown';

        if (pinNumber && pinNumber <= 100) { // Reasonable pin count limit
          pins.push({
            number: pinNumber,
            name: pinName.trim(),
            function: pinFunction.trim(),
          });
        }
      }
    }

    return pins.slice(0, 100); // Limit to 100 pins
  }

  private extractPackageType(text: string): string {
    const packageTypes = [
      'DIP', 'PDIP', 'SOIC', 'SSOP', 'TSSOP', 'QFP', 'LQFP', 'TQFP',
      'BGA', 'PBGA', 'CBGA', 'QFN', 'DFN', 'LGA', 'PGA',
      'TO-92', 'TO-220', 'TO-263', 'SOT-23', 'SOT-89',
    ];

    const textUpper = text.toUpperCase();

    for (const packageType of packageTypes) {
      if (textUpper.includes(packageType)) {
        return packageType;
      }
    }

    return 'Unknown';
  }

  async cleanup(): Promise<void> {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
      }
    } catch (error) {
      logger.warn('Error cleaning up image processor:', error);
    }
  }
}