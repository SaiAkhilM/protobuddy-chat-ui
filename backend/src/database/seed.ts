import { query } from './connection';
import { logger } from '../utils/logger';

const sampleBoards = [
  {
    name: 'Arduino Uno R3',
    manufacturer: 'Arduino',
    type: 'microcontroller',
    specifications: {
      processor: 'ATmega328P',
      clockSpeed: '16 MHz',
      memory: {
        flash: '32KB',
        sram: '2KB',
        eeprom: '1KB'
      },
      voltage: {
        operating: 5,
        io: 5
      },
      current: {
        input: { max: 20, unit: 'mA' },
        output: { perPin: 20, total: 200, unit: 'mA' }
      }
    },
    supportedProtocols: [
      { type: 'I2C', details: { pins: ['A4', 'A5'] } },
      { type: 'SPI', details: { pins: ['10', '11', '12', '13'] } },
      { type: 'UART', details: { pins: ['0', '1'] } },
      { type: 'PWM', details: { pins: ['3', '5', '6', '9', '10', '11'] } }
    ],
    pins: [
      { number: 0, digitalPin: 0, name: 'RX', functions: ['UART', 'digital'], voltage: 5, currentMax: 20 },
      { number: 1, digitalPin: 1, name: 'TX', functions: ['UART', 'digital'], voltage: 5, currentMax: 20 },
      { number: 2, digitalPin: 2, name: 'D2', functions: ['digital', 'interrupt'], voltage: 5, currentMax: 20 },
      { number: 3, digitalPin: 3, name: 'D3', functions: ['digital', 'PWM', 'interrupt'], voltage: 5, currentMax: 20 },
      { number: 4, digitalPin: 4, name: 'D4', functions: ['digital'], voltage: 5, currentMax: 20 },
      { number: 5, digitalPin: 5, name: 'D5', functions: ['digital', 'PWM'], voltage: 5, currentMax: 20 },
      { number: 6, digitalPin: 6, name: 'D6', functions: ['digital', 'PWM'], voltage: 5, currentMax: 20 },
      { number: 7, digitalPin: 7, name: 'D7', functions: ['digital'], voltage: 5, currentMax: 20 },
      { number: 8, digitalPin: 8, name: 'D8', functions: ['digital'], voltage: 5, currentMax: 20 },
      { number: 9, digitalPin: 9, name: 'D9', functions: ['digital', 'PWM'], voltage: 5, currentMax: 20 },
      { number: 10, digitalPin: 10, name: 'D10', functions: ['digital', 'PWM', 'SPI'], voltage: 5, currentMax: 20 },
      { number: 11, digitalPin: 11, name: 'D11', functions: ['digital', 'PWM', 'SPI'], voltage: 5, currentMax: 20 },
      { number: 12, digitalPin: 12, name: 'D12', functions: ['digital', 'SPI'], voltage: 5, currentMax: 20 },
      { number: 13, digitalPin: 13, name: 'D13', functions: ['digital', 'SPI', 'LED'], voltage: 5, currentMax: 20 },
      { number: 14, digitalPin: 14, analogPin: 0, name: 'A0', functions: ['analog', 'digital'], voltage: 5, currentMax: 20 },
      { number: 15, digitalPin: 15, analogPin: 1, name: 'A1', functions: ['analog', 'digital'], voltage: 5, currentMax: 20 },
      { number: 16, digitalPin: 16, analogPin: 2, name: 'A2', functions: ['analog', 'digital'], voltage: 5, currentMax: 20 },
      { number: 17, digitalPin: 17, analogPin: 3, name: 'A3', functions: ['analog', 'digital'], voltage: 5, currentMax: 20 },
      { number: 18, digitalPin: 18, analogPin: 4, name: 'A4', functions: ['analog', 'digital', 'I2C'], voltage: 5, currentMax: 20 },
      { number: 19, digitalPin: 19, analogPin: 5, name: 'A5', functions: ['analog', 'digital', 'I2C'], voltage: 5, currentMax: 20 }
    ]
  },
  {
    name: 'ESP32 DevKit V1',
    manufacturer: 'Espressif',
    type: 'microcontroller',
    specifications: {
      processor: 'ESP32',
      clockSpeed: '240 MHz',
      memory: {
        flash: '4MB',
        sram: '520KB',
        eeprom: 'N/A'
      },
      voltage: {
        operating: 3.3,
        io: 3.3
      },
      current: {
        input: { max: 12, unit: 'mA' },
        output: { perPin: 12, total: 120, unit: 'mA' }
      }
    },
    supportedProtocols: [
      { type: 'I2C', details: { pins: ['21', '22'] } },
      { type: 'SPI', details: { pins: ['5', '18', '19', '23'] } },
      { type: 'UART', details: { pins: ['1', '3'] } },
      { type: 'PWM', details: { pins: ['2', '4', '5', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '23'] } }
    ],
    pins: [
      { number: 1, name: 'EN', functions: ['enable'], voltage: 3.3, currentMax: 12 },
      { number: 2, name: 'VP', functions: ['analog'], voltage: 3.3, currentMax: 12 },
      { number: 3, name: 'VN', functions: ['analog'], voltage: 3.3, currentMax: 12 },
      { number: 4, name: 'D34', functions: ['analog', 'digital'], voltage: 3.3, currentMax: 12 },
      { number: 5, name: 'D35', functions: ['analog', 'digital'], voltage: 3.3, currentMax: 12 }
      // Simplified for brevity - would include all 30 pins in real implementation
    ]
  }
];

