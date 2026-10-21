import { Heart } from "lucide-react";

// Footer gaya shadcnstore template (site-footer.tsx)
export function SiteFooter() {
  return (
    <footer className="no-print border-t bg-background">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Made with</span>
            <Heart className="size-4 fill-destructive text-destructive" />
            <span>for</span>
            <a href="https://mainkekudus.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground transition-colors hover:text-primary">
              Main ke Kudus
            </a>
          </div>
          <p className="text-xs text-muted-foreground">Monthly report for Website · News · YouTube · Social Media</p>
        </div>
      </div>
    </footer>
  );
}
