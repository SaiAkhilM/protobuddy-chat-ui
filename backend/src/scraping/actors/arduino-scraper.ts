import { ApifyClient } from 'apify-client';
import { config } from '../../config';
import { logger, logScrapeStart, logScrapeSuccess, logScrapeError } from '../../utils/logger';
import { ScrapedData, ScrapedImage, ScrapedPDF } from '../../types';
import { PDFProcessor } from '../processors/pdf-processor';
import { ImageProcessor } from '../processors/image-processor';

export class ArduinoScraper {
  private client: ApifyClient;
  private pdfProcessor: PDFProcessor;
  private imageProcessor: ImageProcessor;

  constructor() {
    this.client = new ApifyClient({
      token: config.apis.apify.token,
    });
    this.pdfProcessor = new PDFProcessor();
    this.imageProcessor = new ImageProcessor();
  }

  async scrapeArduinoDocumentation(): Promise<ScrapedData[]> {
    const startTime = Date.now();
    logScrapeStart('arduino.cc', 'documentation');

    try {
      // Arduino.cc main sections to scrape
      const urls = [
        'https://docs.arduino.cc/hardware/',
        'https://docs.arduino.cc/software/',
        'https://docs.arduino.cc/tutorials/',
        'https://www.arduino.cc/en/hardware',
        'https://www.arduino.cc/en/Guide',
      ];

      const scrapeResults: ScrapedData[] = [];

      for (const url of urls) {
        try {
          const result = await this.scrapeArduinoPage(url);
          scrapeResults.push(...result);
        } catch (error) {
          logger.error(`Failed to scrape ${url}:`, error);
        }
      }

      logScrapeSuccess('arduino.cc', 'documentation', Date.now() - startTime, scrapeResults.length);
      return scrapeResults;

    } catch (error) {
      logScrapeError('arduino.cc', 'documentation', error as Error);
      throw error;
    }
  }

  async scrapeArduinoHardware(): Promise<ScrapedData[]> {
    const startTime = Date.now();
    logScrapeStart('arduino.cc', 'hardware');

    try {
      // Use Apify's Web Scraper actor
      const input = {
        startUrls: [
          { url: 'https://docs.arduino.cc/hardware/' },
          { url: 'https://www.arduino.cc/en/hardware' },
        ],
        linkSelector: 'a[href*="/hardware/"], a[href*="/docs/"]',
        pageFunction: this.getArduinoPageFunction(),
        proxyConfiguration: { useApifyProxy: true },
        maxRequestsPerCrawl: 200,
        maxConcurrency: 3,
        requestTimeoutSecs: 30,
      };

      const run = await this.client.actor('apify/web-scraper').call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      const processedResults: ScrapedData[] = [];

      for (const item of items) {
        try {
          const processed = await this.processArduinoItem(item);
          if (processed) {
            processedResults.push(processed);
          }
        } catch (error) {
          logger.warn('Failed to process scraped item:', error);
        }
      }

      logScrapeSuccess('arduino.cc', 'hardware', Date.now() - startTime, processedResults.length);
      return processedResults;

    } catch (error) {
      logScrapeError('arduino.cc', 'hardware', error as Error);
      throw error;
    }
  }

  async scrapeArduinoTutorials(): Promise<ScrapedData[]> {
    const startTime = Date.now();
    logScrapeStart('arduino.cc', 'tutorials');

    try {
      const input = {
        startUrls: [
          { url: 'https://docs.arduino.cc/tutorials/' },
          { url: 'https://create.arduino.cc/projecthub' },
        ],
        linkSelector: 'a[href*="/tutorials/"], a[href*="/project/"]',
        pageFunction: this.getTutorialPageFunction(),
        proxyConfiguration: { useApifyProxy: true },
        maxRequestsPerCrawl: 500,
        maxConcurrency: 5,
        requestTimeoutSecs: 45,
      };

      const run = await this.client.actor('apify/web-scraper').call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      const processedResults: ScrapedData[] = [];

      for (const item of items) {
        try {
          const processed = await this.processTutorialItem(item);
          if (processed) {
            processedResults.push(processed);
          }
        } catch (error) {
          logger.warn('Failed to process tutorial item:', error);
        }
      }

      logScrapeSuccess('arduino.cc', 'tutorials', Date.now() - startTime, processedResults.length);
      return processedResults;

    } catch (error) {
      logScrapeError('arduino.cc', 'tutorials', error as Error);
      throw error;
    }
  }

