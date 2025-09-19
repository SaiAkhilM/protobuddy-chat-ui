import { query, cache } from '../database/connection';
import { cacheKeys, config } from '../config';
import { logger, logCompatibilityCheck } from '../utils/logger';
import {
  CompatibilityCheck,
  CompatibilityIssue,
  Component,
  Board,
  CommunicationProtocol
} from '../types';

export class CompatibilityService {

  async checkCompatibility(boardId: string, componentId: string): Promise<CompatibilityCheck> {
    try {
      // Check cache first
      const cacheKey = cacheKeys.compatibility(boardId, componentId);
      const cached = await cache.get(cacheKey);

      if (cached) {
        const result = JSON.parse(cached);
        logCompatibilityCheck(boardId, componentId, result.compatible, result.issues.length);
        return result;
      }

      // Get board and component data
      const [board, component] = await Promise.all([
        this.getBoard(boardId),
        this.getComponent(componentId),
      ]);

      if (!board || !component) {
        throw new Error('Board or component not found');
      }

      // Perform compatibility analysis
      const compatibility = await this.analyzeCompatibility(board, component);

      // Cache result
      await cache.set(cacheKey, JSON.stringify(compatibility), config.cache.ttlSeconds);

      logCompatibilityCheck(boardId, componentId, compatibility.compatible, compatibility.issues.length);
      return compatibility;

    } catch (error) {
      logger.error('Compatibility check failed:', error);
      throw error;
    }
  }

  async calculateCompatibilityScore(boardId: string, componentId: string): Promise<number> {
    try {
      const compatibility = await this.checkCompatibility(boardId, componentId);
      return compatibility.score;
    } catch (error) {
      logger.warn('Failed to calculate compatibility score:', error);
      return 0;
    }
  }

  async getBulkCompatibility(boardId: string, componentIds: string[]): Promise<Map<string, CompatibilityCheck>> {
    const results = new Map<string, CompatibilityCheck>();

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < componentIds.length; i += batchSize) {
      const batch = componentIds.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(componentId => this.checkCompatibility(boardId, componentId))
      );

