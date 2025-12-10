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
    name: 'General handyman (hourly)',
    duration: 'Per hour',
    price: 'From $120/hr',
    description: 'Hire us hourly for mixed small jobs; materials billed as needed.',
  },
];

export type ServiceCatalogItem = {
  id: string;
  name: string;
  baseMinutes: number;
  priceCents: number;
  category: string;
  description?: string;
};

export const serviceCatalog: ServiceCatalogItem[] = [
  // Assembly
  { id: 'assembly_bed', name: 'Assembly: Bed', baseMinutes: 80, priceCents: 15000, category: 'Assembly' },
  { id: 'assembly_table', name: 'Assembly: Table/Desk', baseMinutes: 60, priceCents: 12000, category: 'Assembly' },
  { id: 'assembly_chair', name: 'Assembly: Chair/Lamp', baseMinutes: 30, priceCents: 6000, category: 'Assembly' },
  { id: 'assembly_sofa', name: 'Assembly: Sofa/Sectional', baseMinutes: 90, priceCents: 18000, category: 'Assembly' },
  { id: 'assembly_dresser', name: 'Assembly: Dresser', baseMinutes: 70, priceCents: 14000, category: 'Assembly' },
  { id: 'assembly_patio', name: 'Assembly: Patio Set', baseMinutes: 90, priceCents: 16000, category: 'Assembly' },
  { id: 'assembly_other', name: 'Assembly: Other furniture', baseMinutes: 60, priceCents: 12000, category: 'Assembly' },
  { id: 'grill_assemble', name: 'Grill assembly', baseMinutes: 75, priceCents: 14000, category: 'Assembly' },
  { id: 'bike_assemble', name: 'Bike assembly', baseMinutes: 45, priceCents: 8000, category: 'Assembly' },

  // TV / media / low voltage
  { id: 'tv_mount_basic', name: 'TV mount install (drywall, up to 65")', baseMinutes: 60, priceCents: 18000, category: 'TV & Media' },
  { id: 'tv_mount_premium', name: 'TV mount + wire concealment / fireplace', baseMinutes: 90, priceCents: 25000, category: 'TV & Media' },
  { id: 'cable_hide', name: 'Cable concealing (per TV)', baseMinutes: 20, priceCents: 4000, category: 'TV & Media' },
  { id: 'mount_sensors', name: 'Mount sensors/cameras (per device)', baseMinutes: 30, priceCents: 6000, category: 'TV & Media' },

  // Electrical & lighting
  { id: 'electrical', name: 'Light/Fan swap (simple)', baseMinutes: 60, priceCents: 8000, category: 'Electrical & Lighting' },
  { id: 'fan_install', name: 'Ceiling fan install', baseMinutes: 75, priceCents: 15000, category: 'Electrical & Lighting' },
  { id: 'light_swap', name: 'Light fixture swap', baseMinutes: 60, priceCents: 12000, category: 'Electrical & Lighting' },
  { id: 'dimmer_install', name: 'Dimmer/switch install', baseMinutes: 30, priceCents: 5000, category: 'Electrical & Lighting' },
  { id: 'outlet_replace', name: 'Outlet replace', baseMinutes: 30, priceCents: 6000, category: 'Electrical & Lighting' },
  { id: 'doorbell_chime_install', name: 'Doorbell/chime install or replace', baseMinutes: 45, priceCents: 9000, category: 'Electrical & Lighting' },

  // Smart home & security
  { id: 'video_doorbell_install', name: 'Video doorbell install + app setup', baseMinutes: 45, priceCents: 12000, category: 'Smart Home & Security' },
  { id: 'smart_lock_install', name: 'Smart lock install + programming', baseMinutes: 45, priceCents: 12000, category: 'Smart Home & Security' },
  { id: 'door_lock', name: 'Door lock/smart lock install', baseMinutes: 45, priceCents: 9000, category: 'Smart Home & Security' },
  { id: 'smart_thermostat_install', name: 'Smart thermostat install + setup', baseMinutes: 60, priceCents: 15000, category: 'Smart Home & Security' },
  { id: 'camera_install_single', name: 'Security camera install (single device)', baseMinutes: 45, priceCents: 15000, category: 'Smart Home & Security' },
  { id: 'camera_install_multi', name: 'Security camera kit install (3–4 devices)', baseMinutes: 120, priceCents: 35000, category: 'Smart Home & Security' },
  { id: 'smart_hub_setup', name: 'Smart home hub/voice assistant setup', baseMinutes: 45, priceCents: 10000, category: 'Smart Home & Security' },
  { id: 'smoke_co_detector_replace', name: 'Smoke/CO detector install or replace (per unit)', baseMinutes: 45, priceCents: 8000, category: 'Smart Home & Security' },

  // Doors, hardware, and storage
  { id: 'door_adjust', name: 'Door adjust/hinge/strike plate', baseMinutes: 30, priceCents: 6000, category: 'Doors & Hardware' },
  { id: 'grab_bar_install', name: 'Grab bar install (per bar)', baseMinutes: 45, priceCents: 9000, category: 'Doors & Hardware' },
  { id: 'curtains_blinds', name: 'Curtain/blinds install (per window)', baseMinutes: 30, priceCents: 4000, category: 'Doors & Hardware' },
  { id: 'closet_rod_shelf_install', name: 'Closet rod/shelf install (per section)', baseMinutes: 60, priceCents: 14000, category: 'Doors & Hardware' },
  { id: 'closet_system', name: 'Closet system install (small)', baseMinutes: 120, priceCents: 25000, category: 'Doors & Hardware' },
  { id: 'garage_storage', name: 'Ceiling/garage storage rack install', baseMinutes: 90, priceCents: 18000, category: 'Doors & Hardware' },
  { id: 'attic_ladder_replace', name: 'Attic ladder replacement', baseMinutes: 180, priceCents: 45000, category: 'Doors & Hardware' },

  // Plumbing & fixtures
  { id: 'appliance_hookup', name: 'Washer/dryer hookup (no vent install)', baseMinutes: 60, priceCents: 12000, category: 'Plumbing & Fixtures' },
  { id: 'disposal_replace', name: 'Garbage disposal replace', baseMinutes: 60, priceCents: 13000, category: 'Plumbing & Fixtures' },
  { id: 'babyproof', name: 'Babyproofing hardware install', baseMinutes: 60, priceCents: 10000, category: 'Plumbing & Fixtures' },
  { id: 'laundry_shelves', name: 'Laundry shelves/rod install', baseMinutes: 45, priceCents: 8000, category: 'Plumbing & Fixtures' },
  { id: 'caulk_replace', name: 'Caulk/tile/sink re-seal', baseMinutes: 45, priceCents: 8000, category: 'Plumbing & Fixtures' },
  { id: 'caulk_bathroom_full', name: 'Full bathroom re-caulk (tub/shower/sink)', baseMinutes: 90, priceCents: 16000, category: 'Plumbing & Fixtures' },

  // Repairs & patching
  { id: 'drywall_patch_small', name: 'Drywall patch (small)', baseMinutes: 60, priceCents: 9000, category: 'Repairs & Patching' },
  { id: 'furniture_repair', name: 'Furniture touch-up/repair (minor)', baseMinutes: 60, priceCents: 10000, category: 'Repairs & Patching' },
  { id: 'paint_touchup_wall', name: 'Paint touchup (small areas)', baseMinutes: 60, priceCents: 9000, category: 'Repairs & Patching' },
  { id: 'tile_repair_small', name: 'Tile repair (small area)', baseMinutes: 90, priceCents: 20000, category: 'Repairs & Patching' },

  // Exterior & painting
  { id: 'room_paint_standard', name: 'Room painting (walls only, up to 12x12)', baseMinutes: 240, priceCents: 60000, category: 'Exterior & Painting' },
  { id: 'fence_repair_small', name: 'Fence repair (up to 8 linear ft)', baseMinutes: 90, priceCents: 18000, category: 'Exterior & Painting' },
  { id: 'deck_board_replace', name: 'Deck board replacement (small section)', baseMinutes: 90, priceCents: 20000, category: 'Exterior & Painting' },
  { id: 'gutter_clean_single', name: 'Gutter cleaning (single-story home)', baseMinutes: 60, priceCents: 12000, category: 'Exterior & Painting' },
  { id: 'gutter_clean_double', name: 'Gutter cleaning (two-story home)', baseMinutes: 90, priceCents: 18000, category: 'Exterior & Painting' },
  { id: 'pressure_wash_driveway', name: 'Pressure wash: driveway/walkway', baseMinutes: 90, priceCents: 20000, category: 'Exterior & Painting' },
  { id: 'pressure_wash_house', name: 'Pressure wash: small house exterior', baseMinutes: 180, priceCents: 45000, category: 'Exterior & Painting' },

  // Tech & networking
  { id: 'wifi_router_setup', name: 'Wi-Fi router setup + optimization', baseMinutes: 45, priceCents: 9000, category: 'Tech & Networking' },
  { id: 'wifi_mesh_setup', name: 'Mesh Wi-Fi system install (2–3 nodes)', baseMinutes: 90, priceCents: 20000, category: 'Tech & Networking' },
  { id: 'network_cable_run_simple', name: 'Ethernet run (single, simple route)', baseMinutes: 90, priceCents: 22000, category: 'Tech & Networking' },
  { id: 'pc_cleanup', name: 'Computer cleanup/tune-up (software)', baseMinutes: 60, priceCents: 12000, category: 'Tech & Networking' },
  { id: 'pc_setup_new', name: 'New computer setup + data migration (basic)', baseMinutes: 60, priceCents: 12000, category: 'Tech & Networking' },
  { id: 'tv_streaming_setup', name: 'TV/streaming devices setup (apps/logins)', baseMinutes: 45, priceCents: 9000, category: 'Tech & Networking' },
];