  async scrapeComponentDatasheets(componentUrls: string[]): Promise<ScrapedData[]> {
    const startTime = Date.now();
    logScrapeStart('component-datasheets', 'datasheets');

    try {
      const results: ScrapedData[] = [];

      for (const url of componentUrls) {
        try {
          const result = await this.scrapeComponentDatasheet(url);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          logger.warn(`Failed to scrape datasheet ${url}:`, error);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, config.scraping.delayMs));
      }

      logScrapeSuccess('component-datasheets', 'datasheets', Date.now() - startTime, results.length);
      return results;

    } catch (error) {
      logScrapeError('component-datasheets', 'datasheets', error as Error);
      throw error;
    }
  }

  private async scrapeArduinoPage(url: string): Promise<ScrapedData[]> {
    const input = {
      startUrls: [{ url }],
      pageFunction: this.getArduinoPageFunction(),
      proxyConfiguration: { useApifyProxy: true },
      maxRequestsPerCrawl: 50,
    };

    const run = await this.client.actor('apify/web-scraper').call(input);
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    const results: ScrapedData[] = [];

    for (const item of items) {
      const processed = await this.processArduinoItem(item);
      if (processed) {
        results.push(processed);
      }
    }

    return results;
  }

  private async scrapeComponentDatasheet(url: string): Promise<ScrapedData | null> {
    try {
      const input = {
        startUrls: [{ url }],
        pageFunction: this.getDatasheetPageFunction(),
        proxyConfiguration: { useApifyProxy: true },
        maxRequestsPerCrawl: 1,
      };

      const run = await this.client.actor('apify/web-scraper').call(input);
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

      if (items.length === 0) return null;

      const item = items[0];
      return await this.processDatasheetItem(item, url);

    } catch (error) {
      logger.warn(`Error scraping datasheet ${url}:`, error);
      return null;
    }
  }

  private async processArduinoItem(item: any): Promise<ScrapedData | null> {
    try {
      const images = await this.processImages(item.images || []);
      const pdfs = await this.processPDFs(item.pdfs || []);

      return {
        id: `arduino-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: item.url,
        title: item.title || '',
        content: item.text || item.content || '',
        images,
        pdfs,
        metadata: {
          scrapedAt: new Date(),
          source: 'arduino.cc',
          type: this.determineContentType(item.url, item.title),
        },
        processed: false,
      };
    } catch (error) {
      logger.warn('Failed to process Arduino item:', error);
      return null;
    }
  }

  private async processTutorialItem(item: any): Promise<ScrapedData | null> {
    try {
      const images = await this.processImages(item.images || []);
      const pdfs = await this.processPDFs(item.pdfs || []);

      return {
        id: `tutorial-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: item.url,
        title: item.title || '',
        content: item.text || item.content || '',
        images,
        pdfs,
        metadata: {
          scrapedAt: new Date(),
          source: 'arduino.cc',
          type: 'tutorial',
        },
        processed: false,
        extractedData: {
          difficulty: this.extractDifficulty(item.text || ''),
          components: this.extractComponents(item.text || ''),
          estimatedTime: this.extractTime(item.text || ''),
        },
      };
    } catch (error) {
      logger.warn('Failed to process tutorial item:', error);
      return null;
    }
  }

  private async processDatasheetItem(item: any, url: string): Promise<ScrapedData | null> {
    try {
      const images = await this.processImages(item.images || []);
      const pdfs = await this.processPDFs(item.pdfs || []);

      return {
        id: `datasheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url,
        title: item.title || '',
        content: item.text || item.content || '',
        images,
        pdfs,
        metadata: {
          scrapedAt: new Date(),
          source: 'component-datasheet',
          type: 'datasheet',
        },
        processed: false,
        extractedData: {
          voltage: this.extractVoltage(item.text || ''),
          current: this.extractCurrent(item.text || ''),
          protocols: this.extractProtocols(item.text || ''),
          pinouts: images.filter(img => img.type === 'pinout'),
        },
      };
    } catch (error) {
      logger.warn('Failed to process datasheet item:', error);
      return null;
    }
  }

  private async processImages(imageUrls: string[]): Promise<ScrapedImage[]> {
    const images: ScrapedImage[] = [];

    for (const url of imageUrls.slice(0, 10)) { // Limit to 10 images per page
      try {
        const type = this.classifyImage(url);
        const image: ScrapedImage = {
          url,
          type,
          analyzed: false,
        };

        if (type === 'schematic' || type === 'pinout') {
          // Perform OCR on technical diagrams
          const ocrText = await this.imageProcessor.performOCR(url);
          image.ocrText = ocrText;
          image.analyzed = true;
        }

        images.push(image);
      } catch (error) {
        logger.warn(`Failed to process image ${url}:`, error);
      }
    }

    return images;
  }

  private async processPDFs(pdfUrls: string[]): Promise<ScrapedPDF[]> {
    const pdfs: ScrapedPDF[] = [];

    for (const url of pdfUrls.slice(0, 5)) { // Limit to 5 PDFs per page
      try {
        const processed = await this.pdfProcessor.processPDF(url);
        if (processed) {
          pdfs.push(processed);
        }
      } catch (error) {
        logger.warn(`Failed to process PDF ${url}:`, error);
      }
    }

    return pdfs;
  }

  private getArduinoPageFunction(): string {
    return `
      async function pageFunction(context) {
        const { page, request } = context;

        const title = await page.evaluate(() => {
          return document.title || document.querySelector('h1')?.textContent || '';
        });

        const text = await page.evaluate(() => {
          // Remove script and style elements
          const scripts = document.querySelectorAll('script, style, nav, footer');
          scripts.forEach(el => el.remove());

          return document.body.innerText || document.body.textContent || '';
        });

        const images = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .map(img => img.src)
            .filter(src => src && (src.includes('.png') || src.includes('.jpg') || src.includes('.svg')))
            .slice(0, 10);
        });

        const pdfs = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
          return links.map(link => link.href).slice(0, 5);
        });

        return {
          url: request.url,
          title,
          text,
          images,
          pdfs,
        };
      }
    `;
  }

  private getTutorialPageFunction(): string {
    return `
      async function pageFunction(context) {
        const { page, request } = context;

        const title = await page.evaluate(() => {
          return document.title || document.querySelector('h1')?.textContent || '';
        });

        const content = await page.evaluate(() => {
          // Look for main content areas
          const contentSelectors = ['.content', '.tutorial-content', '.project-content', 'article', 'main'];

          for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              return element.innerText || element.textContent || '';
            }
          }

          return document.body.innerText || document.body.textContent || '';
        });

        const images = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .map(img => img.src)
            .filter(src => src && (src.includes('.png') || src.includes('.jpg') || src.includes('.svg')))
            .slice(0, 15);
        });

        const difficulty = await page.evaluate(() => {
          const difficultyEl = document.querySelector('[data-difficulty], .difficulty, .level');
          return difficultyEl ? difficultyEl.textContent || '' : '';
        });

        return {
          url: request.url,
          title,
          text: content,
          images,
          difficulty,
        };
      }
    `;
  }

  private getDatasheetPageFunction(): string {
    return `
      async function pageFunction(context) {
        const { page, request } = context;

        const title = await page.evaluate(() => {
          return document.title || document.querySelector('h1')?.textContent || '';
        });

        const text = await page.evaluate(() => {
          return document.body.innerText || document.body.textContent || '';
        });

        const images = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .map(img => img.src)
            .filter(src => src && (src.includes('.png') || src.includes('.jpg') || src.includes('.svg')))
            .slice(0, 20);
        });

        const pdfs = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
          return links.map(link => link.href);
        });

        return {
          url: request.url,
          title,
          text,
          images,
          pdfs,
        };
      }
    `;
  }

  private determineContentType(url: string, title: string): 'datasheet' | 'tutorial' | 'product' | 'documentation' {
    if (url.includes('datasheet') || title.includes('datasheet')) return 'datasheet';
    if (url.includes('tutorial') || title.includes('tutorial')) return 'tutorial';
    if (url.includes('product') || title.includes('product')) return 'product';
    return 'documentation';
  }

  private classifyImage(url: string): 'schematic' | 'pinout' | 'photo' | 'diagram' {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('schematic') || urlLower.includes('circuit')) return 'schematic';
    if (urlLower.includes('pinout') || urlLower.includes('pin')) return 'pinout';
    if (urlLower.includes('diagram') || urlLower.includes('wiring')) return 'diagram';
    return 'photo';
  }

  private extractDifficulty(text: string): string {
    const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
    const textLower = text.toLowerCase();

    for (const difficulty of difficulties) {
      if (textLower.includes(difficulty)) {
        return difficulty;
      }
    }

    return 'unknown';
  }

  private extractComponents(text: string): string[] {
    const componentPatterns = [
      /Arduino\s+\w+/gi,
      /Raspberry\s+Pi\s*\w*/gi,
      /ESP32|ESP8266/gi,
      /sensor\w*/gi,
      /LED\w*/gi,
      /resistor\w*/gi,
      /capacitor\w*/gi,
    ];

    const components: string[] = [];

    for (const pattern of componentPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        components.push(...matches);
      }
    }

    return [...new Set(components)]; // Remove duplicates
  }

  private extractTime(text: string): string {
    const timePattern = /(\d+)\s*(minute|hour|day)s?/gi;
    const match = text.match(timePattern);
    return match ? match[0] : 'unknown';
  }

  private extractVoltage(text: string): string[] {
    const voltagePattern = /(\d+(?:\.\d+)?)\s*V/gi;
    const matches = text.match(voltagePattern);
    return matches ? matches : [];
  }

  private extractCurrent(text: string): string[] {
    const currentPattern = /(\d+(?:\.\d+)?)\s*(mA|A)/gi;
    const matches = text.match(currentPattern);
    return matches ? matches : [];
  }

  private extractProtocols(text: string): string[] {
    const protocolPattern = /(I2C|SPI|UART|PWM|GPIO|ADC|OneWire|CAN)/gi;
    const matches = text.match(protocolPattern);
    return matches ? [...new Set(matches)] : [];
  }
}