const sampleComponents = [
  {
    name: 'DHT22 Temperature Sensor',
    manufacturer: 'Aosong',
    category: 'sensor',
    description: 'Digital temperature and humidity sensor with high accuracy',
    specifications: {
      voltage: {
        operating: { min: 3.3, max: 6.0, unit: 'V' }
      },
      current: {
        operating: { typical: 1.5, max: 2.5, unit: 'mA' }
      },
      communication: [
        { type: 'OneWire', details: { pins: ['data'] } }
      ],
      pins: [
        { number: 1, name: 'VCC', type: 'power', function: 'Power supply', voltage: 5 },
        { number: 2, name: 'DATA', type: 'digital', function: 'Data signal', voltage: 5 },
        { number: 3, name: 'NC', type: 'nc', function: 'Not connected' },
        { number: 4, name: 'GND', type: 'ground', function: 'Ground', voltage: 0 }
      ],
      temperature: {
        operating: { min: -40, max: 80, unit: 'C' }
      }
    },
    compatibility: {
      boards: ['arduino-uno', 'esp32', 'raspberry-pi'],
      voltageCompatible: ['3.3V', '5V'],
      conflictingComponents: [],
      requiredLibraries: ['DHT sensor library'],
      notes: ['Requires 4.7k pull-up resistor on data line']
    },
    price: 3.99,
    availability: 'in-stock',
    tags: ['sensor', 'temperature', 'humidity', 'digital']
  },
  {
    name: 'SG90 Micro Servo',
    manufacturer: 'TowerPro',
    category: 'actuator',
    description: 'Micro servo motor with 180 degree rotation',
    specifications: {
      voltage: {
        operating: { min: 4.8, max: 6.0, unit: 'V' }
      },
      current: {
        operating: { typical: 10, max: 200, unit: 'mA' }
      },
      communication: [
        { type: 'PWM', details: { frequency: '50Hz', pulseWidth: '1-2ms' } }
      ],
      pins: [
        { number: 1, name: 'GND', type: 'ground', function: 'Ground', voltage: 0 },
        { number: 2, name: 'VCC', type: 'power', function: 'Power supply', voltage: 5 },
        { number: 3, name: 'SIGNAL', type: 'digital', function: 'PWM control signal', voltage: 5 }
      ],
      dimensions: {
        length: 22.2, width: 11.8, height: 31, unit: 'mm'
      }
    },
    compatibility: {
      boards: ['arduino-uno', 'esp32'],
      voltageCompatible: ['5V'],
      conflictingComponents: [],
      requiredLibraries: ['Servo'],
      notes: ['High current draw - may need external power supply']
    },
    price: 2.50,
    availability: 'in-stock',
    tags: ['actuator', 'servo', 'motor', 'pwm']
  },
  {
    name: 'HC-SR04 Ultrasonic Sensor',
    manufacturer: 'Various',
    category: 'sensor',
    description: 'Ultrasonic distance sensor with 2-400cm range',
    specifications: {
      voltage: {
        operating: { min: 5.0, max: 5.0, unit: 'V' }
      },
      current: {
        operating: { typical: 15, max: 15, unit: 'mA' }
      },
      communication: [
        { type: 'GPIO', details: { pins: ['trigger', 'echo'] } }
      ],
      pins: [
        { number: 1, name: 'VCC', type: 'power', function: 'Power supply', voltage: 5 },
        { number: 2, name: 'TRIG', type: 'digital', function: 'Trigger pulse input', voltage: 5 },
        { number: 3, name: 'ECHO', type: 'digital', function: 'Echo pulse output', voltage: 5 },
        { number: 4, name: 'GND', type: 'ground', function: 'Ground', voltage: 0 }
      ]
    },
    compatibility: {
      boards: ['arduino-uno'],
      voltageCompatible: ['5V'],
      conflictingComponents: [],
      requiredLibraries: ['NewPing'],
      notes: ['Echo pin outputs 5V - use level shifter for 3.3V boards']
    },
    price: 1.99,
    availability: 'in-stock',
    tags: ['sensor', 'ultrasonic', 'distance', 'gpio']
  },
  {
    name: 'MCP23017 I2C Port Expander',
    manufacturer: 'Microchip',
    category: 'interface',
    description: '16-bit I/O expander with I2C interface',
    specifications: {
      voltage: {
        operating: { min: 1.8, max: 5.5, unit: 'V' }
      },
      current: {
        operating: { typical: 1, max: 1, unit: 'µA' }
      },
      communication: [
        { type: 'I2C', details: { address: '0x20-0x27', speed: '100kHz/400kHz' } }
      ],
      pins: [
        { number: 1, name: 'GPB0', type: 'digital', function: 'GPIO Port B bit 0' },
        { number: 2, name: 'GPB1', type: 'digital', function: 'GPIO Port B bit 1' },
        { number: 9, name: 'VDD', type: 'power', function: 'Power supply' },
        { number: 10, name: 'VSS', type: 'ground', function: 'Ground' },
        { number: 12, name: 'SCL', type: 'communication', function: 'I2C Clock' },
        { number: 13, name: 'SDA', type: 'communication', function: 'I2C Data' }
      ]
    },
    compatibility: {
      boards: ['arduino-uno', 'esp32', 'raspberry-pi'],
      voltageCompatible: ['3.3V', '5V'],
      conflictingComponents: [],
      requiredLibraries: ['Adafruit_MCP23017'],
      notes: ['Up to 8 devices can share the same I2C bus']
    },
    price: 4.95,
    availability: 'in-stock',
    tags: ['interface', 'i2c', 'gpio', 'expander']
  }
];

