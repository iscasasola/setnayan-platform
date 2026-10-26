/**
 * icon-map.ts — THE ONLY FILE THAT IMPORTS AN ICON LIBRARY (brand refresh step 3, owner 2026-10-26:
 * "if we choose a different color or icon or font, it will be easy to make the whole app to look
 * differently"). Plan §1c of corpus prototypes/brand_refresh_2026-10-26/before_after.html.
 *
 * ── TWO LAYERS ──────────────────────────────────────────────────────────────
 *   ICONS   semantic ROLE → glyph name   (`guests` → 'book-user', `ai` → 'sparkles').
 *           What a component asks for: `<Icon name="guests" />` (app/_components/icon/icon.tsx).
 *           Where one glyph means two things today (`ai` and `polish` both draw Sparkles), the roles
 *           are already split, so the next set can tell them apart.
 *   GLYPHS  glyph name → component       ('book-user' → lucide's BookUser).
 *           Stored rows (nav registry overrides, the category taxonomy) name a LUCIDE glyph; they reach
 *           this layer through legacy-icon-names.ts.
 *
 * TODAY EVERY GLYPH IS LUCIDE — the same component objects the app imported before — so nothing on
 * screen moves (`lib/icon-map-is-the-one-source.test.ts` proves identity for every stored name).
 * SWITCHING ICON SETS = editing THIS file: point each GLYPHS entry at the new set's component (the
 * plan's Lucide → Carbon table names each one) and change `IconComponent`. Nothing else is touched.
 *
 * Neutral module (no 'use client', no hooks) — server pages and client bars both import it.
 * `scripts/lint-icon-source.mjs` fails any OTHER file that imports `lucide-react` or
 * `@carbon/icons-react` (today's 1,080 importers are a ratcheting baseline, migrated by the area
 * batches, plan steps 5–14). The guest Event Hub (`app/[slug]`) owns its own icons and is not scanned.
 *
 * GENERATED glyph list (from the registry allowlist + the roles below + the /features extras); the
 * prose and the roles are hand-written. Keep GLYPHS sorted by name.
 */
