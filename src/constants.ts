import { Category, Vendor } from './types';

export const INITIAL_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Restaurant', defaultPrice: 60000, color: 'orange', maxHelpers: 5 },
  { name: 'Photocopy', defaultPrice: 60000, color: 'yellow', maxHelpers: 3 },
  { name: 'POS', defaultPrice: 120000, color: 'green', maxHelpers: 3 },
  { name: 'Fast Food', defaultPrice: 25000, color: 'blue', maxHelpers: 4 },
  { name: 'Provision', defaultPrice: 40000, color: 'purple', maxHelpers: 4 },
  { name: 'Charging Spot', defaultPrice: 25000, color: 'amber', maxHelpers: 2 },
  { name: 'Drinks', defaultPrice: 0, color: 'sky', maxHelpers: 3 },
  { name: 'Clothing', defaultPrice: 15000, color: 'indigo', maxHelpers: 1 },
  { name: 'Saloon', defaultPrice: 15000, color: 'rose', maxHelpers: 2 },
  { name: 'Barbing', defaultPrice: 15000, color: 'red', maxHelpers: 2 },
  { name: 'Laundry (Male)', defaultPrice: 25000, color: 'emerald', maxHelpers: 2 },
  { name: 'Laundry (Female)', defaultPrice: 10000, color: 'pink', maxHelpers: 2 },
  { name: 'Kosai', defaultPrice: 10000, color: 'orange', maxHelpers: 1 },
  { name: 'Awara', defaultPrice: 10000, color: 'yellow', maxHelpers: 1 },
  { name: 'Kunu', defaultPrice: 5000, color: 'lime', maxHelpers: 1 },
  { name: 'Fan Milk', defaultPrice: 5000, color: 'cyan', maxHelpers: 1 },
  { name: 'Shoe Maker', defaultPrice: 5000, color: 'stone', maxHelpers: 1 },
  { name: 'Meat Pie (Earpie)', defaultPrice: 5000, color: 'orange', maxHelpers: 1 },
  { name: 'Photographers', defaultPrice: 20000, color: 'violet', maxHelpers: 1 },
  { name: 'Tailors', defaultPrice: 25000, color: 'fuchsia', maxHelpers: 1 },
  { name: 'Fruit Seller', defaultPrice: 10000, color: 'green', maxHelpers: 1 }
];

export const VENDOR_MAP: Record<string, string[]> = {
  'Restaurant': ['Mamam Martha', 'Mamam Fauza', 'Mamam Abdul', 'Jspot'],
  'Photocopy': ['Peter', 'Mamam Yusuf', 'Zakka'],
  'POS': ['CBN'],
  'Fast Food': ['Mamam Yusuf', 'Baga', 'Uzairu', 'Abokin Karaye'],
  'Provision': ['Mamam Junior', 'Mamam Ana', 'Mamam Farida', 'Photographer', 'Doctor', 'Dan Kwai'],
  'Charging Spot': ['CBN', 'Barnabas', 'Kano', 'Tman'],
  'Drinks': ['Mamam Aisha', 'Mamam Yusuf', 'Na Gidan Shehi', 'Adamawa'],
  'Clothing': ['Uzairu'],
  'Saloon': ['Martha', 'Madam Union Bank', 'Madam C/O Mamam Abdul'],
  'Barbing': ['Barnabas', 'Saed Guy'],
  'Laundry (Male)': ['Tzee', 'Secretary', 'Shamsu', 'C/O Saed Guy'],
  'Laundry (Female)': ['Tsayyu', 'Mamam Nakowa', 'Khadija', 'Angelina', 'Madam Hakuri', 'Buzuwa', 'Yar Hajia Mai Ruwa'],
  'Kosai': ['Yan Biyu', 'Mamam Auta', 'Hajia Mai Itace'],
  'Awara': ['Mai Wanki Sister', 'Auta', 'Yar Gidan Yan Biyu'],
  'Kunu': ['Hajia Mai Kunu', 'Yan Niger', 'Yan Niger Sis', 'Hajia Mai Ruwa'],
  'Fan Milk': ['Vendor 1', 'Vendor 2', 'Vendor 3', 'Vendor 4', 'Vendor 5'],
  'Shoe Maker': ['Tsiga', 'Umar Batsari'],
  'Meat Pie (Earpie)': ['Pie'],
  'Photographers': ['Photographer 1', 'Photographer 2', 'Photographer 3', 'Photographer 4', 'Photographer 5'],
  'Tailors': Array.from({ length: 15 }, (_, i) => `Tailor ${i + 1}`),
  'Fruit Seller': ['Shakaf']
};