const sampleProjects = [
  {
    title: 'Weather Station',
    description: 'Build a complete weather monitoring station with temperature, humidity, and data logging',
    difficulty: 'intermediate',
    components: ['DHT22 Temperature Sensor', 'Arduino Uno R3', 'LCD Display'],
    board: 'Arduino Uno R3',
    tags: ['weather', 'sensor', 'logging'],
    tutorialUrl: 'https://example.com/weather-station',
    estimatedTime: '3-4 hours',
    costMin: 25.00,
    costMax: 40.00,
    costCurrency: 'USD'
  },
  {
    title: 'Robotic Servo Control',
    description: 'Control multiple servo motors with Arduino for robotic applications',
    difficulty: 'beginner',
    components: ['SG90 Micro Servo', 'Arduino Uno R3'],
    board: 'Arduino Uno R3',
    tags: ['robotics', 'servo', 'control'],
    tutorialUrl: 'https://example.com/servo-control',
    estimatedTime: '1-2 hours',
    costMin: 15.00,
    costMax: 25.00,
    costCurrency: 'USD'
  },
  {
    title: 'Smart Distance Sensor',
    description: 'Create a smart distance measurement system with alerts',
    difficulty: 'beginner',
    components: ['HC-SR04 Ultrasonic Sensor', 'Arduino Uno R3', 'Buzzer'],
    board: 'Arduino Uno R3',
    tags: ['sensor', 'distance', 'alert'],
    tutorialUrl: 'https://example.com/distance-sensor',
    estimatedTime: '2-3 hours',
    costMin: 10.00,
    costMax: 20.00,
    costCurrency: 'USD'
  }
];

