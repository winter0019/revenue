import { Category, Vendor } from './types';

export const INITIAL_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Restaurant', defaultPrice: 60000, color: 'orange' },
  { name: 'Photocopy', defaultPrice: 60000, color: 'yellow' },
  { name: 'POS', defaultPrice: 120000, color: 'green' },
  { name: 'Fast Food', defaultPrice: 25000, color: 'blue' },
  { name: 'Provision', defaultPrice: 40000, color: 'purple' },
  { name: 'Charging Spot', defaultPrice: 25000, color: 'amber' },
  { name: 'Drinks', defaultPrice: 0, color: 'sky' },
  { name: 'Clothing', defaultPrice: 15000, color: 'indigo' },
  { name: 'Saloon', defaultPrice: 15000, color: 'rose' },
  { name: 'Barbing', defaultPrice: 15000, color: 'red' },
  { name: 'Laundry (Male)', defaultPrice: 25000, color: 'emerald' },
  { name: 'Laundry (Female)', defaultPrice: 10000, color: 'pink' },
  { name: 'Kosai', defaultPrice: 10000, color: 'orange' },
  { name: 'Awara', defaultPrice: 10000, color: 'yellow' },
  { name: 'Kunu', defaultPrice: 5000, color: 'lime' },
  { name: 'Fan Milk', defaultPrice: 5000, color: 'cyan' },
  { name: 'Shoe Maker', defaultPrice: 5000, color: 'stone' },
  { name: 'Meat Pie (Earpie)', defaultPrice: 5000, color: 'orange' },
  { name: 'Photographers', defaultPrice: 20000, color: 'violet' },
  { name: 'Tailors', defaultPrice: 25000, color: 'fuchsia' },
  { name: 'Fruit Seller', defaultPrice: 10000, color: 'green' }
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
