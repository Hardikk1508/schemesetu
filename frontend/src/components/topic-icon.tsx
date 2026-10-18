import {
  Briefcase,
  GraduationCap,
  HandHeart,
  Heart,
  HeartPulse,
  House,
  type LucideIcon,
  PiggyBank,
  Sparkles,
  Store,
  Wheat,
} from "lucide-react";

// Topic icons are named in backend/app/data/schemes.json.
const ICONS: Record<string, LucideIcon> = {
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  store: Store,
  wheat: Wheat,
  heart: Heart,
  "hand-heart": HandHeart,
  "heart-pulse": HeartPulse,
  house: House,
  "piggy-bank": PiggyBank,
};

export function TopicIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}