export async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');

    // Clear existing data
    await query('DELETE FROM compatibility_cache');
    await query('DELETE FROM projects');
    await query('DELETE FROM components');
    await query('DELETE FROM boards');

    logger.info('Cleared existing data');

    // Insert boards
    for (const board of sampleBoards) {
      await query(`
        INSERT INTO boards (name, manufacturer, type, specifications, supported_protocols, pins)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        board.name,
        board.manufacturer,
        board.type,
        JSON.stringify(board.specifications),
        JSON.stringify(board.supportedProtocols),
        JSON.stringify(board.pins)
      ]);
    }

    logger.info(`Inserted ${sampleBoards.length} boards`);

    // Insert components
    for (const component of sampleComponents) {
      await query(`
        INSERT INTO components (
          name, manufacturer, category, description,
          specifications, compatibility,
          price, availability, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        component.name,
        component.manufacturer,
        component.category,
        component.description,
        JSON.stringify(component.specifications),
        JSON.stringify(component.compatibility),
        component.price,
        component.availability,
        component.tags
      ]);
    }

    logger.info(`Inserted ${sampleComponents.length} components`);

    // Insert projects
    for (const project of sampleProjects) {
      await query(`
        INSERT INTO projects (
          title, description, difficulty, components, board, tags,
          tutorial_url, estimated_time, cost_min, cost_max, cost_currency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        project.title,
        project.description,
        project.difficulty,
        project.components,
        project.board,
        project.tags,
        project.tutorialUrl,
        project.estimatedTime,
        project.costMin,
        project.costMax,
        project.costCurrency
      ]);
    }

    logger.info(`Inserted ${sampleProjects.length} projects`);

    // Create some compatibility cache entries
    const boardsResult = await query('SELECT id, name FROM boards');
    const componentsResult = await query('SELECT id, name FROM components');

    for (const board of boardsResult.rows) {
      for (const component of componentsResult.rows) {
        // Create realistic compatibility scores
        let compatible = true;
        let score = 85;
        const issues: any[] = [];

        // DHT22 with ESP32 - voltage warning
        if (component.name.includes('DHT22') && board.name.includes('ESP32')) {
          issues.push({
            type: 'voltage',
            severity: 'warning',
            message: 'Consider using 3.3V version or level shifters'
          });
          score = 75;
        }

        // HC-SR04 with ESP32 - voltage issue
        if (component.name.includes('HC-SR04') && board.name.includes('ESP32')) {
          issues.push({
            type: 'voltage',
            severity: 'error',
            message: 'Echo pin outputs 5V, needs level shifter for ESP32'
          });
          compatible = false;
          score = 30;
        }

        await query(`
          INSERT INTO compatibility_cache (
            board_id, component_id, compatible, issues, score
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          board.id,
          component.id,
          compatible,
          JSON.stringify(issues),
          score
        ]);
      }
    }

    logger.info('Created compatibility cache entries');
    logger.info('Database seeding completed successfully');

  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const { initializeConnections, closeConnections } = require('./connection');

  (async () => {
    try {
      await initializeConnections();
      await seedDatabase();
      await closeConnections();
      process.exit(0);
    } catch (error) {
      logger.error('Seeding script failed:', error);
      process.exit(1);
    }
  })();
}