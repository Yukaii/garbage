import { LogoSVG } from './LogoSVG';

export function Logo({ className = "", size = 120 }: { className?: string; size?: number }) {
  return <LogoSVG className={className} size={size} />;
}

export function LogoWithText({ size = 120 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Logo size={size} />
      <div className="text-center">
        <h1>垃圾車地圖</h1>
        <p className="text-muted-foreground">Garbage Collection Map</p>
      </div>
    </div>
  );
}