      batch.forEach((componentId, index) => {
        const result = batchResults[index];
        if (result.status === 'fulfilled') {
          results.set(componentId, result.value);
        } else {
          logger.warn(`Compatibility check failed for ${componentId}:`, result.reason);
          results.set(componentId, this.createErrorCompatibility(result.reason));
        }
      });
    }

    return results;
  }

  private async analyzeCompatibility(board: Board, component: Component): Promise<CompatibilityCheck> {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Voltage compatibility check
    const voltageAnalysis = this.checkVoltageCompatibility(board, component);
    if (!voltageAnalysis.compatible) {
      issues.push(...voltageAnalysis.issues);
      suggestions.push(...voltageAnalysis.suggestions);
      score -= voltageAnalysis.penalty;
    }

    // Current requirements check
    const currentAnalysis = this.checkCurrentRequirements(board, component);
    if (!currentAnalysis.compatible) {
      issues.push(...currentAnalysis.issues);
      suggestions.push(...currentAnalysis.suggestions);
      score -= currentAnalysis.penalty;
    }

    // Communication protocol compatibility
    const protocolAnalysis = this.checkProtocolCompatibility(board, component);
    if (!protocolAnalysis.compatible) {
      issues.push(...protocolAnalysis.issues);
      suggestions.push(...protocolAnalysis.suggestions);
      score -= protocolAnalysis.penalty;
    }

    // Pin availability check
    const pinAnalysis = this.checkPinAvailability(board, component);
    if (!pinAnalysis.compatible) {
      issues.push(...pinAnalysis.issues);
      suggestions.push(...pinAnalysis.suggestions);
      score -= pinAnalysis.penalty;
    }

    // Library support check
    const libraryAnalysis = await this.checkLibrarySupport(board, component);
    if (!libraryAnalysis.compatible) {
      issues.push(...libraryAnalysis.issues);
      suggestions.push(...libraryAnalysis.suggestions);
      score -= libraryAnalysis.penalty;
    }

    // Physical constraints check
    const physicalAnalysis = this.checkPhysicalConstraints(board, component);
    if (!physicalAnalysis.compatible) {
      issues.push(...physicalAnalysis.issues);
      suggestions.push(...physicalAnalysis.suggestions);
      score -= physicalAnalysis.penalty;
    }

    // Overall compatibility determination
    const errorCount = issues.filter(issue => issue.severity === 'error').length;
    const compatible = errorCount === 0;

    return {
      compatible,
      issues: issues.sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      suggestions: [...new Set(suggestions)], // Remove duplicates
      score: Math.max(0, Math.min(100, score)), // Ensure score is between 0-100
    };
  }

  private checkVoltageCompatibility(board: Board, component: Component): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    const boardVoltage = board.specifications.voltage.io;
    const compVoltage = component.specifications.voltage.operating;

    // Check if component can operate at board's IO voltage
    if (compVoltage.min > boardVoltage || compVoltage.max < boardVoltage) {
      const isError = Math.abs(boardVoltage - compVoltage.min) > 1.5; // More than 1.5V difference is likely incompatible

      issues.push({
        type: 'voltage',
        severity: isError ? 'error' : 'warning',
        message: `Voltage mismatch: Board operates at ${boardVoltage}V, component requires ${compVoltage.min}-${compVoltage.max}V`,
        solution: boardVoltage > compVoltage.max
          ? 'Consider using a level shifter or voltage divider'
          : 'Component may work but check datasheet for tolerance',
      });

      penalty = isError ? 50 : 20;

      if (boardVoltage === 5 && compVoltage.max <= 3.6) {
        suggestions.push('Use a 3.3V level shifter for safe operation');
      } else if (boardVoltage === 3.3 && compVoltage.min >= 4.5) {
        suggestions.push('This component requires 5V and may not work reliably at 3.3V');
      }
    }

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions,
      penalty,
    };
  }

  private checkCurrentRequirements(board: Board, component: Component): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    const boardMaxCurrent = board.specifications.current.output.perPin;
    const boardTotalCurrent = board.specifications.current.output.total;
    const compCurrent = component.specifications.current.operating.max;

    // Check per-pin current limit
    if (compCurrent > boardMaxCurrent) {
      issues.push({
        type: 'current',
        severity: 'error',
        message: `Current requirement too high: Component needs ${compCurrent}mA, board can supply ${boardMaxCurrent}mA per pin`,
        solution: 'Use an external driver or power supply',
      });
      penalty = 40;
      suggestions.push('Consider using a MOSFET or relay driver for high-current components');
    } else if (compCurrent > boardMaxCurrent * 0.8) {
      issues.push({
        type: 'current',
        severity: 'warning',
        message: `High current usage: Component uses ${compCurrent}mA, close to board limit of ${boardMaxCurrent}mA`,
        solution: 'Monitor temperature and consider external power',
      });
      penalty = 10;
    }

    // Check total current budget (simplified check)
    if (compCurrent > boardTotalCurrent * 0.5) {
      issues.push({
        type: 'current',
        severity: 'warning',
        message: `Component uses significant portion of total current budget (${compCurrent}mA of ${boardTotalCurrent}mA)`,
        solution: 'Consider power management and other connected components',
      });
      penalty += 5;
    }

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions,
      penalty,
    };
  }

  private checkProtocolCompatibility(board: Board, component: Component): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    const componentProtocols = component.specifications.communication;
    const boardProtocols = board.supportedProtocols.map(p => p.type);

    // Check if component needs any communication protocols
    if (componentProtocols.length === 0) {
      // Simple GPIO component, should be compatible
      return { compatible: true, issues, suggestions, penalty };
    }

    // Check each required protocol
    for (const protocol of componentProtocols) {
      if (!boardProtocols.includes(protocol.type)) {
        if (protocol.type === 'GPIO') {
          // Most boards have GPIO
          continue;
        }

        issues.push({
          type: 'protocol',
          severity: 'error',
          message: `Protocol not supported: Component requires ${protocol.type}, board doesn't support it`,
          solution: this.getProtocolSolution(protocol.type),
        });
        penalty += 30;
      } else {
        // Check protocol-specific compatibility
        const protocolCheck = this.checkSpecificProtocol(board, component, protocol);
        issues.push(...protocolCheck.issues);
        suggestions.push(...protocolCheck.suggestions);
        penalty += protocolCheck.penalty;
      }
    }

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions,
      penalty,
    };
  }

  private checkSpecificProtocol(board: Board, component: Component, protocol: CommunicationProtocol): {
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    switch (protocol.type) {
      case 'I2C':
        // Check I2C address conflicts (would need database of other components)
        if (protocol.details.address) {
          suggestions.push(`I2C address: ${protocol.details.address} - ensure no conflicts with other components`);
        }
        break;

      case 'SPI':
        // SPI generally doesn't have address conflicts, but needs CS pin
        suggestions.push('SPI component will need a dedicated CS (Chip Select) pin');
        break;

      case 'UART':
        // Check if board has available UART
        const boardUARTs = board.pins.filter(pin =>
          pin.functions.some(func => func.toLowerCase().includes('uart') || func.toLowerCase().includes('serial'))
        ).length;

        if (boardUARTs === 0) {
          issues.push({
            type: 'protocol',
            severity: 'warning',
            message: 'No dedicated UART pins found - may need to use software serial',
            solution: 'Use SoftwareSerial library for additional UART functionality',
          });
          penalty = 10;
        }
        break;
    }

    return { issues, suggestions, penalty };
  }

  private checkPinAvailability(board: Board, component: Component): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    const requiredPins = component.specifications.pins.length;
    const availablePins = board.pins.filter(pin =>
      pin.functions.includes('GPIO') || pin.functions.includes('digital')
    ).length;

    if (requiredPins > availablePins) {
      issues.push({
        type: 'pins',
        severity: 'error',
        message: `Insufficient pins: Component needs ${requiredPins} pins, board has ${availablePins} available`,
        solution: 'Use a pin expander or choose a board with more pins',
      });
      penalty = 30;
    } else if (requiredPins > availablePins * 0.8) {
      issues.push({
        type: 'pins',
        severity: 'warning',
        message: `High pin usage: Component uses ${requiredPins} of ${availablePins} available pins`,
        solution: 'Consider pin usage for future expansion',
      });
      penalty = 5;
    }

    // Check for specific pin type requirements
    const analogPinsNeeded = component.specifications.pins.filter(pin => pin.type === 'analog').length;
    const analogPinsAvailable = board.pins.filter(pin => pin.analogPin !== undefined).length;

    if (analogPinsNeeded > analogPinsAvailable) {
      issues.push({
        type: 'pins',
        severity: 'error',
        message: `Insufficient analog pins: Need ${analogPinsNeeded}, have ${analogPinsAvailable}`,
        solution: 'Use an external ADC or choose a board with more analog pins',
      });
      penalty += 25;
    }

    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions,
      penalty,
    };
  }

  private async checkLibrarySupport(board: Board, component: Component): Promise<{
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  }> {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    const requiredLibraries = component.compatibility.requiredLibraries;

    // Check if libraries are available (simplified check)
    for (const library of requiredLibraries) {
      // In a real implementation, you'd check against a database of available libraries
      const isAvailable = await this.checkLibraryAvailability(library, board.type);

      if (!isAvailable) {
        issues.push({
          type: 'library',
          severity: 'warning',
          message: `Library may not be available: ${library}`,
          solution: 'Check Arduino Library Manager or install manually',
        });
        penalty += 5;
      }
    }

    return {
      compatible: true, // Library issues are usually not blocking
      issues,
      suggestions,
      penalty,
    };
  }

  private checkPhysicalConstraints(board: Board, component: Component): {
    compatible: boolean;
    issues: CompatibilityIssue[];
    suggestions: string[];
    penalty: number;
  } {
    const issues: CompatibilityIssue[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    // Check component dimensions if available
    if (component.specifications.dimensions) {
      const compSize = component.specifications.dimensions;

      // Basic size warnings (would need board dimensions for proper check)
      if (compSize.length > 50 || compSize.width > 50) { // mm
        issues.push({
          type: 'physical',
          severity: 'info',
          message: `Large component: ${compSize.length}×${compSize.width}mm - ensure adequate space`,
          solution: 'Verify board has sufficient space and consider mounting',
        });
        penalty = 2;
      }
    }

    return {
      compatible: true, // Physical constraints rarely block compatibility
      issues,
      suggestions,
      penalty,
    };
  }

  private async checkLibraryAvailability(library: string, boardType: string): Promise<boolean> {
    // Simplified library check - in reality, you'd have a database of libraries
    const commonLibraries = [
      'Arduino', 'Wire', 'SPI', 'SoftwareSerial', 'Servo',
      'LiquidCrystal', 'DHT', 'OneWire', 'Adafruit_Sensor',
    ];

    return commonLibraries.some(lib =>
      library.toLowerCase().includes(lib.toLowerCase())
    );
  }

  private getProtocolSolution(protocol: string): string {
    const solutions: { [key: string]: string } = {
      'I2C': 'Use software I2C or an I2C-capable board',
      'SPI': 'Use bit-banged SPI or choose a board with SPI support',
      'UART': 'Use SoftwareSerial library or a board with multiple UARTs',
      'OneWire': 'OneWire can be implemented on any digital pin',
      'CAN': 'Use a CAN transceiver shield or CAN-capable board',
    };

    return solutions[protocol] || 'Check if software implementation is available';
  }

  private async getBoard(boardId: string): Promise<Board | null> {
    try {
      const result = await query(
        'SELECT * FROM boards WHERE id = $1 OR name ILIKE $2',
        [boardId, `%${boardId}%`]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get board:', error);
      return null;
    }
  }

  private async getComponent(componentId: string): Promise<Component | null> {
    try {
      const result = await query(
        'SELECT * FROM components WHERE id = $1 OR name ILIKE $2',
        [componentId, `%${componentId}%`]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get component:', error);
      return null;
    }
  }

  private createErrorCompatibility(error: any): CompatibilityCheck {
    return {
      compatible: false,
      issues: [{
        type: 'error' as any,
        severity: 'error',
        message: 'Compatibility check failed',
        solution: 'Please try again or contact support',
      }],
      suggestions: [],
      score: 0,
    };
  }
}