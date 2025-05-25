export const testData = {
  filaments: {
    pla: {
      brand: 'ESUN',
      material: 'PLA',
      color: 'Red',
      diameter: 1.75,
      costPerGram: 0.025,
    },
    petg: {
      brand: 'Polymaker',
      material: 'PETG',
      color: 'Blue',
      diameter: 1.75,
      costPerGram: 0.030,
    },
    abs: {
      brand: 'Hatchbox',
      material: 'ABS',
      color: 'Black',
      diameter: 1.75,
      costPerGram: 0.028,
    },
    tpu: {
      brand: 'NinjaFlex',
      material: 'TPU',
      color: 'White',
      diameter: 1.75,
      costPerGram: 0.045,
    },
  },
};

export const TEST_FILAMENTS = [
  testData.filaments.pla,
  testData.filaments.petg,
  testData.filaments.abs,
  testData.filaments.tpu,
];

export const TEST_PURCHASES = [
  {
    quantityKg: '1.0',
    pricePerKg: '25.00',
    channel: 'Amazon',
    notes: 'Initial stock',
  },
  {
    quantityKg: '2.5',
    pricePerKg: '23.50',
    channel: 'Direct from manufacturer',
    notes: 'Bulk discount',
  },
];

export const TEST_PRODUCTS = [
  {
    name: 'Phone Case v2',
    printTimeHrs: '2.5',
    filamentUsages: [
      { filamentIndex: 0, gramsUsed: '45.5' }, // Red PLA
    ],
  },
  {
    name: 'Desk Organizer',
    printTimeHrs: '4.0',
    filamentUsages: [
      { filamentIndex: 0, gramsUsed: '120.0' }, // Red PLA
      { filamentIndex: 1, gramsUsed: '80.0' },  // Blue PETG
    ],
  },
];

export const TEST_PRINTERS = [
  {
    name: 'Prusa i3 MK3S+',
    priceEur: '750.00',
    expectedLifeHours: '26280', // 3 years
  },
  {
    name: 'Ender 3 Pro',
    priceEur: '250.00',
    expectedLifeHours: '17520', // 2 years
  },
];

export const TEST_PRINT_JOBS = [
  {
    name: 'Customer Order #001',
    products: [
      { productIndex: 0, quantity: 5 },
    ],
    printers: [
      { printerIndex: 0, quantity: 1, hoursEach: '12.5' },
    ],
    packagingCostEur: '5.00',
  },
  {
    name: 'Batch Production',
    products: [
      { productIndex: 0, quantity: 10 },
      { productIndex: 1, quantity: 5 },
    ],
    printers: [
      { printerIndex: 0, quantity: 1, hoursEach: '20.0' },
      { printerIndex: 1, quantity: 1, hoursEach: '20.0' },
    ],
    packagingCostEur: '15.00',
  },
];

export const TEST_SUBSCRIPTIONS = [
  {
    name: '3D Model Pack - January',
    platform: 'Thangs',
    licenseUri: 'https://thangs.com/license/12345',
    priceEur: '9.99',
  },
  {
    name: 'Premium Designs',
    platform: 'Patreon',
    licenseUri: 'https://patreon.com/creator/12345',
    priceEur: '15.00',
  },
];