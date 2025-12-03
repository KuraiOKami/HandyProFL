export type Service = {
  name: string;
  duration: string;
  price?: string;
  description: string;
};

export const coreServices: Service[] = [
  {
    name: 'Furniture assembly',
    duration: '60-120 min',
    price: 'From $95',
    description: 'Dressers, beds, IKEA sets, patio furniture, and more.',
  },
  {
    name: 'TV mounting',
    duration: '60-90 min',
    price: 'From $145',
    description: 'Stud scan, hidden cabling, secure mount for flat screens.',
  },
  {
    name: 'Ceiling fans & lights',
    duration: '60-120 min',
    price: 'From $125',
    description: 'Swap fixtures, install fans, dimmer switches, smart bulbs.',
  },
  {
    name: 'Home fixes',
    duration: '60-180 min',
    price: 'From $95',
    description: 'Door/lock repair, drywall patches, touch-up paint, caulking.',
  },
  {
    name: 'Outdoor refresh',
    duration: '60-180 min',
    price: 'From $110',
    description: 'Pressure washing patios, driveways, siding, and decks.',
  },
  {
    name: 'Custom punch list',
    duration: 'Varies',
    price: 'Quote',
    description: 'Send your list of small jobs and we will bundle them.',
  },
];