import {
  Accessibility,
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Aperture,
  AppWindow,
  Apple,
  Archive,
  Armchair,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  AtSign,
  Award,
  Baby,
  BadgeCheck,
  BadgePercent,
  Ban,
  Banknote,
  BarChart2,
  BarChart3,
  Bed,
  Bell,
  BellRing,
  Bird,
  Blocks,
  BookOpen,
  BookUser,
  Bookmark,
  Bot,
  Boxes,
  Brain,
  Briefcase,
  BriefcaseBusiness,
  Brush,
  Bug,
  Building,
  Building2,
  Bus,
  Cake,
  CakeSlice,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarHeart,
  CalendarRange,
  CalendarSearch,
  Camera,
  Car,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Church,
  Circle,
  CircleCheck,
  CircleUser,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cloud,
  CloudUpload,
  Coffee,
  Coins,
  Columns2,
  Compass,
  Component,
  Contact,
  Copy,
  Cpu,
  CreditCard,
  Crown,
  Disc3,
  DollarSign,
  DoorOpen,
  Dot,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Factory,
  File,
  FileCheck,
  FileSignature,
  FileText,
  Files,
  Film,
  Filter,
  Fingerprint,
  Flag,
  Flame,
  Flower,
  Flower2,
  Folder,
  FolderOpen,
  Footprints,
  Frame,
  Gauge,
  Gem,
  Gift,
  Globe,
  Globe2,
  Grid2x2,
  Grid3x3,
  Grip,
  GripVertical,
  Hammer,
  HandCoins,
  Handshake,
  HardHat,
  Headphones,
  Heart,
  HeartHandshake,
  HeartPulse,
  History,
  Home,
  Hourglass,
  House,
  IdCard,
  Image,
  ImageDown,
  ImagePlus,
  Images,
  Inbox,
  Info,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LifeBuoy,
  Lightbulb,
  LineChart,
  Link,
  Link2,
  ListChecks,
  ListFilter,
  Loader2,
  Lock,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MailOpen,
  Map,
  MapPin,
  MapPinned,
  Martini,
  Megaphone,
  Menu,
  MessageCircle,
  MessageSquare,
  MessageSquareWarning,
  Mic,
  Minus,
  MonitorPlay,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Move,
  Music,
  Music2,
  Music4,
  Navigation,
  Network,
  Newspaper,
  NotebookPen,
  Package,
  PaintBucket,
  Paintbrush,
  Palette,
  PanelLeft,
  PanelRight,
  PartyPopper,
  Pause,
  PawPrint,
  PenLine,
  Pencil,
  PencilLine,
  PhilippinePeso,
  Phone,
  PieChart,
  PiggyBank,
  Pin,
  Plane,
  PlaneTakeoff,
  Play,
  Plus,
  Power,
  Printer,
  QrCode,
  Radar,
  Radio,
  Receipt,
  RefreshCw,
  Rocket,
  RotateCcw,
  Route,
  Save,
  Scale,
  ScanLine,
  School,
  Scissors,
  ScrollText,
  Search,
  Send,
  Settings,
  Settings2,
  Shapes,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Signature,
  SlidersHorizontal,
  Snowflake,
  Sofa,
  Sparkles,
  Sprout,
  SquareStack,
  Stamp,
  Star,
  Sticker,
  Store,
  Sun,
  Tag,
  Tags,
  Target,
  Tent,
  TestTube,
  Ticket,
  TicketPercent,
  Timer,
  Trash2,
  Trees,
  TrendingUp,
  Trophy,
  Truck,
  Tv,
  Type,
  Undo2,
  Upload,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
  UsersRound,
  Utensils,
  UtensilsCrossed,
  Video,
  Wallet,
  WandSparkles,
  Warehouse,
  WifiOff,
  Wine,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** What an icon component is. Today lucide's; when the set changes, this line changes with it. */
export type IconComponent = LucideIcon;

/**
 * Every glyph the app can draw through the map, by a set-independent name (lucide's own kebab name
 * today). Registry overrides and taxonomy rows may name any glyph listed in legacy-icon-names.ts.
 */
export const GLYPHS = {
  accessibility: Accessibility,
  activity: Activity,
  'alert-circle': AlertCircle,
  'alert-octagon': AlertOctagon,
  'alert-triangle': AlertTriangle,
  aperture: Aperture,
  'app-window': AppWindow,
  apple: Apple,
  archive: Archive,
  armchair: Armchair,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-down': ArrowUpDown,
  'arrow-up-right': ArrowUpRight,
  'at-sign': AtSign,
  award: Award,
  baby: Baby,
  'badge-check': BadgeCheck,
  'badge-percent': BadgePercent,
  ban: Ban,
  banknote: Banknote,
  'bar-chart-2': BarChart2,
  'bar-chart-3': BarChart3,
  bed: Bed,
  bell: Bell,
  'bell-ring': BellRing,
  bird: Bird,
  blocks: Blocks,
  'book-open': BookOpen,
  'book-user': BookUser,
  bookmark: Bookmark,
  bot: Bot,
  boxes: Boxes,
  brain: Brain,
  briefcase: Briefcase,
  'briefcase-business': BriefcaseBusiness,
  brush: Brush,
  bug: Bug,
  building: Building,
  'building-2': Building2,
  bus: Bus,
  cake: Cake,
  'cake-slice': CakeSlice,
  calculator: Calculator,
  calendar: Calendar,
  'calendar-check': CalendarCheck,
  'calendar-clock': CalendarClock,
  'calendar-days': CalendarDays,
  'calendar-heart': CalendarHeart,
  'calendar-range': CalendarRange,
  'calendar-search': CalendarSearch,
  camera: Camera,
  car: Car,
  check: Check,
  'check-check': CheckCheck,
  'check-circle-2': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  church: Church,
  circle: Circle,
  'circle-check': CircleCheck,
  'circle-user': CircleUser,
  clapperboard: Clapperboard,
  'clipboard-check': ClipboardCheck,
  'clipboard-list': ClipboardList,
  clock: Clock,
  cloud: Cloud,
  'cloud-upload': CloudUpload,
  coffee: Coffee,
  coins: Coins,
  'columns-2': Columns2,
  compass: Compass,
  component: Component,
  contact: Contact,
  copy: Copy,
  cpu: Cpu,
  'credit-card': CreditCard,
  crown: Crown,
  'disc-3': Disc3,
  'dollar-sign': DollarSign,
  'door-open': DoorOpen,
  dot: Dot,
  download: Download,
  'external-link': ExternalLink,
  eye: Eye,
  'eye-off': EyeOff,
  factory: Factory,
  file: File,
  'file-check': FileCheck,
  'file-signature': FileSignature,
  'file-text': FileText,
  files: Files,
  film: Film,
  filter: Filter,
  fingerprint: Fingerprint,
  flag: Flag,
  flame: Flame,
  flower: Flower,
  'flower-2': Flower2,
  folder: Folder,
  'folder-open': FolderOpen,
  footprints: Footprints,
  frame: Frame,
  gauge: Gauge,
  gem: Gem,
  gift: Gift,
  globe: Globe,
  'globe-2': Globe2,
  'grid-2x2': Grid2x2,
  'grid-3x3': Grid3x3,
  grip: Grip,
  'grip-vertical': GripVertical,
  hammer: Hammer,
  'hand-coins': HandCoins,
  handshake: Handshake,
  'hard-hat': HardHat,
  headphones: Headphones,
  heart: Heart,
  'heart-handshake': HeartHandshake,
  'heart-pulse': HeartPulse,
  history: History,
  home: Home,
  hourglass: Hourglass,
  house: House,
  'id-card': IdCard,
  image: Image,
  'image-down': ImageDown,
  'image-plus': ImagePlus,
  images: Images,
  inbox: Inbox,
  info: Info,
  'key-round': KeyRound,
  landmark: Landmark,
  languages: Languages,
  layers: Layers,
  'layout-dashboard': LayoutDashboard,
  'layout-grid': LayoutGrid,
  'layout-list': LayoutList,
  'life-buoy': LifeBuoy,
  lightbulb: Lightbulb,
  'line-chart': LineChart,
  link: Link,
  'link-2': Link2,
  'list-checks': ListChecks,
  'list-filter': ListFilter,
  'loader-2': Loader2,
  lock: Lock,
  'lock-keyhole': LockKeyhole,
  'log-in': LogIn,
  'log-out': LogOut,
  mail: Mail,
  'mail-open': MailOpen,
  map: Map,
  'map-pin': MapPin,
  'map-pinned': MapPinned,
  martini: Martini,
  megaphone: Megaphone,
  menu: Menu,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'message-square-warning': MessageSquareWarning,
  mic: Mic,
  minus: Minus,
  'monitor-play': MonitorPlay,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  move: Move,
  music: Music,
  'music-2': Music2,
  'music-4': Music4,
  navigation: Navigation,
  network: Network,
  newspaper: Newspaper,
  'notebook-pen': NotebookPen,
  package: Package,
  'paint-bucket': PaintBucket,
  paintbrush: Paintbrush,
  palette: Palette,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  'party-popper': PartyPopper,
  pause: Pause,
  'paw-print': PawPrint,
  'pen-line': PenLine,
  pencil: Pencil,
  'pencil-line': PencilLine,
  'philippine-peso': PhilippinePeso,
  phone: Phone,
  'pie-chart': PieChart,
  'piggy-bank': PiggyBank,
  pin: Pin,
  plane: Plane,
  'plane-takeoff': PlaneTakeoff,
  play: Play,
  plus: Plus,
  power: Power,
  printer: Printer,
  'qr-code': QrCode,
  radar: Radar,
  radio: Radio,
  receipt: Receipt,
  'refresh-cw': RefreshCw,
  rocket: Rocket,
  'rotate-ccw': RotateCcw,
  route: Route,
  save: Save,
  scale: Scale,
  'scan-line': ScanLine,
  school: School,
  scissors: Scissors,
  'scroll-text': ScrollText,
  search: Search,
  send: Send,
  settings: Settings,
  'settings-2': Settings2,
  shapes: Shapes,
  'share-2': Share2,
  shield: Shield,
  'shield-alert': ShieldAlert,
  'shield-check': ShieldCheck,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  signature: Signature,
  'sliders-horizontal': SlidersHorizontal,
  snowflake: Snowflake,
  sofa: Sofa,
  sparkles: Sparkles,
  sprout: Sprout,
  'square-stack': SquareStack,
  stamp: Stamp,
  star: Star,
  sticker: Sticker,
  store: Store,
  sun: Sun,
  tag: Tag,
  tags: Tags,
  target: Target,
  tent: Tent,
  'test-tube': TestTube,
  ticket: Ticket,
  'ticket-percent': TicketPercent,
  timer: Timer,
  'trash-2': Trash2,
  trees: Trees,
  'trending-up': TrendingUp,
  trophy: Trophy,
  truck: Truck,
  tv: Tv,
  type: Type,
  'undo-2': Undo2,
  upload: Upload,
  user: User,
  'user-check': UserCheck,
  'user-cog': UserCog,
  'user-plus': UserPlus,
  'user-x': UserX,
  users: Users,
  'users-round': UsersRound,
  utensils: Utensils,
  'utensils-crossed': UtensilsCrossed,
  video: Video,
  wallet: Wallet,
  'wand-sparkles': WandSparkles,
  warehouse: Warehouse,
  'wifi-off': WifiOff,
  wine: Wine,
  wrench: Wrench,
  x: X,
  zap: Zap,
} as const satisfies Record<string, IconComponent>;

/** A glyph's name in this file — the set-independent name a component or a stored row uses. */
export type GlyphName = keyof typeof GLYPHS;

/**
 * Semantic ROLES — what a component means, not what it draws. Add a role when a new JOB needs an
 * icon; point it at an existing glyph (or add the glyph above). Two roles may share a glyph today.
 */
export const ICONS = {
  home: 'house', // the event Home tab
  guests: 'book-user', // the Guests tab
  suppliers: 'store', // the Suppliers tab
  hub: 'app-window', // the Event Hub tab
  more: 'grip', // the More tab
  people: 'users', // a group of people
  person: 'user', // one person
  add: 'plus', // add / create
  close: 'x', // close / dismiss
  done: 'check', // done / confirmed
  'done-circle': 'check-circle-2', // done, in a ring
  verified: 'badge-check', // verified
  back: 'arrow-left', // back
  forward: 'arrow-right', // forward / continue
  next: 'chevron-right', // go into a row
  previous: 'chevron-left', // go back a step
  expand: 'chevron-down', // open a fold
  collapse: 'chevron-up', // close a fold
  external: 'external-link', // opens outside
  delete: 'trash-2', // delete
  edit: 'pencil', // edit
  search: 'search', // search
  filter: 'list-filter', // filter
  adjust: 'sliders-horizontal', // adjust / settings of a view
  settings: 'settings', // settings
  loading: 'loader-2', // working (spins)
  info: 'info', // information
  warning: 'alert-triangle', // warning
  error: 'alert-circle', // error
  ai: 'sparkles', // Setnayan AI
  polish: 'sparkles', // polish / Pro — today the same glyph as ai; Carbon splits them (magic-wand)
  camera: 'camera', // camera / Papic
  photos: 'images', // photos
  video: 'video', // video
  music: 'music', // music
  calendar: 'calendar-days', // a date
  time: 'clock', // a time
  location: 'map-pin', // a place
  lock: 'lock', // locked
  view: 'eye', // show
  hide: 'eye-off', // hide
  download: 'download', // download
  upload: 'upload', // upload
  share: 'share-2', // share
  copy: 'copy', // copy
  send: 'send', // send
  chat: 'message-square', // a conversation
  notifications: 'bell', // notifications
  gift: 'gift', // a gift
  wallet: 'wallet', // money held / budget
  money: 'banknote', // a payment
  receipt: 'receipt', // a receipt
  star: 'star', // a rating / favourite
  heart: 'heart', // love / save
  checklist: 'list-checks', // the checklist
  print: 'printer', // print
  qr: 'qr-code', // a QR code
  undo: 'undo-2', // undo
  refresh: 'refresh-cw', // refresh
  reset: 'rotate-ccw', // start over
  play: 'play', // play
  pause: 'pause', // pause
  live: 'radio', // live broadcast
  party: 'party-popper', // a celebration
  palette: 'palette', // colours / mood board
  shield: 'shield-check', // safe / protected
  phone: 'phone', // a phone number
  email: 'mail', // an email
  link: 'link-2', // a link
  globe: 'globe', // public / web
  grid: 'layout-grid', // a grid view
  menu: 'menu', // a menu
  overflow: 'more-horizontal', // more actions
  drag: 'grip-vertical', // drag to reorder
  empty: 'circle', // an empty ring / unknown icon
} as const satisfies Record<string, GlyphName>;

/** A semantic icon name — what `<Icon name>` takes. */
export type IconName = keyof typeof ICONS;

/** The component for a semantic role. */
export function iconFor(name: IconName): IconComponent {
  return GLYPHS[ICONS[name]];
}

/** The component for a glyph name, or null when the name is not in the map. */
export function glyphComponent(name: string | null | undefined): IconComponent | null {
  if (!name) return null;
  return Object.prototype.hasOwnProperty.call(GLYPHS, name) ? GLYPHS[name as GlyphName] : null;
}
